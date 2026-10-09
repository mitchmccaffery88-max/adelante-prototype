// §Consent workflow (Mitch 9 Oct) — Draft — pending counsel review.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { CHART_ENTRY_ROLES } from "@/lib/chartAccess";
import { STAFF_ROLES, type StaffRole } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { applyFlagJourneys } from "@/lib/flagJourneys";
import { precheckBooking } from "@/lib/bookingFlow";
import {
  sendForms, publishedForm, editForm, submitForLegalReview, approveForm, publishForm, listFormVersions, formsToSign, setChecked, signChecked, declineForm,
  listRequests, listSignedCopies, sweepConsentForms, revokeForm, intakePacketFor, buildIntakePacket, groupConsentGate, GROUP_CONSENT_NEEDED,
  migrateLegacyConsents, retainUntil, textHash, listSimulatedSms, FORM_NOTICE, CARE_IMPACT, sendAdvocateForms, signAdvocateAttestation, advocateFormsToSign,
  reopenForPatient, hasSignedForm, _resetConsentForms, type FormKey,
} from "@/lib/consentForms";

const admin = { role: "sys_admin" as const, name: "Admin" };
const coord = { role: "clinical_coordinator" as const, staffId: "s-coord", name: "Coord" };
let n = 0;
function newPatient(extra: Record<string, unknown> = {}): Patient {
  n += 1;
  const r = AdelanteEHR.createReferral({
    firstName: "Form", lastName: `Signer${n}${Math.random().toString(36).slice(2, 6)}`, dob: `1991-0${(n % 9) + 1}-1${n % 9}`, phone: `55955502${String(n).padStart(2, "0")}`,
    referringAgency: "Test", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization", consentToContact: true, channel: "public", ...extra,
  } as never);
  const pid = AdelanteEHR.enrollReferral(r.id)!;
  applyFlagJourneys(pid);
  return AdelanteEHR.getPatient(pid)!;
}
const signAll = (pid: string, keys: FormKey[]) => {
  for (const k of keys) setChecked(pid, k, true);
  return signChecked({ patientId: pid, signerName: "Form Signer", typedName: "Form Signer" });
};

beforeEach(() => _resetConsentForms());

describe("W1 form library", () => {
  it("seeds 10 forms as published v1 placeholders with counsel pending", () => {
    const keys: FormKey[] = ["hipaa", "telehealth", "portal", "sms", "part2", "group", "po_release", "advocate_patient", "advocate_attestation", "ai_recording"];
    for (const k of keys) {
      const v = publishedForm(k)!;
      expect(v.version).toBe(1);
      expect(v.placeholder).toBe(true);
      expect(v.counsel).toBe("Counsel: pending");
      expect(v.body.en).toMatch(/Placeholder wording — pending counsel/);
    }
    expect(publishedForm("group")!.body.en).toMatch(/not bound by 42 CFR Part 2/);
    expect(publishedForm("group")!.body.en).toMatch(/attended/);
    expect(publishedForm("group")!.body.en).toMatch(/Video groups/);
  });
  it("only published forms can be sent; editing creates a new version; past signatures keep theirs", () => {
    const p = newPatient();
    sendForms({ patientId: p.id, formKeys: ["hipaa"], actor: coord });
    const [copy] = signAll(p.id, ["hipaa"]);
    expect(copy!.version).toBe(1);
    const v2 = editForm("hipaa", { summary: { en: "New summary", es: "Nuevo" } }, admin);
    expect(v2.version).toBe(2);
    expect(v2.status).toBe("draft");
    expect(publishedForm("hipaa")!.version).toBe(1);
    expect(() => approveForm(v2.id, admin)).toThrow(/not legal review/);
    submitForLegalReview(v2.id, admin);
    expect(() => approveForm(v2.id, coord)).toThrow(/sys_admin/);
    approveForm(v2.id, admin);
    expect(listFormVersions("hipaa").find((x) => x.id === v2.id)!.approvedBy).toMatch(/Counsel: pending/);
    publishForm(v2.id, admin);
    expect(publishedForm("hipaa")!.version).toBe(2);
    expect(listSignedCopies(p.id)[0]!.copy.version).toBe(1);
  });
});

