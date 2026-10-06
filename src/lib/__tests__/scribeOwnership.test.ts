// Ownership fix — dictation-only roles may dictate only on their own contacts.
import "@/test/freezeClock";
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { _resetAfbi, getAfbiContact, reassignAfbiContact, recordAfbiContact } from "@/lib/afbiOutreach";
import {
  _resetScribe, confirmAiReview, deleteAiSentence, keepAiSentence, openAiDraft, createDictationDraft, dictationBlocker, grantAiRecordingConsent, OWN_CONTACT_BLOCK,
  saveAfbiFromScribe, type ScribeActor, type ScribeSession,
} from "@/lib/scribe";

const PEER: ScribeActor = { name: "Andre Willis", role: "peer_specialist", staffId: "s-peer1" };
const OTHER_PEER: ScribeActor = { name: "Trey Wilson", role: "peer_specialist", staffId: "s-peer2" };
const ECM: ScribeActor = { name: "Luz Herrera", role: "ecm_provider", staffId: "s-cm1" };

let n = 0;
function patientWithConsent() {
  const p = AdelanteEHR.createPatient({ firstName: "Own", lastName: `C${++n}${Math.random().toString(36).slice(2, 5)}` } as never) as { id: string };
  grantAiRecordingConsent({ patientId: p.id, signedByName: "O C", attested: true, part2: true, capturedBy: { staffName: "x", role: "therapist" } });
  return p.id;
}
function contactVisit(pid: string, assignedStaffId: string, day: number) {
  return AdelanteEHR.bookAppointment({
    patientId: pid, clinicianId: "c1", start: new Date(Date.UTC(2026, 8, 20 + day, 17)).toISOString(), durationMin: 30,
    serviceType: "peer_support", modality: "phone", assignedStaffId, allowPatientOverlap: true,
  } as never) as { id: string };
}

beforeEach(() => { _resetScribe(); _resetAfbi(); });

describe("ownership — contact-note dictation", () => {
  it("own visit (assigned staff) is allowed", () => {
    const pid = patientWithConsent();
    const a = contactVisit(pid, PEER.staffId!, 1);
    expect(dictationBlocker({ actor: PEER, target: "note", patientId: pid, appointmentId: a.id })).toBeNull();
  });

  it("a colleague's visit is blocked — in the rights check AND through the registry action", () => {
    const pid = patientWithConsent();
    const a = contactVisit(pid, OTHER_PEER.staffId!, 2);
    expect(dictationBlocker({ actor: PEER, target: "note", patientId: pid, appointmentId: a.id })?.reason).toBe(OWN_CONTACT_BLOCK);
    expect(() => createDictationDraft({ actor: PEER, target: "note", patientId: pid, appointmentId: a.id })).toThrow(OWN_CONTACT_BLOCK);
    const r = runAction("scribe_dictate", { role: "peer_specialist", staffId: PEER.staffId! }, AdelanteEHR.getPatient(pid), {
      args: [{ actor: PEER, target: "note", patientId: pid, appointmentId: a.id }],
    });
    expect(r.ok).toBe(false);
    expect(r.event.action).toBe("action.blocked");
    expect(String(r.event.detail?.["reason"])).toBe(OWN_CONTACT_BLOCK);
  });

  it("applies to every dictation-only role (ECM too)", () => {
    const pid = patientWithConsent();
    const a = contactVisit(pid, PEER.staffId!, 3);
    expect(dictationBlocker({ actor: ECM, target: "note", patientId: pid, appointmentId: a.id })?.reason).toBe(OWN_CONTACT_BLOCK);
  });

  it("a contact-role booker becomes the visit's assigned staff", () => {
    const pid = patientWithConsent();
    const a = AdelanteEHR.bookAppointment({
      patientId: pid, clinicianId: "c1", start: new Date(Date.UTC(2026, 8, 25, 17)).toISOString(), durationMin: 30,
      serviceType: "case_management", modality: "phone", allowPatientOverlap: true,
    } as never) as { id: string; assignedStaffId?: string };
    expect(a.assignedStaffId).toBeUndefined();
  });
});

describe("ownership — AFBI contacts", () => {
  it("only the recorder can dictate onto a contact; a coordinator reassignment transfers it", () => {
    const c = recordAfbiContact({ role: "peer_specialist", name: OTHER_PEER.name, staffId: OTHER_PEER.staffId }, {
      locationType: AFBI_LOC(), initials: "JR", activities: [AFBI_ACT()], minutes: 15, outcome: AFBI_OUT(),
    });
    expect(dictationBlocker({ actor: PEER, target: "afbi", afbiContactId: c.id })?.reason).toBe(OWN_CONTACT_BLOCK);
    expect(dictationBlocker({ actor: OTHER_PEER, target: "afbi", afbiContactId: c.id })).toBeNull();
    expect(() => reassignAfbiContact(c.id, { staffId: PEER.staffId!, name: PEER.name, role: "peer_specialist" }, { role: "peer_specialist", name: "x" }, "left")).toThrow(/coordinator/);
    reassignAfbiContact(c.id, { staffId: PEER.staffId!, name: PEER.name, role: "peer_specialist" }, { role: "clinical_coordinator", name: "Priya Raman" }, "Trey on leave");
    expect(dictationBlocker({ actor: PEER, target: "afbi", afbiContactId: c.id })).toBeNull();
    expect(dictationBlocker({ actor: OTHER_PEER, target: "afbi", afbiContactId: c.id })?.reason).toBe(OWN_CONTACT_BLOCK);
    // New owner's reviewed draft updates the same contact (no second contact, still ISL).
    const s = createDictationDraft({ actor: PEER, target: "afbi", afbiContactId: c.id }) as ScribeSession;
    openAiDraft(s.id, PEER);
    for (const x of s.sentences.filter((y) => y.identifying)) deleteAiSentence(s.id, x.id, PEER);
    for (const x of s.sentences.filter((y) => y.unsupported && !y.deleted)) keepAiSentence(s.id, x.id, "I did that myself", PEER);
    confirmAiReview(s.id, PEER, 5);
    const saved = saveAfbiFromScribe(s.id, PEER);
    expect(saved.id).toBe(c.id);
    expect(getAfbiContact(c.id)?.fundingLane).toBe("isl_non_medi_cal");
  });
});

import { AFBI_ACTIVITIES, AFBI_LOCATION_TYPES, AFBI_OUTCOMES } from "@/lib/afbiOutreach";
function AFBI_LOC() { return AFBI_LOCATION_TYPES[0].id; }
function AFBI_ACT() { return AFBI_ACTIVITIES[0].id; }
function AFBI_OUT() { return AFBI_OUTCOMES[0].id; }
