# Public website update — Mitch, 12 Oct

## Built
- Adelante Health public header/footer and homepage title, description, OG and Twitter metadata. Application brand strings and routes remain unchanged. WebsiteBrand is the single public A-mark placeholder for the forthcoming logo.
- About Us follows How it works: exact mission, 18px readable text capped at 70ch, and a “hospital without walls” pull quote.
- Meet Our Team: four team cards containing seven icon-led roles; no individual names or new photos.
- Find Where You Fit: three cards; both patient buttons use /start/signup and the help button uses the existing /advocate flow. Signup has no pathway-preselection parameter; no signup logic was changed.
- Ready When You Are: exact closing copy and both existing-flow buttons.
- Five ordered navigation links on desktop and in the mobile menu, smooth scrolling and sticky-header offsets. #who-its-for redirects to #find-your-fit, including direct arrivals.
- All landing copy goes through the existing i18n dictionary. Spanish website translations are visibly marked “ES Draft — pending translation review”. EN/ES toggle and crisis bar remain.

## Visual review
Desktop: About is a calm cream block with limited line length; Team uses a two-column grid; Fit uses three equal-height columns; closing is a dark gradient with both actions.
Mobile (390px): all cards stack, role icons remain beside text, buttons wrap with generous tap heights, brand wraps neatly and the menu contains all five links. No horizontal overflow. Closing actions stack. Existing hero photo remains the only person image. Spanish About was also visually checked.
Screenshots inspected/captured under /tmp/browser/website: desktop/mobile about, team, find-your-fit, closing, and mobile-es-about. No browser page errors during visual checks.

## Files
src/components/Landing.tsx; AppShell.tsx (public branches only); WebsiteBrand.tsx; WebsiteNavigation.tsx; website.css; src/lib/i18n.website.ts; src/lib/i18n.tsx (dictionary additions); src/routes/index.tsx; src/components/__tests__/landingWebsite.test.ts; e2e/publicWebsite.spec.ts; AGENTS.md; roadmap.md; this handoff.
Root fallback metadata is unchanged so patient/staff metadata is not renamed; the homepage leaf overrides it.

## Validation — not fully green
- Full unit suite: 306 files, 2,555 tests passed, including existing notification and access/permission tests. No permission snapshot edits.
- New website browser tests: 3/3 passed together (EN, ES, mobile). Cover headings, exact reachable anchor positions, legacy redirect, metadata, existing-flow links and navigation, seven roles/no individual names, crisis support and no mobile overflow.
- Full browser run alongside units: 67/68 passed. Existing e2e/adelBrief.spec.ts “Brief: instant render, Part 2 masking per role, New after PHQ-9” exceeded its unchanged 1,500ms threshold (1,587ms).
- Two additional full-suite attempts were terminated by the execution environment at approximately 293/300 seconds, despite the requested 600-second command timeout. They did not complete; neither is reported as green. One showed CF proxy timeouts; the other again exceeded the Brief performance threshold.
- Automatic harness build checks report build OK. A separate typecheck result is not exposed in the available harness log, so typecheck is unverified; no manual project typecheck/build was run per platform instructions.
- No assertions, retries, performance limits, application logic, or patient/staff screens were changed to force a green browser run.

## Decisions / remaining verification
Spanish copy remains Draft pending translation review. Existing signup is used without reentry preselection. Complete all-green browser verification and explicit typecheck confirmation remain outstanding; the website is built, not represented as fully validated.
