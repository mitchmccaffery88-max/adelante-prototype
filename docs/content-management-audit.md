# Content management audit — Oct 7 2026 (report only, no code changed)

Scope: every kind of text the platform holds or serves, who controls it, and how
staff find it. Roles were read from the live permission matrix (`canAccess`), not
from comments. "Code" means the text lives in a source file and changes only
with a deploy.

## 1. Inventory

| # | Content type | Where it lives | Author / edit / publish | Versioning & review | Draft label | EN/ES | Reading level | Clinical sign-off needed | Who sees it |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Library lessons (self-help: box breathing, grounding, sleep, Starting Strong) | Baseline `library.ts` + `library.ported.ts`; managed overlay `contentPublishing.ts` (type `library_lesson`); authored overrides `library.startingStrong.authored.ts` | Author: `content_authoring` write (11 roles). Publish: `CONTENT_PUBLISHER_ROLES` (coordinator, sys_admin, PMHNP, physician, therapist), own work, no second approver | Yes: revisions, draft → pending_review (optional) → published; no review/expiry date | Per lesson where clinical | Partial (ES fields on many shipped lessons; authored overrides mostly EN) | Not measured | Yes for exercises with clinical claims | Patients (/library), Adel recommendations |
| 2 | Library categories | `contentPublishing` (`library_category`) + baseline | Same as 1 | Same as 1, plus "still in use" guard | — | Labels EN/ES via i18n | — | No | Patients; advocate category for advocates |
| 3 | Recovery modules + lessons (incl. My First Days Out, 9 modules) | Baseline `recovery.ts`, `recovery.ported.ts`; 9 `recovery.*.authored.ts` files; `recovery.activityChoices.remediation.ts` (must load last) | Same as 1 | Same as 1; authored files are published overrides seeded in code | Stage model Draft (`recoveryStages.ts`) | ES only for chrome (`i18n.recovery.ts`); lesson bodies mostly EN | Not measured | Yes (SUD education) | Patients (/recovery-journey), Adel |
| 4 | Re-entry Journey / Day-zero content | `reentry.ts`, `reentryDayZero.ts`, `preReleaseTimeline.ts` | Code only | None | Some | Partial | Not measured | Partly | Patients; in-facility parts behind `inFacilityEnabled()` (off) |
| 5 | Toolkit / activity tool-flows | `toolkit.ts`, option sets inside authored lesson files, `recovery.exerciseMatch.ts` | Code (option sets ride lesson publishing) | Via lesson revisions only | — | Partial | — | Partly | Patients (/toolkit) |
| 6 | Community resource directory | `communityResources.ts` + `.ported.ts`; managed type `community_resource` | Edit in /admin-content (`content_authoring`); verify in Resource verification queue (verifier role, coordinator screen) | Revisions; verification ticks; no expiry (removed on purpose) | — | Partial | — | No | Patients (/resources), advocates (/advocate/resources), intake, SDOH match |
| 7 | Naloxone access points | Managed type `naloxone_access_point`; seed `seedNaloxoneAccessContent()` | Same as 6 | Revisions; Cathy's verification kept as rev 1 | — | Partial | — | No | Patients (/naloxone) |
| 8 | Naloxone / overdose steps, safety content | `safetyContent.ts` | Code only | Flag "awaiting Christi / Dr. Bagga" shown in Clinical content review card | Yes | EN/ES | Not measured | Yes | Patients (/naloxone, crisis) |
| 9 | Crisis copy and policy | `crisisCopy.ts`, `crisisPolicy.ts`, `crisisTextDetection.ts` | Code only | None | Policy Draft | EN/ES (ES Draft) | Not measured | Yes | Patients, Adel, crisis queue |
| 10 | Crisis lines by county | `outsideCrisisResources.ts` (`COUNTY_CRISIS_LINES`) | Code only | Comment: verified on county sites, Sep 2026 | — | EN/ES | — | No (but safety-critical) | Patients (crisis screens) |
| 11 | Safety plan prompts | `safetyPlan.ts` | Code only | None | Draft | EN/ES | — | Yes | Patients, care team |
| 12 | Adel system prompt / scripts | `adelPrompt.ts`, `vendors/llm.ts` (Simulated), `adelDistress.ts`, `privateNudge.ts`, `whatWouldHelp.ts` | Code only | None | — | EN/ES in replies | — | Yes (therapeutic framing) | Patients via Adel |
| 13 | Adel question library / Ask Adel (staff) | `askAdel.ts` (29 ES strings), `AskAdelPanel.tsx`; voice copy `adelVoice.ts`, `intakeVoiceCopy.ts` | Code only | None | Simulated | EN/ES | — | Partly | Staff (Ask Adel), patients (voice) |
| 14 | Note templates | `templateSchema.ts`, `templateScope.ts`, `scribeFormats.ts`, `noteAutofill.ts`; screen /admin-note-templates | `note_templates`: coordinator + sys_admin write; clinicians read | Template store has versions; no clinical approval step | — | EN only | — | Yes (documentation rules) | Staff (notes, scribe) |
| 15 | Screeners and instruments (PHQ, GAD, C-SSRS, AUDIT/DAST, ASAM) | `screeners.ts`, `cssrs.ts`, `asam.ts`, `asamFlow.ts`, `reassessmentCopy.ts`, `severityRules.ts` | Code only | None (validated wording must stay verbatim) | Severity rules Draft | 6 ES blocks in `screeners.ts`; not all instruments | Fixed (validated) | Yes | Patients (check-ins, rescreen), staff |
| 16 | Risk-text Spanish translations (disclosures) | Catalog strings + governance metadata; panel `RiskTextReviewPanel` | `clinical_text_governance`: coordinator, sys_admin, PMHNP, physician write | Two sign-offs promote es-v1-draft → es-v1 | Yes | EN/ES | — | Yes | Patients (forms) |
| 17 | Consent and legal wording, Part 2 notices | `consentLabels.ts`, `consentAudit.ts`, `part2Disclosure.ts`, `poDisclosure.ts`, `ab133.ts`, `refusalPdf.ts` | Code only | Disclosure records versioned; wording not | Some | EN/ES (ES partly Draft) | — | Legal sign-off | Patients (/consent), advocates, staff |
| 18 | Patient interface strings (i18n) | `i18n.tsx` (937 lines), `i18n.benefits.ts`, `i18n.recovery.ts`, many `*Copy.ts` files (intake, schedule, my care, phase9a) | Code only | None | ES marked "Draft — pending bilingual review" on many screens | EN/ES | Not measured | No (except clinical lines) | Patients, advocates |
| 19 | Notification / SMS text | `groupNotifications.ts`, `groupNotificationSms.ts`, `staffAlerts.ts`, `staffAlertSms.ts`, `reminders.ts`, `referrerUpdateDelivery.ts`, `advocateInviteDelivery.ts` | Code only | None | — | Mixed; staff alerts EN | — | No (Part 2-neutral wording required) | Patients, advocates, staff, referrers |
| 20 | County / TPS survey and reporting text | `countyReporting.ts`, `calomsReporting.ts`, `sudReportingAccess.ts` | Code only | None | Some Draft | EN (patient survey ES not found) | — | No | Staff; patients for TPS |
| 21 | Weekly recap, check-in summaries | `weeklyRecap.ts`, `checkInSummary.ts`, `recoveryCheckInNotes.ts` | Code only | None | — | EN/ES | — | Partly | Patients |
| 22 | Clinical rule labels (note clock, calendars, scheduling rules, KPI targets) | `noteClock.ts`, `workingCalendar.ts`, /admin-scheduling-rules, /admin-kpi-targets | Rules: coordinator + sys_admin | Audited changes | Yes | EN | — | Yes | Staff |

