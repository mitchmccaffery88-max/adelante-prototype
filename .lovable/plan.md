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

## Decisions (Mitch, Oct 21 — approved)
1. Legacy flags grant NOTHING: they become legacyUnverified records with no access. Demo patients needing access are re-captured as signed records through real store functions; affected-patient count and effect reported before switching.
2. Verbal assent is LIMITED (Draft — pending counsel): allowed only for the referrer_authorization "enrolled" update to a non-covered referrer (family / community) and for SMS / portal reminders; records who heard it, when, and the exact wording. Never for Part 2 (TPO or specific), counseling-notes release, HIPAA authorization, legal disclosure or advocate SUD release — those need e-sign or an uploaded wet signature.
3. Multiple active records per patient: approved, one per type + recipient.
4. Denied-navigation audit under slow load: folded into backend / immutable-audit work; no sessionStorage.

## Status
- B2-0 done (docs/b2-consent-inventory.md, consentInventoryB2.test.ts). B2-1 next.

## B2-4 inventory (plan only — rollback 0089ca4fda285ead2c0632f8cf16c30c53f732c4, HEAD confirmed)

### 0. Approach and the legacy-flag question
Every gate calls one ledger reader, `consentGate(patientId, type, {recipient?, purpose?, item?, at})`, built on `consentCovers`. `isConsentCategoryAuthorized(category)` becomes a wrapper that maps category to type (sud_treatment -> part2_tpo_single | part2_specific_written; telehealth -> telehealth; group_confidentiality -> group_confidentiality; roi_collateral / advocate_sud_disclosure -> advocate_release; legal_disclosure -> legal_part2_disclosure; po voluntary -> part2_specific_written with PO recipient; hipaa_authorization -> hipaa_authorization).

Precedence, per gate, for each type:
1. A typed record of that type exists for the patient (any status) -> the ledger decides. Expired, revoked, superseded or legacyUnverified -> denied. No fallback.
2. No typed record of that type -> today's source answers: the untyped (pre-B2) record's section, then the legacy flag. This step is removed in B2-5.

Two options for "legacy flag, no typed record":
- Option A (recommended): keep today's result until B2-5 (step 2 above). Seeded patients whose access changes in B2-4: 0.
- Option B: deny now. Seeded patients losing access in B2-4 (static count, confirmed at build step 1): sud_treatment fallback on p3, p4, p-demo-refusal and the two demo-scenario personas seeded through completeIntake with part2Sud (Luis Camacho, plus one other `sud: true` persona) — about 5 patients; the two in-facility seeds (fac-adelante-res) only when in-facility is enabled (off by default). Coordinator flags: 0 seeded patients (no app code sets sudCoordinationConsent / sudCounselingNotesRelease; tests only).
Option A defers every legacy-flag loss to B2-5, where Decision 1 explains it.
Note: the counts were found by reading the code. Plan mode blocked a scratch probe. Build step 1 runs that probe read-only; if it shows a different count, STOP.

