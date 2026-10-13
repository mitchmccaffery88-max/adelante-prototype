# Patient color pass — validation completed; fixes pending Mitch decision

## Current result — validation only, 13 Oct 2026
Validated unchanged application commit `6da8b4da`. **Not all green:** Spanish Home overflows horizontally at 390px, and two staff deep-link browser checks fail. All requested settled contrast pairings pass 4.5:1. No app, styles, copy, tests, assertions, retries, thresholds, permissions or business logic changed in this validation turn; only this report and roadmap updated.

- Units: **2,561 passed / 0 failed**, **306 files passed / 0 failed**; full `bunx vitest run`, 64.61s.
- Browsers, separately after units: **77 passed / 2 failed / 0 skipped**, 79 total; full `E2E_BASE_URL=http://localhost:8080 bunx playwright test`, 7.6 minutes. Ran through both failures to completion.
- Axe and Back to top: existing `websitePolish.spec.ts` checks passed for `/`, `/about`, `/team`, including EN desktop and ES mobile. No serious/critical axe violations under those existing assertions (not a claim of zero minor issues everywhere).
- Automatic harness build: **build OK**, latest observed 19:50:18 UTC. No manual build/typecheck invoked; a separate standalone typecheck is not certified by this validation run.

## Settled rendered contrast
Before each sample, injected temporary browser-only `*{transition:none !important; animation:none !important}`, toggled document `.dark`, waited **600ms**, then measured computed foreground and composited background using WCAG sRGB relative luminance. The app has no dark switch: **light is the actual user-facing default**; dark values below are explicitly forced audit conditions.

All eight EN/ES × light/dark × 1280/390 combinations measured. **208 primary pairing observations**, plus all gold-tile text lines. The table is ratios, not simulated product statistics. Minimum is **5.43:1** (team chip, light). The prior website dark **1.02:1** capture is superseded: settled hero and closing buttons both measure **8.86:1**, establishing that capture was not a settled failure.

Real patient Home, lesson, advocate header and website supplied mounted UI. Actual exported StatusChip and JoinCallButton were temporarily rendered in browser-only fixtures for all states/labels and meeting windows, using existing appointment data with only local render props; no stored record was changed. Recovery timeline needed a browser-only render of its actual Timeline component because demo records had no current recovery stage. Actual gold-tile eyebrow, title, date, clinician, prep text, links, suggestions and remaining copy were additionally sampled and all use the reported gold text pairing. Long chip labels used “Draft — pending clinical sign-off” / “Borrador — pendiente de revisión de traducción”; each state was sampled with its generic word and the long label, with identical results. Labels/icons/borders were present; Restringido stayed in its own element. Spanish shell notices measured **14px** and are absent in EN.

The closing CTA locator was **`.website-closing a[href="/start/signup"]`**, never positional. No production CSS was injected or changed; temporary style affects only disposable browser contexts.

