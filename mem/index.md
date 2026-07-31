# Project Memory

## Core
All SUD/Part 2 masking flows through one check: `canAccess(role, "screeners_sud", patient)` — never re-implement or hardcode roles.

## Memories
- [SUD consent policy](mem://features/sud-consent-policy) — therapist/pmhnp un-gated, case_manager/peer_specialist consent-gated; Part 2 messaging backstop selection