# Payment and coverage rules for every appointment — 29 Oct (Mitch)

**Draft — pending billing/compliance review with Christi.** Not published. Persistence OFF. No Supabase change: client coverage has no database mirror (the only coverage table, `clinician_coverage_assignments`, is staff-to-staff coverage). No rates, tiers or billing codes were invented.

Every appointment now answers two questions on its own date: **who pays**, and **can this staff member render it**.

## 1. One funding-source resolver
- `resolveFundingSource(patientId, serviceType, dateOfService)` in `src/lib/fundingSource.ts` (pure core `resolveFundingSourceFrom`). Returns a source (`medi_cal_mcp`, `county_mhp`, `county_dmc_ods`, `medi_cal_ffs`, `commercial`, `medicare`, `private_pay`, `grant_or_county_funded`, `non_billable`), the coverage record used, the enrollment payer key, neutral flags, or "Coverage — needs review".
- Coverage spans (`CoveragePlanSpan`) gained optional `order` (primary/secondary) and `planType`; `addCoveragePlan` accepts both. Older spans are read conservatively by payer name ("Medi-Cal FFS" → FFS, other "Medi-Cal" names → plan, "Medicare" → Medicare); anything else is "needs review".
- Medi-Cal is payer of last resort: with commercial or Medicare plus Medi-Cal, the other coverage is primary and Billing gets "Coordination of benefits — review".
- No coverage and the client chose to pay (self-pay / sliding fee) → private pay. Grant/ISL arrangement with no coverage → grant_or_county_funded. Non-billable service types → non_billable.
- Booking stores the result on the appointment (`fundingSource`). Billing (`billing`, `billing_coordinator`) or Intake can change it with a reason code through the new registry action `appointment_funding_set`; one audit row with appointment id, from/to source and reason code only.
- Readiness (`careLifecycle.billableService`), credentialing review flags, the booking hard stop and groups all use the stored/resolved source.
- Not yet bridged: the separate coverage-request determinations (`coverageRequests.ts`, which hold their own primary/secondary order) are not read by the resolver yet. Listed as open.

## 2. Full Draft delivery-system table (for Mitch and Christi to confirm)

| Service type | Draft tag | Usually pays | To confirm |
|---|---|---|---|
| intake — First visit (intake) | smhs_or_nsmhs | county_mhp when the clinician's SMHS determination says so; otherwise medi_cal_mcp, or medi_cal_ffs when not in a plan | SMHS determination picks county MHP vs plan/FFS |
| therapy_individual — Talk with a counselor | smhs_or_nsmhs | as above | — |
| therapy_group — Group session | smhs_or_nsmhs | as above, per member | — |
| med_management — Medication visit | nsmhs | medi_cal_mcp, or medi_cal_ffs when not in a plan | — |
| controlled_med_moud — Controlled medication / MOUD visit | county_dmc_ods | county_dmc_ods (+ "Delivery system — needs review (Draft)" flag) | Confirm Tulare/Kings DMC-ODS participation; plan or FFS billing needs review |
| sud_counseling — Individual counseling (SUD) | county_dmc_ods | county_dmc_ods | Confirm Tulare/Kings DMC-ODS participation |
| sud_group_odf — ODF group | county_dmc_ods | county_dmc_ods | same |
| sud_group_iot — IOT group | county_dmc_ods | county_dmc_ods | same |
| peer_support — Peer support | county_peer | county_mhp (SMHS) or county_dmc_ods; **non-billable until county opt-in is confirmed** (`countyPeerOptInConfirmed: false`) | Confirm county opt-in |
| case_management — Meet your case manager | ecm_mcp | medi_cal_mcp only with an active ECM enrollment episode; otherwise non-billable | ECM enrollment only |
| care_coordination — Care coordination | non_billable | non_billable | — |

Draft county payer keys: "Tulare County MHP", "Tulare County DMC-ODS" (Kings pending). Commercial/Medicare/plan keys are the coverage span's payer name.

The SMHS determination is a dated field on the care plan (`smhsDetermination`), set only by a treating licensed clinician (therapist, PMHNP, physician) through registry action `smhs_determination_set`. Never inferred.

## 3. What gets checked, by funding source
`credentialedForService(..., { fundingSource })` / `evaluateCredentialing` input `fundingSource`:
- **Every clinical service, any source (incl. private pay):** license/registration verified and unexpired on the date of service; supervision for associates/trainees; DEA for the Controlled medication / MOUD type; exclusion check not overdue and no hit as of booking. For private pay and grant visits, exclusion reasons read "… — Adelante policy (Draft)".
- **Enrollment only where required:** medi_cal_mcp, county_mhp, county_dmc_ods, medi_cal_ffs → active enrollment for that service with the source's payer key. Commercial → in-network enrollment; none → flag "Out-of-network — needs review", not blocked. Medicare → flag "Medicare — needs review (Draft)", not blocked. Private pay / grant → no enrollment check.
- **non_billable:** no credential check; existing role gates still apply.
- Private pay shows "Fee: per sliding scale (Draft — tiers pending)". No amounts.
- Draft for Christi: the booking hard stop for private pay / grant applies to visits dated today or later; back-dated entries are flagged for Billing review instead.