| Rendered pairing | EN light 1280 | EN light 390 | EN dark 1280 | EN dark 390 | ES light 1280 | ES light 390 | ES dark 1280 | ES dark 390 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Gold tile — all text | 8.90:1 | 8.90:1 | 6.69:1 | 6.69:1 | 8.90:1 | 8.90:1 | 6.69:1 | 6.69:1 |
| Gold tile — Start meeting | 5.52:1 | 5.52:1 | 8.86:1 | 8.86:1 | 5.52:1 | 5.52:1 | 8.86:1 | 8.86:1 |
| Gold tile — Opens at | 7.95:1 | 7.95:1 | 9.68:1 | 9.68:1 | 7.95:1 | 7.95:1 | 9.68:1 | 9.68:1 |
| StatusChip done — generic + long label | 6.03:1 | 6.03:1 | 6.41:1 | 6.41:1 | 6.03:1 | 6.03:1 | 6.41:1 | 6.41:1 |
| StatusChip yourturn — generic + long label | 8.90:1 | 8.90:1 | 6.69:1 | 6.69:1 | 8.90:1 | 8.90:1 | 6.69:1 | 6.69:1 |
| StatusChip team — generic + long label | 5.43:1 | 5.43:1 | 7.54:1 | 7.54:1 | 5.43:1 | 5.43:1 | 7.54:1 | 7.54:1 |
| StatusChip upnext — generic + long label | 7.95:1 | 7.95:1 | 9.68:1 | 9.68:1 | 7.95:1 | 7.95:1 | 9.68:1 | 9.68:1 |
| StatusChip urgent — generic + long label | 5.51:1 | 5.51:1 | 7.59:1 | 7.59:1 | 5.51:1 | 5.51:1 | 7.59:1 | 7.59:1 |
| StatusChip closed — generic + long label | 6.83:1 | 6.83:1 | 8.72:1 | 8.72:1 | 6.83:1 | 6.83:1 | 8.72:1 | 8.72:1 |
| StatusChip restricted — generic + long label | 6.83:1 | 6.83:1 | 8.72:1 | 8.72:1 | 6.83:1 | 6.83:1 | 8.72:1 | 8.72:1 |
| StatusChip simulated — generic + long label | 6.70:1 | 6.70:1 | 8.06:1 | 8.06:1 | 6.70:1 | 6.70:1 | 8.06:1 | 8.06:1 |
| Lesson — You are here | 6.24:1 | 6.24:1 | 8.03:1 | 8.03:1 | 6.24:1 | 6.24:1 | 8.03:1 | 8.03:1 |
| Recovery timeline — You are here | 6.24:1 | 6.24:1 | 8.03:1 | 8.03:1 | 6.24:1 | 6.24:1 | 8.03:1 | 8.03:1 |
| Patient — Get help now | 7.06:1 | 7.06:1 | 9.24:1 | 9.24:1 | 7.06:1 | 7.06:1 | 9.24:1 | 9.24:1 |
| Advocate — Get help now | 7.06:1 | 7.06:1 | 9.24:1 | 9.24:1 | 7.06:1 | 7.06:1 | 9.24:1 | 9.24:1 |
| Website hero — Get started | 5.52:1 | 5.52:1 | 8.86:1 | 8.86:1 | 5.52:1 | 5.52:1 | 8.86:1 | 8.86:1 |
| Website closing — Get started | 5.52:1 | 5.52:1 | 8.86:1 | 8.86:1 | 5.52:1 | 5.52:1 | 8.86:1 | 8.86:1 |
| Patient Spanish Draft notice | N/A — EN | N/A — EN | N/A — EN | N/A — EN | 7.50:1 | 7.50:1 | 11.00:1 | 11.00:1 |
| Advocate Spanish Draft notice | N/A — EN | N/A — EN | N/A — EN | N/A — EN | 7.50:1 | 7.50:1 | 11.00:1 | 11.00:1 |

## Phone-width checks — 390 × 844, light (user-facing), EN and ES
Measured document `scrollWidth` against 390px and reviewed screenshots. No app fix was attempted.

| Surface | EN scrollWidth | ES scrollWidth | Result |
|---|---:|---:|---|
| Home, including gold tile | 390 | **431** | **ES fails: 41px horizontal overflow** |
| Longest existing lesson: Calming My Mind (`ss-calming-my-mind`), 11 steps | 390 | 390 | Pass; all 11 targets 48×48px and wrap |
| Advocate Home, including urgent header | 390 | 390 | Pass |
| Medications/cards | 390 | 390 | Pass |
| Schedule, Your appointments tab with actual appointment cards | 390 | 390 | Pass |

Catalog inspection of existing library and recovery lessons found a maximum of 11 rendered steps; selected existing 11-step lesson, not new test content. Long-label chips separately fit at 248px EN and 348px ES across all eight states. Patient/advocate urgent header buttons fit and Spanish labels wrap. Gold tile EN is 358px wide; Spanish tile expands to 415px because the Home grid expands, so ES gold-tile/page fit is **not certified** despite text wrapping inside the card.

**Confirmed overflow cause:** Home’s support-needs tile, not lesson dots or the standalone StatusChip. The Spanish ConnectMeButton text “¿Quiere que su equipo de atención le ayude a conectarse?” renders at **351px**, with computed `white-space: nowrap` inherited from the shared Button. Its LI/UL are 373px and TileShell 415px; the grid has an intrinsic minimum width and cannot shrink to the available 358px. `HomeDashboard.tsx` mounts it under `data-testid="sdoh-status-list"`; `NeedConnect.tsx` supplies `className="mt-2 min-h-11"` without a wrap/min-width override. In the initial unscrolled capture the support tile reaches x=431px. Scrolling to an expanded gold tile can shift horizontal scroll, which explains later x=415px without any width fix. A separate investigator suggested the medication tile, but direct measured ancestor geometry establishes the support button as the observed source; medication was not proven causal. No layout fix authorized or applied.

