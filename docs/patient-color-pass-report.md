# Patient color pass — stopped validation

## Result
Implementation is incomplete and not accepted as done. Per Mitch's stop-on-failure instruction, no test assertion changes, fixes, retries, or browser-suite runs followed the unit failure.

Full units: **2,560 passed; 1 failed**, across 306 files (305 passed / 1 failed).
Failure: `src/components/__tests__/landingWebsite.test.ts:94`, public website contract → follow-ups: quote gone, root meta, partners, privacy, FAQ, no numbers. The assertion expects `Forward starts here.`; the existing display string is `Your Path Forward Starts Here.` from Mitch's earlier visual text edit. This batch did not change that string or the assertion.

Latest automatic harness output additionally reports two errors in `HomeDashboard.tsx`: the service-title fallback passes an empty string where a ServiceType or undefined is required; the referral-chip mapping compares ResourceReferralOutcome to `completed` rather than its actual outcome vocabulary. These are introduced presentation errors, not the unit failure's cause. They were not fixed after the required stop. Build/typecheck is not green.

All-browser validation, axe and Back to top checks **not run** after unit failure. Full rendered light/dark desktop/390px contrast **not completed**.

## Advocate help
No eligible existing advocate page displays both 988 and 911 without patient data. `/advocate/support-for-myself` renders the self-care enrollment card, not an emergency-help page; the existing shell crisis bar includes only 988. Advocate header preserved; no advocate modal, new page, flow, store or permission change.

## Final modal order
Call 988 → Text 988 → Talk to a peer specialist → Talk to Adel → Naloxone & overdose prevention → I used — help me come back (existing recovery condition only) → Crisis support.
The title remains `In crisis now`; conditions, destinations, content and Not built yet notes remain unchanged.

## Preliminary contrast measurements
Browser-resolved semantic-token pairs sampled on the public preview at 390px before implementation. These are **pairing measurements**, not final rendered-element certification. Desktop, actual chip markup, overlays, gold-tile opening state and all post-change states remain to be verified. Ratios rounded to two decimals:

| Foreground / background | Light | Dark |
|---|---:|---:|
| done / path-soft | 6.03 | 6.41 |
| on-attention-soft / attention-soft | 8.90 | 6.69 |
| info / info-soft | 5.43 | 7.54 |
| ink-muted / surface (Up next, opening-time treatment) | 7.95 | 9.68 |
| urgent / urgent-soft | 5.51 | 7.59 |
| ink-muted / surface-sunk (Closed) | 6.83 | 8.72 |
| restricted / restricted-soft | 6.83 | 8.72 |
| path / path-faint (Simulated) | 6.70 | 8.06 |
| on-gold / gold | 8.90 | 6.69 |
| primary-foreground / primary (teal button) | 5.52 | 8.86 |
| sunrise-text / surface | 6.24 | 8.03 |
| sunrise-text / sunrise-soft | 5.22 | 7.49 |
| on-urgent / urgent (Get help now) | 7.06 | 9.24 |

## Files changed in this batch

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

No test files, permission snapshots, route definitions, business stores, generic Badge/Button primitives or staff-only AHCD checklist changed.

Next step requires authorization to resume: resolve the stale-heading test contract without silently reverting Mitch's copy, correct the two presentation type errors, finish implementation review and rendered contrast checks, then rerun units before browsers separately.