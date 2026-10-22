# B2-4 — consent enforcement switch (Option A)

Rollback 0089ca4fda285ead2c0632f8cf16c30c53f732c4 (HEAD 4032f64f appended only the plan section, kept). Draft — pending clinical sign-off and counsel. Not published. B2-5 not started.

## 1. Probe (step 1, read-only, scratch file under /tmp, deleted)
15 seeded patients.
- Option A, patients whose access changes in B2-4: **0** (confirmed by the matrix, §4).
- Option B, patients that would have lost access (legacy `part2Sud` flag, no untyped record): **7**: p3 Marcus L., p4 Alicia Serrano, p-demo-refusal Alicia R., p-demo-mar-seed Marcus Whitfield, p-demo-mar-seed-es Lucía Moreno, Luis Camacho, Jasmine Holt. The plan estimated about 5, but the probe found 7: the two MAR demo seeds are the in-facility-named fixtures, and Jasmine Holt is also a `sud: true` persona. This does not affect Option A.
- Seeded patients with a typed record: **0**. Nothing newly granted.
- Seeded coordinator flags (`sudCoordinationConsent` / `sudCounselingNotesRelease`): **0**. The ASAM coordinator cohort is empty, so totals stay hidden below 11.
- p1 keeps its untyped seed record (`cr-seed-1`). Untyped records are not legacy flags and keep answering until B2-5.

