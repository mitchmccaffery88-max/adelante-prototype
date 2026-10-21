# B2 — Complete consent record for MVP (plan only)

Rollback for every batch: HEAD at batch start, recorded first. No publish. Narrowing only unless Mitch approves a named access change. New test files only; stop rule and flake list unchanged.

## Key finding
A structured consent ledger already exists and most gates already read it. B2 extends that ledger rather than adding a second one. The remaining gaps are a handful of gates that still read old flags, a missing per-recipient/purpose model, and a legacy fallback that still grants Part 2 from a flag.

## 1. Inventory (confirmed reads; batch B2-0 completes and freezes the full list)

| Item | Where | What it reads |
|---|---|---|
| ConsentRecord type (formType, signedBy, capturedBy, sections by category, status, supersedesId, revoke fields) | src/lib/ehr.ts:3689-3718 | — |
| ConsentCategory list (sud_treatment, mental_health, case_coordination, billing, group_confidentiality_ack, telehealth_services, information_sharing_disclosure, roi_collateral, advocate_sud_disclosure, po_voluntary_coordination, legal_part2_disclosure, ai_session_recording(+_part2), hipaa_authorization, patient_portal, sms_reminders, group_participation, advocate_attestation, pre_release_services) | ehr.ts:3513-3567 | — |
| Ledger store + seed | ehr.ts:6466 | — |
| Live status (clock expiry) | ehr.ts:6489 effectiveConsentStatus | record dates |
| One active record per patient | ehr.ts:12687 activeConsentRecord | ledger |
| Central check | ehr.ts:12697 isConsentCategoryAuthorized | ledger; LEGACY FALLBACK ehr.ts:12703-12708 grants sud_treatment from Patient.consentState.part2Sud / consents.part2Sud when no record exists |
| Create / supersede | ehr.ts:12714-12750 createConsentRecord (prior set "superseded") | — |
| getConsentState (part2Sud derived; ecmShare false; sms flag) | ehr.ts:12657 | ledger + flags |
| Patient withdraw / staff set | ehr.ts:12828 patientWithdrawConsent, :12857 staffSetConsent (writes consents.part2Sud flag too) | flags + ledger |
| Legacy flags on Patient | ehr.ts:1661 consents{hipaa,part2Sud}, :1668 sudCoordinationConsent, :1670 sudCounselingNotesRelease, :1789 consentState | — |
| Intake writes part2Sud flag | ehr.ts:8728-8751, src/routes/intake.tsx | flag |
| Coordinator SUD access | src/lib/coordinatorSudAccess.ts:32 | FLAG sudCoordinationConsent OR emergency grant |
| Counseling notes release | coordinatorSudAccess.ts:30 | FLAG sudCounselingNotesRelease |
| Emergency path | coordinatorSudAccess.ts:22-54, coordinatorSudEmergency.ts | own grant store (stays separate) |
| ASAM consent cohort | src/lib/asamReporting.ts:92 | FLAGS sudCoordinationConsent AND consents.part2Sud |
| Part 2 disclosure check | src/lib/part2Disclosure.ts:143-175 part2ConsentFor | ledger categories + legal disclosure list; legacy label "Consent on file (legacy flag)" |
| Advocate SUD disclosure | ehr.ts:6218-6288 | ledger advocate_sud_disclosure |
| Telehealth gate | ehr.ts:9241 | ledger telehealth_services |
| Legal disclosure | ehr.ts:10090 | ledger legal_part2_disclosure |
| SUD-treatment reads | ehr.ts:11351, :11446 | ledger |
| Group consent hook | ehr.ts:3627-3633 setGroupConsentGate/groupConsentBlock | injected gate |
| Referrer authorization (P3) | src/lib/referrerAuthorizationStore.ts:21-55, referrerUpdateGate.ts:23-40 | separate per-referral store |
| Care partners / handoffs | src/lib/carePartners.ts:174-249 | link purpose only, no consent record |
| Form library / packet / Forms to sign / signing | src/lib/consentForms.ts (versions, textHash FNV-1a :122, signChecked writes superseding ConsentRecord), ConsentFormsPanel, FormsToSign, PatientSignedForms, ConsentFormLibrary | ledger |
| Registry entries | src/lib/chartActions.ts:58, :141 consent_form_* | runAction |
| Patient withdraw UI | components/patient/ConsentWithdrawSheet.tsx | purposes part2Sud/ecmShare/sms |
| Other flag readers to confirm in B2-0 | countyReporting.ts, adelBrief.ts, adelHistory.ts, printRecord.ts, notePdf.ts, outpatientCare.ts, bookingFlow.ts, ntpReferral.ts, dmcOdsReadiness.ts, dataExchange.ts, coordinatorSudView.ts, advocate.tsx, AdvocateConsentStatus, ProfilePanels, PatientProfileDialog, admin.tsx, consent.tsx | to be listed with line and read type |

