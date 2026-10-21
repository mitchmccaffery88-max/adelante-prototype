# B3a — Seeded end-to-end claims

## Checkpoint and outcome

- Rollback recorded before B3 edits: `2f56b883487b7d927a7c63d080bfc14459173a40`, the “Collected CalAIM decision” documentation checkpoint after DMC source checkpoint `615a3ac8`.
- Mitch superseded the diagnostic stop with B3a approval. B3b privacy narrowing remains separate; no billing rules, rates, states, role visibility, default seeds, denied styling or existing tests changed. Nothing published.
- Implemented the separate opt-in QA scenario plus NEW unit and browser tests. Final validation is recorded below; prior DMC totals are not B3a validation.

## Diagnostic questions — resolved by Mitch for B3a

Retain the financial fields; preserve county exports; stable keys resolve generated IDs without injection; partial is a patient receipt with unchanged claim state; paid is the existing transition with no payer-remittance ledger; assert exactly one registry success and one lifecycle audit per transition. The following original inventory records why these decisions were requested, not unresolved approval items.

1. **Financial reconciliation fields:** the strict P1 allowlist excludes payment method, receipt/reference, recorder attribution and void reason. These are used by the existing receipt/payment/void workflow (`PatientBalance.tsx:24–165`, `OpsActionLauncher.tsx:263–276`). Simply removing them loses reconciliation and void-review information. Approve a narrow financial-field extension or an alternative authorized workflow before removing them.
2. **County reporting layout:** the active ISL builder includes `care_continuum`, funding classification and service references; adjacent client-level reporting files include episode/substance fields. Removing these changes existing reporting layouts (`countyReporting.ts:280,302–329,537–577`). Decide their separate reporting boundary rather than treating them as ordinary claim payloads. No new reporting access is proposed.
3. **Repeatability:** patient, appointment, claim and payment IDs are internally random. Public creation APIs accept no explicit IDs (`ehr.ts:4469,8549–8595,9190–9278`; `ehr-ext.ts:491,1076–1090,1357–1381`). Choose stable scenario keys resolving generated record IDs, or explicitly approve an ID-injection mechanism; neither global random replacement nor internal mutation was applied.
4. **Payment meaning:** existing APIs record patient receipts only; there is no payer-remittance ledger. `paid` is an allowed workflow transition, but marking paid does not record insurer payment. `partial` exists as a state but has no incoming transition (`ehr-ext.ts:205–232,1179–1240,1357–1402`). A supported partial patient receipt can leave a visible responsibility balance while retaining its existing claim state. Confirm that meaning for B3, or separately approve missing remittance/state functionality; no state/rule change was made.
5. **Audit assertion scope:** a registry transition produces one `action.succeeded` event plus the store's one `claim_status_changed` lifecycle event (`runAction.ts:180–200`; `ehr-ext.ts:1218–1240`; `ehr.ts:17344–17391`). Test one event of each existing type, not one total event, unless a separate audit architecture change is approved.

## Supported lifecycle inventory

| Stage | Existing public path | Notes |
|---|---|---|
| Fictional patient | `ehr.ts:8549–8595` `createPatient` | First/last name required; DOB/CIN/contact optional. Omit DOB and SSN rather than invent realistic identifiers. |
| Scheduled visit | `ehr.ts:9190–9295` `bookAppointment` | Real scheduling/credential/consent gates remain. |
| Attended visit | `chartActions.ts:1473` `visit_attended` → `markAppointmentAttended` | Use the authorized attendance path; existing encounter bridge creates the claim. |
| Encounter claim | `ehr-ext.ts:1076–1115` `upsertClaimFromEncounter` | Idempotent encounter linkage; code/program/minutes/rate pricing; starts documented. |
| Linked note and signature | `ehr.ts:11587,11643–11750,12163–12202` | `addProgressNote`, `signProgressNote`, `cosignProgressNote`; linked appointment and valid attestation required. |
| Signature mirror | `ehr-ext.ts:975–1059` | Final signature advances documented → signed; pending cosign does not. |
| Code/rate correction | `ehr-ext.ts:1248–1299`; `rates.ts:287–338` | Existing `correctClaim` and effective-dated pricing; no invented amount or rate. |
| Claim lifecycle | `chartActions.ts:843–853`; `ehr-ext.ts:1179–1240` | `claim_status` via registry; signed → coded → generated → submitted → paid/denied. |
| Write-off/reversal | `billing.tsx:200–215,535–600`; `ehr-ext.ts:219–239` | Existing confirmation/reason path; written_off → generated requires reason and gates. |
| Patient responsibility | `ehr-ext.ts:1307–1350,1357–1433` | Arrangement, patient receipt and payment void; payments do not change claim state. |
| DMC-ODS necessity | `dmcOdsReadiness.ts:33–111`; `asamFlow.ts:24–61`; `ehr.ts:10172–10312` | Final signed/cosigned ASAM plus linked SUD diagnosis in existing window; billing sees generic block only. |