## 2. Authoring and admin screens

| Screen | Route | Gate | What it does |
|---|---|---|---|
| Patient content | /admin-content | `content_authoring` (11 roles write) | Draft, revise, publish lessons, categories, modules, community resources, naloxone points |
| Resource verification queue | inside /admin-coordination | coordinator / sys_admin (`canAct`) | Confirms address/phone/hours before a resource goes live |
| Clinical content review card | inside /admin-audit | audit log access | Shows which clinical content is still awaiting sign-off (read-only) |
| Risk-text review panel | inside /admin-audit | `clinical_text_governance` | Records the two sign-offs that promote Spanish disclosures |
| Catalog resolution metrics | inside /admin-audit | audit log access | Drug-catalog search quality |
| Note templates | /admin-note-templates | `note_templates` | Edit documentation templates |
| Scheduling rules | /admin-scheduling-rules | `scheduling_rules` | Worklist-generating rules |
| Catalog governance | /admin-catalog-governance | `catalog_governance` | Frequencies, drug-catalog suppressions |
| CalAIM codes | /billing-calaim-codes | billing roles | Code list text |
| Location calendars | /location-calendars | sys_admin edit, coordinator read | Holiday names shown to patients |

Duplicates and overlaps:
- Community resources are edited in /admin-content but verified in /admin-coordination — two screens, two menus, one record.
- Clinical sign-off status and Spanish-translation sign-off live inside the Audit log page, which reads as a log, not a work screen.
- /admin-content's page description still promises "a second-reviewer approval step", which product direction removed. The `content_authoring` code comment ("authoring cannot publish") is also out of date.
- The recovery "pending review" state exists but is optional, so it looks like an approval queue that nothing requires.

