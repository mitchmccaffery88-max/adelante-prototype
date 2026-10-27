# Public website — Diana first pass / Mitch additions (27 Oct 2026)

## Scope and boundaries
Public website presentation and copy only. No Supabase calls, schema changes, TEST secrets, integrations, persistence switches or publishing. Phase 2c stays parked at its migration-target stop. Member/staff clinical workflows, gates and registry actions are unchanged.

## Delivered
- Hero has equal, separate, arrow-free **Start my care** and **I want to help someone** choices. The header care button has the same label; **Make a referral** sits beside **Join our team** in desktop navigation and the phone menu. The privacy/Medi-Cal line remains below the choices.
- Removed all four floating hero tags. The sunrise stays; `HeroMedia` reserves a photo/video slot and `dianaConfig` holds short future captions. No feed or new video built.
- Home order: Hero → Mission → Core values → One Ecosystem of Care → Core services → Your Path, Your Care. Your Way → existing How it works / fit / What you get / About / team / partners / FAQ / closing bands.
- The supplied English mission is verbatim in `websiteMission`, used by Home and About. Spanish is a draft for native review. The exact English mission intentionally retains its supplied reading level rather than being simplified.
- Five values come from one editable config inventory and bilingual strings. A slow continuous band has a visible pause/play control, pauses on hover/focus, and becomes a wrapped static list with reduced motion. Repeated visual copies are hidden from assistive technology; one semantic list remains. About lists the same five values.
- Ecosystem retains the connected diagram and “Care that knows your whole story,” with a visible paragraph connecting existing supports and local/county/state/federal programs and community resources. No statistics or dollar claims added.
- Six larger service cards have short EN/ES descriptions exposed by hover, keyboard focus or phone toggle. Language availability is a support line, not a service. Group copy is the supplied English text.
- Groups are included in How care works and What you get as clinical care/community support, without times, places or counts.
- Four path cards and existing manual journey controls remain; heading/subline updated as requested.
- Larger 988 bar uses existing urgent tokens, measured clearance, 20/28 desktop and 18/26 phone text. Spanish wraps to a taller bar; layout and phone sheet reserve its actual height.
- All new copy is in dictionaries/config, not JSX literals; Atkinson and existing semantic tokens remain.

## Menu grouping
Top menus remain click-open; category lists expose adjacent sub-items on desktop hover/focus (click also works). Right arrow moves keyboard focus into the active flyout; left arrow returns to its category. Escape closes the parent menu and returns focus. Phone uses nested accordions in the existing trapped sheet.

- **Get care:** Who it's for; Journeys; How it works — requested inventory, unchanged destination routes.
- **Our team (proposed grouping, implemented):** Your Care Team (clinicians, psychiatric care, recovery); Your Navigation and Reentry Team (coordinators, reentry guides); Resources and advocate support (resource navigators, advocate partners). All existing team items retained; careers promotion remains.
- **For partners (proposed grouping, implemented):** Refer someone (referral and partner page); The platform (portal, clinical record, Adel, practice management). All existing items retained.
- About us keeps its existing short list.

## Public modality wording sweep
Scanned public dictionaries, shared website content, landing sections, journey data and public routes in both languages. No public literal “telehealth,” “virtual only,” or “virtual-only” claims were found. Clinical consent/telehealth labels outside public marketing were intentionally untouched. Existing FAQ and Ways to meet already offered both video and in-person visits and remain.

| Page / shared source | Old English | New English (Spanish counterpart updated) |
|---|---|---|
| Home service string | Teletherapy | Therapy and counseling (in person and online) |
| Home service string | Telepsychiatry | Medication management |
| Home + Team, including 4b role strings | Telepsychiatry Providers | Psychiatric Care Providers |
| Home + Team role description | Offer psychiatric care and medication support by video, from wherever you are. | Offer psychiatric care and medication support in person and online by video. |
| Home What you get + How it works + Everyday journey | Private video or phone sessions with a counselor, on your schedule. | Meet with a counselor in person or online by video. Your team helps you plan your visits. |
| Home How it works + How it works page | Talk to a counselor, learn new skills, and get help with daily life. | Meet with a counselor in person or online. Join groups, learn new skills and get help with daily life. You do not have to go it alone. |
| Home Find where you fit | Mental and behavioral health, telepsychiatry, substance use recovery, and everyday resources are open to you. | Mental and behavioral health, medication management in person and online, substance use recovery, and everyday resources are open to you. |
| Home metadata/shared description | telepsychiatry | medication management in person and online |
| Home + About mission | Former Complete Wrap-Around Care paragraph with telepsychiatry | Mitch's exact new mission paragraph |
| Hero | Teletherapy / Reentry support / English and Spanish / Free with Medi-Cal floating tags | Removed; privacy/Medi-Cal line remains under choices |

## Metadata
Inspected all public content leaves: index, About, Team, referral, auth, start index/signup/helping/support/reconnect/other-help, four care journeys, How it works, cost, FAQ, partners, platform, privacy, careers, contact and directory. Each has app-specific title/description/Open Graph fields/type and Twitter card. About now has its own editable page description. `/start` is an Outlet-only parent, with metadata on its index and content children. Existing share-card behavior was preserved.

## Validation and evidence
- Full unit suite after final refinements: **3,523/3,523**, 402 files, exit 0; 96.57 seconds. Units and public browser suites were sequential, never overlapping.
- Initial public suite: **46/47**, one homepage focus-clearance failure caused by an earlier smooth scroll overriding focused-control placement. Corrected public focus handling, retaining the assertion.
- Next public suite: **43/47**, four back-to-top regressions exposed because focus cancellation included that button. Excluded the back-to-top command from cancellation. Targeted shell/polish rerun: **9/9**, exit 0; no assertion or timeout weakening.
- Intermediate full public + Diana run: **51/52**, the existing homepage focus check exposed a sticky-header resize restoring an earlier scroll destination. Footer focus now centers immediately and rechecks after the header settles; back-to-top is excluded. Targeted shell/polish checks passed **9/9**, with original assertions/timeouts.
- Final full public suite plus five new Diana interaction checks: **52/52**, exit 0, **10.6 minutes**, one worker against `:8080`. The original 47 public checks all passed alongside five new Diana checks. Preview build OK.
- Browser interaction proof at **1280 and 390, EN and ES**: mission equality, service keyboard/touch expansion, pausable values, category flyouts/accordions and document width all passed; zero page errors. Reduced-motion values are static.
- Screenshots under `/tmp/browser/diana/`: final-home images, menu images, group details and reduced-values. Long section captures include fixed chrome; group-detail captures isolate the actual expanded content.
- Existing assertions changed only for the superseded mission/modality copy, section order, removed tags, Start my care label, five About values, nested phone category and About description, with batch comments. Five new public regressions cover the new interactions. No timeouts/retries changed.

## Review / not built
Spanish remains draft pending native-speaker review; short new service copy is draft editorial copy. Supplied mission/clinical/model claims remain Diana/Mitch first-pass content for their review, not newly verified operational claims. No locations, service counts, times or dollar figures added. Future supplied photo/video media and feed are not built. Nothing published.