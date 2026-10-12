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

## Validation — not fully green
- Full unit suite: 306 files, 2,555 tests passed, including existing notification and access/permission tests. No permission snapshot edits.
- New website browser tests: 3/3 passed together (EN, ES, mobile). Cover headings, exact reachable anchor positions, legacy redirect, metadata, existing-flow links and navigation, seven roles/no individual names, crisis support and no mobile overflow.
- Full browser run alongside units: 67/68 passed. Existing e2e/adelBrief.spec.ts “Brief: instant render, Part 2 masking per role, New after PHQ-9” exceeded its unchanged 1,500ms threshold (1,587ms).
- Two additional full-suite attempts were terminated by the execution environment at approximately 293/300 seconds, despite the requested 600-second command timeout. They did not complete; neither is reported as green. One showed CF proxy timeouts; the other again exceeded the Brief performance threshold.
- Automatic harness build checks report build OK. A separate typecheck result is not exposed in the available harness log, so typecheck is unverified; no manual project typecheck/build was run per platform instructions.
- No assertions, retries, performance limits, application logic, or patient/staff screens were changed to force a green browser run.

## Decisions / remaining verification
Spanish copy remains Draft pending translation review. Existing signup is used without reentry preselection. Complete all-green browser verification and explicit typecheck confirmation remain outstanding; the website is built, not represented as fully validated.
