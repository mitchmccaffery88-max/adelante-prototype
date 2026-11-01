# Content import B5.0 — inventory and mapping

**Approved:** Mitch, 1 Nov 2026, 11:07 CT. **Scope:** documentation only. **Status:** inventory and mapping in progress; B5.1–B5.4 not started or authorized here.

Clinical and policy proposals are **Draft — pending clinical sign-off**; proposed SUD self-report/flag access remains **Draft — pending counsel**. No publication, persistence, Supabase, source, test, role, access or permission-snapshot changes.

This report maps the supplied sections 3–4 prep proposal onto the current app. Cathy's final source package and full commit are not yet verified; proposal-only source identifiers, lesson counts and lexical counts are not treated as an inspected import.

## Results recorded during B5.0

- Located the existing CMS audit, CSV inventory, vocabulary and approved 14 Oct audiences/Part 2 authoring plan.
- Captured pre-work hashes of 1,631 files under `src/`, `e2e/` and `supabase/` to verify documentation-only scope at closeout.
- Access investigation returned: current targeting is three any-match audiences, not the proposed six populations; the 14 Oct author exception does not grant patient-record access. Recommendation/deep-link gate inconsistencies are documented for B5.3, not changed here.
- Resource investigation returned: existing managed directory, county crisis contacts and need-linked referrals are reusable, but no unified verified `resourceType` resolver exists. Existing advocate output already masks restricted provider names.

## 1. Current content system

### 1.1 Types, schemas and storage

The shared lifecycle store currently has **eight types**, not the four described in older notes: `library_lesson`, `recovery_lesson`, `library_category`, `recovery_module`, `community_resource`, `naloxone_access_point`, `exercise`, `journey` (`src/lib/contentPublishing.ts:40–56`). Bodies are descriptor-validated `Record<string, unknown>` values, keyed internally by `typeId::id` (`:58–59,114–115`).

- **Library categories:** id/name/desc/icon/clinicalTarget/eyebrow/audience/order (`src/lib/library.ts:33–59`). `clinicalTarget` is intended for staff, but absent an authored eyebrow the category can derive a patient eyebrow from it (`:40–48`); v2 must stop that derivation if `clinicalFocus` is staff-only.
- **Library lessons:** eight-part problem → check-in → learn → activity → Adel reflection → insight → action → toolkit; categoryId/order, audiences, optional legacy populations and Part 2 flag (`src/lib/library.ts:62–122`). Ten activity variants are a discriminated union (`:131–165`).
- **Recovery lessons/modules:** ten-step lessons sharing the activity union, plus typed warning-sign/support/today-action tool flow; modules carry mission/subtitle/icon/order (`src/lib/recovery.ts:30–86`). Optional authoring extras are shared, not a merged Cathy five-step schema (`src/lib/lessonAuthoring.ts:23–93`).
- **Exercises:** seven renderer types with typed content and title/subtitle/minutes/tags/purpose (`src/lib/library.ts:171–235`); they are independently launchable.
- **Working versus published:** draft/pending_review/published working status; full immutable-by-clone revision snapshots, frozen `publishedBody`/`publishedRev`, returned note, retirement/discard history (`src/lib/contentPublishing.ts:37–108,260–280`). Draft edits do not replace served published content (`:143–149,296–334`). This is in-memory prototype state, not durable production CMS storage.
- **Descriptor editor/validation:** `ContentField` and `ContentTypeDescriptor` define real fields, baseline/empty bodies and validation (`src/lib/contentTypes.ts:41–98`); library fields/validators at `:272–315,419–460`, recovery at `:480` onward. Do not run the old eight/ten-step validator over an imported five-step body and call it valid.
- **Name collision warning:** this app's `SelfHelpModule` is only a care-plan assignment `{key,title,cadence,assignedBy,completedAt?}` (`src/lib/ehr.ts:848–854`); it is **not Cathy's merged lesson type**. Keep these concepts separate.

### 1.2 Audiences and Part 2-for-authors

The approved 14 Oct plan is `.lovable/plan/content-audiences-and-part-2-for-authors-2026-10-14.md:7–16,19–44,65–80`. Its shipped contract is:

- One `audiences` field: `justice_involved | sud | advocate`; **any match**, empty means everyone; unknown values currently filter out (`src/lib/contentAudience.ts:9–35`). Legacy track gates convert on read; retired `meta.populations` is not a gate.
- `personAudiences` derives confirmed justice signals and the shared SUD signal; advocate viewers receive only advocate, not the patient's audiences (`src/lib/population.ts:177–211`). SUD flags must remain the existing shared signal, including only clinician-origin SUD goals; AUDIT/DAST can create neutral staff review tasks, not flags (`src/lib/AGENTS.md:106–108`).
- No patient content branches on before/after release. Operational population tracks are separate (`src/lib/contentAudience.ts:5–7`; `src/lib/population.ts:89–108`). Tests explicitly reject content `pre_release` and map future release dates to first_30 (`src/lib/__tests__/contentAudiences.test.ts:118–125`).
- Every content author may maintain Part 2 **educational content** in CMS through `canAuthorContent(role) || roleSeesAsamSection(role)`; non-authors use the existing predicate (`src/lib/contentStaff.ts:10–25,41–43`). This **does not unlock any patient record**. The author exception is Draft pending compliance review, pinned by `src/lib/__tests__/contentAudiences.test.ts:128–147`.
- Patient-derived Part 2 outcomes/titles remain gated: engagement masking removes protected lesson/exercise IDs, revisions/dates and recovery completion (`src/lib/engagement.ts:381–385`; classifier registration `src/lib/contentCatalog.ts:247`). Outbound patient data still uses `disclose()` (`src/lib/AGENTS.md:48`); no private check-in answers enter staff summaries, exports or audit payloads.

### 1.3 Adel hooks, recommendations and need-paths

- Catalog injection supplies live published lessons/exercises and engagement resolution (`src/lib/contentCatalog.ts:238–250`). Adel defaults to shipped catalogs when sources are not registered; it filters audiences and separately rejects Part 2 items for a non-SUD audience (`src/lib/adelPrompt.ts:11–49,69–81,114–116`). These are existing context/action-token hooks, not evidence that the full external Adel Behavior Spec is present.
- Lesson recommendations use deterministic sibling order and keyword overlap, real targets only (`src/lib/lessonRecommends.ts:40–110`). They take **no viewer argument**; `livePatientLibraryItems` excludes advocate categories but is not patient-specific (`src/lib/contentCatalog.ts:171–175`). Treat recommendation title leakage/target eligibility as a B5.3 finding, not permission approval.
- About You routes selected needs to library, medications, recovery and obligations (`src/lib/seeking.ts:73–118`). Existing `patientPathway`/`pathwayFromFlags` and `journeysForPathway` select flagged journeys through `meta.pathways`/`meta.pathwayOrder` (`src/lib/flagJourneys.ts:45–80`). They do not advance clinical stages or remove existing assignments when flags change.
- No Cathy's named `NEED_TAGS`, `LIBRARY_TAGS`, merged `IfThenConfig`, `CareNote` or source need-path membership tables were found in the inspected local app. They are **import inputs still required**, not aliases for existing tags. `contentTags.ts` is the current shared tag-driven recommendation seam (`src/lib/AGENTS.md:79`).
- Existing direct-open library lesson/exercise branches resolve and render before listing-level eligibility filters (`src/components/library/LibraryBrowser.tsx:136–205`). Existing auto-added journey visibility returns before normal Part 2/audience checks (`src/lib/curriculumProgress.ts:23–30`). Both require negative/deep-link tests in B5.3; this report does not claim all downstream write gates were proven bypassed.

### 1.4 Existing inventory artifacts (not regenerated)

| Artifact | Inspected content and limitation |
|---|---|
| `docs/content-inventory.csv:1–215` | 214 rows: 90 library lessons, 90 recovery lessons, 10 categories, 9 modules, 11 exercises, 4 journeys. 101 Live, 113 Live (shipped); 210 Spanish missing, 4 draft; all owner/last-review/next-review fields blank. Snapshot, not freshly read runtime inventory. |
| `scripts/export-content-inventory.ts:63–75,101–114` | Education CSV covers six types; resources export separately to `docs/resource-inventory.csv`. No exporter run in B5.0. |
| `docs/content-management-audit.md:1–6,10–32,59–67,73–90` | 7 Oct historical audit across 22 text families and a proposed hub. Four-type/governance gaps and old navigation/review descriptions are not today's source of truth. |
| `docs/content-vocabulary.json:1–307` | No generation date; 11 category entries, 9 modules, 14 resource categories, 5 bands, 6 ASAM dimensions, 3 stages, 3 audiences, 10 activities, 2 flags, 3 reviewer roles. Category count differs from CSV; it contains both patient/advocate entries for advocate-support (`:49–58`), so do not deduplicate by bare id. |
| `docs/sculptsoft-content-handoff.md:7–19,64–80` | Useful later CMS/revision/governance summary, but the old Part 2-only clinical predicate at :80 predates the all-author exception; use current predicates and tests. |

