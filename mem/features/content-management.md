---
name: Content management tool (/admin-content)
description: Managed content types, direct-publish RBAC (no second approver), no expiry, and how Cathy's verification history was preserved
type: feature
---
`/admin-content` manages FOUR content types through
`contentPublishing.ts` / `contentTypes.ts` / `contentCatalog.ts`:
`library_lesson`, `recovery_lesson`, `community_resource`,
`naloxone_access_point`. Patient surfaces read the published overlay
(`liveLibraryItems`, `liveRecoveryLessons`, `patientVisibleResources`,
`liveNaloxoneAccessPoints`); the shipped baseline stays as the fallback.

NO SECOND APPROVER for this content (product direction). `CONTENT_PUBLISHER_ROLES`
in `roles.ts` may create AND publish their own work; `clinical_coordinator`
(Cathy, `s-cc2`) is the designated content-manager seat. The review queue is an
optional second look, never a precondition. Do NOT reintroduce separation of
duties here. This is scoped to general editorial content only — the per-patient
care-plan / cosign / order gating is a separate system and stays as gated as it is.

NO EXPIRY. `VERIFICATION_VALID_DAYS`, `expiresOn` and `flagResourceForRecheck`
were removed for real; nothing auto-unpublishes on a timer. Expiry becomes
valuable again only with multiple site/county/state partners — a future
reintroduction is anticipated, not a mistake being undone.

Cathy's real verification pass survived migration as revision 1: naloxone
access points are seeded via `seedNaloxoneAccessContent()` with her staff id and
the original 2026-08-12 date; community resources replay through the real
`verifyResource`, which now publishes into the content store. Never re-date
these to "now" or invent a migration actor.
