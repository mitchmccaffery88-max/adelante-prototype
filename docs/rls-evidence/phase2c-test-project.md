# Phase 2c test-project evidence — pre-migration stop

Request: Mitch, 27 Oct 2026, 20:39 UTC. Outcome: blocked before migrations, not Phase 2c acceptance.

## Safety preflight

| Check | Result |
|---|---|
| TEST_SUPABASE_DB_URL | Present |
| TEST_SUPABASE_URL | Present |
| TEST_SUPABASE_ANON_KEY | Present |
| TEST_SUPABASE_SERVICE_ROLE_KEY | Present |
| Test project ref | cguwotbbuyqzgmebckqy |
| Main project ref | bnvukmpmwuhftvjpnwqi |
| Test differs from main | Passed |
| Test database project ref matches test API ref | Passed |

Secret presence was confirmed using the hidden-value secret listing and sandbox environment presence checks. Only project refs were compared. No credential values, connection strings, passwords or derived secret information are included. Credential validity and connectivity remain unverified.

## Blocker

The available `supabase.migration` tool operates on the connected main project and exposes only SQL, retry SQL patches and a description, with no test-project selector. Database changes must use the migration tool; executing migrations through the sandbox database URL is not permitted by the tool instructions. Connecting the test project through the integration would violate this batch's scope.

No main-project migration was submitted. No shell-based database modification was attempted. An approved test-targeting migration mechanism is required before resuming.

## Counts and migration evidence

- Applied migration IDs: none.
- Schema-version comparison: not run; equality unverified.
- Fictional auth users/accounts created: 0.
- Store-driven seed loads: 0.
- Signed-JWT positive/negative RLS assertions: 0; not run, not passing evidence.
- Crisis-owner TS/SQL parity assertions: 0; not run.
- Policies opened: none in either project.
- Access-test failures: not evaluated; tooling blocker is not an RLS failure.
- Full unit suite: not run at the pre-migration stop.
- Public browser suite: not run at the pre-migration stop.

## Retained boundaries

Main remains the app's only integration. Persistence stays OFF and all unverified reads/commands remain closed. No lifecycle code, schema, data, accounts, policies, storage, connections or publication changed.

Phase 2d remains unstarted: full repositories, server/registry write transport, signup matching parity, signed-copy storage, persistence switches, and tables for Didn't-start-care state and Getting-started need confirmations.