## 2. Schema v2 mapping

**Disposition:** reuse = existing contract can retain meaning; extend = adapt an existing field/contract without discarding its history; new = absent typed structure/reference; drop = not carried into v2. “Keep” in Cathy's prep describes her source, not proof the same field already exists here. Every import field is validated in quarantine before live catalog use.

### 2.1 Entities and group fields

| V2 entity/field | Disposition | Existing seam / transformation |
|---|---|---|
| ContentGroup (`lib.*`, `rec.*`) | Extend | Unify category/module shapes, retain legacy type+id aliases; do not change current route families while flag is off. |
| Lesson (`lesson.<groupKey>.<id>`) | Extend | New canonical five-step body over current library/recovery descriptors; namespace handles collisions. |
| Exercise (`ex.*`) | Extend | Existing exercise entity/renderers; new global key/reference adapter. |
| IfThenPlan child | Extend | `ifThenPractice` options exist; separate child plus Cathy's full configuration needs validation. |
| CareNote (`care.<CODE>`) | New | No reusable Cathy care-note entity found. Reference graph, locale and review required; no copied clinical/crisis text. |
| ContentRevision `(entityKey,version)` | Extend | Existing full snapshots/revision ledger and served revision; new entity-key mapping preserves old unknowns rather than assigning guessed versions. |
| Group id | Extend | Existing id → namespaced group key with immutable alias table. |
| Group name | Reuse | Existing category/module name. |
| Group desc / subtitle | Extend | Category desc vs module subtitle normalized without substituting fallback text silently. |
| Group icon | Reuse | Existing lucide name validation/resolution. |
| clinicalTarget → clinicalFocus | Extend | Rename staff field; never derive patient copy from it. |
| mission | Reuse | Existing recovery mission. |
| order | Reuse | Preserve deterministic group order. |
| badge | Drop | No imported rewards or completion incentives; old runtime remains until B5.3 switch. |
| kind | New | `library | recovery` discriminant replaces schema/route-family distinction only in v2. |
| defaultPlacement | New | Reviewed group default; resolved lesson placement remains explicit, not inferred at every read. |

### 2.2 Every lesson field

