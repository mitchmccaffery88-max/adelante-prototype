# Project Memory

## Core
Adelante EHR prototype (Tulare County pilot). In-memory `AdelanteEHR` store in `src/lib/ehr.ts` is the single source of truth.
RBAC lives ONLY in the `src/lib/roles.ts` matrix — never hardcode role names as a proxy for `canAccess()`.
Nav is generated from `src/lib/navSections.ts`; inaccessible entries are omitted, never disabled.
Compliance content (DHCS/ASCMI form text, categories, attestations) is PLACEHOLDER pending Christi — flag it, never invent statutory wording.

## Memories
- [SUD consent policy](mem://features/sud-consent-policy) — which roles read `screeners_sud` unconditionally vs consent-gated; Part 2 messaging backstop
- [ASCMI consent](mem://features/ascmi-consent) — ConsentRecord model, live gate, disclosure audit, psychotherapy-notes tier
- [Group sessions](mem://features/group-sessions) — eligibility gate, category/billing split, occurrence exceptions
- [Advocate access](mem://features/advocate-access) — v3.0 Phase 4 third-party PHI access: AdvocateLink entity, authorization types, invitation-only invariant, schedule-only ceiling
- [Patient documents](mem://features/patient-documents) — Phase 5 upload paths, derived verify-queue ownership, Part 2 at upload, malware gate, metadata-only storage flag