### 1. Readers to switch (file:line — today -> B2-4)
- coordinatorSudAccess.ts:30 — `sudCounselingNotesRelease === true` -> gate(counseling_notes_release, purpose coordination); legacy flag only under Option A step 2. A TPO / specific record never satisfies it.
- coordinatorSudAccess.ts:32 — `sudCoordinationConsent` tpo/specific -> gate(part2_tpo_single) OR gate(part2_specific_written, item); `|| coordinatorEmergencyFor(...)` stays as written.
- asamReporting.ts:92 — `!!sudCoordinationConsent && consents.part2Sud` -> same coordinator predicate as :32 (no emergency term, as today) AND sud_treatment gate.
- referrerUpdateGate.ts:29-30 — `part2ConsentNamesRecipient` + `referrerAuthorizationFor` -> gate(part2_specific_written, recipient) and gate(referrer_authorization, recipient, purpose); the separate store answers step 2. decideReferrerUpdate and P3 messages unchanged.
- ehr.ts:12702-12718 isConsentCategoryAuthorized -> wrapper (all 30+ callers below follow automatically, with no edit at the caller): ehr.ts:6290, 9243, 10092, 11353, 11448, 12677, 13807, 13841, 15341, 18410, 19073, 24633, 24770, 24910, 25352, 25360, 25510, 25527; roles.ts:937; part2Disclosure.ts:198; hie.ts:120/154/173/181; chartOrders.ts:194; bookingFlow.ts:82; patientBooking.ts:39; ab133.ts:119; advocateInviteDelivery.ts:12-13; poDisclosure.ts:201; consentLifecycle.ts:173; PoDisclosureCard.tsx:21; RescreenForm.tsx:32; intake.tsx:593; DemoStateSwitcher.tsx:239.
- Direct flag reads frozen in B2-0: ehr.ts:12662-12663 getConsentState base and :12713 fallback -> step 2 of the wrapper; adelBrief.ts:408 and CoordinatorSudPanel.tsx:23 (cache / version keys) -> add the gate results to the key (no access effect); recordSections.tsx:500 `consents.part2Sud` prop -> wrapper(sud_treatment); intake.tsx:590, onboarding.ts:18, consent.tsx:142 (hipaa / signedAt, intake-complete status, not access) -> unchanged, listed as not-a-gate; consentForms.ts:388-390 migrateLegacyConsents -> unchanged (B2-5). Write sites ehr.ts:8752-8754, 12961-12971 -> unchanged (B2-5).
- Not switched: coordinatorEmergencyFor and the grant store (byte-identical); recordSectionGate / canAccess matrix (Part 2 masking).

### 2. Access table (seeded default state, Option A)
Roles: therapist, pmhnp, case_manager, peer_specialist, clinical_coordinator, cf_care_manager, ecm_provider, billing, sys_admin, advocate. Patients: every patient in listPatients() (p1..pN, demo-scenario personas, p-demo-refusal).
| Surface | Option A | Option B |
|---|---|---|
| Coordinator SUD view (B items) | same, all | same (no seeded flags) |
| Counseling notes | same, all | same |
| ASAM cohort / totals (coordinator, sys_admin) | same (cohort 0, hidden <11) | same |
| County share / HIE (hie.ts) | same | narrows: p3, p4, p-demo-refusal, 2 personas |
| SUD treatment reads (screeners, problems, case-manager / peer consent_gated via roles.ts:937, notes PDF, autofill) | same | narrows: same ~5 patients for case_manager, peer_specialist; therapist / pmhnp unaffected |
| Telehealth booking / join | same (untyped record or no grant, as today) | same (no legacy flag for telehealth) |
| Advocate SUD disclosure / invites | same | same |
| Legal disclosure | same | same |
| Referrer updates (P3) | same | same |
| Group confidentiality / enrolment | same | same |
| AI recording / scribe consent | same | same |
| PO disclosure | same | same |
| MOUD / chartOrders:194 | same | narrows: same ~5 patients |
No WIDENS cell in seeded data under either option. Hard-stop note for Mitch: after B2-4, a typed record captured through B2-2 flows grants on its own (that is the point of enforcement). No seeded patient has one today, so the table shows no widening. Capturing one in a demo grants access where the legacy state said no. Confirm this is intended. If not, B2-4 stops here.
The build produces the full patient x role x surface matrix as a generated JSON (rollback vs current, pinned clock). Any cell that differs from this table -> STOP.