| Field | Disposition | Mapping / validation |
|---|---|---|
| id → key; legacyId | Extend | Preserve Cathy id and existing app aliases; no bare-id join across groups. |
| groupKey; order | Extend | categoryId/moduleId + ordered position; check actual source order, not alphabetical guess. |
| title; subtitle; minutes | Reuse title/minutes; New lesson subtitle | Preserve source text and actual duration. |
| understanding.welcome, checklistTitle, checklist, normalizing, essentials, stages | Extend | Existing problem/learnTitle/learnBody/learnStages/enrichment are related, not lossless equivalents; retain Cathy's exact six subfields. Flag every generic fallback in provenance. |
| checkIn.intro, dimensions, reflectionPrompt | Extend | Existing checkIn/checkInOptions and rating dimensions; preserve source dimension IDs/anchors/direction. Do not equate lesson ratings with clinical screeners. |
| checkInCraving → checkInExtraDimension | Extend | `craving | null`; rendering depends on reviewed placement. Must not alter private EmotionCheckIn or infer a clinical SUD flag. |
| adel.intro, questions[3], recommends | Extend | Existing adelReflection/adelQuestion/recommendation hooks; validate exactly 3 source questions and resolved, gated recommendation references. |
| skill.toolName, toolIntro, purpose, steps, saveLabel, reminder, partBExerciseId | Extend | Existing activity/toolFlow/toolkitLabel/exercise renderers; typed skill structure and secondary exercise FK are new. Tool saves retain registry/privacy boundaries. |
| ifThen → IfThenPlan | Extend | Existing ifThenPractice has paired lists; preserve source config, stable choices, referenced resources and no clinical advancement. |
| exerciseId | Extend | Existing exercise linking → `ex.*`; resolve against quarantine graph before offer. |
| insight | Reuse | Existing insight text. |
| progressNote | New | Content template, not automatic clinical note/record write. Do not copy private answers to team summaries. |
| related[] | Extend | Existing derived recommends; explicit source references all filtered by current viewer/placement before labels render. |
| careNote → careNoteIds[] | New | Reference `care.*` records; unresolved IDs block approval. |
| peerStory.name, text, fictional | New | Preserve exact story plus required `fictional: true`; narrator cannot imply real staff/patient testimonial. |
| threads | New | Typed finding-footing-only structure; reject elsewhere unless later explicitly approved. |
| activity (legacy optional) | Extend | Preserve existing union where present; don't require it on every five-step lesson. |
| toolkitKey | Drop | Derive from canonical key; retain legacy response/toolkit alias mapping. |
| badge reward / finish-all | Drop | No badges, points or sobriety streak incentives. |
| placement | New | See 2.4; distinct content eligibility, never a role/access grant. |
| sensitivity | Extend | Existing Part 2 marker becomes explicit four-field structure. |
| lifecycle | Extend | Existing content stage tags become suggestions only; pre_release is rejected in live v2 pending resolution. |
| locale; translations | Extend | Existing es bodies/meta.esStatus; richer status/reviewer evidence. |
| review | Extend | Existing lifecycle ledger plus richer review states/evidence; approval must not equal immediate publication. |
| readingLevel | Extend | Existing browser grade heuristic target 6 → proposed target 6–8 with method/measurement evidence; Draft clinical change. |
| safety | New | Structured references/checks; crisis action and approved wording remain code-held. |
| provenance | New | Verified source/batch/checksums and fallback-field ledger; never store truncated commit as verified full hash. |
| tags | Extend | Existing meta fields/backfilled Draft become family/value/source/confidence/review evidence. |
| locationScope | New | Validated registry area IDs or statewide; launch allowlist Tulare. Metadata can name scope; content prose cannot embed contact numbers. |

### 2.3 Every exercise field

| Field | Disposition | Mapping |
|---|---|---|
| id, title, subtitle, minutes, type, content | Reuse shape; Extend id | Existing seven typed renderers; canonical `ex.*` plus legacy aliases. Unknown source renderer type stays quarantined. |
| tags → exerciseTags | Extend | Preserve source tags, bridge to skill/topic, not a replacement for eligibility. |
| purpose | Reuse | Existing purpose text. |
| adel.skill, needs, states, when | New structured metadata | Existing catalog/context hook reusable; exact source offering conditions are not locally defined. |
| placement | New | Independently enforced on direct link, Adel offer, recommendations and completion. |
| sensitivity | Extend | Preserve existing part2Sensitive and engagement masking. |
| review | Extend | Shared governance, separate exercise approval. |
| locale | Extend | Also carry translations for exercises; English-only base cannot skip ES review. |
| readingLevel | Extend | Same Draft 6–8 measurement contract. |
| provenance | New | Per-exercise source/fallback evidence. |
| safety | New | Standalone safe-routing contract; no inline emergency/local numbers. |

### 2.4 Nested fields, conflicts and hold points

