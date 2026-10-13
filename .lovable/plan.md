# Patient color pass review — phases 2a + 4

**Review only. No application or test changes.**

## Exact proposed files

New: `src/components/ui/status-chip.tsx` — eight states, AI modifier, optional real waiting-days caption, inline markup, decorative icons, 14px minimum.

Status replacements (paths relative to `src/components/`):
- `patient/HomeDashboard.tsx`, `PatientHome.tsx` (SupportPlanCard), `patient/MyMedicationsCard.tsx`, `patient/RefillRunwayCard.tsx`, `clinical/MedCheckInCard.tsx`, `clinical/QuickCheckCard.tsx`.
- `patient/AppointmentsSummary.tsx`, `patient/MyCareTiles.tsx`, `scheduling/VisitActions.tsx` (patient/advocate portions only), `CarePlanCard.tsx` (patient goal status only; severe allergy unchanged).
- `consent/PatientConsentStatusCard.tsx`, `consent/FormsToSign.tsx`, `patient/SafetyPlanSummaryTile.tsx`, `patient/NeedThreadList.tsx`, `reentry/ObligationsCard.tsx`, `reentry/ReentryDayZeroModule.tsx`.
- `advocate/AdvocateNextStepsPanel.tsx`, `advocate/AdvocateDocumentChecklist.tsx`, `advocate/AdvocateMessagesPanel.tsx`, `advocate/AdvocateWorkspace.tsx`, `advocate/AdvocateIdentityBanner.tsx`, `advocate/AdvocateStatusList.tsx`, `advocate/AdvocateDesignationPanel.tsx`, `advocate/AdvocatePoAwarenessPanel.tsx`.
- `src/routes/advocate.tsx` — JSX styling/statuses only; route configuration and access unchanged.

Shell, celebrations and public buttons:
- `src/components/AppShell.tsx`, `src/components/patient/CrisisHeader.tsx` — help trigger/modal ownership and member-only styling; staff branches unchanged.
- `src/components/recovery/RecoveryStagePanel.tsx`, `src/components/library/ModuleTemplate.tsx` — patient current-step and completion treatments.
- `src/components/Landing.tsx`, `src/components/WebsiteContent.tsx` — only the two gold Get started overrides become default primary; sizes/destinations unchanged.
- `src/lib/i18n.tsx`, `src/lib/scheduleCopy.ts` — new UI words and Draft Spanish; the actual “Join video call” source is `scheduleCopy.ts:46`, not the main dictionary.
- `src/styles.css` — add the missing semantic `shadow-card`; narrowly scoped member touch-target rules and completion background override. Preserve phase-1 colors, fonts and text floors.
- `src/routes/advocate.library.tsx` — its pending-content block still has raw amber classes, including `border-amber-500` (line 83); presentation only.

Keep `ui/badge.tsx`, `ui/button.tsx`, stores, permissions and tests unchanged. Roadmap/architecture bookkeeping only after build approval.

## Conflicts and recommended interpretation