### 3. Existing tests expected to change
Option A: no behaviour, access or audit assertion is expected to fail. The flag-setting tests (privacyP1:16/74/77/108/114, privacyP2:16/80, privacyP2Surfaces:21-24, privacyP3EndAccess:23, privacyP3SysAdminCohort:18, coordinatorEmergencyP2.spec:25-27) still pass through step 2. Pre-approved pin edits only:
- consentInventoryB2.test.ts: count changes for coordinatorSudAccess.ts, asamReporting.ts, ehr.ts, referrerUpdateGate.ts, plus a new consentGate.ts line (additive pin; keeps the check).
- consentB2Approved.ts: exact-once substitutions for the wrapper hunk in ehr.ts (keeps the check).
- consentAuditB2Parity fixture: expected byte-identical; any diff -> STOP.
Option B would also break privacyP1:74-114, privacyP2:16, privacyP2Surfaces:21, privacyP3SysAdminCohort:18, consentRecords, intakeConsentReprompt, myWorkPart2Screeners, part2DisclosureAccessLog, dataExchange and others. Those tests set flags expecting access, so rewriting them would mean capturing typed records instead. That changes access fixtures, so it is a stop.
New tests: consentEnforcementB2.test.ts (precedence; expired, revoked, superseded and legacyUnverified each deny, with no fallback once a typed record exists; a TPO record never opens counseling notes; parity matrix) and e2e/consentEnforcementB2.spec.ts (revoke a typed record -> coordinator view locks; axe).

### 4. Demo walkthroughs
Option A: none lose access in B2-4. Re-capture moves to B2-5: for the patients listed in Option B, the scenario code captures signed typed records (part2_tpo_single, e-sign) through captureConsentRecord / runAction, never by setting fields. The list comes from the build step 1 probe.

### 5. Emergency-path parity
- Source pin: the coordinatorEmergencyFor, saveCoordinatorEmergencyGrant, endCoordinatorEmergencyGrant and validateCoordinatorEmergency bodies, and coordinatorSudEmergency.ts, are hashed at rollback and must match after.
- Behaviour: pinned Date, for each seeded patient x {no grant, active grant, expired grant, ended grant} x item list -> coordinatorSudCanRead results, audit entries and disclosure entries compared byte-identically against `git archive 0089ca4f` (same harness as B2-6).
- The grant must still unlock B items with no typed record, and must never unlock counseling notes.

### Hard stops (checked during build)
Any WIDENS cell in the generated matrix; any emergency-path diff; probe count differing from §0; any test edit beyond the pre-approved pins and adapters; any patient losing access in a way Decision 1 does not explain. Validation as for every batch: restart, full units, full one-worker browser run to the literal EXIT line, screenshots restored against 0089ca4f, report, roadmap, SHA. No publish. B2-5 waits for approval.

## B2-5 plan

**Docs only; not implemented or approved to build.** B24d closed B2-4 green: 224/224, 31.5m, literal EXIT 0; no flake exception. Draft — pending clinical sign-off and counsel. Decision 1: legacy flags grant nothing; migrate them to non-granting `legacyUnverified` records. Re-capture only independently needed demo access through signed typed records and real store functions/registry. Preserve outpatient default, neutral audit text, Part 2 masking and cohort guard 11.

### a. Before/after access table

Compare current B2-4 to two separately measured stages: **migration alone**, then **migration plus proposed signed demo captures**. No positive capture is assumed approved. Before build, pin Date/PRNG, inventory actual store rows and generate every patient × roster role × surface cell, including flags-only, untyped, revoked/expired/merge-held records. Never replace historical rollback fixtures with current output.

The accepted store-only probe had 15 patients, seven flag-only grants and one untyped seed (`ehr.ts:6469–6488`). A fresh read-only staff UI probe after demo initialization has 20 patients and **five untyped records across four patients**: Daniel M. (two), Victor Hale, Jordan Vega, Tomás Reyes. The additional rows are real demo-store writes, not extra flag-only patients. Evidence under `/tmp/browser/b24d/roster/consent-roster.json`; generated IDs are referenced by patient + source, not hardcoded. No signed form copies were found for those four patients. Re-run both scopes before migration; different counts/provenance → STOP and report.

