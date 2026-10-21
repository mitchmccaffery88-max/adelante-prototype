# B3b — Billing privacy narrowing

## Rollback and scope

- Rollback recorded before B3b edits: `b1d3c414de160babe95c541483a610853cb3e076` (current HEAD; B3a accepted final `2409b85c`).
- Narrowing only for billing / billing_coordinator claim surfaces. Shared clinical stores, other roles, permissions, rates, states, necessity validation, payment reconciliation, county / ISL exports and denied styling remain unchanged. Do not publish.
- B3a added saveAsamDraft / signAsam / cosignAsam store references to the existing asam registry entry. Role-gate and permission-snapshot byte comparison against `2f56b883` is pending inventory verification.

## Required before/after inventory

Inventory and existing-test stop checks in progress; production edits have not started.

## Validation

Pending: NEW projection and browser tests; pinned-clock seeded clinician / sys_admin parity; restart; full units; exclusive background full browser suite on :8080 with one worker polled to literal EXIT; screenshot restoration; closeout.