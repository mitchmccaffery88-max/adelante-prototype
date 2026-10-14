# Download / Load my changes — Patient Content & Resources Center

## What Cathy gets
Two outline buttons on /admin-content, "Download my changes" and "Load my changes". Next to them is one quiet line: "Last downloaded 2:14 PM · 6 changes since" (or "Not downloaded yet"). When changes since the last download are above zero, the browser shows its standard leave-page warning. Loading a file shows a preview first: N new, N updated, N unchanged, N skipped, with a reason for each skip. Nothing is applied until she confirms.

## Stores that exist (checked)
- `contentPublishing.ts` `entries` Map holds all 8 types: library_lesson, recovery_lesson, library_category, recovery_module, community_resource, naloxone_access_point, exercise, journey. Exercises and journeys are in this same store (descriptors in `curriculumTypes.ts`). They are not a separate store.
- `communityResources.ts` `resources` Map is a second store. It holds per-resource verification facts (verified state, verifier, date, plus details from `updateResourceDetails`). `verifyResource` publishes into the content store, but the verification record itself stays in this map. It is included in the file.
- Out of scope: patient records, audit log, care plans, lesson ratings and analytics.

## JSON shape
```text
{
  "schemaVersion": 1,
  "kind": "adelante-content",
  "exportedAt": "2026-10-15T21:14:03.000Z",
  "exportedBy": { "staffId": "s-cc2", "name": "Cathy …", "role": "clinical_coordinator" },
  "appCommit": "abc1234" | null,
  "partTwoIncluded": true | false,
  "entries": [ ContentEntry verbatim:
     { id, typeId, status, body, publishedBody?, publishedRev?, publishedAt?,
       publishedBy?, revisions: [{ rev, action, body, statusAfter, at, by,
       byStaffId?, byRole, note? }], overridesBaseline, returnedNote? } ],
  "resourceVerifications": [ { resourceId, verification facts as stored } ]
}
```
File name: `adelante-content-YYYY-MM-DD-HHmm.json`, using facility-local time. `appCommit` comes from a build-time define of the git short SHA. When it isn't available, `appCommit` is null and the file says so; nothing is invented.

## Store functions (contentPublishing.ts)
```text
exportContentEntries(role: StaffRole): ContentEntry[]          // deep clones, Part 2 filtered
planContentRestore(file: unknown, actor: ContentActor): RestorePlan
  RestorePlan = { ok: false, error } |
    { ok: true, items: { typeId, id, outcome: "new"|"updated"|"unchanged"|"skipped", reason? }[] }
restoreContentEntries(input: { file: unknown; actor: ContentActor }): ContentResult & { plan }
```
- `restoreContentEntries` re-runs the plan and writes `new` and `updated` entries verbatim, with revisions[] exactly as in the file. It never adds or renumbers revisions and never stamps "now". Then it calls notify() once.
- Community resource verifications restore through a matching `restoreResourceVerifications` in `communityResources.ts`, using the same newer-wins rule on the verified date.
- Change counter: `contentChangesSince(iso)` counts revisions with `at` after the last download. The last-download time is kept in sessionStorage for the session only and is not audit data.

## Conflict rule
Compare the latest revision in the file with the store, using `rev` first and then `at`.
- Not in the store: **new**.
- File's latest is newer (higher rev, or same rev with a later `at`): **updated** (the entry is replaced).
- Same rev and same `at`: **unchanged**.
- Anything else: **skipped**, with the reason "Your app has a newer version (rev X, date) than the file (rev Y)".
- Same rev but different content, which means a fork: skipped, with the reason "Edited in two places; not replaced". It is never merged.

## Validation and refusal
- The whole file is refused (nothing applied) when: the JSON is invalid, `kind` doesn't match, the schemaVersion is unknown, or `entries` is not an array.
- Per entry, skipped with a reason: unknown typeId, missing id or revisions, revisions not numbered 1..n, or revision bodies that fail the shape check. Unknown types are refused, never coerced.