Content that can only be changed in code: rows 4, 5 (outside lessons), 8–13, 15, 17–21 above — including crisis lines, crisis copy, safety plan, naloxone steps, consent and Part 2 wording, screeners, Adel prompts and every notification.

## 3. Governance gaps

1. **content_authoring is still write for 11 roles** (10 directly, plus physician through PMHNP): ECM provider, CF care manager, SUD counselor, clinical trainee, peer specialist, CHW, therapist, PMHNP, physician, coordinator, sys_admin. Medical assistant reads. That's 11 of 17 roles in the role list (older count: 14). Authoring is wide on purpose; it is safe only because publishing is narrower.
2. **Publishing rules:** 5 roles (coordinator, sys_admin, PMHNP, physician, therapist) can publish their own work immediately. No second approver (product decision, kept).
3. **Clinical content without sign-off:** any of those 5 can publish a lesson with clinical claims (e.g. SUD education, coping steps) with no clinical-review flag on the lesson type. Clinical review is tracked only for code-held content (row 8, risk text). A therapist can publish recovery content that has never had clinical sign-off.
4. **No review dates or expiry:** removed on purpose for editorial content; there is also no "next review" date on clinical content, crisis lines or resources. Crisis lines carry only a code comment ("Sep 2026").
5. **Missing Spanish:** recovery lesson bodies and most authored overrides are EN only; note templates EN only; staff alerts EN; county/TPS survey text has no ES found. The content form doesn't require ES before publish. No reading-level check anywhere.
6. **Part 2 risk in tagging:** lessons carry an optional `part2Sensitive` flag set by hand. Recovery-module completion, lesson ratings and Adel recommendations can show that someone is in SUD treatment (module names like "Understanding my addiction"). Nothing forces the flag on SUD lessons, and advocate-facing or notification text derived from lesson titles isn't checked against it.
7. **Hard-coded content that should be managed:** crisis lines by county, naloxone steps, safety-plan prompts, consent / Part 2 notice wording, notification and SMS templates, and the patient i18n catalogue.

## 4. Navigation today

- Staff menu → Administration has 15+ entries in one flat group. Content is spread across "Patient content", "Note templates", "Catalog governance", "Clinical coordination" (resource verification) and "Audit log" (clinical review, Spanish sign-off).
- Confusing points: verification sits under coordination; sign-off sits under audit; "Patient content" doesn't say it also holds resources and naloxone points for advocates; no screen lists code-held content or its review status except the Audit log card.

## 5. Suggested target structure (proposal only)

One **Content hub** (Administration → Content) with tabs:
- **Patient education** — library, recovery modules, toolkit activities, re-entry content.
- **Directory** — community resources, naloxone points, county crisis lines (edit + verify on one screen).
- **Safety & clinical text** — crisis copy, safety plan, naloxone steps, screener wording (view; edit locked to clinical reviewer), with sign-off status.
- **Legal & consent** — consent, Part 2 notices, disclosures, translation sign-off.
- **Messages** — notification / SMS / reminder templates (Part 2-neutral check built in).
- **Staff documentation** — note templates, scribe formats.

Roles:
- Author: today's `content_authoring` set (wide is fine).
- Clinical reviewer: PMHNP, physician, coordinator, required before publish for any item tagged clinical or Part 2.
- Publisher: coordinator, sys_admin (editorial items may stay "publish own work" per current decision).
- Legal/consent: sys_admin with counsel sign-off recorded.

Per item: clinical tag, Part 2 tag (required for SUD topics), EN + ES status, reading level, owner, next review date.

SculptSoft server side: a CMS with versioned content records and an approval workflow (draft → clinical review → published, with the "no second approver" exception for editorial types); audit trail; locale variants with translation status; scheduled review reminders; Part 2 tag enforcement on publish and on any derived text (notifications, advocate views); migration of the code-held types into the store.
