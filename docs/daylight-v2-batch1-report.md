# Daylight v2 — batch 1: shared public shell

## Delivered
- Public-only WebsiteLayout, WebsiteNavigation, WebsiteBrand and website.css rebuild: measured sticky header (104→72px desktop), supplied flat symbol and live wordmark, exact EN/ES copy, segmented persistent existing language control, one Sign in action, click-only four-menu desktop navigation and one gliding underline.
- Shared menu inventory in websiteMenus.ts; Radix Dialog phone sheet with focus trap, Escape/close focus return, body scroll lock, accordion sections, pinned account/language controls. Portal independently measures crisis bar clearance in either language.
- Fixed urgent 988 aside, bilingual copy, measured bottom reserve, highest public z-index; inherited automatically on auth and every start flow through unchanged AppShell branch.
- Shared footer, exact 2026 copyright/demo copy, tagline, eight links; round back-to-top with reduced-motion behavior and top-target focus.
- Twelve missing public routes with WebsitePlaceholder, breadcrumbs, requested token wash, unique leaf title/description/Open Graph metadata. Existing routes and legacy home anchors remain working; team cards gain care/navigation/resource/advocate anchors without text changes.
- No patient/advocate/EHR/admin shell edits, no permissions or mutations, no new colors/fonts/dependencies, no publishing. Artwork extracts only the supplied symbol's existing paths.

## Validation
- Full units: **3,063/3,063, 379/379 files**.
- Public browser suites: **22/22**, one worker, E2E_BASE_URL=http://localhost:8080. Includes existing publicWebsite, websitePolish and publicEarlyTap plus six new Daylight cases.
- New component tests: 26 cases for click/one-panel/outside/Escape-focus, trapped phone sheet and one crisis aside in shared shell across public/entry destinations.
- Real rendered checks at 1280×1800 and 390×844, EN/ES: no horizontal overflow; labels wrap; Axe has no serious/critical violations for shell menus/crisis or existing public content; keyboard Escape returns to opener, sheet traps Tab and locks body scrolling; footer and floating button clear the crisis bar. Sticky 104/72 sizing and instant reduced-motion transitions verified.
- Public referral validation exercised its existing real form and read back saved record through the app: optional organization and required referrer name unchanged.
- Latest harness build signal: build OK.

## Existing public test migration
Only public presentation expectations were updated; no config, timeouts, retries, business-rule tests or assertions on referral fields changed.
- landingWebsite: allows literal 2026 requested in footer (other number restrictions retained).
- publicWebsite: crisis region→aside selector, page navigation via new footer/accordion rather than removed flat header links, legacy anchors tested as direct URLs, exact described FAQ tile accessible name, new partners destination, explicit rendered-heading/hydration readiness before next interaction.
- websitePolish: four menu triggers replace old flat-nav scroll-spy expectation; current-page check in footer; existing anchor URLs remain exercised directly.
- App correction found during testing: keyboard-only crisis-clearance scrolling prevents pointer click target displacement; brief ResizeObserver keeps a deep-link anchor aligned while sticky header shrinks.

## Explicit limits / next batch
- `/resources` already exists as a patient-facing directory. Its URL resolves, but its existing member shell and access boundaries are deliberately unchanged; no anonymous directory redesign or public reclassification was introduced. A distinct public directory decision remains needed if the same URL must have the public shell without changing patient behavior.
- Existing page bodies, including legacy fonts/sizing utilities inside content and safety callouts in start flows, are retained per the batch's no-content-change instruction. New chrome uses existing tokens and 14px floor; no sweeping content restyle.
- Spanish is draft pending native-speaker review. Missing pages remain `[ To be confirmed ]` pending batch 4.
- Full unrelated staff/member browser suite was not run; full units and all public-site browser suites passed.
