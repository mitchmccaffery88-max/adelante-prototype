# Patient color pass — approved fix pass, stopped at contrast

## Current result
The seven approved fixes were applied. Validation stopped on the first below-threshold rendered contrast measurement; implementation is **not accepted as done**.

Latest automatic harness entries at 19:15:56, 19:16:57 and 19:17:28 report **build OK**, with the two HomeDashboard type errors cleared. No manual build or typecheck was run.

**Failure:** desktop dark website hero Get started captured at **1.02:1**, below 4.5:1. Measured foreground RGB (136,145,144), background (77,153,158). The audit changed the document to dark immediately before sampling. These intermediate colors do not match the settled dark tokens, and the existing Button uses `transition-colors`; a theme-transition sample is the likely cause, not an established static-token failure. No rerun or code correction followed the required stop. Settled dark website contrast remains unverified.

Full units and all browser specs (including axe and Back to top) **not run in this fix pass** because contrast failed first. Previous pass had 2,560 passed / 1 failed from the stale hero assertion. This pass changes only that single authorized assertion to Mitch's existing headline; no other assertions, retries or thresholds changed.

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

## Rendered contrast captured before stopping
Desktop 1280px, light/dark. Chip states and the open-window meeting button rendered from the actual exported components in a temporary browser-only fixture, not new app content or stored records. Real Home supplied gold text/opening-time/help; real lesson supplied You are here; real advocate supplied help. Fixture used an existing appointment with a temporary render prop within its open window; no store mutation. Values are captured samples, not full completion certification.

| Rendered text pairing | Desktop light | Desktop dark |
|---|---:|---:|
| gold text | 8.90:1 | 6.69:1 |
| gold button | 5.52:1 | 8.86:1 |
| opens at | 7.95:1 | 9.68:1 |
| done | 6.03:1 | 6.41:1 |
| yourturn | 8.90:1 | 6.69:1 |
| team | 5.43:1 | 7.54:1 |
| upnext | 7.95:1 | 9.68:1 |
| urgent | 5.51:1 | 7.59:1 |
| closed | 6.83:1 | 8.72:1 |
| restricted | 6.83:1 | 8.72:1 |
| simulated | 6.70:1 | 8.06:1 |
| you are here | 6.24:1 | 8.03:1 |
| patient help | 7.06:1 | 9.24:1 |
| advocate help | 7.06:1 | 9.24:1 |
| website hero | 5.52:1 | 1.02:1 |

**Closing website CTA not verified:** the positional locator selected another Get started link rather than establishing the closing-section button. Its sampled values were 5.52:1 light / 4.93:1 during dark transition; excluded from certification. Full 390px light/dark contrast not reached.

## Phone/layout observations
Initial real Home at 390×844: document scrollWidth **390px**, gold card fits (screenshot `/tmp/browser/fix-pass/gold-mobile.png`). Desktop lesson had 11 step controls, each **48×48px**, document width 1280px with no horizontal overflow in both themes. Desktop advocate also 1280px without overflow. The longest existing lesson, long chips and advocate header at 390px **remain unverified** after the contrast stop.

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


## Blocker / next authorization
Resume permission is needed after the contrast stop: verify settled theme contrast and target the closing CTA directly, complete 390px/longest-lesson/Spanish checks, then run full units and all browsers separately. No settled-state result is claimed and no test failure was concealed.