## 2. Consent record model (extends ConsentRecord)
Kept: patient, sections/categories, signedAt, signedBy (patient / guardian / proxy), capturedBy, effective/expiry dates, status, supersedesId, revoke fields.
Added:
- consentType: part2_tpo_single, part2_specific_written, counseling_notes_release, hipaa_authorization, referrer_authorization, advocate_release (collateral ROI / advocate SUD disclosure), legal_part2_disclosure, po_voluntary_coordination, telehealth, group_confidentiality, ai_recording, sms/portal; each maps to existing categories.
- recipients[]: person and/or organization (directory ref where one exists).
- purpose (free text from template + chosen purpose code).
- scope: covered information list (Part 2 item list reuses COORDINATOR_SUD_ITEMS).
- expiry: date and/or event (e.g. "end of treatment episode", "referral closed").
- signature: method (e_sign, wet_sign_upload, verbal_assent where template allows), signer + relationship, signedAt, recordedAt, recordedBy, witness (optional).
- document: formKey, versionId, version, documentHash (existing textHash for MVP), upload ref for wet-sign.
- part2Elements checklist (the 42 CFR 2.31 elements as booleans, Draft) and redisclosureNotice text/version.
- revocation: by, at, method (written / verbal / portal), reason, onBehalfOfPatient flag.
- disclosureIds[]: back-links from the disclosure log.
- legacyUnverified: boolean (migration only).
Change: allow several active records per patient (one per type + recipient); "superseded" applies within the same type + recipient, not across the patient.

## 3. Flows (screens and roles)
- Staff capture: chart Consents section (existing ConsentFormsPanel) — intake/clinical/coordinator roles that already hold consent_form_* entries; pick template, recipients, purpose, scope, expiry, method; Part 2 checklist must be complete to save.
- Patient e-sign: existing Forms to sign (patient portal), EN + ES; Spanish marked "Borrador — pendiente de revisión de traducción" via the existing member-shell notice; typed name + attestation (current mechanism).
- Paper upload: staff attach wet-sign scan to the record (simulated file store, labelled "Simulated"); witness optional.
- View and history: chart Consents timeline (all versions, statuses, linked disclosures); patient "My forms" (own records only, plain words); advocates see only their own release status (existing AdvocateConsentStatus).
- Revoke: patient via ConsentWithdrawSheet (extended to type/recipient); staff on patient request with method + reason (audited). Immediate effect.
- Renew / supersede: "Renew" pre-fills a new record; prior becomes superseded only after the new one is signed.
- Expiry: clock-based (existing) plus event-based; renewal task at RENEWAL_LEAD_DAYS (Draft); staff see a neutral lock with "No active consent for <recipient/purpose>" or "Consent expired on <date>" and a "Request consent" action — no data shown, Part 2 masking unchanged.

## 4. Enforcement
- All gates call one function: consentCovers(patientId, type, recipient?, purpose?, item?, at) built on the ledger; isConsentCategoryAuthorized becomes a wrapper.
- Switch coordinatorSudAccess.ts:30/32 and asamReporting.ts:92 and every flag reader from B2-0 to the ledger.
- Expired / revoked / superseded / legacyUnverified = denied at read time (no caching, as today).
- Emergency grant path unchanged and separate; counseling notes stay a separate type that the coordinator TPO record never satisfies.
- Referrer authorization becomes a referrer_authorization record; referrerUpdateGate reads it; P3 messaging unchanged.

