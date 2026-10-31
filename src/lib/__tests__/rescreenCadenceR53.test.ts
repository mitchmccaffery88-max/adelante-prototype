// Mitch, 31 Oct. Draft — pending clinical sign-off.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCREENER_CADENCE } from "../screeners";
import { autoInstrumentAllowed, automaticBundle, cadenceDue, cadenceInterval, lastScoredAt, promptSurfaceAt } from "../rescreenCadence";
import { AdelanteEHR, type Patient } from "../ehr";
import { runAction } from "../actions/runAction";
import { followupOwner, screenerFollowupActor } from "../screenerFollowup";
import { STAFF_ROSTER } from "../roles";
const DAY = 86400000;
const now = Date.parse("2026-10-31T18:00:00Z");
function member(): Patient {
  const base = AdelanteEHR.listPatients()[0];
  if (!base) throw new Error("Existing member fixture missing");
  return { ...base, id: "cadence-projection", releaseDate: "", intakeCompletedAt: "2026-01-01", screeners: {}, screenerHistory: [
    { key: "phq-9", score: 0, severity: "Minimal", completedAt: new Date(now-40*DAY).toISOString() },
    { key: "gad-7", score: 0, severity: "Minimal", completedAt: new Date(now-40*DAY).toISOString() },
  ], tasks: [] };
}
afterEach(() => vi.useRealTimers());
describe("R53 configured last-scored cadence", () => {
  it.each([["phq-9",30],["gad-7",30],["audit",90],["dast-10",90],["pc-ptsd-5",90],["ahc-hrsn",180]])("%s interval is %i days", (key,days) => {
    expect(cadenceInterval(String(key), undefined, now)).toBe(days);
    expect(SCREENER_CADENCE[key as keyof typeof SCREENER_CADENCE].note).toBe("Draft — pending clinical sign-off");
  });
  it.each(["audit","dast-10"])("%s needs both SUD flag and consent for auto-prompt", key => {
    expect(autoInstrumentAllowed(key,true,true)).toBe(true);
    expect(autoInstrumentAllowed(key,false,true)).toBe(false);
    expect(autoInstrumentAllowed(key,true,false)).toBe(false);
    expect(autoInstrumentAllowed(key,false,false)).toBe(false);
  });
  it("HRSN uses 90 days during reentry and 180 after day 90 or absent release", () => {
    expect(cadenceInterval("ahc-hrsn", new Date(now-89*DAY).toISOString(),now)).toBe(90);
    expect(cadenceInterval("ahc-hrsn", new Date(now-90*DAY).toISOString(),now)).toBe(180);
    expect(cadenceInterval("ahc-hrsn",undefined,now)).toBe(180);
  });
  it("C-SSRS and short checks never enter automatic cadence", () => {
    for (const key of ["c-ssrs-screener","phq-2","gad-2"]) expect(autoInstrumentAllowed(key,true,true)).toBe(false);
  });
  it("incomplete does not reset clock; estimated does", () => {
    const p = member();
    expect(lastScoredAt("phq-9",[...(p.screenerHistory ?? []),{key:"phq-9",completedAt:new Date(now).toISOString(),completeness:"incomplete"}])).toBe(now-40*DAY);
    expect(cadenceDue(p,now).map(d=>d.key)).toContain("phq-9");
    p.screenerHistory?.push({key:"phq-9",score:9,severity:"Mild",estimated:true,completeness:"estimated",completedAt:new Date(now).toISOString()});
    expect(cadenceDue(p,now).map(d=>d.key)).not.toContain("phq-9");
  });
  it("bundles all due instruments in one prompt", () => expect(automaticBundle(member(),now,[],false,false)).toEqual(["phq-9","gad-7"]));
  it("seven-day cap includes completed automatic prompts", () => {
    const p=member(); p.tasks=[{id:"prior",kind:"rescreen",label:"Screening follow-up needed",screenerKey:"phq-9",automaticRescreen:true,createdAt:new Date(now-6*DAY).toISOString(),completedAt:new Date(now-5*DAY).toISOString()}];
    expect(automaticBundle(p,now,[],false,false)).toEqual([]);
    p.tasks[0].createdAt=new Date(now-7*DAY).toISOString();
    expect(automaticBundle(p,now,[],false,false)).toEqual(["phq-9","gad-7"]);
  });
  it("recent scored intake result within 14 days is excluded", () => {
    const p=member(); p.screeners["phq-9"]={key:"phq-9",score:0,severity:"Minimal",completedAt:new Date(now-13*DAY).toISOString(),context:"intake"};
    expect(automaticBundle(p,now,[],false,false)).toEqual(["gad-7"]);
  });
  it("aligns to two days before a visit in seven days, never past the visit", () => {
    expect(promptSurfaceAt(now,[{start:new Date(now+6*DAY).toISOString(),status:"scheduled"}])).toBe(now+4*DAY);
    expect(promptSurfaceAt(now,[{start:new Date(now+DAY).toISOString(),status:"scheduled"}])).toBe(now);
    expect(promptSurfaceAt(now,[{start:new Date(now+8*DAY).toISOString(),status:"scheduled"}])).toBe(now);
  });
  it("owner fallback primary → on-call → coordinator, never case manager", () => {
    const therapist=STAFF_ROSTER.find(m=>m.role==="therapist"); const call=STAFF_ROSTER.find(m=>m.role==="pmhnp"); const cm=STAFF_ROSTER.find(m=>m.role==="ecm_provider");
    if(!therapist || !call || !cm) throw new Error("Existing roles missing");
    expect(followupOwner(therapist,call).assignedTo).toBe(therapist.id);
    expect(followupOwner(cm,call).assignedTo).toBe(call.id);
    expect(followupOwner(undefined,cm)).toEqual({assignedTo:"",allowedRoles:["clinical_coordinator"]});
  });
  it("registry creates one bundle, day 3/7 neutral in-app reminders and one day 10 task per member", () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const base=AdelanteEHR.listPatients().find(p=>p.intakeCompletedAt);
    if(!base) throw new Error("Member fixture missing");
    // Real store writers, no seed mutation or permission changes.
    for(const key of ["phq-9","gad-7"]) AdelanteEHR.recordScreener(base.id,{key,score:0,severity:"Minimal",completedAt:new Date(now-400*DAY).toISOString()});
    AdelanteEHR.sendRescreenTask(base.id,"phq-9"); AdelanteEHR.sendRescreenTask(base.id,"gad-7");
    const created=AdelanteEHR.patientReassessmentDue(base.id).filter(d=>["phq-9","gad-7"].includes(d.key));
    expect(created).toHaveLength(2);
    for(const day of [3,7]) {
      vi.setSystemTime(now+day*DAY);
      const ops=AdelanteEHR.automaticRescreenOperations(base.id,now+day*DAY).filter(o=>o.kind==="reminder");
      expect(ops.length).toBeGreaterThanOrEqual(2);
      for(const op of ops) expect(runAction("screener_item9_followup",screenerFollowupActor,base,{via:"runAutomaticRescreenStep",args:[base.id,op,new Date(now+day*DAY).toISOString(),screenerFollowupActor]}).ok).toBe(true);
      const notices=AdelanteEHR.listMemberNotifications("patient",base.id).filter(n=>n.dedupeKey?.startsWith("rescreen-reminder:"));
      expect(notices.some(n=>n.subject==="You have a short check-in waiting.")).toBe(true);
      expect(AdelanteEHR.automaticRescreenOperations(base.id,now+day*DAY).filter(o=>o.kind==="reminder")).toHaveLength(0);
    }
    vi.setSystemTime(now+10*DAY);
    for(let i=0;i<3;i++) for(const op of AdelanteEHR.automaticRescreenOperations(base.id,now+10*DAY).filter(o=>o.kind==="followup")) {
      expect(runAction("screener_item9_followup",screenerFollowupActor,base,{via:"runAutomaticRescreenStep",args:[base.id,op,new Date(now+10*DAY).toISOString(),screenerFollowupActor]}).ok).toBe(true);
    }
    const tasks=AdelanteEHR.caseTasksForPatient(base.id).filter(t=>t.taskType==="rescreen_followup");
    expect(tasks).toHaveLength(1); expect(tasks[0].title).toBe("Screening follow-up needed"); expect(tasks[0].detail).toBe("Screening follow-up needed");
  });
  it("staff request bypasses cap/alignment and scored completion restarts clock", () => {
    vi.useFakeTimers();vi.setSystemTime(now);
    const p=AdelanteEHR.listPatients().find(p=>p.intakeCompletedAt); if(!p)throw new Error("fixture");
    AdelanteEHR.sendRescreenTask(p.id,"gad-7");
    expect(AdelanteEHR.patientReassessmentDue(p.id).some(d=>d.key==="gad-7")).toBe(true);
    AdelanteEHR.completeRescreen(p.id,"gad-7",[0,0,0,0,0,0,0],{actorId:p.id,actorRole:"patient"});
    expect(AdelanteEHR.patientReassessmentDue(p.id).some(d=>d.key==="gad-7")).toBe(false);
    expect(AdelanteEHR.rescreensDue(p.id).some(d=>d.key==="gad-7")).toBe(false);
  });
});