Role/surface keys (apply each key to **every patient row** below; same includes already-denied roles):
- **G:** `sud_treatment` category / derived Part 2 state, plus every class currently `consent_gated`: screeners_sud (ECM provider, peer specialist, clinical trainee); sud_treatment class (therapist, clinical trainee, ECM provider, peer specialist, billing); SUD group-note/chart/export/autofill consumers using their unchanged role matrix. See `roles.ts:214–234,303–311,873–880,935–943`. This does not grant billing clinical data; existing downstream privacy holds stay on top.
- **D:** SUD HIE receive/release (`hie.ts:120,154,173,181`), county/outbound treatment-consent prerequisites, and MOUD/order gate (`chartOrders.ts:194`), only for roles already authorized for those operations. Non-SUD reads remain same; every outbound SUD transfer still uses `disclose()` and named recipient/purpose checks.
- **C:** coordinator B-item view, counseling notes, ASAM coordinator/sys_admin consent cohort and totals: same denied/empty by default for all seven (no coordinator flags seeded); no treatment-only capture grants care-coordination or counseling access. Other roles' existing unconditional clinical reads, denied roles and sys_admin names remain same; totals stay suppressed below 11.
- **O:** telehealth booking/join, group confidentiality, advocate release/invites, AI recording, referrer updates, voluntary PO/legal disclosure: same for seven flag-only patients where already denied; their separate signed scope is not created by a treatment capture. Required/mandatory PO tier remains unchanged. Non-SUD/private-self-tracking/member gates remain same.

| Patient | G migration only | D migration only | C | O | After proposed capture |
|---|---|---|---|---|---|
| p3 Marcus L. | narrows | narrows where treatment consent is required | same | same | same as before for G/D only if independent SUD demo needs capture (b); never restore coordinator cohort |
| p4 Alicia Serrano | narrows | narrows where applicable | same | same | stays narrowed; anxiety/advocate demo is not Part 2 authorization |
| p-demo-refusal Alicia R. | narrows | narrows where applicable | same | same | stays narrowed; psychiatric-refusal flow does not need SUD sharing |
| p-demo-mar-seed Marcus Whitfield | narrows | narrows where applicable | same | same | stays narrowed; in-facility MAR demo remains OFF by default |
| p-demo-mar-seed-es Lucía Moreno | narrows | narrows where applicable | same | same | stays narrowed; Spanish refusal demo is not SUD consent |
| Luis Camacho (original sud_consented persona, not matching duplicate) | narrows | narrows | same | same | proposed signed treatment capture restores only G/D to same as before |
| Jasmine Holt (combination persona) | narrows | narrows | same | same | proposed signed treatment capture restores only G/D to same as before |
| p1 Daniel M.: cr-seed-1 superseded; active “in person — consent tab” | intended same only after provenance-verified conversion; otherwise narrows → STOP | same only for verified original scopes; otherwise STOP | same | mental_health/case_coordination and named legal scopes must stay same if verified; cannot inherit them from a new treatment form | verification gap, see c; no invented backdated signature |
| Victor Hale: active “intake (legacy)” | same denied | same denied | same | HIPAA category would narrow if legacy boolean is removed; flag-derived provenance explains it under Decision 1, list explicitly | no signed-copy evidence; non-granting legacy record |
| Jordan Vega: active “in person — consent tab” (legal_part2_disclosure) | same denied | same denied for treatment; named legal disclosure may narrow | same | legal/referrer voluntary scopes may narrow → STOP if not explained by a flag | source-only legal row cannot be silently verified |
| Tomás Reyes: active “Front desk (demo)”, needsReviewAfterMerge | same denied | same denied | same | same held; mental-health section must not bypass merge review | keep merge hold, no recapture to defeat it |

**WIDENS:** no proposed authorized cell above is WIDENS relative to the pre-migration baseline. Restoring a subset of an existing treatment grant by explicitly signed demo capture is “same”, not permission to open a previously denied scope. A newly visible row, recipient, counseling item, cohort patient or below-11 total is WIDENS → STOP. All roles not named by G/D retain their original role gate; evaluate the complete roster rather than inferring grants from a patient's boolean.