describe("W2 send", () => {
  it("every chart-entry role can send; others are refused", () => {
    const p = newPatient();
    for (const role of STAFF_ROLES.map((r) => r.key as StaffRole)) {
      const res = runAction("consent_form_send", { role }, p, { via: "sendForms", args: [{ patientId: p.id, formKeys: ["portal"], actor: { role, name: role } }] });
      expect(res.ok, role).toBe(CHART_ENTRY_ROLES.includes(role));
    }
  });
  it("patient notice and SMS are neutral — no form names", () => {
    const p = newPatient();
    AdelanteEHR.setConsent(p.id, "sms", true);
    sendForms({ patientId: p.id, formKeys: ["part2", "po_release"], actor: coord });
    const sms = listSimulatedSms(p.id);
    expect(sms.at(-1)!.body).toBe(FORM_NOTICE.en);
    expect(sms.at(-1)!.simulated).toBe(true);
    const notes = AdelanteEHR.listNotifications() ?? [];
    for (const nn of (notes as { subject: string; body: string; recipientPatientId?: string }[]).filter((x) => x.recipientPatientId === p.id))
      expect(`${nn.subject} ${nn.body}`).not.toMatch(/Part 2|substance|probation|parole|HIPAA/i);
  });
  it("records sender, time, version and due date", () => {
    const p = newPatient();
    const [r] = sendForms({ patientId: p.id, formKeys: ["telehealth"], actor: coord, dueDays: 5 });
    expect(r!.sentBy.name).toBe("Coord");
    expect(r!.version).toBe(1);
    expect(+new Date(r!.dueAt) - +new Date(r!.sentAt)).toBe(5 * 86_400_000);
  });
});

describe("W3 Forms to sign", () => {
  it("progress count, per-card checkbox, one signature, save/resume, decline recorded", () => {
    const p = newPatient();
    sendForms({ patientId: p.id, formKeys: ["hipaa", "telehealth", "portal"], actor: coord });
    expect(formsToSign(p.id)).toMatchObject({ done: 0, total: 3 });
    setChecked(p.id, "hipaa", true);
    // Resume: state is in the store, not the screen.
    expect(listRequests(p.id).find((r) => r.formKey === "hipaa")!.checked).toBe(true);
    declineForm(p.id, "portal");
    setChecked(p.id, "telehealth", true);
    const copies = signChecked({ patientId: p.id, signerName: "Form Signer" });
    expect(copies).toHaveLength(2);
    expect(formsToSign(p.id)).toMatchObject({ done: 3, total: 3 });
    expect(listRequests(p.id).find((r) => r.formKey === "portal")!.status).toBe("declined");
    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).some((e) => e.action === "consent_form.declined" || (e.detail as { action?: string })?.action === "consent_form.declined")).toBe(true);
  });
  it("Part 2 is its own card naming recipient, what and why; requires a typed name", () => {
    const p = newPatient();
    expect(publishedForm("part2")!.part2).toMatchObject({ recipient: expect.any(String), what: expect.any(String), why: expect.any(String) });
    sendForms({ patientId: p.id, formKeys: ["part2"], actor: coord });
    setChecked(p.id, "part2", true);
    expect(() => signChecked({ patientId: p.id, signerName: "Form Signer" })).toThrow(/Type your full name/);
    signChecked({ patientId: p.id, signerName: "Form Signer", typedName: "Form Signer" });
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);
  });
  it("in-person mode records channel and proxy signer relationship", () => {
    const p = newPatient();
    sendForms({ patientId: p.id, formKeys: ["telehealth"], actor: coord });
    setChecked(p.id, "telehealth", true);
    const [c] = signChecked({ patientId: p.id, signerName: "Ana Guardian", relationship: "guardian", channel: "in_person", language: "es" });
    expect(c).toMatchObject({ channel: "in_person", relationship: "guardian", language: "es", signerName: "Ana Guardian" });
    expect(c!.fullText).toMatch(/Telesalud/);
  });
});