| Structure / every subfield | Disposition and constraint |
|---|---|
| placement.populations | **Extend** three audiences to proposed general/sud/reentry/justice_supervised/under_21/advocate only after approved semantics. Unknown values must fail closed in v2; current parser would drop unknowns to everyone. General must mean universal, not OR-bypass of a required SUD gate. |
| placement.requiresAny | **New** reviewed positive predicates. Proposed SUD self-report/flag no-consent admission differs from existing recovery consent/signal behavior; preserve existing gates until counsel decision is authorized in B5.3. Reentry/supervision must not be inferred from release date alone. |
| placement.diagnosisSpecific | **New** assignment/member-choice restriction, not diagnosis inference. Need explicit representation of member choice/assignment evidence before implementation. |
| placement.assignableByStaff | **Extend** existing assignments; assignment cannot override population/sensitivity/consent restrictions or add role access. |
| sensitivity.part2 | **Extend** existing required recovery Part 2 and flags; gate all outcome/title/derived text reads. |
| sensitivity.justice, selfHarmAdjacent, dvAdjacent | **New** classification, not automatic emergency escalation, disclosure or role grants. |
| safety.crisisLinkSteps | **New** stable step references; validate resolved steps. |
| safety.hasEmergencyBackup | **New** verify the claimed six lists against actual final source; enforce 988 immediately before 911 where prep requires, no inferred count. |
| safety.harmReduction | **New** human-reviewed clinical classification. |
| safety.safetyCheckInTalk | **New** once/never behavior; no private answer scanning or duplicate alert logic. |
| safety.routesTo | **New** literal pathways_crisis_screen must resolve to existing code-held help surface, not a nonexistent new route. |
| safety.verifiedContacts | **New** computed verified-reference evidence, not importer's untrusted boolean. |
| lifecycle.suggestedStages, sequenceHint | **Extend/New** only hints; exclude pre_release under current content policy. Do not import STAGE_DONE_AT/currentStageIndex. Clinical stage remains care-flow spine. |
| locale=en; translations.es.status, fields, reviewer, reviewedAt | **Extend/New evidence** missing→none, draft→draft, reviewed only with actual provenance. machine_draft is a classification, not permission to machine-translate clinical content. Existing publishBlocker permits draft Spanish and a missing-Spanish reason override (`src/lib/contentGovernance.ts:116–120,174–179`); stronger native-speaker-reviewed publication requires B5.4 approved rule/test changes. |
| review.status, author, submittedAt, clinicalReviewer, reviewedAt, publisher, publishedAt, version, changeNote, reviewDue | **Extend** existing ledger/timestamps/actors/version; **New** approved/changes_requested/retired states and separate clinicalReviewer evidence. Current approve and publish registry IDs both call publishContent; author review marker is not clinical approval. Role add-ons aren't implemented today; stop before changing grants. Preserve editorial own-publish exception unless scope explicitly replaces it for v2. |
| readingLevel.target, measured, method | **Extend/New metadata** target 6–8 is Draft, measured optional but absent cannot mean passed; record grade method/language. |
| provenance.source, commit, sourceFiles, fieldsFromGenericFallback, importedAt, importBatch | **New** source string cathy_wireframe_39aaddf5 and truncated 8a84f1a2… are prep claims until full immutable package verified; list exact files, import time/batch and fallback paths. |
| tag.value, source, confidence, needsReview | **Extend/New evidence** validated family values/source enum/range; derived review state cannot be overwritten by untrusted source. |

**Safety/clinical conflict holds:** Private EmotionCheckIn currently offers Urge Surfing Timer when a patient chooses Craving regardless of a stored SUD flag (`mem/features/emotion-check-in` requirement; `src/lib/AGENTS.md:14`). Prep says it must never be offered to non-SUD members. Do not silently remove that approved private offer or turn it into a SUD flag; Mitch/clinical resolution is needed before B5.3. Likewise no new clinical advancement, pre-release content, permission union or Part 2 summary exemption is approved here.

### 2.5 Group defaults and dropped behaviors

- Every rec.* and lib.strengthen-recovery defaults to reviewed SUD placement/Part 2; first-days and life-that-works add reentry **without letting OR-match bypass SUD**. Validate aliases against the final source; current group IDs differ (`first-days-out`, `building-a-life-that-works`, etc.).
- lib.understanding is per-lesson: SUD gated; depression/anxiety/bipolar/PTSD/psychosis choice/assignment-only; my-strengths/treatment-team general; my-triggers-2/recovery-journey-2 unresolved. Current psychosis/JI audience seed must not be silently repurposed (`14 Oct plan:49–56`).
- lib.back-on-feet general except legal-responsibilities supervision-only; lib.starting-strong general except finding-footing reentry. This changes current JI-gated lessons/journeys; approval/testing required. All remaining library groups general only after full member-text lexicon review.
- Drop badges, Days Sober and party cards from imported display; keep existing RecoveryDateCard privacy. Replace PATHWAY advancement with hints, local numbers with resource references, Devon with `{peerName}`/“my peer specialist”, and source mock meds/obligations with no fake record writes.

### 2.6 Auto-tagging map

