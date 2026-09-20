# Phase 1 — Pre-release episode release transition

## What I found (and one correction to the brief)

The brief says every `post_release_ji` surface is dead. That is not quite what the code does, and the difference changes the fix:

- **Obligations card** and **PO-disclosure card** both gate on `allow={["pre_release_ji", "post_release_ji"]}`. They were already active for these patients under the stuck `pre_release_ji` track. Not broken.
- **Day-0 reentry module** is the genuinely broken one, and for a second, separate reason: `dayZeroAvailability` requires `eps.some(e => e.status === "released")` — literally the string `"released"`. Nothing in the app ever sets it.

That second fact settles the status-model question. `closePreReleaseEpisode` sets `"closed"`, which satisfies `resolvePopulationTrack` (it accepts `released` **or** `closed`) but **not** the Day-0 trigger. So closing alone would fix the population track and still leave Day-0 dark.

## Status model decision

Use the existing three-state type unchanged: `"open" | "released" | "closed"`. Do not invent a value.

- `open → released` — the person is out. This is the real clinical event, and the one Day-0 reads.
- `released → closed` — administrative wrap-up, already implemented and tested as `closePreReleaseEpisode`.

So I add one new transition (`released`), not a replacement. `closePreReleaseEpisode` keeps its current behaviour and its existing tests untouched.

## Build

**`src/lib/ehr.ts`** — new `markPreReleaseEpisodeReleased({ episodeId, confirmedBy, actorRole, releasedOn? })`:
- throws if the episode is missing, or if status is not `open`
- sets `status = "released"`
- writes audit `pre_release_episode_released` (same shape as the close audit)
- calls `_recomputeCarePlan` + `emit()`, mirroring `closePreReleaseEpisode` exactly

**`src/routes/pre-release.tsx`** — in `EpisodePanel`'s existing header card, beside the proxy badges:
- a live status badge (Open / Released / Closed)
- **"Confirm release"** when status is `open`
- **"Close episode"** when status is `released` (reason required, matching the function's real requirement)

Both actions render only when the acting role has `write` on the `pre_release` record class **and** the existing `useAttribution` gate returns `ok` — the same authority already required to record task-list and care-plan activity, so proxy-blocked and read-only roles (therapist, sud_counselor, clinical_coordinator) see the badge but no buttons. Confirmation dialog on each: releasing changes what the patient sees.

Entry point reasoning: the episode panel is where the CF Care Manager already works the timeline, and the timeline card directly above already renders a derived "Released N days ago" line off the anticipated date — which is exactly the misleading part today, since the record still says open. Putting the real action next to that derived claim is the honest placement. `/released-search` is a lookup surface with no episode context; the chart's reentry tab is receiving-side.

## Test

`src/lib/__tests__/preReleaseRelease.test.ts` — end to end:
- open episode → `resolvePopulation` is `pre_release_ji`, `dayZeroAvailability` unavailable
- `markPreReleaseEpisodeReleased` → track is `post_release_ji`, Day-0 available with trigger `released_episode`, Obligations + PO-disclosure population checks pass
- `closePreReleaseEpisode` after release still leaves `post_release_ji`
- guard: cannot release a non-open episode; audit row written

## Verification

Typecheck, full suite, build, browser at 1280 and 390 as a CF Care Manager: confirm release, watch the badge flip, then confirm the patient's Day-0 module activates where it previously did not. Zero console errors.

## Non-goals

No SDOH mapping/provenance work, no intake reconciliation, no scheduling changes. No auto-close on date — release stays a human confirmation.