## Role rules
- Download and Load both require `canAuthorContent`, the existing content_authoring write gate.
- An entry with published state (status published, or a publishedRev) needs `canPublishContent`. Without it, the entry is skipped with the reason "Published content needs a publisher role to load". Why: a load would otherwise let an author put content in front of patients, which is the one thing `publishContent` already blocks for authors. Draft and pending entries load for authors.
- Part 2: export filters through the existing `contentVisibleToStaff`. A role that can't see Part 2 content does not get it in the file (your expectation holds), and `partTwoIncluded` records this. On load, a role without Part 2 access has Part 2 entries skipped with the reason "Restricted content". Why: they couldn't see or edit those entries anyway.
- Audit text stays neutral: counts only, no titles.

## Registry (AGENTS.md rule)
Two new CHART_ACTIONS entries, `group: "admin"`, `needsPatient: false`, `menu: false`:
- `content_export`: check `canAuthorContent`, store `exportContentEntries`.
- `content_restore`: check `canAuthorContent`, store `restoreContentEntries`. Per-entry publish checks happen inside the store.
Each goes through runAction, so each gets one `action.succeeded` or `action.blocked` event. The load event carries counts (new/updated/unchanged/skipped) through a short neutral `reason`. Previewing writes no audit event; only applying does.

## UI (design system)
- `ContentAdminWorkspace` toolbar: outline buttons with Download and Upload icons, a hidden file input, and the quiet status line (14px, muted).
- Preview dialog: four counts, then a skipped list with reasons. Its primary action is "Load N changes"; the secondary is "Not now".
- Errors appear in attention text with a CircleAlert icon, never red. Toasts are neutral.
- English only, `lang="en"`.
- The leave-page warning uses a `beforeunload` listener while changes since the last download are above zero.
- The file download follows the in-app blob pattern (`downloadBlob`).

## Files
- `src/lib/contentPublishing.ts`: export, plan and restore functions, plus the change counter.
- `src/lib/communityResources.ts`: verification export and restore.
- `src/lib/contentBackup.ts` (new): file shape, validation, file name, schemaVersion.
- `src/lib/chartActions.ts`: the two registry entries.
- `src/components/admin/ContentAdminWorkspace.tsx`: buttons, status line, unload warning.
- `src/components/admin/ContentRestoreDialog.tsx` (new): the preview dialog.
- `vite.config.ts`: define for the commit SHA (null fallback).
- `src/lib/__tests__/contentBackup.test.ts` (new).
- `src/lib/AGENTS.md` (one rule), `roadmap.md`, `docs/content-backup.md` (short how-to and the seed path).

## Permissions snapshot (Mitch's condition: not touched)
The runAction permissions snapshot file stays exactly as it is. That snapshot lists every registry action for each role, so adding `content_export` and `content_restore` to `CHART_ACTIONS` may make it fail. The build will report any failure plainly, and it will not edit the snapshot or update it automatically. The way to handle it is waiting on your next message.

## Tests (new only)
1. Round trip: seed drafts, published content, a returned note, a Part 2 item and a resource verification, then export, reset, load, and check the result deep-equals the original store.
2. Conflict: newer file means updated; same rev means unchanged; older file means skipped with a reason; a fork is skipped.
3. Roles: billing can't export or load (blocked event); an author loads drafts but published entries are skipped; a publisher loads published entries; a non-Part 2 role's export omits Part 2 entries and its load skips them.
4. Bad file: invalid JSON, wrong kind, unknown schemaVersion and missing entries are refused with nothing applied; unknown typeId and a broken revision sequence are skipped per entry.
5. Audit: one event per load, a preview writes none, and audit text has no titles.
6. File name format; appCommit null fallback.
Then the full unit suite, every browser spec including axe, and a 1280px screenshot of the preview.

## What I'd do differently
- **Seed path on download:** downloading also makes the file the seed source. The later seed step can read it through `restoreContentEntries`, so `seedPublishedContent` doesn't need to replay each revision by hand. One function means one history rule.
- **Session-only counter:** "changes since" counts revisions, not keystrokes. An unsaved form in an open drawer is already guarded by drawer drafts; the counter only tracks store changes.
- **No automatic merge:** fork cases are skipped and listed for Cathy to redo by hand. A silent merge could put the wrong version in front of patients.
- **Risk to flag:** this is still a manual habit. If Cathy forgets to download, the work is lost. The leave-page warning reduces the risk but doesn't remove it. A real database (Lovable Cloud) is the lasting fix after this week.