## 5. Migration (through real store functions, seed-only)
- consents.part2Sud / consentState.part2Sud with no record: legacyUnverified record, does NOT grant. ACCESS CHANGE: removes the fallback at ehr.ts:12703-12708; affected patients lose Part 2 TPO-derived visibility (county share, SUD treatment reads) until re-captured. Mitch to decide.
- sudCoordinationConsent tpo / specific_written: legacyUnverified part2 record; ACCESS CHANGE: coordinators lose non-emergency SUD access for those patients unless Mitch keeps them granting.
- sudCounselingNotesRelease true: legacyUnverified counseling release; ACCESS CHANGE: counseling-note access ends.
- consents.hipaa: legacyUnverified HIPAA record (no gate reads it today — confirm in B2-0).
- Existing ConsentRecords (seed + signed forms): migrate as verified, hash/version from the form version when present.
- Referrer authorizations: converted to records with the named referrer as recipient; no access change.
- Demo seeds re-captured as real signed records where the demo needs access, so demo walkthroughs keep working; count of affected patients reported before switching.

## 6. Audit and disclosure log
- Events (one per runAction): consent.captured, consent.signed, consent.uploaded, consent.revoked, consent.renewed, consent.superseded, consent.expired (emitted once by a read-time sweep), consent.legacy_flagged. Metadata neutral (type, record ID, no SUD content).
- Disclosure entries (part2Disclosure, referrer updates, handoffs, county share) store consentRecordId; record lists them.

## 7. Risks and dependencies
Counsel / Diana: all form wording and templates (already "Draft — pending counsel review"), Part 2 element checklist and redisclosure notice, e-sign validity (checkbox + typed name), verbal assent where allowed, minor/guardian rules, retention periods, Spanish wording (native review).
Backend / real-login phase: immutable append-only consent and audit storage; real document storage and SHA-256 hashing (FNV-1a today); signer identity verification; server-side enforcement. The "Audit: denied-navigation audit under slow load" item moves here: no sessionStorage fix, because client storage isn't an audit store; it is resolved by the server-side immutable audit write. Roadmap item updated accordingly.
Demo-only: in-memory ledger, simulated uploads, typed-name signatures, clock sweep for expiry.

## 8. Batches
- B2-0 Inventory freeze (no behaviour change): docs/b2-consent-inventory.md with every reader file:line; NEW unit test pinning that list. Stop if a reader is unclassifiable.
- B2-1 Model extension: additive fields, multi-active records, consentCovers(); old API unchanged in behaviour. Tests: consentRecordModelB2.test.ts.
- B2-2 Capture, e-sign (EN/ES), paper upload, view/history. Tests: consentCaptureB2.test.ts, e2e/consentCaptureB2.spec.ts (staff + patient, axe, 390px ES).
- B2-3 Revoke, renew/supersede, expiry, missing/expired staff view. Tests: consentLifecycleB2.test.ts, e2e/consentLifecycleB2.spec.ts.
- B2-4 Enforcement switch (coordinator, counseling, ASAM cohort, referrer, other readers). Pinned-clock parity for every non-migrated patient; emergency path byte-identical. Tests: consentEnforcementB2.test.ts.
- B2-5 Migration + legacyUnverified (only after Mitch's access decisions). Tests: consentMigrationB2.test.ts, before/after access table in report.
- B2-6 Audit + disclosure links. Tests: consentAuditB2.test.ts.
Each batch: restart → full units → full one-worker browser suite on :8080, background, polled to EXIT → screenshots → report + roadmap → SHA.

Existing tests likely affected (stop rule applies): consentRecords, consentWorkflow (unit + e2e), consentAuditView, consentPublishReason, intakeConsentReprompt, advocateSudDisclosureConsent, part2DisclosureAccessLog, part2SimulatedHardening, privacyP3Referrer, poDisclosure, section4part2, groupEnrollmentTelehealthConsent, sdohReferralConsentAttribution, coordinatorEmergencyP2.spec, consentSigningClearance8a2.spec, myWorkPart2Screeners. B2-4 and B2-5 are where most would break; those stop for approval.

## Decisions needed from Mitch
1. Do legacy flags grant nothing (default) or keep granting until a date?
2. Is verbal assent allowed for any type in MVP?
3. Multi-active records per patient: approve.