## Every browser failure and cause
1. **PMHNP deep links**, `e2e/staffNav.rbac.spec.ts:96`, failing assertion **line 116**: denied `/nurse` stayed at `http://localhost:8080/nurse`; expected `/clinician`. URL assertion exhausted unchanged **10,000ms** timeout (12 unexpected samples). Trace confirms earlier allowed paths and denied `/assisted-signup` were processed before `/nurse`. This is a route guard/registry disagreement or a guard not taking effect, **not a contrast failure**; exact underlying diagnosis follows below where supported.
2. **Billing deep links**, same spec/assertion: denied `/referral-queue` stayed at `http://localhost:8080/referral-queue`; expected `/inbox`. URL assertion exhausted unchanged **10,000ms** timeout (11 unexpected samples). Earlier denied `/content-library` completed. Same route guard/registry or hydration disagreement; no permission/test fix attempted.

Both are actual completed suite failures, not execution termination or test retries. Full evidence: `/tmp/browser/color-validation/browsers.log`; corresponding traces/error-context files under `test-results/staffNav.rbac-deep-links-h-ca8fc--denied-deep-links-redirect-chromium/` and `test-results/staffNav.rbac-deep-links-h-16685--denied-deep-links-redirect-chromium/`. Do not interpret the patient styling pass as authorization to modify staff guards.

## Measurement tooling gaps resolved within validation
An initial temporary probe incorrectly treated a Python Locator property as callable and imported ReactDOM without its default export; those invalid samples were discarded. The corrected probe collected all patient/chip/advocate samples but could not find a seeded recovery current marker or the website language selector. Dedicated read-only probes collected all eight actual Timeline fixtures and all sixteen section-specific website CTA samples. Thus those tooling errors leave **no requested contrast pairing missing** and are not app/test failures. No existing spec was edited or rerun to conceal the two failures.

Evidence stays in `/tmp/browser/color-validation/`: `results.json`, `supplement.json`, `website.json`, `gold_text.json`, `phone_details.json`, `overflow_cause.log`, `units.log`, `browsers.log`; reviewed screenshots include `home-es.png`, `gold-es.png`, `long-chips.png`, `lesson-es.png`, `advocate-es.png`, `medications-es.png`, `appointments-cards-es.png`, and `website-en-390-dark.png`. Temporary fixtures/scripts are outside the checkout.

## Approved changes
- Public English headline preserved. Its one test expectation now matches it. Both supplied Spanish headline/corner strings applied under the existing public ES Draft note.
- Service fallback never passes an empty string. Referral chip mapping uses actual outcomes: connected → done; closed/declined_by_client → closed; not_eligible/unreachable → yourturn; pending/waitlisted → team. Connected referrals display the existing dashboard Done label.
- StatusChip optional label supplies visible word and accessible name while state retains icon/color/border; specific tooltip-only labels moved into chips and duplicate status spans removed. Advocate Open → done. Goals use existing translated labels and done/in_progress/open map to done/upnext/yourturn.
- Consent chips map actual ledger statuses active → done and expired/revoked/superseded → closed. The current ConsentRecordStatus has **no pending member**; no new status or business rule was invented.
- New per-element translation Draft marks removed from chips/help/gold/current-step/meeting controls. One Spanish-only 14px ink-muted notice added below the patient/advocate header. Older clinical/legal Draft annotations remain unchanged.
- Advocate header Get help now is a direct `tel:988` link, urgent tokens, life-buoy, 48px minimum; English accessible name Get help now: call 988 (Spanish localized). No modal, new page or patient data; bottom 988 bar unchanged.
- Lesson dots use wrapping, fixed 48×48px targets; long labels wrap and appointment meeting labels allow wrapping. Staff workflow rules unchanged.

## Modal order (unchanged by fix pass)
Call 988 → Text 988 → Talk to a peer specialist → Talk to Adel → Naloxone & overdose prevention → I used — help me come back (existing recovery condition only) → Crisis support.
Title remains In crisis now; OUTSIDE_CRISIS_COPY, conditions, destinations and Not built yet notes unchanged.

