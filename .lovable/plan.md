# Phase 7b.1 — Signature-to-claim gaps

## Current state (confirmed)
- `mirrorNoteSignatureToLedger` (noteSignFlow.ts) → `AdelanteEHRExt.signNote(apptId, signerId)` → `markClaimSignedFromNote(encounterId, signerId)`. Neither takes a note id or attestation; both are public.
- `cosignProgressNote` (ehr.ts) takes `{ cosignedBy, role, attested: boolean, comment }`: a checkbox, no statement version, no drawn signature. It never calls the mirror, so claims for trainee notes stay at `documented`.
- `/cosign-inbox` `CosignDetail` passes `staffName` and a checkbox. `AttestationSignatureBlock` + `SignaturePad` (with anti-tap validation) and the `progress_note_supervisor_sign` statement already exist and are what the self-sign flow uses.
- Claim history and audit record `actor` and `getActingRole()` only. The seed (ehr-ext.ts ~1210) writes `signed` with actor `"seed"` and no audit row.

## Decision: when does the claim advance?
**At cosign only.** When a note goes to `cosign_pending`, the claim stays `documented` and shows "Awaiting cosign". It moves to `signed` only when the note is final (`signed` without cosign, or `cosigned`), and that move is credited to the final signer. This matches the existing rule that automations run only on the final signature.

## Build
1. **Cosign ceremony, using the parts we already have**
   - `cosignProgressNote` input becomes `{ cosignedBy (staff id), cosignerName, role, attestation: AttestationRecord, comment }`. It refuses the cosign unless the attestation is for `progress_note_supervisor_sign`, matches the current version, and carries a valid drawn signature (the same validator the self-sign path uses, so a tap is rejected).
   - The note stores `cosignAttestation` (statement key, version, signature image, signedAt).
   - `/cosign-inbox` drops the checkbox and renders `AttestationSignatureBlock` with the supervisor statement, plus the shared blocker list (`mergeBlockers` / `attestationBlockers`). Cosign stays disabled until nothing is blocking.
   - Who is allowed to cosign doesn't change (role, cosignRole and not-the-signer checks stay).
2. **One enforced claim-signing path**
   - Replace the `markClaimSignedFromNote(encounterId, signerId)` signature with `markClaimSignedFromNote({ patientId, noteId, attestation })`. The function looks up the note itself and refuses (typed `CLAIM_SIGN_REFUSED`, nothing changes) if any of these is true:
     - the note is missing or has no linked visit;
     - the note isn't final (it's a draft, or it's `cosign_pending`);
     - the attestation isn't the one stored on the note for its final signature (the self-sign attestation, or the cosign attestation when a cosign was required);
     - the signature fails validation.
   - Signer id, name, role and time come from the note's final signature record, not from the acting session.
   - `AdelanteEHRExt.signNote` loses its claim side effect and just writes the ledger entry. `mirrorNoteSignatureToLedger` passes `{ patientId, noteId, attestation }`, and `cosignProgressNote` calls it after a successful cosign.
   - Any other caller of `signNote` or the old signature (automations, tests) gets updated or refused. I'll list them during the build.
3. **Seed path**: `seedClaimSigned(claim, { reason })` is the only other way to reach `signed`. Its history entry says `actor: "seed"` and `via: "seed_data"`, and it writes a `claim_status_changed` audit row marked `seed: true`.
4. **Traceability**
   - Claim history entries gain `signature?: { noteId, statementKey, statementVersion, signerId, signerName, signerRole, signedAt, cosign: boolean }`. The `claim_status_changed` audit `detail` carries the same fields; the audit `actorRole` becomes the signer's role.
   - `/billing` and `/admin-claims` show a line on each signed or later claim: "Signed from note … by {name} ({role}) on {date}". It links to the note in the chart and reads "cosigned" when a cosign applies. Seeded claims read "Seed data — no note signature".

## Non-goals
No change to who can sign or cosign. No changes to billing permissions, rates, units or amounts.

## Verification
- Typecheck and the full test suite, plus a new `phase7b1SignatureClaim.test.ts` covering:
  - a trainee sign leaves the claim at documented, and a cosign moves it to signed, credited to the cosigner;
  - a cosign without an attestation, or with a single-tap signature, is refused;
  - a direct `markClaimSignedFromNote` call with a draft or pending note, or a mismatched attestation, is refused with nothing changed;
  - history and audit carry the note id, statement key/version, and signer name/role;
  - the seed path writes an audit row with `seed: true`.
- Browser at desktop and phone sizes: a trainee writes and signs a note, and the claim shows "Awaiting cosign". The supervisor draws a signature to cosign (a tap is rejected on screen). On `/billing` the claim shows signed with its "Signed from note" line. Desktop checks happen after the acting role has loaded.