## 4. Billable roles without a clinical license (Draft — confirm with compliance)
Extended the existing credential record (no new store): `peerCertification`, `chwQualification`, `supervisingProviderStaffId`, `ecmTraining`; organization-level ECM contracts per plan in `ECM_ORG_CONTRACTS_DRAFT` (fictional rows). Checked only when billable for the resolved source. New Credentialing Coordinator tile "Peer, CHW and ECM credentials" plus expiry items (90/60/30) for each.

## 5. Groups with mixed payers
`groupSessionFundingReview` (`src/lib/groupFunding.ts`): each member resolves its own source; the facilitator check runs per member; only an affected member is flagged; a non-billable group never flags. The group page shows only "Billing review needed for N member(s)".

## 6. Recurring series (staff only)
`AdelanteEHR.bookAppointmentSeries` + registry action `schedule_visit_series` (same gate as `schedule_visit`). Weekly or every two weeks; end date or number of visits; Draft maximum **26 visits per series**. Each occurrence calls `bookAppointment` (rights, credential, coverage checks) and gets its own audit row (`appointment_series_occurrence_booked` / `_blocked`, ids only). Blocked occurrences are listed in the Book a visit drawer with the neutral reason so staff can rebook with another clinician. Group types and patient self-scheduling are refused.

## 7. Demo data and the rename
- Demo clinician c5 renamed to **Dr. R. Sample** ("Dr. Riley Sample, M.D.") in seeds, fixtures, tests and docs; c5 stays the overdue-exclusion case. Dr. Bagga references that name the real clinical reviewer/sign-off were kept.
- The "DEA expires in 20 days" case moved to c3 (Anita Brooks, fully credentialed, enrolled for MOUD with Medi-Cal FFS and Tulare County DMC-ODS). c5 DEA now long-dated.
- Opt-in fictional mix (`src/lib/coverageMixScenario.ts`, real creators, default seeds unchanged): plan client with an SMHS determination (county_mhp therapy + plan med management), DMC-ODS MOUD client, commercial-primary + Medi-Cal (COB), private pay, grant-funded reentry; a therapy group evaluated with members on three sources.

## Confirm-lists
**For Christi (billing):** the delivery-system table above; county payer keys; MOUD via plan/FFS; Medicare handling; out-of-network policy; commercial in-network rule; back-dated private-pay hard-stop rule; ECM billable only with an ECM episode; peer support opt-in; COB precedence; sliding-scale tiers (pending).
**For compliance:** peer certification + supervising provider; CHW certificate or experience attestation + supervising licensed provider; ECM training attestation + organization contract per plan; skipping individual enrollment for peer/CHW/ECM staff; exclusion screening as Adelante policy for private pay/grant; DEA only for the controlled type.

## Tests and validation
- New `src/lib/__tests__/coverageRulesOct29.test.ts` (18 tests): resolver tags, SMHS determination, payer-of-last-resort, missing coverage, non-billable; private pay never checks enrollment; commercial out-of-network flags; county MHP enrollment; peer/CHW/ECM only when billable; mixed-payer group; series books allowed/lists blocked with one audit per occurrence; no patient series; projection unchanged except the funding-source value; button = store for all 18 roles; opt-in demo mix.
- Superseded assertions updated (no weakening): credentialing tiles now six (new role-credentials tile); MOUD seed test now checks the DEA-expiry case on c3 (and that DEA is its only reason); enrolled-MOUD test de-duplicates c3's two payer rows; B3b appointment allowlist adds `fundingSource` and asserts its keys; cross-role J2 matches the renamed signer.
- Registry snapshot: 54 additive rows (3 new actions × 18 roles), no removals.
- Full units: **3,688 / 3,688** (416 files).
- Public browser suite: see "Browser acceptance" below.

## Re-pins (pre-approved exact-once adapter)
`src/test/coverageRulesOct29Approved.ts`, composed last in `credentialingOct27Approved.ts`: `src/lib/ehr.ts`, `src/lib/ehr-ext.ts`, `src/lib/credentialing.ts`, `src/lib/careLifecycle.ts`, `src/lib/billingProjection.ts`, `src/lib/chartActions.ts`, `src/lib/structuredCarePlan.ts`, `src/lib/roles.ts`, `src/lib/chartOrders.ts`, `src/lib/demoInboxSeed.ts`, `src/lib/outpatientCare.ts`, `src/components/credentials/CredentialingToday.tsx`, `src/components/scheduling/BookVisitDrawer.tsx`, `src/routes/group-sessions.tsx`.

## Open
- Bridge coverage-request determinations (`coverageRequests.ts` order) into the resolver.
- Christi/compliance confirmations above; sliding-scale tiers; real billing code mapping for the MOUD type.
- No UI yet for the SMHS determination or for Billing/Intake "Change who pays" (registry actions and store exist).
