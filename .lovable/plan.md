# Phase 5d-1 — Part 2 consent check on staff referrals + attribution

Safety and honesty only. No linking, no directory picker, no outcome vocabulary (5d-2/5d-3).

## What I found

- `addResourceReferral` (`ehr.ts:8466`), `setResourceReferralStatus` (`ehr.ts:10035`), `setSdohStatus` (`ehr.ts:9895`), `addSdohItem` (`ehr.ts:9783`), `setSdohVisibility`, `removeSdohItem` all take no actor and write no audit entry.
- Care Coordination tile passes the raw boolean `active.consents.part2Sud` (`case-manager.tsx:585,789`); the record tab writes `!sudGated` (`RecordTabs.tsx:816`) — the viewer's access, not the patient's consent.
- The real live consent check used everywhere else is `AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment")` (what `canAccess` itself calls, `roles.ts:838`) — not the flat `consents.part2Sud` boolean. I will use the live check.
- No seeded demo patient has any `resourceReferrals` at all (no seed writes that field anywhere), so there is no pre-existing recovery-category referral to correct. I will report this rather than invent a backfill.

## Sensitive categories

From the real category list (`ehr.ts:1732-1746`, mirrored from `RESOURCE_CATEGORIES`), I include exactly **`recovery_meetings`** and **`support_groups`** — the same two the patient-facing matcher already treats as Part 2 caution (`sdohResourceMatch.ts:26-33`). I will reuse and export that existing constant rather than declare a second list, so the two sides can never drift. Other categories (housing, legal, healthcare…) are not SUD-identifying by category and stay unrestricted; widening them would be a guess.

## Build

1. **Data-layer consent gate.** `addResourceReferral` gains a required `actor: { staffName, role }` and throws a typed error when the category is Part 2 sensitive and `isConsentCategoryAuthorized(patientId, "sud_treatment")` is false. Both UI paths catch it and show a clear reason with a link to the patient's consent section — never a silent create.
2. **Correct flag.** Both paths stop passing viewer-derived values; the data layer itself stamps `sudDisclosureConsent` from the live patient consent at creation time, so it cannot be wrong.
3. **Gating detail.** SUD-sensitive referrals render **existence-only** for a Part 2–gated viewer: category and status shown, provider name and note replaced with a locked "42 CFR Part 2 — consent required" line, and status/visibility controls disabled. Existence-only (not hidden) because the referral count and category already surface elsewhere, and hiding rows would make the list silently disagree with the tab count.
4. **Attribution + audit.** New optional fields `createdBy/createdByRole/createdAt` and `lastUpdatedBy/lastUpdatedByRole/updatedAt` on `ResourceReferral` and `SdohPlanItem`. Audit entries in the `setWorklistStatus` shape (`category: "clinical"`, `actorId`, `actorRole`, `patientId`, `detail` with changed fields) for: `sdoh_need_created`, `sdoh_need_status`, `resource_referral_created`, `resource_referral_status`. Existing callers that pass no actor keep working (attribution recorded as unattributed rather than faked).
5. **Inline display.** Needs and referrals in the record show "Added by X · date" and "Updated by Y · date" when present.

## Verification

Typecheck, full test run, plus new tests: blocked-without-consent and allowed-with-consent for both creation paths; flag reflects patient consent not viewer access; gated role sees existence-only (no provider, no note); audit entries carry actor and role. Live browser at desktop and phone including a Part 2–gated role, zero console errors.
