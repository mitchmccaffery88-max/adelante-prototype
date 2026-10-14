# Part 2 content visible to content authors

## Part A — the change

### Rule
Any role with `content_authoring` **write** (`canAuthorContent`) sees Part 2 **content** in /admin-content. Everyone else keeps today's rule: they see it only if `roleSeesAsamSection` passes. Patient data checks stay exactly as they are.

Roles that gain Part 2 content access (they have write but fail `roleSeesAsamSection`): `clinical_coordinator` (Cathy), `ecm_provider`, and any other write role whose screener access is limited (confirmed role by role in a test, not assumed). `sys_admin`, `pmhnp`, `therapist` and the rest already pass.

### The one change
In `src/lib/contentStaff.ts`, add one rule and use it inside `contentVisibleToStaff`:

```text
contentPart2VisibleToStaff(role) = canAuthorContent(role) || roleSeesAsamSection(role)
contentVisibleToStaff(role, type, body) =
  canBrowseContent(role) && (!isPart2Content(type, body) || contentPart2VisibleToStaff(role))
```

`roleSeesAsamSection`, `SUD_MED_WITHHELD_ROLES`, `asamReporting.ts` and `roles.ts` stay untouched. The rule gets the label "Draft — pending compliance review", like the list it sits beside.

### Content-center readers
These change automatically, because each one already goes through `contentVisibleToStaff` or `staffContentInventory`:
- Manage inventory (`ContentAdminWorkspace.tsx` inventory tab, through `staffContentInventory`)
- Review queue and its counts (`ContentAdminWorkspace.tsx`, review tab and badge counts)
- History tab (`ContentAdminWorkspace.tsx` HistoryTab)
- Browse tab (`ContentBrowse.tsx`, through `staffContentInventory`). This changes only for authors.
- Backup export filter and the restore Part 2 check (`contentBackup.ts`). Cathy's file will now include recovery lessons and modules, and say `partTwoIncluded: true`.

These stay as they are:
- Browse for non-authors (for example `medical_assistant` with read access, and care-plan readers without write). They still need `roleSeesAsamSection`. Your expectation holds: this does not change.
- The "Part 2" badges and edit-drawer chips. These only label items; they don't decide who sees them.
- The audit redaction in `contentPublishing.ts`: Part 2 ids still show as "protected-content" in audit text.
- The Part 2 check in `contentTags.ts` that matches content to a patient's needs. It feeds patient care-plan suggestions, so it stays on the patient-record rule.
- Everything on patient records: ASAM sections, SUD meds, screeners, `disclose()`, care plans, audit and notification text.

### Tests (new file `src/lib/__tests__/contentPart2Authoring.test.ts`)
1. `clinical_coordinator` sees a recovery lesson, a module, and a journey and exercise flagged Part 2 through `contentVisibleToStaff`. `roleSeesAsamSection("clinical_coordinator")` is still false.
2. For every role: if `canAuthorContent` passes, it sees Part 2 content. If it doesn't, the result equals the old rule (`roleSeesAsamSection`).
3. A non-author with read access (`medical_assistant`), and `peer_specialist` if it lacks write, still can't see Part 2 content. The existing `peer_specialist` assertion stays as it is. If `peer_specialist` turns out to have write, I'll report the conflict before building.
4. The backup export as Cathy includes the recovery entries and `partTwoIncluded: true`, and the round trip still deep-equals.
5. Patient side unchanged: `SUD_MED_WITHHELD_ROLES` still contains the same four roles, and a patient-record ASAM section is still hidden from `clinical_coordinator`.

No existing assertion, retry or threshold changes. One risk to check before building: `peer_specialist` has `content_authoring` write, but `staffContentCenter.test.ts:14` expects it **not** to see Part 2 content. Under this rule that test would fail. If so, I stop and ask Mitch to choose between narrowing the rule to `CONTENT_PUBLISHER_ROLES` (which keeps the test green) or approving that one line. The permissions snapshot is not affected, because no actions change.

### Files
`src/lib/contentStaff.ts`, the new test file, `src/lib/AGENTS.md` (one rule), `docs/content-backup.md`, `roadmap.md`.

---

## Part B — how the app decides what a patient sees (no build)