| Family | Disposition / current mapping | Proposed review |
|---|---|---|
| topic | Extend existing topic/tag-driven seam; Cathy's 17 NEED_TAGS + grief/housing/money/legal/health need final literal vocabulary and memberships. | Auto-approve only deterministic+rule agreement; record provenance. |
| skill | Extend Exercise.tags plus **new** adel.skill mapping to the prep's 15 values. | Bulk approval is a recorded human action, never implicit publication. |
| population | Extend audiences into proposed six-value taxonomy after semantic approval. Scan **all** member-facing nested text/options/care notes/translations. | Always human. |
| sudSensitive | Extend required recovery Part 2/lexicon to all source text; true when SUD population or lexicon hits. | Always human; cannot clear existing protected classification automatically. |
| diagnosisSpecific | New reviewed id→diagnosis mapping for lib.understanding. | Always human. |
| stage | Extend stage/meta.pathways hints, not progress. | Human; pre_release blocked. |
| sdohNeed | Extend meta.sdoh through explicit aliases: benefits/financial, healthcare/health care, ID/phone etc.; no unrecognized ID silently accepted. | Deterministic membership + review rule hits. |
| format, duration, audience | Reuse deterministic type/minutes/viewer semantics; duration bucket rules and audience-vs-population meaning must be written. | No manual tag review, but normal entity publication gate applies. |
| readingLevel | Extend grade scorer and recorded method/language. | Flag >8; target change Draft. |
| safetySensitive | New self-harm-adjacent/crisis-link/emergency-backup/harm-reduction/dv/cws/court-order/supervision/overdose values. | Always human. |
| locationScope | New registry IDs; detect Tulare references, do not infer verified contacts. | Always human. |

Confidence imports the supplied rules: deterministic **0.95**, deterministic+rule agree **0.9**, rule-only **0.6**, model **≤0.5**. Agreement being lower than deterministic is retained, not silently corrected. Default needsReview is protected-family membership OR confidence<0.8. The prep additionally requires stage review and all placement/sensitivity/safety sign-off: enforce those higher-level approval holds even if the general formula returns false. Deterministic-only topic (.95) is **not auto-approved** unless the topic agreement condition is met. No model service is added/connected by this plan; any future model-assisted pass is separately approved, Simulated while mocked, and sees content only, not patient records.

Queue seeds: strengthen-recovery + understanding/sud; SUD/justice phrases in general text/options; finding-footing, legal-responsibilities, grief-loss/work/first-days; COURT_ORDER/ASSOCIATION/SUPERVISION_SLIP/CWS; diagnosis lessons; get-safe-first/call-give-stay/understanding-3/Medicine Continuity/Never Use Alone; safe-now/bipolar/first-days-8; when-hard-9; every local tel reference; every Devon hit. **About 47 Devon mentions and six backup lists are unverified prep estimates**, to be counted against Cathy's final build during B5.1. Tag review carries source evidence, proposed value, approver and timestamp, not just a checked boolean.

## 3. One feature flag (proposal, not added)

Propose `content_v2_player` in existing `src/lib/features.ts:6–38,40–178`: global, default **false**, owner Product & Clinical Content, non-integration (`simulated: false`). No second flag/store selector. False always serves current routes/catalog/players; imported v2 stays quarantined, invisible to member browse, Adel/recommendations, assignments and progress. B5.3 may expose approved preview under the same switch only after full gate/negative tests. Reverting false preserves both versioned progress histories and returns the current player; never migrate/advance stages on toggle. Registry `feature_flag_set` remains the only administered toggle writer (`src/lib/features.ts:209–225`). No flag, admin control, new feature snapshot row or default change is implemented in B5.0. Turning it on is not clinical approval, permission or production-persistence approval.

## 4. R50/R51 registry and R58 needs connection

### Existing pieces — reuse, do not duplicate

- Managed community directory has county/city/category, public name/address/phone/hours/website and stamped contact confirmation (`src/lib/communityResources.ts:71–115,429–438,623–670`). One store overlays CMS edits; no expiry. Published/browsable is **not equivalent to verified** (`:484–495,520–535`). Fresh external phone accuracy was not checked here; old baseline confirmation is 8 Oct (`:760–787`).
- `publicDirectory` shares those records plus naloxone; demo deliberately permits labelled unverified entries (`src/lib/website/publicDirectory.ts:9–16`; `src/lib/website/siteConfig.ts:1–2`). Existing resourceType in anonymous reports means community_resource/naloxone_access_point record kind, **not the requested semantic contact type** (`src/lib/website/publicResourceReports.ts:7–13`).
- County crisis contacts live separately in `src/lib/outsideCrisisResources.ts:3–20` with Kings/Tulare and both-counties unknown fallback. Their source comments are historical verification, not per-entry verified evidence.