1. **Shared staff views:** CarePlanCard has an `audience` prop; RecoveryStagePanel has `actor`; LateCancelBadge also renders in StaffVisitActions. Use those existing boundaries and opt-in patient styling for LateCancelBadge, not a global replacement. `AhcdValidationChecklist.tsx:29` has raw amber but is explicitly staff-only in AdvocateDesignationPanel (`:98–110`): leave it for 2b. Do not globally restyle Badge/Button or every `.patient-theme` instance: staff previews and in-person signing also use that class.
2. **Missing shadow / competing CSS:** all requested color tokens already exist in `styles.css:98–125`; `shadow-card` does not. Existing CSS gives *every* patient Card a shadow (`:356–360`) and `.completion-panel` a gradient (`:374`). Add a semantic shadow and override the completion gradient only for the intended patient treatment; avoid an unrelated global shadow cleanup.
3. **Sunrise limit:** Home renders up to three milestone cards (`HomeDashboard:297–306,679–690`). Coloring each sunrise-soft conflicts with “max one sunrise fill per screen.” Recommend one shared celebration band containing all existing milestones, with neutral individual items; retain all real milestones. Current-step accents use a ring/text, not another fill.
4. **Visit behavior:** Home’s tile currently only manages appointments (`HomeDashboard:447–490`); the real join window/URL lives in AppointmentsSummary and `apptPrep.ts` (15 minutes early, through visit end). Reuse those helpers, preserve Simulated labeling, and offer meeting launch only for video—phone/in-person retain their existing guidance. Home currently selects only future scheduled visits (`:309–315`); keeping a visit visible after its start would change selection logic and is not included. With no visit, reuse `suggestions[0]`; if also empty, preserve the library fallback. “After this:” must not promise an unmodeled follow-up: use an existing suggestion, not invented clinical instructions.
5. **Advocate help conflict:** the unchanged modal reads the *current patient* for recovery visibility and links to patient `/home`, `/adel`, `/library`, `/naloxone`, `/crisis`. Mounting it for advocates is not an advocate-safe help flow; do not substitute the supported patient or alter Part 2 checks. This needs an explicit decision: accept the unchanged destinations as self-help navigation, or authorize a separately scoped advocate-safe presentation. No permission/store changes proposed.
6. **Touch targets:** existing `Button size="patient"` is 48px, but most affected controls use 44px/small/icon sizes; ModuleTemplate step dots are only 20px minimum width (`:360`). Apply scoped member target sizing, including portal overlays, while retaining visited-only navigation. Do not enlarge staff controls or public header buttons. FormsToSign has no Badge today—its signed/declined text becomes chips without changing the signing flow. Tier, modality and MAT labels are classifications, not task statuses: retain neutral badges rather than assigning misleading status meanings.
7. **Spanish / safety:** keep chip words exact and add a separate Draft annotation (not appended inside the word). Refill denial/out-of-supply remain Your turn as requested; keep clinical-review labels. Preserve the modal title “In crisis now” and all modal copy/order. Do not change other crisis-copy constants. No new clinical rules or mock waiting counts.

## Tests likely to break

**No existing test directly asserts “Join video call”, Home’s “In crisis now”, `get-help-now-button`, `patient-header-crisis-pill`, `forward-step-card`, or the affected badge color classes. No definite label/class failure found.**

- `src/lib/__tests__/inCrisisNow.test.ts:7–8` pins **OUTSIDE_CRISIS_COPY**, not Home’s hardcoded button. It stays valid if that constant remains unchanged.
- `src/lib/__tests__/badgeInline.test.tsx:7–8` requires the existing Badge to remain a span. Leave Badge alone; make StatusChip inline too.
- `src/components/documents/__tests__/documentsI18n.test.tsx:100` requires exact **Restringido** in AdvocateDocumentsPanel. Keep that word in its own element and Draft annotation separate.
- `src/components/__tests__/goalStatusAudit.test.tsx:40–77` requires the same goal button accessible label and three audited transitions. Chips must not replace the interactive goal button.
- `patientNavShellParity.test.tsx` and `userNavigationShell.test.ts` in `src/components/__tests__/` pin shell/sidebar structure and staff conditionals; preserve them. `landingWebsite.test.ts:74–79` pins public isolation, destinations and the remaining shell 988 link.
- `e2e/websitePolish.spec.ts:28–29,80–81` runs axe: teal public buttons and changed sizing can expose real contrast/layout failures. Its Back to top check (`:41–48`) is height-sensitive. `e2e/cfProxyMode.spec.ts:81–99` pins proxy badges: these staff badges stay untouched.

## GetHelpNowModal order today

1. Talk to a peer specialist
2. Talk to Adel
3. Call 988
4. Text 988
5. Naloxone & overdose prevention
6. I used — help me come back **only when the existing recovery visibility check passes**
7. Crisis support

Peer-specialist and come-back entries retain their existing “Not built yet” explanations. No reorder or content changes.

## Validation after approval

Measure gold-tile button, every chip pairing and sunrise text in light/dark at desktop and 390px, including disabled opening-time presentation. Stop/report any requested text contrast below 4.5:1. Run full units, then all browser specs separately, including existing axe; stop on any failure without changing assertions, retries or thresholds. Report changed files and measured/test results. Existing tests do not cover all new patient visual states; supplement with browser inspection without modifying their assertions.