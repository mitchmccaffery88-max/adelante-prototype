# Cross-role test report

Clock frozen at Tue 29 Sep 2026 08:00 Pacific (`src/test/freezeClock.ts`), advanced explicitly where a journey needs it.
Store-level journeys: `src/lib/__tests__/crossRoleJourneys.test.ts` (15 tests). Browser: `e2e/crossRole.spec.ts` (13 tests). Screenshots: `docs/cross-role/*.png`.

## Ownership fix (step 1)
- Peer, CHW, ECM provider and care manager may dictate only on visits where they are the assigned or rendering staff (`Appointment.assignedStaffId`, set automatically when a contact role books).
- AFBI: only the recording staff member may dictate onto a contact; a coordinator/sys_admin can reassign it (reason required, audited).
- Enforced in the scribe store check, so the registry path (`runAction` → store) blocks it and writes `action.blocked`. Inline reason: "You can only dictate on your own contacts". Tests: `scribeOwnership.test.ts` (own allowed, colleague blocked, AFBI owner rule).

## Journeys
| # | Journey | Result | Notes |
|---|---|---|---|
| J1 | Referral → first visit | Pass (unit) | Chase task in coordinator pool; peer fill shrinks it; coordinator books Anita in person on real availability; patient notified; attended; timely-access line shows request / offered (+2 d) / kept. |
| J2 | Medication chain | Pass (unit) | Order → RN verify → LVN give (cosign routed) → RN cosign; each step in next person's queue; LVN review refused; new signature trail ordered/reviewed/given/cosigned; chart badge now also shows "Ordered by". |
| J3 | Crisis | Pass (unit) | Owned by assigned clinician with countdown; reasoned handoff; crisis note on 1-day clock at top of Needs closing; +2 d → coordinator pool with Reassign; text neutral. |
| J4 | Scribe by role | Pass (unit + browser) | Physician/PMHNP/therapist sign directly; SUD counselor and RN sign then route to licensed cosign (existing policy) — deletion stub after final sign. Peer/CHW/ECM dictation only; LVN/billing/admin none (browser: no scribe entry). No consent / unnamed bystander blocked. |
| J5 | AFBI → ISL | Pass (unit) | Initials-only dictation, coordinator confirms link, row moves under the person, ISL lane, never a claim. Because the dictated activities are SUD-related, the named row now goes through disclose() and is withheld without county consent. |
| J6 | County reporting | Pass (unit) | Billing coordinator gets CalOMS client rows with no ASAM signature / medical-necessity columns and no notes/ASAM/care-plan access; plain billing aggregates only, <11 suppressed. |
| J7 | Part 2 sweep | Pass (unit + browser) | Fixture Luis Camacho (signed ASAM, buprenorphine). Matrix below matches the registry; browser confirms ASAM tab content per role (10 roles). |

## J7 role × item matrix
| Role | asam_section | sud_meds | sud_instruments | scribe_draft | partner_sud_link | disclosure_log | therapy_notes |
|---|---|---|---|---|---|---|---|
| ecm_provider | hidden | hidden | hidden | hidden | hidden | hidden | metadata only |
| cf_care_manager | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| sud_counselor | sees | sees | sees | sees | sees | hidden | sees |
| clinical_trainee | hidden | hidden | hidden | hidden | hidden | hidden | sees |
| medical_assistant | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| peer_specialist | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| community_health_worker | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| therapist | sees | sees | sees | sees | sees | hidden | sees |
| physician | sees | sees | sees | sees | sees | hidden | sees |
| pmhnp | sees | sees | sees | sees | sees | hidden | sees |
| nurse_rn | sees | sees | sees | sees | sees | hidden | hidden |
| lvn | sees | sees | sees | sees | hidden | hidden | hidden |
| billing | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| clinical_coordinator | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| credentialing_coordinator | hidden | hidden | hidden | hidden | hidden | sees | hidden |
| billing_coordinator | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| sys_admin | hidden | hidden | hidden | hidden | hidden | sees | hidden |

## ECM / care manager note-content restriction (follow-up)
Draft — pending executive RBAC review. `therapy_notes` for `ecm_provider` is now `summary` (metadata: date, type, author, signed status, visit). Bodies, scribe drafts and transcripts show "Clinical note — content restricted for your role"; own-authored and coordination notes stay readable. `cf_care_manager` already had no access. Enforced in `noteBodyRestricted` / `redactNoteBodies` (roles.ts) on chart, note peek, chart review, Adel Brief data, note PDF, print record, scribe view, and the inbox unsigned tab. Test: `ecmNoteContent.test.ts`.
Permissions snapshot: no action changed state; new `_clinical_note_content` block (ecm_provider = metadata). ECM loses Notes queue and Cosign inbox menu entries (could not sign anyway).

## Browser journeys (follow-up) — `e2e/crossRoleJourneys.spec.ts`, clock fixed with page.clock
Steps run the real store/registry functions as each acting person through a dev-only bundle; each hand-off switches person and opens their screen in-app (no reloads).
| # | Result | Screenshots (/tmp/cross-role/shots) |
|---|---|---|
| J1 | Pass | j1-1-coordinator-pool, j1-2-timely-line (offered 2d, kept 7d) |
| J2 | Pass | j2-1-rn-review-queue, j2-2-lvn-administer-queue, j2-3-rn-cosign-queue |
| J3 | Pass | j3-1-owner-countdown, j3-2-new-owner-crisis-note, j3-3-coordinator-reassign |
| J5 | Pass | j5-isl-hub (row held without county consent; not in claims) |
| J6 | Pass | j6-1-billing-coordinator-hub, j6-2-billing-aggregates |

## Bugs found and fixed
1. **Clinician availability used the server's time zone** — 9 AM hours became 9 AM UTC off-Pacific. Now facility time zone.
2. **Task notifications leaked Part 2 text** — subjects like "Task assigned — ASAM reassessment due" / "CALOMS admission prompt". SUD tasks now notify neutrally ("Task assigned", open the chart).
3. **AI drafts not masked for some SUD patients** — Part 2 detection ignored signed ASAMs and SUD medications/orders when no SUD problem was listed. Now included.
4. **ISL export kept "not-yet-enrolled" after an AFBI link was confirmed** — now uses the linked person (and so goes through disclose()).
5. **No single signature trail on clinic orders** — added; badge shows Ordered by / Verified by / Given by / cosign.

6. **Print record and chart review carried the whole patient object**, note bodies included, for roles that could not read them. Now redacted.
7. **"Needs closing" button hid crisis notes** — the count included them, the list it opened didn't.
8. **Flaky browser helper** — `isVisible({timeout})` doesn't wait; J7 sometimes never clicked the tab. J7 peer expectation now follows that load's Part 2 consent (registry rule).

## Open decisions
- Pre-enrollment AFBI rows with SUD activities export by initials without a consent check (no identity). Confirm that is acceptable to counsel.
- J4: SUD counselor and RN notes route to a licensed cosigner; the brief said "sign". Kept existing policy — confirm.

## Test counts
Unit 2,255/2,255 · type check clean · e2e crossRole 13/13 + journeys 5/5. Other older e2e specs: 7 failures (staffNav deep links landing on /assisted-signup, cfProxyMode and advocateSelfSeparation patient picker) — not related to this batch, not yet investigated.