Blocked is a refusal, not a synthetic claim state. Paid is terminal. Each branch has a separate fictional patient and encounter; omitted DOB/CIN/contact identifiers. `billingLifecycleScenario.ts` provides stable keys over generated IDs and idempotent loading. The UI option is `Billing: full claim lifecycle`; default seeds do not invoke it. Rehearsal cohorts use the same public builder without terminal transitions so the browser can exercise the real actions without resetting records.

## Implemented B3a

- Branch keys: paid, receipt_balance, denied, writeoff_reversed, blocked, sliding_fee, dmc_ods.
- Existing public creators and registry paths: patient_create_anyway/createPatient; payment_arrangement/setPaymentArrangement; consent_purpose_set/staffSetConsent; schedule_visit/bookAppointment; visit_attended/markAppointmentAttended; progress_note/addProgressNote + signProgressNote; claim_correct/correctClaim; claim_status/transitionClaim; payment_record/recordPatientPayment.
- The existing ASAM action now references public saveAsamDraft, signAsam and cosignAsam methods; its role/patient gate is unchanged. The fictional trainee's assessment is signed and cosigned by its assigned therapist, outpatient only, F15.20 linked to the assessment. A separate attended treatment encounter is corrected to H0004/DMC-ODS and passes the unchanged necessity gate. Signing ASAM creates its existing H0001 assessment claim as a store-owned lifecycle output; it is not an injected branch encounter.
- Rate-derived examples: 90834 self-pay $165.00; half patient receipt $82.50 leaves $82.50 and submitted status; sliding fee $82.50; H0004 3 × $41.25 = $123.75. Paid branch records full patient responsibility via the public receipt API, then uses the existing paid transition (no insurer remittance invented).
- NEW `billingLifecycleB3.test.ts`: creators spied, stable keys/generated IDs, rate×units, balances/states, final cosigned ASAM/linked diagnosis, registry ASAM events, and idempotent loading.
- NEW `claimLifecycleB3.spec.ts`: both billing roles select the actual QA option, walk seven rehearsal branches through real UI, check dual audits for each transition and reason stops, receipt/readback/state preservation, denied class unchanged, unsigned Ready refusal, both current CSV headers and safe content, table axe and peer denial. Development inspection remains behind the existing compile-time DEV/E2E boundary.

## Payload inventory — received versus rendered

These are in-memory reads, not verified network responses. A hidden field is still received when an entire record reaches the page. The P1 allowlist used here is: identifier on the claim, payer/member ID, date of service, service type/duration, provider, claim CPT/HCPCS and claim ICD, amounts and status.

| Surface | Received fields / source | Rendered fields / source |
|---|---|---|
| `/billing` | Whole appointments, patients, clinicians and claims (`billing.tsx:113–119`) | Date, program ID, provider, funding lane, amount/units/rate/balance, status, signature provenance, draft state, denial reason and encounter data attribute (`:435–455`); ISL reason/service (`:488`). |
| `/admin-claims` | Whole claims/patients/clinicians; clinical audit events filtered after receipt (`admin-claims.tsx:221–231`) | Patient name/source/duplicate hold/code/units/provider/status/signature/block/amount/denial or review flag (`:390–439`); group topic, occurrence and other attendees' IDs/status (`:395–430`); blocked service/reason code/free text (`:365–377`). |
| Claim amount/detail | Whole Claim prop (`RatesPanel.tsx:41–64`); patient arrangement (`PatientBalance.tsx:24–27`) | Charge, code/program/unit basis/rate/no-rate reason; correction inputs (`RatesPanel.tsx:69–125`); balance/portion/paid/payment method/date/reference/recorder/void reason (`PatientBalance.tsx:24–165`). |
| Claim signature | Claim history signature (`ClaimSignatureLine.tsx:5–27`) | Note ID with chart link, signer role/name/date, author, attestation key/version; seed label. |
| Operations claim forms | Whole claims/workspace and whole patient collection (`OpsActionLauncher.tsx:130–145,194–204`) | Patient label/date/code/state/hold (`:163–183`); code/program/units/reason; move state/reason; amount/date/method/reference; duplicate counterpart ID (`:223–285`). |

No dedicated claim-detail route was found; inventory includes the amount, correction, signature and payment popovers plus operations forms.

### Entire received record schemas

