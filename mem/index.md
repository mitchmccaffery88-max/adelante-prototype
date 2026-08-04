# Project Memory

## Core
All SUD/Part 2 masking flows through one check: `canAccess(role, "screeners_sud", patient)` — never re-implement or hardcode roles.
Consent answers come from the live `ConsentRecord` (ASCMI); categories/form text are placeholders pending Christi's DHCS content.

## Memories
- [SUD consent policy](mem://features/sud-consent-policy) — therapist/pmhnp un-gated, case_manager/peer_specialist consent-gated; Part 2 messaging backstop selection
- [ASCMI consent records](mem://features/ascmi-consent) — ConsentRecord model, placeholder categories, write roles, live gate, disclosure audit, psychotherapy tier