### b. Independent demo need and proposed re-captures

| Patient | Independent source / need | Proposal |
|---|---|---|
| Marcus L. | overdue ASAM task + incomplete CalOMS discharge (`ehr.ts:26454–26467`), co-occurring SUD medication narrative (:26557–26560) | Proposed treatment-only capture if the demonstrated consent-gated task/share path requires it; preserve no-coordinator-consent / <11 reporting. Document that path before capture; clinical unconditional access alone does not justify restoring all gated roles. |
| Alicia Serrano | anxiety/advocate-patient example (`ehr.ts:26562–26566`) | No Part 2 recapture proposed. Stays narrowed. |
| Alicia R. | psychiatric refusal/sertraline fixture (`ehr.ts:5660–5766`) | No Part 2 recapture. Stays narrowed. |
| Marcus Whitfield / Lucía Moreno | MAR refusal demos (`ehr.ts:25630–25657,25715–25738`) | No Part 2 recapture. Both stay narrowed; do not enable in-facility. |
| Luis Camacho | named sud_consented persona (:26218,26268); signed ASAM (:26388–26407), buprenorphine/refill/CURES (:26582–26591) | Proposed treatment-only signed capture before SUD seed writes that need consent; identity-match duplicate is not granted. |
| Jasmine Holt | combination persona (:26219,26269); counselor ASAM awaiting cosign (:26408–26427); naltrexone (:26592–26598) | Proposed treatment-only signed capture before consent-dependent SUD seed writes; cosign workflow unchanged. |
| Daniel / Jordan / Victor / Tomás | untyped provenance or merge hold, not blanket permission | Resolve c first; do not grant back solely to pass a demo/test. |

Each proposed treatment capture: `part2_tpo_single`, recipient `{kind:"org", name:"Adelante", directoryRef:"adelante-program"}`, purpose/purposeCode `treatment`, method **e_sign**, fictional person's own signer/relationship, attestation, complete Draft Part 2 checklist and existing form version/hash/redisclosure fields. Use `runAction("consent_record_capture", …)` → existing capture/store (`consentCapture.ts:88–139,144+`), authorized actor, one registry audit; no direct flag setter or array push. No `care_coordination` purpose, counseling release, external recipient, legal or advocate scope piggybacks. Capture dates are real demo capture dates, not fabricated historic signatures. Expected extra seed events/IDs must be itemized; audit-count test conflicts STOP.

### c. Untyped pre-B2 migration and provenance stop

Verified untyped form records migrate through an idempotent registry/store action, retaining signer, signature method/time, original statuses/expiry/revocation, merge holds and disclosure links. Resolve **the exact signed copy + original form version**; verify `textHash(fullText)` against that copy, attach versionId/version/hash, and map only the signed categories and evidenced recipients/purpose/items. `consentForms.ts:301–335` already records signed copies, but carries prior sections (:306–316): a later form signature does NOT verify every carried-forward section. Never sign today's template on behalf of yesterday's patient or infer authorization from `source`, `signedAt`, checkbox-only attestation or a bare `createConsentRecord`.

Flag-only `migrateLegacyConsents` (`consentForms.ts:377–390`) becomes non-granting `legacyUnverified`; no guessed signature/hash. Future real signing should produce typed evidence through existing form actions, preserving cancellation/renewal/supersession rules and recipient-specific keys.

**Found blocking provenance gaps:** Daniel's cr-seed-1 is checkbox_only with no version/hash; its active legal demo replacement carries old sections but no signed copy (`outpatientCare.ts:307–319`). Jordan's legal row has the same gap. Victor's migration row is explicitly flag-derived. Tomás's AB133 is untyped (not typed despite its formType), has no form hash/version and remains merge-held (`identityDemoSeed.ts:51–60`). **No plan claims these rows are verified.** Build must stop for Mitch's provenance/capture decision before converting Daniel/Jordan to verified or causing unexplained narrowing. Preserve historical rows, never invent verification. The generic original plan “existing records migrate as verified” is conditional on this evidence, not an automatic grant. Also inventory future untyped writers: form sign/revoke, scribe grant/withdraw (`scribe.ts:243,266`), legal grant/revoke and identity seed; stop on any unmapped writer.