- **Patient (`ehr.ts:1634–1934`):** identifiers, site/merge/duplicate fields, prescriber, name/DOB/contact, release/enrollment/timezone/episode information, consent and consent events, screeners/history/missed screeners, needs/flag origins, care-plan summary/intake, payment arrangement/attribution, coverage/plan spans/verification/non-Medi-Cal answers, case manager/check-ins/resources, crisis flag, program ID, goals/seeking/suggestions/requests, ASAM, severity, notes/tasks, preferences/emergency contacts/signup/address/CIN/other IDs, demographic history/messages/episodes/custody/SDOH/CalOMS/peer notes/care plans, diagnoses/problems/allergies/alerts/escalations, medication orders/administrations/dose claims/supplies/refusals/housing/reconciliation. Clinical subgraphs are **beyond P1** and must not reach billing just because UI hides them.
- **Appointment (`ehr.ts:2139–2188`):** id, patientId, clinicianId, start, durationMin, status, source, videoUrl, fundingLane, serviceType, modality, locationId, chargeCents, islReason, asamTaskId, cancellation/request/no-show/check-in/attended-by data, reschedule links, assignedStaffId. ASAM task and non-claim lifecycle metadata exceed P1.
- **Clinician (`ehr.ts:2081–2094`):** id/name/credential/Medi-Cal credentialing/status/services/locations/license expiry/languages. Provider reference data is separate from clinical patient payloads.
- **Claim (`ehr-ext.ts:261–332`):** id; duplicateReview (mergeId/otherClaimId/flaggedAt); encounterId/patientId/clinicianId; state/chargeCents/serviceDate/program; program/code/units provenance; minutes/rateId/rateCentsPerUnit/rateStatus/noRateReason; denialReason/updatedAt/history (timestamp/state/actor/name/role/note/justification/signature); serviceCode/units/taxonomy/supervisingStaffId/arrangementMissing/payerId; copay/deductible/coinsurance/payerPortion/patientPortion/paid/balance; reviewFlag (kind/label/time/noteId), voidBlocked, overpaymentReview, patientPayments. No claim-linked ICD or member-ID field was found; do not substitute clinical diagnosis lists.
- **Payment (`ehr-ext.ts:342–357`):** id, cents/date/method/reference, recorder identity/role/time and void identity/time/reason. Reconciliation fields exceed the literal allowlist and are a stop boundary above.

## Every identified billing export

| Export | Exact fields and source | Excess / disposition |
|---|---|---|
| Admin claims CSV | Program ID, Clinician, State, Code, Units, Unit basis, Charge (USD), Denial reason, Group-sourced, Group session ID, Occurrence start (`admin-claims.tsx:273–307`) | Denial free text and group provenance beyond strict P1. No changes made. |
| Operations claims CSV | claim_id, patient_program_id, service_date, service_code, units, program, status, charge_cents (`billingWorkspace.ts:50–63`; launcher `:318–323`) | Closest allowlisted projection; claim ID is operational linkage. Exports all claims. |
| Active ISL CSV | service_ref, date, client_record_id, service, program, care_continuum, funding_lane, minutes (`countyReporting.ts:280,302–329`) | Continuum and service-reference/reporting classification require reporting boundary decision. SUD rows use existing authorization and disclose(); no gate widened. |
| Legacy ISL fallback | appointment ID, date, program ID, clinician, service type, modality, duration, funding lane, ISL reason, billing status, charge (`ehr.ts:17390–17415`) | Active registered builder takes precedence. ISL reason/modality/reference exceed literal list. |
| DMC readiness CSV (adjacent reporting) | Episode ID, client ID, opened/closed, selected care level, ASAM version/signature, LPHA cosign, SUD diagnoses, necessity, primary substance/route/frequency/first-use age/prior treatment, discharge date/status/reason, admission/discharge completeness (`dmcOdsReadiness.ts:193–230,291–322`) | Not a claims export. Reporting and disclosure gates must remain; removing fields changes reporting workflow. |
| County CalOMS (adjacent reporting) | Record type, client ID, episode ID, event date, provider number and seven reporting/clinical columns currently emitted as MISSING/on file (`countyReporting.ts:139–140,537–553`) | Client-level reporting, not P1 claim data; preserve owner-only access. |
| County DATAR | Program, capacity, waitlist, admissions (`countyReporting.ts:563–569`) | De-identified reporting aggregates; existing suppression remains. |
| County BHOATR | Funding, program, care continuum, units, minutes (`countyReporting.ts:570–573`) | Aggregate reporting, not individual claims; existing suppression remains. |
| County TPS | Eligible, offered, completed, declined (`countyReporting.ts:574–577`) | Aggregate reporting; existing suppression remains. |

Superbill and good-faith estimate are unimplemented registry entries (`chartActions.ts:1174–1185`), not real exports. Rates/codes/managed-care-plan/credentialing tabs are reference administration; they do not justify receiving whole patient records. Billing's ISL export description (`billing.tsx:473–474`) differs from its active builder; no copy or format change made.

## B3b deferred — not implemented in B3a

- Billing-specific read projections, retaining explicit action IDs and minimal allowed financial fields, could remove clinical patient subgraphs without altering shared clinical stores.
- Remove other attendees and group topic from billing group popovers; preserve individual claim processing.
- Replace note/author/attestation provenance with billing-safe signed/blocked status; keep store signature validation.
- Name policy: `/admin-claims` still uses raw names; align with existing `staffPatientLabel`/chart access, not a new permission.
- Use actual claim serviceDate for standalone claims instead of history/update timestamp (`billing.tsx:125–150`). This is a separate correctness observation, not implemented.
- Denial remediation, payment reconciliation, duplicate review and county file contracts need explicit approved treatment before removing their required fields.

## Validation and closeout

Focused builder 2/2 and focused browser 3/3 passed during implementation; both exports downloaded through the actual controls. Final sequence pending: finish edits → restart → full units → exclusive full one-worker browser suite on :8080, polled to literal EXIT as last validation → rollback screenshot restoration → report/roadmap/final SHA. No publishing or manual Git state changes.