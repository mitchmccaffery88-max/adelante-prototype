# Project Memory

## Core
General editorial content publishes with NO second approver (clinical_coordinator = content manager); per-patient clinical gating is separate and untouched.
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
- [Recovery modules](mem://features/recovery-modules) — 8 modules/10-step schema, ONE shared ModuleTemplate renderer, structured tool-flow steps, Living Recovery still unconfirmed
- [Safety plan](mem://features/safety-plan) — Stanley-Brown structure, clinical-adjacent store, safety_plan record class, 988 locked entry, pending clinical review flags
- [Pre-release capacity gate](mem://features/pre-release-capacity-gate) — in-custody profile creation, required Step 1 capacity/surrogate determination, consent-step blocking
- [Pre-release screening](mem://features/pre-release-screening) — real AUDIT-10/DAST-10 + AHC-HRSN SDOH satisfy pre-release checklist rows; shared ScreenerResult storage and population rollups
- [Crisis + naloxone content](mem://features/crisis-and-naloxone) — /crisis is the single crisis destination; verbatim SAMHSA/CDC/DHCS naloxone content with verified:false + pending review flags
- [Adel assistant](mem://features/adel-assistant) — real streaming gateway chat at /adel, prompt discipline, Phase 1 crisis bypass, HELD transcript-retention decision
- [Peer specialist messaging](mem://features/peer-messaging) — one care-team thread, authorRole attribution, peers write but never flag Part 2
- [Message routing architecture](mem://architecture/message-routing) — audited map of every patient free-text surface, crisis-detection wiring, Crisis Queue attribution, and honest gaps
- [Content management](mem://features/content-management) — /admin-content manages lessons + community resources + naloxone access; direct publish, no second approver, no expiry
- [Weekly recap](mem://features/weekly-recap) — /weekly-recap real stats, Adel reflection grounding contract, stats-only fallback
- [Recovery stage model](mem://features/recovery-stage-model) — 5 person-set stages + signals, pending clinical review, never auto-derived
