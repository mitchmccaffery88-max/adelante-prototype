# Public website update — Mitch, 12 Oct

## Built
- Adelante Health public header/footer and homepage title, description, OG and Twitter metadata. Application brand strings and routes remain unchanged. WebsiteBrand is the single public A-mark placeholder for the forthcoming logo.
- `/about`: unchanged mission, referral partners at `#partners`, privacy line and closing CTA. Mission uses 18px readable text capped at 70ch. Mitch's removed pull quote stays removed.
- `/team`: unchanged intro and four team cards containing seven icon-led roles; no individual names or new photos. Links to `/#find-your-fit` and includes the closing CTA.
- Find Where You Fit: three cards; both patient buttons use /start/signup and the help button uses the existing /advocate flow. Signup has no pathway-preselection parameter; no signup logic was changed.
- Ready When You Are: exact closing copy and both existing-flow buttons.
- Shared `WebsiteLayout` header/footer and crisis bar. Six ordered desktop/mobile navigation links; About/Team route to pages, all other links reach homepage anchors with sticky offsets. Footer links About, Team, partners, FAQ and referral.
- Home contains hero, How it works, Find Where You Fit, What You Get, FAQ and closing CTA only. `/#about`, `/#team`, `/#partners` redirect to the new pages; `/#who-its-for` continues to redirect to `/#find-your-fit`.
- Agency is optional in the shared referral form and store input. Referrer name remains required. Missing agency displays as “Not provided” in queue/chart summaries; welcome text omits “at [agency]” when absent. Enrollment accepts an omitted agency.
- All landing copy goes through the existing i18n dictionary. Spanish website translations are visibly marked “ES Draft — pending translation review”. EN/ES toggle and crisis bar remain.

## Visual review
Desktop: About is a calm cream block with limited line length; Team uses a two-column grid; Fit uses three equal-height columns; closing is a dark gradient with both actions.
Mobile (390px): all cards stack, role icons remain beside text, buttons wrap with generous tap heights, brand wraps neatly and the menu contains all five links. No horizontal overflow. Closing actions stack. Existing hero photo remains the only person image. Spanish About was also visually checked.
Screenshots inspected/captured under /tmp/browser/website: desktop/mobile about, team, find-your-fit, closing, and mobile-es-about. No browser page errors during visual checks.

## Files
src/components/Landing.tsx; AppShell.tsx (public branches only); WebsiteBrand.tsx; WebsiteNavigation.tsx; website.css; src/lib/i18n.website.ts; src/lib/i18n.tsx (dictionary additions); src/routes/index.tsx; src/components/__tests__/landingWebsite.test.ts; e2e/publicWebsite.spec.ts; AGENTS.md; roadmap.md; this handoff.
Root fallback metadata uses Adelante Health, preserving the apple app title “Adelante”. About and Team each provide title, description, Open Graph, Twitter and canonical metadata. Route metadata remains English in EN/ES; visible copy uses the chosen language. Removed the homepage's manual metadata mutation because its unmount could overwrite the incoming page's metadata.

## Validation — latest page-split batch
- Full units: 306 files, 2,558 tests passed (final run, 54.06s). Notification lint and permissions contracts passed; no snapshot edits.
- Full browsers: 76/76 passed (6.7 minutes), run after units, never alongside them. Includes 11 public website/referral cases and 22 existing staff navigation/access cases. No assertions, sleeps, retries or performance limits relaxed.
- Earlier full unit run captured an intermittent existing failure: `outpatientMeds.test.ts > outpatient medication demo seed > Paloma has the richest list with a pending refill and a mix of states` (prescriber assertion). Two subsequent full runs passed; medication logic was not changed.
- Earlier full browser run: 67/76 passed. Shared-shell extraction had omitted the existing access guard on public routes also present in STAFF_ROUTES; restored that exact condition. Focused staff navigation then passed 22/22 and final full browsers passed 76/76. Earlier sidebar expansion timeouts did not recur.
- Typecheck remains unverified: platform instructions reserve builds/typechecks for automatic checks; no separately retrievable result was available. Do not report an explicit typecheck as passed.

## Files — page split and optional agency
`src/routes/about.tsx`, `src/routes/team.tsx`, generated `src/routeTree.gen.ts`, `src/components/WebsiteLayout.tsx`, `WebsiteContent.tsx`, `WebsiteNavigation.tsx`, `Landing.tsx`, `AppShell.tsx`, `website.css`, `src/lib/i18n.website.ts` (navigation destinations only; copy unchanged), `src/lib/navSections.ts`, `src/components/referral/ReferralSubmissionForm.tsx`, `src/lib/ehr.ts`, `src/lib/referralWelcome.functions.ts`, `src/components/admin/ReferralTrackerCard.tsx`, `ReferralTimelineDrawer.tsx`, `ReferralStatusTimeline.tsx`, referral tests, `src/components/__tests__/landingWebsite.test.ts`, `e2e/publicWebsite.spec.ts`, `AGENTS.md`, `roadmap.md`, this handoff.

## Decisions / deferrals
Spanish visible copy remains “ES Draft — pending translation review”. Page metadata follows the existing English server-rendered convention; visible copy is bilingual. No patient/staff workflow or permissions changes beyond preserving the pre-existing route guard. Missing agency is stored as an empty string for backwards-compatible consumers, with an optional create input and “Not provided” display. Publish is needed to update the live public pages. Explicit typecheck confirmation remains outstanding.