### Proposed registry home (R50/R51, outside B5 implementation authorization)

New `src/lib/locationContactRegistry.ts`: one area catalog (launch enabled `tulare`, extensible IDs) and semantic resource types referencing existing managed IDs/kinds or reviewed code-held national/crisis contacts. Store county/service-area coverage, public label/contact/channel, verification provenance and canonical stable ID. Reuse `isResourceVerified`; do not copy the directory into another mutable store. Controlled emergency contacts use separate approved evidence because directory address/hours rules do not fit 988/911. New `src/lib/locationResourceLookup.ts` resolves `resourceType` + optional coarse area into verified public facts; no hardcoded local tel in lesson text. Add new tests for area validation, withdrawn/unverified contacts, neutral lookup auditing and decline fallback. Existing `outsideCrisisResources.ts` remains unchanged until R50 safety policy is approved.

Content `locationScope` may contain area IDs; actionable contact/location facts resolve at need time. Resolve profile address/ZIP → optional “Where are you right now?” → decline/unknown Tulare-wide plus eligible statewide/national results. Exact location exists only transiently for lookup; audit semantic type/registry IDs/coarse scope/outcome, **not address, ZIP, raw chat or coordinates**. Any mutation/audited action must use registry/runAction; permission row changes stop for approval. 988 and 911 remain immediately available, never blocked behind location or verified local-match loading. Tulare launch filtering is **not deletion of Kings emergency fallback**: `src/lib/__tests__/inCrisisNow.test.ts:12–14` pins Kings/Tulare/four unknown results.

### Specific connected resource on the needs record (R58)

Today `ResourceReferral` stores `provider`, optional `resourceId`, `sdohItemId`, status/outcome and staff-only logs (`src/lib/ehr.ts:2649–2698`); patient owns resourceReferrals (`:1773`), and `referralsForNeed` joins by need ID (`:14963–14965`). Need connectRequestedAt/task is a **request**, not evidence of a successful connection (`:840–845,14535–14560`).

Propose a validated `resourceConnections[]` on each need (or an explicitly materialized needs projection owned by the existing referral writer): **connection ID, stable registry resource ID/kind/semantic resourceType, saved public resource name, public contact snapshot and its verified revision, existing referral status, referral ID and updatedAt**. The needs record must be able to read back the particular connected resource and status; `categoryId` or “requested” alone does not satisfy this requirement. Snapshot preserves who was connected if a provider retires; current action links re-check verification. Allow multiple referrals without overwriting prior connections; reuse the existing referral as status authority, no parallel lifecycle. Store only real selected public facts, no inferred successful connection.

`advocateCoordination` already projects provider/status/restricted, but no contact/resourceId (`src/lib/ehr.ts:19406–19465`). The UI displays provider — status or Restricted (`src/components/advocate/AdvocateWorkspace.tsx:213–224`). R58 may change separator to `resource · status`; contacts/IDs require an approved minimal projection extension, not a raw directory join. Existing sensitive-provider suppression and consent gates apply to **name, contact, identifier and status-context**; no lookup may fill a withheld name. Preserve `src/lib/__tests__/advocateNeedReferrals.test.ts:86–93,108–116,132–158`. Existing `referralLinks.ts:42–67` can resolve historical active/inactive/missing provider references without rewriting them.

R50/R51 implementation file candidates: new registry/resolver/tests above; existing `src/lib/communityResources.ts`, `src/lib/outsideCrisisResources.ts`, `src/lib/referralLinks.ts`, `src/lib/ehr.ts`, `src/lib/chartActions.ts`, `src/components/patient/NeedConnect.tsx`, `src/components/advocate/AdvocateWorkspace.tsx`, `src/components/admin/ResourceVerificationQueue.tsx`, and corresponding new tests/docs. They are **not silently bundled into B5.1–B5.4**. B5 imports unresolved contact references into quarantine until R50 exposes its approved resolver contract. No directory launch defaults or crisis numbers changed here.