## 2. Precedence (src/lib/consentGate.ts)
A typed record **applies** to a gate only when its type, recipient and purpose match (and, for part2_specific_written, its item list contains the gate's item). If any record applies, `consentCovers` decides: expired, revoked, superseded and legacyUnverified records deny, with no fallback. If none applies, today's source answers (Option A).

| Gate | Type | Recipient (exact name or directoryRef) | Purpose | Item | Otherwise (today) |
|---|---|---|---|---|---|
| sud_treatment (wrapper: roles.ts consent_gated, screeners, HIE/county, chartOrders, rescreen, getConsentState) | part2_tpo_single | Adelante / adelante-program | treatment | — | untyped record section, then legacy flag |
| telehealth_services (booking, join, groups) | telehealth | Adelante / adelante-program | telehealth | — | untyped record section |
| group_confidentiality_ack | group_confidentiality | Adelante / adelante-program | group_confidentiality | — | untyped record section |
| Other categories (mental_health, case_coordination, billing, roi_collateral, advocate_sud_disclosure, legal_disclosure, information_sharing_disclosure, po voluntary, pre_release) | none at the category call site: callers carry no recipient, so no typed record applies | — | — | — | untyped record section |
| Coordinator SUD B items (coordinatorSudAccess.ts:32) | part2_tpo_single; part2_specific_written | Adelante care coordination team / adelante-care-coordination / Adelante / adelante-program | care_coordination | the B item (specific only) | `sudCoordinationConsent` tpo/specific; then `\|\| coordinatorEmergencyFor` (unchanged) |
| Coordinator counseling notes (:30) | counseling_notes_release only (TPO/specific never apply) | as above | care_coordination | — | `sudCounselingNotesRelease === true` |
| Referrer Part 2 named consent (referrerUpdateGate) | part2_specific_written | the referrer's own name / agency only | — | referral_status | legal-disclosure ledger naming the recipient |
| Referrer authorization (referrerUpdateGate) | referrer_authorization | the referrer's own name / agency only | enrolled: enrolled_update or status_updates; other events: status_updates | — | referrer authorization store |
| ASAM cohort (asamReporting.ts:92) | **held, see §6** | — | — | — | unchanged |

A record naming an external recipient (for example "Valley Clinic") never applies to an internal gate. External and referrer gates match only their named recipient. Verbal-assent limits are enforced inside `consentCovers`.

## 3. Readers switched
- ehr.ts `isConsentCategoryAuthorized`: now a wrapper over `consentGate`. The pre-B2-4 body is unchanged as `_consentCategoryToday`, and the ledger is registered at the end of the file. Every existing caller follows automatically, with no caller edits.
- coordinatorSudAccess.ts:30 and :32 (`coordinatorPart2Consent` exported). The emergency term is textually unchanged.
- referrerUpdateGate.ts `referrerDecisionFor`: `decideReferrerUpdate` and the P3 messages are unchanged.
- Direct flag reads not changed: intake.tsx:590, onboarding.ts:18 and consent.tsx:142 report intake status, not access. CoordinatorSudPanel.tsx:23 and adelBrief.ts:408 are cache keys only (the panel re-reads every second). recordSections.tsx:500 is a display prop. The migration writers stay for B2-5.

## 4. Matrix (rollback vs current, pinned clock)
`src/test/consentEnforcementB2Scenario.ts` covers 15 patients x every roster role x these surfaces: 13 consent categories, getConsentState, 9 coordinator items, 7 disclosure recipient kinds (part2ConsentFor), screeners_sud access + ASAM row/section + SUD program visibility per role, the ASAM cohort and mode per role, and every referral x 4 referrer events. It runs in four states: the default seed, after the billing lifecycle QA scenario, after capturing five external-recipient typed records per patient, and through the emergency states. Fixture produced on `git archive 0089ca4f`: `src/lib/__tests__/fixtures/consentEnforcementB2-rollback-0089ca4f.json`. Result: **zero differences** (`consentEnforcementB2Matrix.test.ts`). No WIDENS cell, no narrows cell. B2-6 `consentAuditB2Parity` is still byte-identical.

## 5. Emergency path
- Source: the bodies of coordinatorEmergencyFor, validateCoordinatorEmergency, saveCoordinatorEmergencyGrant and endCoordinatorEmergencyGrant hash identically (SHA-256) to rollback. The grant Map and the 4-hour constant are unchanged, coordinatorSudEmergency.ts is identical, and the `|| !!coordinatorEmergencyFor(...)` term is present.
- Behaviour: the matrix covers no grant, active, expired, ended and after-end for every patient, identical to rollback. Active grants open the 8 B items and never counseling notes.

## 6. Hard stop — asamReporting.ts:92 held
Switching this line edits src/lib/asamReporting.ts. That file is pinned byte-identical by roleDashboardParity9c2 (rollback aff263ff), statTileParity9a2 and billingParity9a3, through `withApprovedP3`. The pre-approved edits for B2-4 are limited to consentInventoryB2 pins and consentB2Approved ehr.ts substitutions, so it needs an adapter outside that list. The line is reverted to rollback and still reads today's flags. Its behaviour is identical to the switched version under Option A, because no seeded typed record applies. Approval needed: one exact-once substitution for asamReporting.ts (an import line and the `.filter` line calling `consentGate(p.id, coordinatorNeed("diagnoses"), () => <today's expression>)`) in `src/test/privacyP3Approved.ts`.

## 7. Test edits
- consentInventoryB2.test.ts (pre-approved): ehr.ts 44 → 45 (the wrapper comment names consentCovers); new pin `src/lib/consentGate.ts: 8`. The coordinatorSudAccess.ts, referrerUpdateGate.ts and asamReporting.ts counts are unchanged.
- src/test/consentB2Approved.ts (pre-approved): three exact-once ehr.ts substitutions (B2-4.1 import, B2-4.2 wrapper hunk, B2-4.3 ledger registration).
- New: consentEnforcementB2.test.ts (13), consentEnforcementB2External.test.ts (1), consentEnforcementB2Matrix.test.ts (1) + fixture, e2e/consentEnforcementB2.spec.ts (1; external record stays locked, coordinator-team TPO opens, counseling stays hidden, revoke locks, axe).
- docs/b2-consent-inventory.md: B2-4 section added. No other existing test touched.

## 8. Validation
- Dev server restarted; build OK.
- Full units: 2,950 / 2,950 across 370 files, EXIT 0.
- New spec standalone: 1/1.
- Full browser (one worker, :8080, background, nothing else running): **224 passed / 224, 37.2m, literal `EXIT 0`**. No flake exception used.
- Screenshots: 17 regenerated tracked images restored from 0089ca4f; 0 differ.
