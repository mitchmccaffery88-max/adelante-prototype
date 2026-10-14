# Content backup (Download / Load my changes)

Patient Content & Resources Center (/admin-content) keeps content in memory. Use **Download my changes** at the end of every session and **Load my changes** at the start of the next.

- The file (`adelante-content-YYYY-MM-DD-HHmm.json`, schemaVersion 1) holds every managed content entry the downloading role may see, with its full revision history, plus community resource verification facts. It contains no patient records, audit log or care plans.
- Part 2: roles that fail `roleSeesAsamSection` (including clinical_coordinator) do not get Part 2 content (all recovery lessons/modules, plus anything flagged part2) in their file, and `partTwoIncluded` is false.
- Load previews new / updated / unchanged / skipped first. An entry is replaced only when the file's latest revision is newer. Published entries and verifications need a publisher role. Unknown types and malformed history are skipped.
- Audit: runAction writes one `action.succeeded` / `action.blocked` per download and per load. Counts are not in that event; the preview writes none.
- Seeding later: feed the file to `restoreContentEntries` at module load. One history rule.