### d. Expected existing-test stops — current / proposed

**No edits authorized here.** These are source-review predictions, not failures observed by a B2-5 run. Every proposed positive-fixture replacement is a STOP for approval; it must preserve a legitimate authorized-flow check AND add flag-only denial, never grant solely to pass. Source-pinned adapters and historical matrices are not waived. File paths below are in `src/lib/__tests__/` unless stated.

| File:line | Current | Proposed / check disposition |
|---|---|---|
| consentEnforcementB2.test.ts:39–41 | Option A p3 flag grants | flag-only false; tighten; use isolated patient so proposed demo seed cannot hide denial |
| consentRecords.test.ts:10–25,59,88–95,108–139 | bare untyped helper grants, revoke/expiry/disclosure checks | approved evidence-backed typed fixture for positive lifecycle + untyped denial; keep revocation/expiry/exact disclosure assertions; STOP pending fixture approval |
| myWorkPart2Screeners.test.ts:38–51,73–80 | untyped grantSud enables peer rows | typed treatment fixture only with approval; keep positive/negative/MH-row assertions, add flag-only denial |
| dataExchange.test.ts:31–40,55–60 | setConsent true releases HIE / edits active untyped grant | flag alone remains held/false (tighten); separately test valid scoped capture/release, keep rejection/masking checks; no early-return skip |
| screenerPart2Store.test.ts:49–63 | false/true/false flag toggles peer access | false for flag-only; approved typed capture/revoke restores genuine positive lifecycle; keep denied-role and MH assertions |
| privacyP1.test.ts:73–79,108–115 | coordination flags define cohort and positive standard-note access | flag-only excluded; approved care_coordination typed fixtures for legitimate positive policy test, separate treatment consent if needed; keep 10/11 threshold and counseling denial |
| privacyP2.test.ts:16,20–49 | TPO/specific/counseling flags grant B/release | flag-only denies; approved typed coordination item lists / separate counseling release; keep exact B ceiling, group/no-other-role checks; emergency :64–89 unchanged |
| privacyP2Surfaces.test.ts:21–24; privacyP3SysAdminCohort.test.ts:18–26 | flag fixtures provide visible content / 11-person totals | approved typed positive fixtures plus flag-only denial; keep every withheld marker/no-name/11/<11 assertion; STOP if consent created merely to refill cohort |
| privacyP3EndAccess.test.ts:23 | noConsent removes flags | ensure no typed grant in emergency-negative fixture; keep all expiry/own-grant/exact-audit assertions; no source emergency edits |
| careMessageFlagMatrix.test.ts:32–38,42–73,92–138 | flag enables CM/peer locks/alerts | keep neutral message/clinical unconditional checks; tighten flag-only access, require approved valid-consent fixture for positive states |
| advocateNeedReferrals.test.ts:89–139 | flag plus authority unmasks some SUD referrals | flag-only denied; preserve HIPAA masking/independent authority boundaries; STOP any positive fixture that grants a broader advocate scope |
| sdohReferralConsentAttribution.test.ts:21+,52–64 | bare untyped record permits sensitive referral | evidence-backed authorized fixture + untyped denial; keep attribution, category sensitivity and all non-sensitive behavior |
| groupEnrollmentTelehealthConsent.test.ts:23+,62–105 | untyped telehealth section unlocks enrollment/list | approved typed telehealth fixture / signed-form migration; keep virtual gate, enrollment and self-book checks |
| poDisclosure.test.ts:16+,83–110; part2DisclosureAccessLog.test.ts | untyped voluntary/named disclosure grants | evidence-backed recipient/purpose fixture only; mandatory tier remains byte-identical; no broad TPO substitution for named disclosure |
| consentWorkflow.test.ts:179–187,192–199 | legacy migration one row; signed form then revoke | retain idempotence; assert legacyUnverified/no grant (tighten); real signed-copy path remains positive/revocable, not bare-source verification |
| consentAuditB2.test.ts:88–98,146–161 | bare form-like source / legacy labels | keep exact audit metadata/link checks; no inference of verified access from source text; STOP unexpected count or disclosure changes |
| consentInventoryB2.test.ts:9–54; src/test/consentB2Approved.ts; src/test/privacyP3Approved.ts:27–28 | exact reader counts/source substitutions | enumerate exact current→proposed reader lines, keep inventory and exact-once checks; new adapters require Mitch, never broad strip/allowlist |
| consentEnforcementB2Matrix.test.ts:51–58; consentAuditB2Parity.test.ts:36–45 | rollback equality of pre-migration gates/disclosures | retain immutable archived baseline; intentional migration differences will STOP; propose separate B2-5 expected-delta matrix, not regenerated rollback or weakened equality |
| roleDashboardParity9c2 / statTileParity9a2 / billingParity9a3 | approved source pins and original values | stop at any source/value change; keep cohort/suppression/access assertions, request exact adapter only when justified |

