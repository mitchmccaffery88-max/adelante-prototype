# Daylight v2 batch 4a

## Delivered
- WebsitePage: bilingual breadcrumbs, dawn/tinted header and graded sun, shared spacing/tokens and ReadyBand.
- JourneyPage and journeyPages: four data-driven journeys, requested points/topics/three-role teams/other journeys, recovery privacy draft callout, consent steps and advocate CTA. English topic titles resolve matching shipped library categories/recovery module names; supplied coming-home Spanish is preserved verbatim.
- About: mission/highlights/values/team and careers links, shared ReadyBand. Legacy /about#partners still resolves to an anchor; partner information remains on /partners and landing.
- How it works: expanded steps/details, in-person first/video/phone, after-start callout, shared WhatYouGet now used by landing and this page.
- Public /directory: shared resource and naloxone records behind getPublicResources; category/county/query URL filters, dynamic county values, public visibility and verified/demo rules, listing language fallback, real verification dates, safe external links, report dialog and matched-care callout.
- Content Center: Show on public website default on, county/city/Spanish editorial fields, Last checked display. Existing content_edit/create/verify gates and reason paths remain the mutation owners. County values derive only explicit county wording, never inferred from city. Existing patient /resources route/components/gates unchanged.
- Anonymous public report registry action with non-staff principal, no patient/staff identifier, bounded reason/note and no personal record fields. Adds a local preview review item displayed inside the existing ResourceVerificationQueue; no verification or publication changes. Reports are Simulated in UI, feature descriptor and audit. Generic audit reason never includes note or listing text; email/long-number note patterns are removed.

## Validation
- Full units after final structural changes: 3,277/3,277, 383 files.
- New browser set: 6/6. All seven pages checked at 1280/390 EN/ES with Axe serious/critical none, no horizontal scroll, breadcrumb and h1 checks. Public report form required reason and confirmation; real Content Center save/hide/show/name edits read back through public UI, then public report read back in review workspace.
- Existing public/browser plus admin resource verification: 28/28; final shared WhatYouGet landing recheck: 5/5.
- New accessor/report tests: 12, plus 4 rendered JourneyPage cases. Public/private, verified/demo/category/county/query, shared identities, metadata save/patient snapshot invariance, anonymous fields and denied staff actor tested.
- New registry entry is hidden for all 17 staff roles; snapshot gained only that hidden field per role. No existing permission changed. Existing no-number copy test permits the supplied 10–15-minute detail.
- Screenshots reviewed: desktop recovery/directory, phone report confirmation and Spanish coming-home/directory. 988 remains above all overlays and bottom clearance is retained.
- No timeout/config changes in existing tests. New multi-page test has its own 120-second budget. One shell command exceeded 300 seconds but its completed log showed 26 passed/2 copy failures; rerun after changing directory title assertion passed 28/28.

## Files changed
- src/components/website/{WebsitePage,JourneyPage,InformationPages,WhatYouGet,PublicDirectory}.tsx and pages.css
- src/components/Landing.tsx (shared grid), website/AskAdel.tsx (typed directory params)
- src/lib/website/{journeyPages,publicDirectory,publicResourceReports,resourceMetadata}.ts and siteConfig.ts
- src/lib/{i18n.website,communityResources,safetyContent,contentTypes,chartActions,features,websiteMenus}.ts
- src/components/admin/{ContentForm,ContentAdminWorkspace,ResourceVerificationQueue}.tsx
- src/routes/{about,how-it-works,care.everyday,care.coming-home,care.recovery,care.advocates,directory}.tsx
- New unit/component tests and e2e/websitePages4a.spec.ts; scoped presentation updates to publicWebsite, websitePolish, websiteLandingDaylight and landingWebsite; runAction permission snapshot additive hidden entry only.
- Architecture rules, roadmap, public-website memory, report and evidence.

## Limitations / pending
- Existing resource/CMS stores are this prototype's in-memory stores. Same-session updates and reports work and are verified; reports are local Simulated and are not delivered durably to a hosted service or another browser. No Supabase schema/server integration was added in this website batch.
- Spanish remains Draft pending native-speaker review. Records lacking Spanish name/description show existing English with lang=en; hours remain sourced English.
- Some sourced listings retain their existing verification hedges and blank facts. No contacts, counties, statistics or verification provenance were invented.
- No unrelated full staff/member browser suite run. Patient route files and access logic untouched.
- Nothing published.
