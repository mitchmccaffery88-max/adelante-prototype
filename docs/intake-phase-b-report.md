# Intake Coordinator — Phase B (26 Oct 2026)

## Scope and result

Dedicated referral adapters only. No broad chart, consent-ledger, eligibility, SDOH, billing, pre-release-import or account-support grant was enabled for Intake. One acting role remains authoritative. No database, connector, real delivery, facility enabling or publication changes.

## Boundary rules

### B1 — paperwork/send/capture/status

- `intakePhaseB.ts` exposes separate `paperwork_send` and `paperwork_capture` checks for an active staff identity holding and acting as Intake Coordinator. The referral must be active administratively and have a confirmed, non-merged, unrestricted patient link. Missing treatment consent does not prevent receiving the consent itself.
- Allowlisted published templates: HIPAA intake authorization/release, telehealth, Part 2 program intake/treatment, portal and SMS intake forms. Recipient and amount/kind are fixed to the corresponding Adelante intake template; the required purpose picker uses canonical codes, never hidden text.
- `sendIntakeForm` reuses `sendForms`, with a fail-closed referral capability hook instead of chart entry. Delivery is explicitly Simulated and tagged with the existing notifications feature. Existing typed records prevent Intake resend/renewal.
- `recordIntakeElectronicForm` and `recordIntakePaperForm` reuse the existing typed capture/upload writers through a fail-closed capability hook. They require an actual signer, relationship, real signature date, future expiration, and explicit signature attestation. Every Part 2 element is separately confirmed. Electronic capture refuses a paper filename; paper capture requires one and uses the simulated upload flag.
- Intake cannot replace/renew an existing non-legacy typed record, even if expired/revoked. No history, scope editing, revoke, renew, disclosure or broad capture panel is mounted.
- The projection returns form label/key, Collected/Missing/Expired/Needs review, signature date and sent date only. Gate-valid typed evidence determines Collected, including merge/expiry/revocation holds. The packet projection feeds count-only progress into the administrative checklist, without claiming clinical assessment or forcing consent as a condition of MAT.
- Optional capture notes remain administrative preview memory, never gate/audit text. Paper-upload references retain the existing simulated metadata-only behavior; they do not claim durable scanned-copy storage.

### B2 — Billing-owned Medi-Cal requests/results

- `requestIntakeEligibility` is linked-referral, active-Intake, write-only. It creates a real neutral case task for an active Billing owner with the referral reference, Billing-only allowed roles, a due date and a stable dedupe key. If no active Billing owner exists it refuses instead of inventing one.
- Billing sees the request in its existing workspace. Its manual form is reused, but the dedicated request host runs `billing_intake_check` with a required reason and actual Billing attribution. Other existing check hosts remain unchanged.
- The result projection reads only a subsequent Billing/Billing Coordinator staff verification, not a referrer report or old check. It returns exactly Active/Inactive/Pending/Not found and checked-on date. Identifiers, notes, history, plans and billing records never enter the Intake projection.
- The underlying manual and electronic result stores explicitly refuse Intake actor roles. The generic eligibility action remains hidden. Electronic eligibility stays disconnected/Simulated; no live vendor response is fabricated.
- Billing ownership uses existing organization-level Billing access, not care-team/chart entry: the new task is neutral, contains no clinical/SUD narrative, and the result host remains Billing-gated.

### B3 — source-bound SDOH checklist

- `intakePacket.ts` owns a separate administrative need store. Sources are referral_form, partner_referral and pre_release_packet only; kinds are structured values. No patient/clinical need store is read to generate these rows.
- Source validation runs at ingestion and every projection/update: referral_form must reference that exact referral; partner/packet must reference the imported source or a referral-owned document of that source. Invented source strings, clinician-note origins and note payloads are refused.
- Intake logging changes only confirmed_still_needed/resolved/unknown in the packet checklist, requires a reason, rechecks source/consent/restricted-record/completion boundaries, and never creates a clinical need or care plan.
- At handoff, assigned care-team members see the checklist through existing chart/site/restricted-record and SDOH record rules. Part 2 need rows remain hidden if the acting role lacks its existing clinical access. No notes are inferred.

### B4 — staging importer and packet documents