## Files changed in this fix pass
- `src/components/__tests__/landingWebsite.test.ts` — only authorized line 94
- `src/lib/i18n.website.ts`
- `src/components/ui/status-chip.tsx`
- `src/components/AppShell.tsx`
- `src/components/PatientHome.tsx`
- `src/components/CarePlanCard.tsx`
- `src/components/patient/HomeDashboard.tsx`
- `src/components/patient/CrisisHeader.tsx`
- `src/components/patient/AppointmentsSummary.tsx`
- `src/components/patient/NeedThreadList.tsx`
- `src/components/patient/MyMedicationsCard.tsx`
- `src/components/patient/RefillRunwayCard.tsx`
- `src/components/patient/MyCareTiles.tsx`
- `src/components/patient/SafetyPlanSummaryTile.tsx`
- `src/components/clinical/MedCheckInCard.tsx`
- `src/components/clinical/QuickCheckCard.tsx`
- `src/components/consent/FormsToSign.tsx`
- `src/components/consent/PatientConsentStatusCard.tsx`
- `src/components/library/ModuleTemplate.tsx`
- `src/components/recovery/RecoveryStagePanel.tsx`
- `src/components/scheduling/VisitActions.tsx`
- `src/components/advocate/AdvocateMessagesPanel.tsx`
- `src/components/advocate/AdvocatePoAwarenessPanel.tsx`
- `src/components/advocate/AdvocateDocumentChecklist.tsx`
- `src/components/advocate/AdvocateIdentityBanner.tsx`
- `src/components/advocate/AdvocateWorkspace.tsx`
- `src/components/advocate/AdvocateStatusList.tsx`
- `src/components/advocate/AdvocateDesignationPanel.tsx`
- `src/routes/advocate.tsx`
- `AGENTS.md`
- `roadmap.md`
- `docs/patient-color-pass-report.md`

No stores, permissions, route definitions, generic Button/Badge primitives or staff-only AHCD checklist changed.

## Prior pass file inventory


- `roadmap.md`
- `AGENTS.md`
- `docs/patient-color-pass-report.md` (this report)
- `src/styles.css`
- `src/lib/i18n.tsx`
- `src/lib/scheduleCopy.ts`
- `src/components/ui/status-chip.tsx` (new)
- `src/components/AppShell.tsx`
- `src/components/Landing.tsx`
- `src/components/WebsiteContent.tsx`
- `src/components/PatientHome.tsx`
- `src/components/CarePlanCard.tsx`
- `src/components/patient/CrisisHeader.tsx`
- `src/components/patient/GetHelpNowModal.tsx`
- `src/components/patient/HomeDashboard.tsx`
- `src/components/patient/AppointmentsSummary.tsx`
- `src/components/patient/MyMedicationsCard.tsx`
- `src/components/patient/RefillRunwayCard.tsx`
- `src/components/patient/MyCareTiles.tsx`
- `src/components/patient/SafetyPlanSummaryTile.tsx`
- `src/components/patient/NeedThreadList.tsx`
- `src/components/clinical/MedCheckInCard.tsx`
- `src/components/clinical/QuickCheckCard.tsx`
- `src/components/consent/FormsToSign.tsx`
- `src/components/consent/PatientConsentStatusCard.tsx`
- `src/components/reentry/ObligationsCard.tsx`
- `src/components/reentry/ReentryDayZeroModule.tsx`
- `src/components/recovery/RecoveryStagePanel.tsx`
- `src/components/library/ModuleTemplate.tsx`
- `src/components/scheduling/VisitActions.tsx`
- `src/components/advocate/AdvocateNextStepsPanel.tsx`
- `src/components/advocate/AdvocateDocumentChecklist.tsx`
- `src/components/advocate/AdvocateMessagesPanel.tsx`
- `src/components/advocate/AdvocateIdentityBanner.tsx`
- `src/components/advocate/AdvocateStatusList.tsx`
- `src/components/advocate/AdvocateDesignationPanel.tsx`
- `src/components/advocate/AdvocatePoAwarenessPanel.tsx`
- `src/components/advocate/AdvocateWorkspace.tsx`
- `src/routes/advocate.tsx`
- `src/routes/advocate.library.tsx`



## Decision required
Mitch to decide whether to authorize fixes for **Spanish Home 390px overflow**, **PMHNP `/nurse` redirect failure**, and **billing `/referral-queue` redirect failure**. Settled contrast is green; phase completion remains blocked by these three findings. This turn changed only this report and `roadmap.md`.
