# Daylight v2 batch 4b

Implemented remaining public pages and the public referral three-step presentation. Nothing published; no database, connector or clinical gate changes.

## Changed files
- Routes: `src/routes/cost.tsx`, `faq.tsx`, `team.tsx`, `partners.tsx`, `platform.tsx`, `privacy.tsx`, `careers.tsx`, `contact.tsx`, `referral.tsx`, `inbox.tsx`.
- Pages/presentation: `src/components/website/WebsiteSections.tsx`, `RemainingInformationPages.tsx`, `WebsiteForms.tsx`, `WebsitePage.tsx`, `pages.css`; `src/components/WebsiteLayout.tsx`; `src/components/referral/ReferralSubmissionForm.tsx`; `src/components/inbox/WebsiteInboxQueue.tsx`.
- Copy/config/model: `src/lib/i18n.website.ts`, `i18n.website4b.ts`, `website/siteConfig.ts`, `website/platformCapabilities.ts`, `website/websiteInbox.ts`, `chartActions.ts`, `features.ts`.
- Tests: `src/components/website/RemainingPages.test.tsx`, `src/lib/website/websiteInbox.test.ts`, `src/lib/__tests__/__snapshots__/runAction.test.ts.snap`, `src/components/__tests__/landingWebsite.test.ts`, `e2e/websitePages4b.spec.ts`, `e2e/publicWebsite.spec.ts`, `e2e/websitePolish.spec.ts`.
- Documentation: `AGENTS.md`, `roadmap.md`, this report; public website requirement memory updated.

## Final platform statuses
“Live” means an implemented in-app preview workflow, not a production-connected vendor or a deployment/compliance certification.

| Part | Capability | Status |
|---|---|---|
| Portal | Today page/next step | Live |
| Portal | Guided journeys/resource directory | Live |
| Portal | Advocate visibility through existing link/tier/consent gates | Live |
| Record | Summary/next action (deterministic chart brief) | Live |
| Record | Existing role/consent restrictions, with protected content hidden | Live |
| Record | AI scribe drafts/review/sign workflow | Simulated |
| Adel | Bilingual plain-language explanations | Simulated |
| Adel | Staff note/summary drafting | Simulated |
| Adel | Links to a person for help and to 988 | Live |
| Practice | Clinic/person-hours scheduling | Live |
| Practice | Referral lifecycle tracking | Live |
| Practice | County/health-plan reporting delivery | Simulated |

No Planned capabilities currently. Both planned and simulated presentation paths are supported. `platformShowNonLive` defaults true; false replaces non-live chips with Coming soon and suppresses the corresponding part description. The Part 2 point was corrected from “never missing” because existing restricted content can be omitted; the human handoff point was corrected to links, not a staffed handoff. Advocate gates are not a claim of universal typed advocate-release enforcement. Internal calendar/referral functionality is real in-app; external delivery remains simulated. Source investigation covered chartBrief, roles/consent gates, scribe/vendor adapter, Adel chat/history/public classifier, workingCalendar, referral stores and countyReporting.

## Validation
- Final complete unit run: 386 files, 3,297 tests passed.
- Final 4b + public polish browser run: 9/9 with one worker on :8080; all nine pages at 1280/390 EN/ES, serious/critical Axe checks, anchors and reduced FAQ still, real preview submissions/readback in demo admin Inbox, non-admin omission.
- Existing public website suite: 11/11; existing daylight shell tests 6/6; 4a directory/pages 6/6. Final combined 4a/public/4b run initially found a focus handler moving Send between pointer-down and click. Corrected by deferring clearance until the next animation frame; intake flow then passed 3/3 standalone and final 4b/polish run passed 9/9. No timeout or production permission changes.
- Original referral required-name/optional-agency flow passes with step navigation; all referral store/validation/audit unit regressions pass. Query `/referral?type=advocate` preserved; no new prefill behavior invented.
- All nine public pages visibly server-render without JavaScript; final desktop team and Spanish phone careers/referral screenshots inspected. Build telemetry last showed build OK.
- Platform rendering both flag values and planned path; exact 5MB boundary/type checks; résumé filename/size-only storage; required fields; all staff public append refusals; one simulated registry audit without message/contact text; six FAQ groups and multiple-open behavior tested.

## Limitations and deliberate deviations
- Existing referral path is an in-memory preview, not encrypted storage. Kept fields, final validations, robot, store and welcome-delivery path; replaced the public “Encrypted submission” claim with explicit simulated/not-encrypted wording. No security mechanism was fabricated. Staff form layout remains single-page. Supplied public header asks not to include charges/diagnoses/substance-use detail, while existing required-preservation optional fields still include charges/prior records; those fields were not removed.
- Careers/contact inbox is browser module memory, not a durable shared inbox; reset/reload loses entries. Demo admin presentation gating is not production authentication or RLS. Do not use real personal/medical information. Résumé bytes never stored; only filename/size retained.
- Privacy commitments remain Draft — pending clinical sign-off; counsel notice/privacy-officer contact remain explicit placeholders. Phone/email/clinic/hours are unconfirmed. Spanish drafts need native-speaker review; operating-system file chooser labels follow the browser locale.
- Contact reply time 1–2 business days is the user-specified placeholder in one dictionary entry, not a verified service guarantee.
- Full staff browser suite was not run; scoped public/directory/inbox flows and complete units were run. Supabase hosted signup/sign-in/security settings were not inspected or changed.