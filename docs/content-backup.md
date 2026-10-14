# Content backup (Download / Load my changes)

Patient Content & Resources Center (/admin-content) keeps content in memory. Use **Download my changes** at the end of every session and **Load my changes** at the start of the next.

- The file (`adelante-content-YYYY-MM-DD-HHmm.json`, schemaVersion 1) holds every managed content entry the downloading role may see, with its full revision history, plus community resource verification facts. It contains no patient records, audit log or care plans.
- Part 2: every content author (content_authoring write, including clinical_coordinator) gets Part 2 content in their file (`contentPart2VisibleToStaff`). Other roles that fail `roleSeesAsamSection` do not, and their `partTwoIncluded` is false.
- Load previews new / updated / unchanged / skipped first. An entry is replaced only when the file's latest revision is newer. Published entries and verifications need a publisher role. Unknown types and malformed history are skipped.
- Audit: runAction writes one `action.succeeded` / `action.blocked` per download and per load. Counts are not in that event; the preview writes none.
- Seeding later: feed the file to `restoreContentEntries` at module load. One history rule.

## Checks (Oct 14)
- Browser suite 79/79 including axe. 1280px load preview verified as Cathy: 85 entries downloaded, 85 unchanged on reload, unknown type skipped with its reason.
- Entries with no revisions yet (resource working facts) load as-is; no revision is invented.

## Content inventory export
`bun run ./scripts/export-content-inventory.ts` → docs/content-inventory.csv, docs/resource-inventory.csv, docs/content-vocabulary.json. Read-only; built on the real descriptors, store and governance helpers.