Further guarded candidates from the original inventory: part2SimulatedHardening.test.ts:49–94 (merge re-confirmation cannot verify a missing form), privacyP3Referrer.test.ts:33–41,90 (named recipient / neutral holds), consentAuditView, consentPublishReason, section4part2, intakeConsentReprompt.test.ts:11–34 and browser crossRole/consentWorkflow/consentSigningClearance/coordinatorEmergencyP2. Capture missing exact current/proposed lines at the first failure and STOP; do not label speculation a verified failure or claim the list proves completeness. Real form signatures migrate without widening; pure publication/privacy/flag-storage checks (recoveryStartDate:47–74, sdohNeedThread:87–97,173–185, asam/asamVisit) are expected unchanged unless they authorize access. section4part1.test.ts:13's derived-consent true after a flag is a potential tightening stop, not a storage-only exemption. No assertion, retry, timeout or named-flake change.

### e. Emergency and counseling unchanged

Keep emergency functions, grant Map, four-hour constant, coordinatorSudEmergency module and emergency OR term byte-identical to B2-4; compare pinned behavior/audit/disclosure for none/active/expired/ended/other actor/other patient. Migration never terminates or extends a grant. Emergency unlocks existing B items, never counseling notes. Counseling requires a separately signed `counseling_notes_release`, correct program/team recipient and `care_coordination` purpose; legacy release boolean, TPO or specific-written treatment record never substitutes. No demo counseling release proposed.

### f. Hard stops and validation

STOP on any WIDENS cell; any narrowing not explained by Decision 1; absent/mismatched original signature/form-version/hash; unknown scope/recipient/purpose; new roster/untyped counts; inherited-category “verification”; merge-hold bypass; emergency source/behavior/audit difference; cohort below-11 exposure; test loosening, skips, back-grants solely to pass, or any existing test edit beyond a newly approved exact change. Daniel/Jordan provenance and legacy historical parity expectations require decisions **before implementation**.

After explicit B2-5 build approval and resolution of stops: record fresh rollback SHA; migration through real registry/store only; NEW concrete flag-denial/provenance/idempotence/expected-delta tests; restart → full units → exclusive FULL background browser --workers=1 :8080 to literal EXIT → restore rollback screenshots → report/roadmap/final SHA. Named flakes remain only contentWiring:47 / staffNewAudit8a2:29 / auditTables8b3:13, accepted solely when one is the SOLE failure followed by 3/3 standalone; :33 is NOT named. No publishing. Stop now: plan only, no B2-5 code.