describe("W4 tracking", () => {
  it("Sent → Viewed → Signed; unsigned after 3 days raises one sender task", () => {
    const p = newPatient();
    const sentAt = new Date(Date.now() - 4 * 86_400_000).toISOString();
    sendForms({ patientId: p.id, formKeys: ["portal"], actor: coord, now: sentAt });
    expect(listRequests(p.id)[0]!.status).toBe("sent");
    sweepConsentForms();
    sweepConsentForms();
    const tasks = AdelanteEHR.listNotifications() as unknown as { taskKey?: string; subject: string; body: string }[];
    const mine = (tasks ?? []).filter((t) => t.taskKey === `consent-unsigned:${listRequests(p.id)[0]!.id}`);
    expect(mine).toHaveLength(1);
    expect(`${mine[0]!.subject} ${mine[0]!.body}`).not.toMatch(/portal|HIPAA|Part 2/i);
    setChecked(p.id, "portal", true);
    expect(listRequests(p.id)[0]!.status).toBe("viewed");
    signChecked({ patientId: p.id, signerName: "Form Signer" });
    expect(listRequests(p.id)[0]!.status).toBe("signed");
  });
  it("forms with an end date raise a renewal task 30 days out", () => {
    const p = newPatient();
    sendForms({ patientId: p.id, formKeys: ["po_release"], actor: coord });
    setChecked(p.id, "po_release", true);
    const at = new Date(Date.now() - 340 * 86_400_000).toISOString();
    const [c] = signChecked({ patientId: p.id, signerName: "Form Signer", typedName: "Form Signer", at });
    sweepConsentForms();
    const tasks = (AdelanteEHR.listNotifications() ?? []) as unknown as { taskKey?: string }[];
    expect(tasks.some((t) => t.taskKey === `consent-renew:${c!.id}`)).toBe(true);
  });
});

describe("W5 store", () => {
  it("signed copy is immutable with version, language, hash, method, signer; retainUntil 10 years after end", () => {
    const p = newPatient();
    sendForms({ patientId: p.id, formKeys: ["sms"], actor: coord });
    const [c] = signAll(p.id, ["sms"]);
    expect(Object.isFrozen(c)).toBe(true);
    expect(() => { (c as { version: number }).version = 9; }).toThrow();
    expect(c!.textHash).toBe(textHash(c!.fullText));
    expect(c).toMatchObject({ version: 1, language: "en", signatureMethod: "checkbox", signerName: "Form Signer", sentBy: "Coord" });
    revokeForm({ patientId: p.id, formKey: "sms", by: "patient" });
    const row = listSignedCopies(p.id)[0]!;
    expect(row.ended!.reason).toBe("revoked");
    expect(row.retainUntil).toBe(retainUntil(row.ended!.endedAt));
    expect(Number(row.retainUntil!.slice(0, 4)) - Number(row.ended!.endedAt.slice(0, 4))).toBe(10);
    expect(row.copy.fullText).toMatch(/Text reminders/);
  });
  it("legacy intake booleans migrate into one ledger entry (source intake (legacy))", () => {
    const p = newPatient();
    AdelanteEHR.setConsent(p.id, "sms", true);
    expect(AdelanteEHR.listConsentRecords(p.id)).toHaveLength(0);
    expect(migrateLegacyConsents(p.id)).toBe(true);
    const recs = AdelanteEHR.listConsentRecords(p.id);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.source).toBe("intake (legacy)");
    expect(migrateLegacyConsents(p.id)).toBe(false);
  });
});

