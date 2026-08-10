# Project Memory

## Core
Never fork the sign-up form: `SignupFlow.tsx` is shared by public and staff-operated front doors.
Staff surfaces are gated by the `roles.ts` record-class matrix and registered in `navSections.ts` — no hidden URLs, no second permission list.

## Memories
- [Advocate access](mem://features/advocate-access)
- [ASCMI consent](mem://features/ascmi-consent)
- [Group sessions](mem://features/group-sessions)
- [Patient documents](mem://features/patient-documents)
- [SUD consent policy](mem://features/sud-consent-policy)
- [Front-door helper tiers](mem://features/front-door-helper-tiers) — Tier 1 informal helper field, Tier 2 staff assisted sign-up, consumedBy attribution rule
