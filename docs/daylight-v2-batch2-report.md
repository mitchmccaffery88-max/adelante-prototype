# Daylight v2 — batch 2

## Delivered
Landing uses the requested twelve visible bands in order (the thirteenth, footprint, is entirely hidden). Existing mission, team roles, FAQs, partners and closing copy are reused verbatim. New text is bilingual in website.v2.*. Sunrise hero is default, with one entrance and a pause control; alternate video mode renders the existing supplied poster. Site config does not invent clinic/service numbers. Manual four-journey deck starts at coming home, roving tabs support arrows/Home/End, and counters announce updates without autoplay. Connected-care diagram links to existing platform anchors. Reusable ReadyBand is available to later pages; existing About/Team content is not restyled.

Ask Adel is a public rules-based classifier, not a model or clinical action. All specified crisis phrases win before any intent or medical guard, including mixed EN/ES. Medical guard precedes intent output. Only anonymous intent counts live in memory; raw typed questions are cleared and never stored in React state, storage, network or audit. Starter messages can display their fixed labels; typed messages display a privacy-safe placeholder rather than retaining their contents. No patient records, permissions or clinic actions are accessed. Simulation is explicit in WEBSITE_PUBLIC_FEATURES in features.ts and the rendered StatusChip.

Public resource links now use /directory, backed by a public placeholder pending batch 4a. /resources is unchanged. Legacy home anchors and redirects are preserved, including the what-you-get alias to the new what band.

## Validation
- Full units: 3,260 / 3,260, 381 files.
- Full public browser set: 27 / 27; --workers=1 on localhost:8080. No timeout/config changes.
- 196 classifier tests cover every specified EN/ES crisis phrase, keywords, medical guard, jobs/careers, boundary false positives, categories, fallback chips, starter overrides, pure-function no-retention and counters.
- Alternate video setting poster checked through rendered component test.
- EN/ES 1280×1800 and 390×844: no horizontal scroll; section labelling/order, hidden footprint, tabs/Home/End, referral query, scripted crisis-only log and safety actions, Escape/focus return, empty input after send, directory link and result page, visible uncovered 988 bar, simulated chip and reduced-motion finished still verified. Axe serious/critical findings: none.
- Existing public referral form and shell/menu checks remain green. Screenshots inspected for desktop hero, system diagram and closing band; Spanish phone hero/journeys/system, and phone crisis panel. No text below 14px found in rendered landing scan.
- Latest harness signal: build OK.

## Changed files
- src/components/Landing.tsx
- src/components/website/{HeroMedia,ReadyBand,JourneyDeck,ConnectedCare,AskAdel}.tsx
- src/components/website/daylight.css
- src/lib/i18n.website.ts
- src/lib/website/{siteConfig,askAdelPublic}.ts
- src/lib/features.ts (separate public simulation descriptor; existing clinical flag inventory unchanged)
- src/lib/websiteMenus.ts and src/lib/navSections.ts (public /directory only)
- src/routes/directory.tsx
- src/lib/website/askAdelPublic.test.ts, src/components/website/heroMedia.test.tsx
- src/components/__tests__/landingWebsite.test.ts; e2e/{publicWebsite,websitePolish,websiteLandingDaylight}.spec.ts
- AGENTS.md, roadmap.md, project public-website memory, this report and evidence logs.

## Scoped existing-test adjustments
Removed obsolete assertions forbidding homepage privacy/about/team content; primary actions now asserted in ReadyBand; allowed only the supplied four-journey count digit 4 in the existing no-invented-numbers check. About/Team heading pins stay unchanged; homepage no longer requires the old five headings. Existing old anchor visibility is preserved by a nonzero invisible alias rather than dropping the test. No business-rule assertions or staff tests changed.

## Pending / limitations
- Actual video and fit photo have not been supplied: approved poster and photo placeholder remain.
- Spanish remains draft pending native-speaker review. Clinic/service counts remain unconfirmed and hidden. Directory content awaits batch 4a.
- No full unrelated staff/member browser suite run; all units and public browser suites passed.
- Typed question text is deliberately not retained for conversation display, to satisfy the no-message-storage requirement.
- Reentry script retains the supplied exact English three sentences, despite the general two-sentence guideline; no claims were rewritten.
- Nothing published; no backend, connector, patient shell or access changes.
