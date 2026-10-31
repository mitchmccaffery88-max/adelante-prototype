// Mitch, 30 Oct. Draft — pending clinical sign-off (Christi / Dr. Bagga).
import { describe, it, expect } from "vitest";
import "@/lib/ehr-ext";
import "@/lib/chartActions";
import { AdelanteEHR } from "@/lib/ehr";
import { screenerByKey } from "@/lib/screeners";
import { STAFF_ROSTER } from "@/lib/roles";
import { scoreAnsweredScreener, DECLINED_ANSWER, staffItemsRecorded, itemDisplay, phq9Item9Positive } from "@/lib/screenerCompleteness";
import { followupOwner, followupDue } from "@/lib/screenerFollowup";
import { recordMemberScreenerAnswers } from "@/lib/screenerIntake";
import { evaluateSeverity } from "@/lib/severityRules";
function def(key: string) { const d = screenerByKey(key); if (!d) throw new Error(key); return d; }
describe("R5 follow-up Draft rules", () => {
  it.each([1, 2])("PHQ-9 with %i blanks estimates the rounded mean times 9", (missing) => {
    const answers = Array.from({length:9}, (_, i) => i < missing ? null : 2);
    const r = scoreAnsweredScreener(def("phq-9"), answers);
    expect(r.scored?.score).toBe(18); expect(r.estimated).toBe(true);
    expect(r.assessment.responses.slice(0, missing)).toEqual(Array(missing).fill(null));
  });
  it("PHQ-9 with 3 blanks has neither total nor severity", () => {
    const r = scoreAnsweredScreener(def("phq-9"), [null,null,null,3,3,3,3,3,0]);
    expect(r.scored).toBeUndefined(); expect(r.estimated).toBe(false);
  });
  it("GAD-7 with one blank estimates, with two stays incomplete", () => {
    expect(scoreAnsweredScreener(def("gad-7"), [null,1,1,1,1,1,2]).scored?.score).toBe(8);
    expect(scoreAnsweredScreener(def("gad-7"), [null,1,1,1,1,1,2]).estimated).toBe(true);
    expect(scoreAnsweredScreener(def("gad-7"), [null,null,1,1,1,1,2]).scored).toBeUndefined();
  });
  it.each(["phq-2", "gad-2", "audit", "dast-10", "pc-ptsd-5", "cssrs", "ahc-hrsn"])("%s never prorates", (key) => {
    const d = def(key); const answers = d.questions.map(() => 1); answers[answers.length-1] = null as unknown as number;
    const r = scoreAnsweredScreener(d, answers); expect(r.scored).toBeUndefined(); expect(r.estimated).toBe(false);
  });
  it("item 9 remains null and cannot trip crisis from an estimated total", () => {
    const r = scoreAnsweredScreener(def("phq-9"), [3,3,3,3,3,3,3,3,null]);
    expect(r.scored?.score).toBe(27); expect(r.assessment.responses[8]).toBeNull();
    expect(phq9Item9Positive("phq-9", r.assessment.responses)).toBe(false);
    expect(phq9Item9Positive("phq-9", [0,0,0,0,0,0,0,0,1])).toBe(true);
  });
  it("owner is primary clinician, on-call clinician, then coordinator; never case manager", () => {
    const primary = STAFF_ROSTER.find(m => m.role === "therapist"); const onCall = STAFF_ROSTER.find(m => m.role === "pmhnp");
    const cm = STAFF_ROSTER.find(m => m.role === "ecm_provider");
    expect(primary).toBeDefined(); expect(onCall).toBeDefined(); expect(cm).toBeDefined();
    expect(followupOwner(primary,onCall).assignedTo).toBe(primary?.id);
    expect(followupOwner(cm,onCall).assignedTo).toBe(onCall?.id);
    expect(followupOwner(undefined,cm)).toEqual({assignedTo:"",allowedRoles:["clinical_coordinator"]});
  });
  it("uses the earliest booked contact within seven days", () => {
    expect(followupDue(new Date("2026-10-30T12:00:00Z"), [
      { start:"2026-11-03T12:00:00Z", status:"scheduled" }, { start:"2026-11-02T12:00:00Z", status:"checked_in" },
      { start:"2026-10-31T12:00:00Z", status:"cancelled" },
    ])).toEqual({dueDate:"2026-11-02T12:00:00Z",taskType:"screening_followup"});
  });
  it("a contact beyond seven days uses two business days outreach, excluding weekends", () => {
    expect(followupDue(new Date("2026-10-30T12:00:00Z"), [{start:"2026-11-07T12:00:00Z",status:"scheduled"}]))
      .toEqual({dueDate:"2026-11-03T12:00:00.000Z",taskType:"screening_outreach"});
    expect(followupDue(new Date("2026-10-31T12:00:00Z"), []).dueDate).toBe("2026-11-03T12:00:00.000Z");
  });
  it("stores declined versus skipped separately; both remain unanswered", () => {
    const p = AdelanteEHR.listPatients().find(p => !p.crisisFlag); if (!p) throw new Error("fixture missing");
    const r = recordMemberScreenerAnswers(p.id,def("phq-9"),[DECLINED_ANSWER,null,1,1,1,1,1,1,0],{timepoint:"adhoc",context:"patient_self"});
    expect(r.responses?.slice(0,2)).toEqual([null,null]); expect(r.declinedItems).toEqual([0]); expect(r.skippedItems).toEqual([1]);
    expect(itemDisplay(r,0)).toBe("Declined"); expect(itemDisplay(r,1)).toBe("Not answered");
    expect("estimated" in r && r.estimated).toBe(true);
    expect(AdelanteEHR.getPatient(p.id)?.screenerHistory?.at(-1)).toBe(r);
  });
  it("staff entry requires every shown item answered or explicitly declined", () => {
    expect(staffItemsRecorded(def("dast-10"), [1,1,1,1,1,1,1,1,1,null])).toBe(false);
    expect(staffItemsRecorded(def("dast-10"), [1,1,1,1,1,1,1,1,1,DECLINED_ANSWER])).toBe(true);
  });
  it("three missing PHQ-9 items cannot trigger severity or replace the scored result", () => {
    const p = AdelanteEHR.listPatients().find(p => !p.crisisFlag); if (!p) throw new Error("fixture missing");
    const before = p.screeners["phq-9"]; const count = p.severityFlags?.length ?? 0;
    const r = recordMemberScreenerAnswers(p.id,def("phq-9"),[null,null,null,3,3,3,3,3,0],{timepoint:"adhoc",context:"patient_self"});
    expect("status" in r && r.status).toBe("incomplete"); expect("score" in r).toBe(false);
    expect(p.screeners["phq-9"]).toBe(before); expect(p.severityFlags?.length ?? 0).toBe(count);
    const estimated = {key:"phq-9",score:24,severity:"Severe",completedAt:new Date().toISOString(),estimated:true,missingItems:[7]};
    expect(evaluateSeverity(undefined,estimated)?.kind).toBe("flag");
  });
});
