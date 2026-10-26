import { describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";
import { canAccess, STAFF_ROSTER, canImportPreReleaseRoster } from "../roles";
import { roleHasChartEntry, setRecordRestricted } from "../chartAccess";
import { runAction } from "../actions/runAction";
import { CHART_ACTIONS } from "../chartActions";
import { INTAKE_FORMS, intakeFormsStatus, intakeCoverageResult, billingIntakeRequests, captureIntakeForm, type IntakeCaptureInput } from "../intakePhaseB";
import { importIntakeStaging, ingestPacketNeeds, intakePacketNeeds, intakePacketDocuments, packetDocumentContent, careTeamPacket, type PacketSource } from "../intakePacket";
import { PART2_ELEMENT_KEYS } from "../consentRecordModel";
import { captureConsentRecord, uploadPaperConsent } from "../consentCapture";
import { sendForms } from "../consentForms";
import { assignIntakeTeam, markIntakeComplete, firstVisitSlots, bookFirstVisit } from "../intakePhaseA";
const actor = { role: "intake_coordinator" as const, staffId: "s-admin1" };
const billing = { role: "billing" as const, staffId: "s-bill1" };
let n = 0;
function referral(link = true) { const r = AdelanteEHR.createReferral({ firstName: "PhaseB", lastName: `Test${++n}`, dob: "1990-04-12", email: `phase-b-${n}@example.invalid`, referrerName: "Test", referralSource: "other", consentToContact: false, channel: "public", intakeServices: { source: "referral", kinds: ["assessment"] } }); if (link) AdelanteEHR.enrollReferral(r.id, { websiteSignup: true }); return r; }
function pid(r: ReturnType<typeof referral>) { if (!r.enrolledPatientId) throw new Error("Missing fixture link"); return r.enrolledPatientId; }
function capture(key: IntakeCaptureInput["formKey"]): IntakeCaptureInput { const f = INTAKE_FORMS.find(x => x.key === key); if (!f) throw new Error("Form missing"); return { formKey: key, purposeCode: f.purposes[0], signer: "Actual Test Signer", relationship: "patient", signedOn: new Date().toISOString().slice(0, 10), expiresOn: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10), attested: true, ...(key === "part2" ? { elements: Object.fromEntries(PART2_ELEMENT_KEYS.map(k => [k, true])) } : {}) }; }
function run(id: string, referralId: string, ...args: unknown[]) { return runAction(id, actor, undefined, { args: [actor, referralId, ...args, "Intake fixture reason"], auditReason: "Intake fixture reason" }); }
describe("26 Oct Phase B — narrow paperwork capture", () => {
  it.each(INTAKE_FORMS.map(f => f.key))("sends and captures %s via its purpose picker without adjacent access", key => {
    const r = referral(); const actionEvents = () => AdelanteEHR.listAuditEvents({ category: "action" }).filter(e => e.action.startsWith("action.")); const before = actionEvents().length;
    expect(run("intake_form_send", r.id, key).ok).toBe(true);
    expect(run("intake_form_capture", r.id, capture(key)).ok).toBe(true);
    expect(actionEvents().length - before).toBe(2);
    expect(intakeFormsStatus(actor, r.id).find(x => x.key === key)?.status).toBe("Collected");
    expect(canAccess(actor.role, "consent_ledger").level).toBe("none"); expect(roleHasChartEntry(actor.role)).toBe(false);
    for (const id of ["consent_record_revoke", "consent_record_renew", "consent_form_send", "consent_record_capture", "consent_record_upload", "consent_record_request_esign", "consent_purpose_set"]) expect(CHART_ACTIONS.find(a => a.id === id)?.allowed(actor).state).toBe("hidden");
    const row = intakeFormsStatus(actor, r.id).find(x => x.key === key); expect(row && Object.keys(row).sort()).toEqual(["date", "key", "label", "sentOn", "status"]);
  });
  it.each(INTAKE_FORMS.map(f => f.key))("attests paper %s with actual signature date", key => { const r = referral(); expect(run("intake_form_upload", r.id, { ...capture(key), fileName: "signed.pdf" }).ok).toBe(true); const rec = AdelanteEHR.listConsentRecords(pid(r)).find(x => x.consentType === INTAKE_FORMS.find(f => f.key === key)?.type); expect(rec?.signature?.method).toBe("wet_sign_upload"); expect(rec?.signature?.signedAt.slice(0, 10)).toBe(capture(key).signedOn); });
  it("refuses missing attestations, incomplete Part 2 elements, inappropriate purpose, unlinked and scope bypasses", () => {
    const r = referral(); for (const input of [{ ...capture("part2"), elements: {} }, { ...capture("telehealth"), attested: false }, { ...capture("telehealth"), purposeCode: "care_coordination" }, { ...capture("telehealth"), signedOn: "2099-01-01" }]) expect(run("intake_form_capture", r.id, input).ok).toBe(false);
    expect(run("intake_form_capture", referral(false).id, capture("telehealth")).ok).toBe(false);
    const d = { patientId: pid(r), consentType: "telehealth" as const, recipients: [{ kind: "org" as const, name: "Adelante", directoryRef: "adelante-program" }], purpose: "Telehealth services", purposeCode: "telehealth", items: ["clinical notes"], expiresOn: "2090-01-01" };
    expect(() => captureConsentRecord({ draft: d, actor: { ...actor, name: "Intake" }, method: "e_sign", signer: "Signer", relationship: "patient", attested: true })).toThrow(/Referral/);
    expect(() => sendForms({ patientId: pid(r), formKeys: ["telehealth"], actor: { ...actor, name: "Intake" } })).toThrow(/Referral/);
    expect(() => uploadPaperConsent({ draft: d, actor: { ...actor, name: "Intake" }, signer: "Signer", relationship: "patient", signedOn: "2026-10-26", fileName: "signed.pdf" })).toThrow(/Referral/);
  });
  it("captured typed telehealth record actually unblocks the first video visit", () => {
    const r = referral(); const clinicianId = "phase-b-calendar";
    STAFF_ROSTER.push({ id: "phase-b-staff", name: "Phase B therapist", role: "therapist", clinicianId });
    AdelanteEHR.registerClinician({ id: clinicianId, name: "Phase B therapist", credential: "LCSW", mediCalCredentialed: true, mediCalStatus: "active", services: ["intake"] });
    for (const weekday of [1, 2, 3, 4, 5] as const) AdelanteEHRExt.upsertAvailabilityBlock({ clinicianId, weekday, start: "09:00", end: "17:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["intake"] });
    const slot = firstVisitSlots(r.id, "assessment", actor, "video").find(x => x.clinicianId === clinicianId); if (!slot) throw new Error("Slot missing");
    const input = { kind: "assessment" as const, clinicianId, start: slot.start, modality: "video" as const };
    expect(() => bookFirstVisit(actor, r.id, input, "First video visit")).toThrow(/telehealth consent/);
    expect(run("intake_form_capture", r.id, capture("telehealth")).ok).toBe(true);
    expect(AdelanteEHR.isConsentCategoryAuthorized(pid(r), "telehealth_services")).toBe(true);
    expect(bookFirstVisit(actor, r.id, input, "First video visit").status).toBe("scheduled");
  });
  it("cannot renew or resend an existing typed form or disguise paper upload as a real capture", () => {
    const r = referral(); expect(run("intake_form_capture", r.id, { ...capture("telehealth"), fileName: "signed.pdf" }).ok).toBe(false);
    expect(run("intake_form_capture", r.id, capture("telehealth")).ok).toBe(true);
    expect(run("intake_form_send", r.id, "telehealth").ok).toBe(false);
    expect(run("intake_form_capture", r.id, capture("telehealth")).ok).toBe(false);
    const rec = AdelanteEHR.listConsentRecords(pid(r)).find(r => r.consentType === "telehealth"); if (!rec) throw new Error("Record missing");
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2035-01-01"));
    try { expect(intakeFormsStatus(actor, r.id).find(r => r.key === "telehealth")?.status).toBe("Expired"); } finally { vi.useRealTimers(); }
    expect(run("intake_form_upload", r.id, { ...capture("telehealth"), fileName: "renew.pdf" }).ok).toBe(false);
  });
});
describe("26 Oct Phase B — Billing request/result", () => {
  it("creates real Billing task with referral reference; only coverage status/date returns", () => {
    const r = referral(); expect(run("intake_eligibility_request", r.id).ok).toBe(true);
    const t = AdelanteEHR.listCaseTasks().find(x => x.dedupeKey === `intake-eligibility:${r.id}`); expect(t?.allowedRoles).toEqual(["billing", "billing_coordinator"]); expect(t?.detail).toBe(`Referral reference: ${r.id}`); expect(t?.assignedTo).toBeTruthy();
    expect(intakeCoverageResult(actor, r.id)).toEqual({ status: "Pending" });
    expect(AdelanteEHR.recordCoverageCheck(pid(r), { channel: "phone_county", result: "verified", statusConfirmed: "active", cin: "92222222B", channelNote: "Private billing reference", actorId: billing.staffId, actorRole: billing.role }).ok).toBe(true);
    expect(intakeCoverageResult(actor, r.id)).toEqual({ status: "Active", checkedOn: new Date().toISOString().slice(0, 10) });
    expect(billingIntakeRequests(billing).some(x => x.referralId === r.id)).toBe(true); expect(billingIntakeRequests(actor)).toEqual([]);
    expect(canAccess(actor.role, "eligibility").level).toBe("none");
  });
  it.each(["Inactive", "Pending", "Not found"] as const)("projects %s and refuses Intake result entry", status => {
    const r = referral(); run("intake_eligibility_request", r.id);
    expect(AdelanteEHR.recordCoverageCheck(pid(r), { channel: "phone_county", result: "verified", actorId: actor.staffId, actorRole: actor.role }).ok).toBe(false);
    expect(AdelanteEHR.applyEligibilityResponse(pid(r), { transactionId: "test", vendor: "test", responseStatus: "active" }, { actorId: actor.staffId, actorName: "Intake", actorRole: actor.role }).ok).toBe(false);
    AdelanteEHR.recordCoverageCheck(pid(r), { channel: "phone_county", result: status === "Not found" ? "not_found" : status === "Pending" ? "pending" : "verified", ...(status === "Inactive" ? { statusConfirmed: "suspended" as const } : {}), actorId: billing.staffId, actorRole: billing.role });
    expect(intakeCoverageResult(actor, r.id).status).toBe(status);
  });
});
describe("26 Oct Phase B — source-bound packet and staging", () => {
  it.each(["partner_referral", "pre_release_packet"] as PacketSource[])("%s stages only referrals and packet needs, never patient/clinical stores", source => {
    const before = JSON.stringify(AdelanteEHR.listPatients()); const appts = JSON.stringify(AdelanteEHR.listAppointments());
    const result = runAction<{ referralIds: string[] }>("intake_staging_import", actor, undefined, { args: [actor, source, "partner-roster.json", [{ firstName: "Staged", lastName: "Person", email: "staged@example.invalid", referrerName: "Partner", releaseDate: "2026-11-01", referralReason: "Intake", sdoh: [{ kind: "housing" }] }], "Partner supplied packet"] }); expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason);
    const id = result.value.referralIds[0]; expect(AdelanteEHR.listReferrals().find(r => r.id === id)?.enrolledPatientId).toBeUndefined();
    expect(JSON.stringify(AdelanteEHR.listPatients())).toBe(before); expect(JSON.stringify(AdelanteEHR.listAppointments())).toBe(appts);
    expect(intakePacketNeeds(actor, id)).toMatchObject([{ kind: "housing", source }]);
    expect(() => importIntakeStaging(actor, source, "roster", [{ firstName: "Bad", lastName: "Row", email: "bad@example.invalid", referrerName: "Partner", countyOfRelease: "Tulare" } as never], "Import")).toThrow(/referral identity/);
  });
  it("clinical needs never appear; validated checklist logging writes no clinical needs", () => {
    const r = referral(); const p = AdelanteEHR.getPatient(pid(r)); if (!p) throw new Error("Patient missing");
    const before = JSON.stringify(p);
    expect(() => ingestPacketNeeds(actor, r.id, "clinician_note" as never, "note-1", [{ kind: "housing" }], "Source")).toThrow(/source/);
    expect(run("intake_packet_needs_ingest", r.id, "referral_form", `referral:${r.id}`, [{ kind: "housing" }]).ok).toBe(true);
    const item = intakePacketNeeds(actor, r.id)[0]; expect(item?.source).toBe("referral_form"); expect(intakePacketNeeds(actor, r.id)).toHaveLength(1);
    expect(run("intake_sdoh_log", r.id, item?.id, "confirmed_still_needed").ok).toBe(true);
    expect(intakePacketNeeds(actor, r.id)[0]?.state).toBe("confirmed_still_needed"); expect(JSON.stringify(p)).toBe(before); expect(canAccess(actor.role, "sdoh").level).toBe("none");
    expect(() => ingestPacketNeeds(actor, r.id, "partner_referral", "invented-source", [{ kind: "housing" }], "Invented source")).toThrow(/source reference/);
  });
  it.each(["part2", "sud_related", "unclassified"] as const)("%s document stays visibly locked then opens with applicable typed treatment consent", classification => {
    const r = referral(); const result = runAction<{ documentId: string }>("intake_packet_attach", actor, undefined, { args: [actor, r.id, { type: "medication_list", source: "pre_release_packet", fileName: "private-med-list.txt", size: 4, mime: "text/plain", dataUrl: "data:text/plain;base64,dGVzdA==", classification }, "Partner packet attachment"] }); expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason);
    expect(intakePacketDocuments(actor, r.id)[0]).toMatchObject({ restricted: true, reason: "Part 2 — needs consent covering intake/treatment" }); expect(JSON.stringify(intakePacketDocuments(actor, r.id))).not.toContain("private-med-list");
    expect(() => packetDocumentContent(actor, r.id, result.value.documentId)).toThrow(/Part 2/);
    expect(run("intake_form_capture", r.id, capture("part2")).ok).toBe(true);
    expect(intakePacketDocuments(actor, r.id)[0]?.restricted).toBe(false); expect(packetDocumentContent(actor, r.id, result.value.documentId).dataUrl).toBe("data:text/plain;base64,dGVzdA==");
    expect(roleHasChartEntry(actor.role)).toBe(false);
  });
  it("handoff projects packet checklist/documents only to assigned permitted care team after completion", () => {
    const r = referral(); run("intake_packet_needs_ingest", r.id, `referral_form`, `referral:${r.id}`, [{ kind: "food" }]); const item = intakePacketNeeds(actor, r.id)[0]; run("intake_sdoh_log", r.id, item?.id, "resolved");
    run("intake_packet_attach", r.id, { type: "hra", source: "partner_referral", fileName: "hra.txt", mime: "text/plain", size: 4, dataUrl: "data:text/plain;base64,dGVzdA==", classification: "general" });
    assignIntakeTeam(actor, r.id, "care_manager", "s-cm2", "2026-10-27", "Initial assignment"); assignIntakeTeam(actor, r.id, "clinician", "s-th2", "2026-10-27", "Initial assignment");
    const cm = { role: "ecm_provider" as const, staffId: "s-cm2" }; expect(careTeamPacket(cm, pid(r))).toEqual([]);
    markIntakeComplete(actor, r.id, { identity_link_checked: true, contact_checked: true, packet_received: true, handoff_ready: true }, "Handoff");
    expect(careTeamPacket(cm, pid(r))[0]?.needs).toEqual([{ kind: "food", source: "referral_form", state: "resolved" }]); expect(careTeamPacket(cm, pid(r))[0]?.documents[0]?.fileName).toBe("hra.txt");
    expect(careTeamPacket(actor, pid(r))).toEqual([]); expect(careTeamPacket(billing, pid(r))).toEqual([]); expect(run("intake_sdoh_log", r.id, item?.id, "unknown").ok).toBe(false);
  });
  it("original pre-release importer and adjacent clinical actions remain denied", () => { expect(canImportPreReleaseRoster(actor.role)).toBe(false); for (const id of ["eligibility_check", "consent_record_revoke", "consent_record_renew"]) { const a = CHART_ACTIONS.find(a => a.id === id); if (!a) throw new Error(`Missing adjacent action ${id}`); expect(a.allowed(actor).state).toBe("hidden"); } expect(canAccess(actor.role, "pre_release").level).toBe("none"); });
  it("clinical coordinator can create/update staging referral but no clinical fields or linked identities", () => {
    const cc = { role: "clinical_coordinator" as const, staffId: "s-cc1" };
    const before = JSON.stringify(AdelanteEHR.listPatients());
    const created = importIntakeStaging(cc, "partner_referral", "partner-1", [{ firstName: "Staging", lastName: "Update", email: "staging@example.invalid", referrerName: "Partner" }], "Partner intake");
    const id = created.referralIds[0]; if (!id) throw new Error("Referral missing");
    importIntakeStaging(cc, "partner_referral", "partner-2", [{ referralId: id, firstName: "Staging", lastName: "Updated", email: "staging@example.invalid", referrerName: "Partner" }], "Partner correction");
    expect(AdelanteEHR.listReferrals().find(r => r.id === id)?.lastName).toBe("Updated"); expect(JSON.stringify(AdelanteEHR.listPatients())).toBe(before);
    expect(() => AdelanteEHR.updateIntakeStagingReferral(id, { cin: "92222222B" }, actor)).toThrow(/fields only/);
    const linked = referral(); expect(() => importIntakeStaging(actor, "partner_referral", "partner-3", [{ referralId: linked.id, firstName: "Changed", lastName: "Person", email: "staging@example.invalid", referrerName: "Partner" }], "Update")).toThrow(/unlinked open/i);
    const audit = AdelanteEHR.listAuditEvents().find(e => e.action === "referral_submitted" && e.detail?.referralId === id); expect(JSON.stringify(audit?.detail)).not.toMatch(/Partner|Staging|staging@example/); expect(audit?.actorRole).toBe("clinical_coordinator");
  });
  it("restricted chart locks packet content and denies consent capture/checklist logging", () => {
    const r = referral(); run("intake_packet_needs_ingest", r.id, "referral_form", `referral:${r.id}`, [{ kind: "food" }]); const need = intakePacketNeeds(actor, r.id)[0];
    run("intake_packet_attach", r.id, { type: "hra", source: "referral_form", fileName: "general.txt", mime: "text/plain", size: 4, dataUrl: "data:text/plain;base64,dGVzdA==", classification: "general" });
    setRecordRestricted({ patientId: pid(r), reason: "Restricted test record", restricted: true, actor: { role: "sys_admin", staffId: "s-admin1", name: "Admin" } });
    expect(intakePacketNeeds(actor, r.id)).toEqual([]); expect(intakePacketDocuments(actor, r.id)[0]?.restricted).toBe(true);
    expect(run("intake_sdoh_log", r.id, need?.id, "resolved").ok).toBe(false); expect(run("intake_form_capture", r.id, capture("telehealth")).ok).toBe(false);
  });
});