---
name: Patient documents & verify queue (v3.0 Phase 5)
description: Unverified-by-default document ingest, derived verify-queue ownership, upload-time Part 2 classification, the malware gate, and the metadata-only storage honesty flag
type: feature
---
**Unverified by default.** `uploadPatientDocument` is the single ingest path for
all three uploaders (patient / staff-on-behalf / advocate). Nothing enters the
clinical chart until `verifyPatientDocument` promotes it; promotion and
rejection are both audited with who/when/reason.

**Queue ownership is DERIVED, never assigned.** CF Care Manager while the
patient's Phase 2 pre-release episode is open, ECM Provider otherwise. Do not
add a manual assignment control. The queue row names the actual uploader
(patient name / named advocate / staff member + on-behalf flag) — "unverified"
alone is not a review signal.

**Part 2 at upload time.** The uploader classifies at the moment of upload; it
is never inferred later. A Part 2 document reuses the SAME
`_advocatePart2Unmasked` gate as Phase 4 group topics — no parallel mechanism.
For advocates, a gated document is RESTRICTED, not hidden: the row stays with
an explicit message naming the missing `advocate_sud_disclosure` consent. The
filename is withheld (filenames leak Part 2 content).

**Malware gate is real** (`scanUpload` in `src/lib/documents.ts`): EICAR
signature, blocked executable extensions, size ceiling. Tested by actually
blocking a bad file.

**STORAGE HONESTY FLAG — dev-team follow-up.** The prototype stores METADATA
ONLY. No file bytes are persisted; there is no encrypted object storage inside
an AWS compliance perimeter. Do not describe this as real storage, same
discipline as the client-side reminder scheduler.