describe("W6 revoke", () => {
  it("patient revoke has a care-impact warning; Part 2 revoke re-locks SUD immediately", () => {
    const p = newPatient();
    sendForms({ patientId: p.id, formKeys: ["part2"], actor: coord });
    signAll(p.id, ["part2"]);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);
    expect(CARE_IMPACT.part2.en).toMatch(/locked/);
    revokeForm({ patientId: p.id, formKey: "part2", by: "patient", reason: "changed my mind" });
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(false);
  });
  it("staff revoke needs a consent_ledger write role and a reason", () => {
    const p = newPatient();
    sendForms({ patientId: p.id, formKeys: ["sms"], actor: coord });
    signAll(p.id, ["sms"]);
    expect(runAction("consent_form_revoke", { role: "pmhnp" }, p, { args: [{ patientId: p.id, formKey: "sms", by: "staff", reason: "x", actor: { role: "pmhnp", name: "P" } }] }).ok).toBe(false);
    expect(() => revokeForm({ patientId: p.id, formKey: "sms", by: "staff", reason: "", actor: { role: "sys_admin", name: "Admin User" } })).toThrow(/reason/);
    const r = runAction("consent_form_revoke", { role: "sys_admin" }, p, { args: [{ patientId: p.id, formKey: "sms", by: "staff", reason: "patient asked by phone", actor: { role: "sys_admin", name: "Admin User" } }] });
    expect(r.ok ? "ok" : r.reason).toBe("ok");
    expect(AdelanteEHR.getConsentState(p.id).sms).toBe(false);
  });
});

describe("W7 intake packet + group gate", () => {
  it("packet contents per pathway", () => {
    expect(intakePacketFor("general").map((i) => i.key)).toEqual(["hipaa", "telehealth", "portal", "sms"]);
    expect(intakePacketFor("sud").map((i) => i.key)).toEqual(["hipaa", "telehealth", "portal", "sms", "part2", "group"]);
    expect(intakePacketFor("reentry").map((i) => i.key)).toEqual(["hipaa", "telehealth", "portal", "sms", "group", "po_release"]);
    expect(intakePacketFor("reentry_sud").map((i) => i.key)).toEqual(["hipaa", "telehealth", "portal", "sms", "part2", "group", "po_release"]);
    expect(intakePacketFor("reentry").find((i) => i.key === "po_release")!.required).toBe(false);
  });
  it("declining group blocks group booking only — never individual visits or MAT", () => {
    const p = newPatient({ referralSource: "probation", substanceUseNeed: true });
    buildIntakePacket(p.id, coord);
    declineForm(p.id, "group");
    expect(groupConsentGate(p.id)).toBe(GROUP_CONSENT_NEEDED);
    const actor = { role: "clinical_coordinator" as const, staffId: "s-coord" } as never;
    const base = { actor, patient: p, clinicianId: AdelanteEHR.listClinicians()[0]!.id, modality: "in_person" as const };
    const g = precheckBooking({ ...base, serviceType: "therapy_group" });
    expect(g.ok).toBe(false);
    for (const st of ["therapy_individual", "med_management"] as const) {
      const r = precheckBooking({ ...base, serviceType: st });
      if (!r.ok) expect(r.reason).not.toBe(GROUP_CONSENT_NEEDED);
    }
    reopenForPatient(p.id, "group");
    signAll(p.id, ["group"]);
    expect(groupConsentGate(p.id)).toBeUndefined();
  });
  it("medication paths never read group consent (MAT-not-conditioned rule)", () => {
    for (const f of ["src/lib/medContinuity.ts", "src/lib/orderSafety.ts", "src/lib/mar.ts", "src/lib/methadoneGuard.ts"])
      expect(readFileSync(f, "utf8")).not.toMatch(/groupConsent|consentForms/);
  });
});

describe("W8 advocate forms", () => {
  it("patient-side consent and advocate attestation go through the same workflow", () => {
    const p = newPatient();
    const reqs = sendAdvocateForms(p.id, "adv-link-1");
    expect(reqs.map((r) => r.formKey)).toEqual(["advocate_patient", "advocate_attestation"]);
    expect(advocateFormsToSign("adv-link-1")).toHaveLength(1);
    signAll(p.id, ["advocate_patient"]);
    const c = signAdvocateAttestation({ patientId: p.id, advocateId: "adv-link-1", signerName: "Diego Helper" });
    expect(c.relationship).toBe("advocate");
    expect(hasSignedForm(p.id, "advocate_attestation")).toBe(true);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "roi_collateral")).toBe(true);
  });
});
