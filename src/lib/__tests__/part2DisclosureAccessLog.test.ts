import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { disclose, listDisclosureLog, patientSharedList, PART2_NOTICE_DRAFT_LABEL, _resetDisclosureLogForTests } from "@/lib/part2Disclosure";
import { recordView, accessEventsFor, ACCESS_LOG_LABEL } from "@/lib/accessLog";
import { AdelanteEHR } from "@/lib/ehr";

const actor = { name: "Dr. Test Person", role: "therapist", staffId: "s-test" };
const noConsentPatient = () =>
  AdelanteEHR.listPatients().find((p) => !AdelanteEHR.isConsentCategoryAuthorized(p.id, "information_sharing_disclosure") && !AdelanteEHR.isConsentCategoryAuthorized(p.id, "legal_part2_disclosure" as never))!;

describe("C1 one disclosure function", () => {
  it("every outbound path calls disclose()", () => {
    const files = ["src/lib/notePdf.ts", "src/lib/printRecord.ts", "src/lib/ehr.ts", "src/lib/dataExchange.ts", "src/lib/outpatientCare.ts", "src/lib/dmcOdsReadiness.ts"];
    for (const f of files) expect(readFileSync(f, "utf8"), f).toMatch(/\bdisclose\(/);
  });
  it("non-SUD disclosures pass through without a notice or log entry", () => {
    _resetDisclosureLogForTests();
    const r = disclose({ patientId: "x", actor, recipient: { name: "Clinic", type: "provider" }, purpose: "care", channel: "record_print", recordClasses: [] });
    expect(r).toEqual({ ok: true });
    expect(listDisclosureLog()).toHaveLength(0);
  });
  it("missing consent blocks with a plain-language reason", () => {
    const p = noConsentPatient();
    const r = disclose({ patientId: p.id, actor, recipient: { name: "Outside Clinic", type: "provider" }, purpose: "treatment", channel: "record_print", recordClasses: ["SUD treatment notes"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/consent/i);
  });
  it("emergency disclosure is allowed, logged and flagged for compliance review", () => {
    _resetDisclosureLogForTests();
    const p = noConsentPatient();
    const r = disclose({ patientId: p.id, actor, recipient: { name: "ER", organization: "Kaweah Health", type: "provider" }, purpose: "medical emergency", channel: "record_print", recordClasses: ["SUD medications"], emergency: { reason: "unresponsive patient" } });
    expect(r.ok).toBe(true);
    const e = listDisclosureLog()[0];
    expect(e.emergency).toBe(true);
    expect(e.complianceReview).toBe("pending");
    const shared = patientSharedList(p.id)[0];
    expect(JSON.stringify(shared)).not.toContain(actor.name);
    expect(JSON.stringify(shared)).not.toMatch(/pending|review/i);
  });
  it("attaches the draft redisclosure notice and never logs content", () => {
    _resetDisclosureLogForTests();
    const r = disclose({ patientId: "p", actor, recipient: { name: "Me", type: "patient" }, purpose: "own copy", channel: "record_print", recordClasses: ["SUD treatment notes"] });
    expect(r.ok && r.notice).toContain(PART2_NOTICE_DRAFT_LABEL);
    const keys = Object.keys(listDisclosureLog()[0]);
    for (const k of ["body", "content", "text", "subjective", "assessment"]) expect(keys).not.toContain(k);
  });
});

describe("C2 record-access log", () => {
  it("collapses same actor/patient/section within 5 minutes and stores no content", () => {
    const t = new Date("2026-10-01T17:00:00Z");
    const base = { actorId: "s-a", actorName: "A", role: "therapist", patientId: "p-acc", kind: "section" as const };
    expect(recordView({ ...base, sectionId: "notes", at: t })).toBe(true);
    expect(recordView({ ...base, sectionId: "notes", at: new Date(+t + 4 * 60000) })).toBe(false);
    expect(recordView({ ...base, sectionId: "meds", at: new Date(+t + 60000) })).toBe(true);
    expect(recordView({ ...base, sectionId: "notes", at: new Date(+t + 6 * 60000) })).toBe(true);
    expect(accessEventsFor("p-acc")).toHaveLength(3);
    expect(ACCESS_LOG_LABEL).toMatch(/immutable storage/);
  });
});