- `importIntakeStaging` allows active Intake and clinical coordinator actors through a distinct staging permission. JSON roster input accepts 1–500 rows; the UI caps the input file at 2 MB. All row shapes, contact requirements, dates, SDOH shape and update targets are checked before writing.
- Creates/updates referral records only: identity, contact, referrer, release date, referral reason and source-bound packet SDOH. Updates require explicit referral IDs and open, unlinked staging records; there is no automatic identity match, patient creation, enrollment, clinical episode, county/coverage or HRSN write.
- EHR has a fail-closed staging hook and a dedicated `updateIntakeStagingReferral` store path. Staging creation is attributed to the real actor; its submission audit contains reference/contact-kind metadata only, no referrer identity. All existing non-staging referral behavior remains pinned.
- The original importer remains unchanged and unavailable to Intake. Clinical coordinator receives staging upload on the existing referral queue; Intake receives it in its own workspace. No new dashboard or facility navigation.
- `attachIntakePacket` accepts HRA, reentry plan, medication list or ROI with source, classification and bounded PDF/image/text file metadata. General classification is an explicit attestation; Part 2, SUD-related and unclassified documents default to restricted. Files are held only in preview memory under the existing simulated document feature.
- Intake always sees a visible lock and the exact reason “Part 2 — needs consent covering intake/treatment” while authorization is absent; protected filenames/types/content do not leak. An unrestricted linked patient and applicable program treatment consent unlock them. A restricted chart still refuses content access.
- Completion releases no new permission: assigned care-team document visibility/content requires existing chart/site/restricted-record, documents and Part 2 role rules. Other clinical audiences do not gain a new clinical view. In-app viewing is sandboxed; no outbound download/share path is added.

## Gaps and stop boundaries

- No new broad-access stop prevented the requested referral-scoped implementation. Hosted authorization, durable/encrypted storage and real delivery remain backend-phase work; none is claimed here.
- The release/ROI capture is the existing published program intake/HIPAA template. Arbitrary external-recipient releases and changes to scope are intentionally outside Intake: they require care-team decisions and the existing consent/disclosure workflow, not an Intake scope editor.
- Imported partner/packet provenance is an operator attestation to the uploaded source, not external partner authentication. No OCR, clinical inference, medication reconciliation or automated document classification is claimed. Unclassified files remain locked.
- Staging validation precedes all row writes; the existing in-memory store is not a transactional hosted importer and has no durable rollback contract.
- Consent templates/checklists and policy remain Draft — pending clinical/counsel sign-off. Existing Spanish clinical review and production-auth limitations remain unchanged.

## Tests and live verification

- New `intakePhaseB.test.ts`: 28 tests cover every allowlisted send/capture/paper form, real telehealth first-visit gate readback, adjacent broad-action denial, actual signature/checklist requirements, replacement/renewal refusals, all four coverage states and denied Intake entry, Billing registry completion, staging create/update and clinical coordinator access, no patient/appointment store writes, real clinician-origin need exclusion, source-reference refusal, checklist-only writes, document classification/consent locks, restricted charts and care-team handoff.
- Permission snapshot adds only the eight Intake entries plus one Billing-owned request-result entry. Existing action/role values remain unchanged. Consent inventory adds only four intakePhaseB reads and one intakePacket read. Historical EHR source adapter applies exact-once staging additions and two Intake-only result-entry denials; every other EHR byte remains pinned.
- Actual browser workflow: acting Intake sends/captures telehealth through the picker; Collected and signature date read back; restricted packet filename/content are masked; full Part 2 attestations unlock the document; acting Billing records a manual check through the request; Intake reads Active plus date only. 390px has no horizontal overflow; no page errors observed. Screenshots: `/tmp/browser/intake-b/`.

## Full validation

- FULL units: **3,387/3,387**, **393 files**, exit 0.
- FULL public browser: **47/47**, exit 0, **10.6 minutes**, isolated eight-spec suite with one worker against :8080. No concurrent units or application edits; no failed checks, retries or timeout changes.
- Latest preview build: OK. No retry/timeout changes. Nothing published.

## Changed files

- Boundaries/stores: `src/lib/intakePhaseB.ts`, `intakePacket.ts`, `intakeConsentBoundary.ts`, `intakeStagingBoundary.ts`, `intakePhaseA.ts`, `consentCapture.ts`, `consentForms.ts`, `ehr.ts`, `chartActions.ts`, `features.ts`.
- UI: `src/components/staff/IntakePhaseBActions.tsx`, `IntakeBillingRequests.tsx`, `IntakePhaseAActions.tsx`; `src/components/chart/IntakePacketHandoff.tsx`, `AssignedCareTeam.tsx`; `src/components/coverage/CoverageCheckDialog.tsx`; `src/routes/intake-workspace.tsx`, `billing.tsx`, `referral-queue.tsx`.
- Tests: `src/lib/__tests__/intakePhaseB.test.ts`, `consentInventoryB2.test.ts`, `runAction.test.ts`, its permission snapshot; `src/test/intakePhaseBApproved.ts`, `signupOct26Approved.ts`.
- Rules/docs: `AGENTS.md`, `roadmap.md`, `docs/b2-consent-inventory.md`, this report; Phase B requirement memory.