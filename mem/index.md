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
- [PO disclosure two-tier](mem://features/po-disclosure-two-tier) — mandatory (legal mandate, never togglable) vs voluntary (revocable consent) probation/parole sharing
- [Self-help library](mem://features/self-help-library) — Library/Exercise schema, store-backed progress, population gating, advocate read-floor visibility
- [Safety plan](mem://features/safety-plan) — Stanley-Brown structure, clinical-adjacent store, safety_plan record class, 988 locked entry, pending clinical review flags
- [Pre-release capacity gate](mem://features/pre-release-capacity-gate) — in-custody profile creation, required Step 1 capacity/surrogate determination, consent-step blocking
- [Pre-release screening](mem://features/pre-release-screening) — real AUDIT-10/DAST-10 + AHC-HRSN SDOH satisfy pre-release checklist rows; shared ScreenerResult storage and population rollups
- [Crisis + naloxone content](mem://features/crisis-and-naloxone) — /crisis is the single crisis destination; verbatim SAMHSA/CDC/DHCS naloxone content with verified:false + pending review flags
