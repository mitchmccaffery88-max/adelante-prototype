// §Group 2 S4/O2 — the patient signs advocate sharing consent (roi_collateral).
// One helper for the portal card and onboarding. Copies every other section
// of the record in force, so nothing else changes.
import { AdelanteEHR } from "./ehr";
import { deliverConsentedAdvocateInvitations } from "./advocateInviteDelivery";

export function signAdvocateConsent(patientId: string, typedName: string, attested: boolean): void {
  if (!attested || typedName.trim().length < 2) throw new Error("Type your full name and tick the box to sign.");
  const prior = AdelanteEHR.activeConsentRecord(patientId);
  const sections = (prior?.sections ?? []).filter((s) => s.category !== "roi_collateral");
  AdelanteEHR.createConsentRecord({
    patientId,
    formType: prior?.formType ?? "NonAB133",
    source: "patient_portal",
    signedByName: typedName.trim().slice(0, 100),
    attested,
    effectiveDate: new Date().toISOString().slice(0, 10),
    sections: [...sections, { category: "roi_collateral", authorized: true }],
    capturedBy: { staffName: "Patient (self-signed)", role: "patient" },
    ...(prior ? { supersedesId: prior.id } : {}),
  });
  void deliverConsentedAdvocateInvitations(patientId);
}