**1. Populations and conditions**
- **Population:** `resolvePopulation` / `resolvePopulationTrack` in `population.ts` give one track only. The order is: an open pre-release episode means `pre_release_ji`; released or missed handoff, a front-door "yes", Z65.2 or custody (`isJusticeInvolved`), the reentry flag, or a justice referral source means `post_release_ji`; "not sure" means `post_release_ji` but provisional; otherwise `general_population`. SUD plays no part in it. `cohorts.ts` `resolveCohorts` runs the same logic for a whole caseload.
- **SUD:** `flagJourneys.ts` `detectFlags` marks SUD for an active problem in the SUD category or an F10–F19 code, an open `sud_dmc_ods` or `outpatient_sud` episode, or `needs.substanceUse` from the intake/seeking answer. Screener scores and care plans don't set it. A separate check, `seeking.ts` `recoveryJourneyVisible`, needs `needs.substanceUse` plus Part 2 consent, an SUD program episode, or SUD CalOMS data (a justice answer alone never counts).
- **Combined:** yes, one person can be all three. JI and SUD are separate flags, and the advocate is a separate `AdvocateLink`.
- **Pathways:** `flagJourneys.ts` `pathwayFromFlags` / `patientPathway`: JI and SUD gives `reentry_sud`, JI only gives `reentry`, SUD only gives `sud`, neither gives `general`.

**2. What each signal unlocks** (seeded in `curriculumTypes.ts` `initializePracticeContent`)
- **Starting Strong and Back on My Feet:** `justiceInvolved: true`, `meta.flags [justice_involved]`, `meta.pathways [reentry]`.
- **My First Days Out:** `meta.pathways [reentry_sud]` only, Part 2.
- **Recovery Journey (`reentry-curriculum`, 9 modules):** `meta.flags [sud]`, `meta.pathways [sud, reentry_sud]`, Part 2.
- **Where the gates are:**
  - `curriculumProgress.ts` `curriculumVisible`: auto-added journeys always show. Otherwise, Part 2 journeys need `recoveryJourneyVisible`; `justiceInvolved` needs a literal front-door "yes"; `positiveSignal` checks `needs[signal]`; and top-level `populations` is checked against the track.
  - Library lessons: `library.ts` `isLibraryItemVisible`, using top-level `populations` with confirmed tracks only.
  - Recovery modules: the same `populations` field in `recovery.ts`.
- **90-day reentry features:** wrapped in `PopulationGate` (confirmed justice-involved tracks only), for example `ReleaseDayChecklist`.
- **Advocate library:** the `advocate-support` category (`library.advocateCategory.seed.ts`). It's for advocates and has no lessons yet.

**3. When it updates**
- The track, pathway and visibility are worked out fresh each time they're read, from the live record, so they always reflect the latest information.
- Adding journeys happens when something changes: `flagJourneys.ts` `sweepFlagJourneys` runs on every save to a record. When the flags change, `applyFlagJourneys` adds the journeys for that pathway through `autoAddJourneyAssignment`. That covers a referral, intake answers, a new F1x or Z65.2 diagnosis, or an SUD episode opening. Screener results and care-plan edits don't change the flags.
- **Automatic or suggested:** journeys are added automatically. Staff get a task only when nothing matches (`raiseGap`, sent to the content owner). Journeys are never removed; changes are marked "Pathway changed — review".

**4. Content tags**
- **Read by logic:**
  - `sdoh`, `stages` and `bands`: content matching in `contentTags.ts`.
  - `asam`: `asamCarePlan.ts`.
  - `flags` and `pathways`: auto-adding journeys in `flagJourneys.ts`.
  - `part2`: promoted to `part2Sensitive`, and controls who can see it.
- **Stored but not read for targeting:** `clinical` is only shown in the content center and exports. No targeting reads it.
- **`meta.populations`:** nothing reads it for targeting. Targeting uses the separate top-level `populations` field.

**5. Advocates**
- **What they see:** the `/advocate` pages, limited by tier (`advocate.ts` `ADVOCATE_TIER_BY_TYPE`), with Part 2 access on its own setting (`ADVOCATE_SUD_MODE_BY_TIER`). In practice they can view the schedule, documents, resources, messages and their own library.
- **Their own track:** `resolvePopulation` returns `advocate` before it reads anything from the patient's record.
- **Can an advocate also be a patient?** Yes, through "Support for myself" (`advocate.support-for-myself.tsx`), which opens a separate record of their own. That record gets its own track and pathway.

**6. Gaps for people who are several things at once**
- **One track only:** the track has no SUD part. So anything gated only by `populations` treats a JI + SUD person the same as JI only.
- **Two different "justice-involved" tests:** `curriculumVisible` needs a literal front-door "yes", but `isJusticeInvolved` also counts custody, Z65.2, the reentry flag and missed coordination. Those people are still auto-added to Starting Strong and Back on My Feet, so the journeys show, but they can't find them by browsing unless they're auto-added.
- **My First Days Out:** SUD-only people never get it, because it's tagged `reentry_sud` only. This is the interim rule, pending Cathy.
- **"Not sure" answers:** a provisional answer opens no justice-gated content or reentry features, by design.
- **At release:** pre-release to post-release is a hard switch. Content gated to `pre_release_ji` disappears on release day.
- **Screener only:** a positive screener alone (no diagnosis, episode or "seeking" answer) doesn't set the SUD flag, so no Recovery Journey is added.
