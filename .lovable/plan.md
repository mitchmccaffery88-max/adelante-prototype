# Part A findings + Phase 7c: real rate table

## Part A — does every claim-signing path go through the signature ceremony?

Short answer: both interactive signing screens require the full ceremony before a claim moves. But the rule lives in the screens, not in the claim code, and there are three gaps.

**Paths that move a claim to `signed`**

| Path | Ceremony before the claim moves? |
|---|---|
| Chart signing panel (`RecordTabs.tsx` ~2786-2821) | Yes. `signBlockers` merges domain and `attestationBlockers(signDraft)`, then `buildAttestationRecord` (which throws on any blocker) runs, then `signProgressNote`, and only then `mirrorNoteSignatureToLedger`. Skipped when the note is routed for cosign. |
| `/notes-queue` via `signUnsignedWorkRow` (`noteSignFlow.ts:85-129`) | Yes. `noteSignAuthorization`, then `attestationBlockers`, then `buildAttestationRecord`, then `signProgressNote`, then the mirror. Skipped when routed to cosign. |
| Cosign / supervisor (`cosign-inbox.tsx:188`, `ehr.ts:9082 cosignProgressNote`) | Does not move the claim at all (see Gap 1). |
| Seed (`ehr-ext.ts:989`) | Writes claim state straight to `signed` and later, tagged actor `"seed"`. Demo data only, and no audit row. |

**Gap 1: a cosigned note never advances its claim.** When a note is routed for cosign, both screens skip the mirror, and `cosignProgressNote` never calls it either. The visit's claim stays at `documented` for good, even after a valid cosignature. The cosign screen also takes a checkbox only: no versioned wording, no drawn signature, no attestation record. So a supervisor signature is weaker evidence than the first signature.

**Gap 2: nothing in the data layer enforces the ceremony.** `AdelanteEHRExt.signNote(encounterId, signerId)` and `markClaimSignedFromNote(...)` are public and accept any caller with no attestation, no note and no authorization. `signProgressNote` also treats `attestation` as optional (documented as deliberate, for seeds and automations). Today no screen calls these directly, but any new caller could move a claim to `signed` without the ceremony.

**Gap 3: a billing reviewer can't trace a signed claim back to the note.** The claim history row is `{ state: "signed", actor: signerId, note: "note signed" }`. The `claim_status_changed` audit row has claimId, from/to, actor id, role and `via: "note_signature"`. Neither row records the note id, the attestation statement or version, the signer's name, or the signature time. The only link is indirect: `note.appointmentId === claim.encounterId`. There is also a smaller issue: the signer id is `clinicianId ?? staffId`, but the role is read from `getActingRole()` at mirror time, not taken from the signer.

**Did 7b change this flow?** Only the last step. Before 7b, `signNote` changed `claim.state` directly with no audit. Now it calls `markClaimSignedFromNote`, which adds an attributed history row and a `claim_status_changed` audit row, and still only allows `documented → signed`. The ceremony checks, their order, the skip-when-cosign-pending behaviour, and all three gaps were there before 7b.

Suggested follow-up for later, not part of 7c: pass `{ noteId, attestation }` into the mirror and require it there; record note id and attestation version on the claim history and audit row; give cosign the same ceremony and have it advance the claim.

---

## Part B — Phase 7c plan

### Payer/program set (minimum real set)

Today the coverage plans on a patient record store the payer as free text ("Medi-Cal FFS", "Health Net Medi-Cal", "Tulare County MHP"). Which Medi-Cal program pays depends on the payer and also on the type of service (SUD vs. mental health). Proposed fixed programs:

- `dmc_ods`: SUD services for Medi-Cal members (county DMC-ODS)
- `smhs`: specialty mental health, county MHP
- `medi_cal_managed`: non-specialty mental health, Medi-Cal FFS or managed care plan
- `calaim_ecm`: CalAIM ECM / Community Supports, CHW and peer-support codes
- `non_medi_cal`: ISL / self-pay / grant-funded; reportable, not billed to Medi-Cal

**Needs your confirmation:** these five programs, and the rule for picking one (below).

### Rate table (data layer, `src/lib/rates.ts`)

`Rate { id, code, program, amountCents (integer), effectiveFrom (YYYY-MM-DD), effectiveTo? (inclusive; empty means open-ended), placeholder: boolean, createdBy, createdByRole, createdAt, endedBy?, endedAt?, endReason? }`

- `addRate(input)`: needs billing write (same check and `BILLING_WRITE_REFUSED` message as `transitionClaim`, so Sys Admin is refused and nothing changes). Rejects the amount unless it is a positive integer, rejects bad dates, and rejects any overlap with an existing range for the same code and program. The error names the conflicting rate.
- `endDateRate(id, effectiveTo, reason)`: billing write only. Sets an end date on an open or later-ending rate. The date can't be before the start and can't shorten a range that claims already priced from (see below). The only field that changes is the end date, plus who ended it and why.
- No edit and no delete. To change a price: end-date the old rate, then add a new one.
- Audit: `rate_added` and `rate_end_dated` (actor, role, code, program, dates, amount).
- `rateFor(code, program, serviceDate)` returns the one matching rate or `undefined`.
- Seed: one open-ended rate per (code, program) pair used today, starting 2026-01-01, with amounts copied from the current `chargeForService`, peer and CHW prices. Every seeded rate is flagged `placeholder: true` and shows a "Placeholder: enter real fee schedule" tag.

### Billing code at claim creation

- 1:1 claims: a new `DEFAULT_CODE_BY_SERVICE` mapping. SUD-flagged service lines get SUD codes: intake H0001, individual counseling H0004, group H0005, case management H0006 (SUD) / T1017. MH lines get H0031 / 90834 / 90853. Med management 99213, peer H0038, care coordination T1017. The code is stored on `Claim.serviceCode` along with `codeSource: "default"`.
- Group claims keep `groupBillingCode(category)`. When that returns nothing, the group falls back to the default for `therapy_group`.
- Peer and CHW claims keep their existing codes.
- Billing can correct the code on a claim that isn't submitted yet (`setClaimCode`, billing write, audited, `codeSource: "billing"`). Correcting the code re-prices the claim.

### Payer/program at claim creation

The program is read from the patient's coverage plan that covers the service date (Phase 3b `coverage.plans`):
- No active plan, or coverage type is not Medi-Cal: `non_medi_cal`
- Peer or CHW code: `calaim_ecm`
- SUD service line: `dmc_ods`
- Payer text matches "MHP" / county mental health: `smhs`
- Any other Medi-Cal payer: `medi_cal_managed`

The result is stored as `Claim.program` along with `programSource`. Billing can correct it through the same audited `setClaimProgram`.

### Pricing and the "no rate on file" flag

- `claimChargeCents({ code, program, serviceDate })` looks up `rateFor(...)` and returns `{ cents, rateId }` or `{ noRate: true }`. `chargeForService` and `apptChargeCents` are removed from pricing.
- A claim with no match gets `amountCents` left empty and `rateStatus: "no_rate"`. Nothing prices it from a fallback. `transitionClaim` refuses `coded → generated` (the move to Ready) while `no_rate` is set, with the message: "No rate on file for H0004 / DMC-ODS on 2026-09-24. Add a rate, then retry."
- A priced claim stores `rateId`, so later rate changes never re-price it silently. Adding a rate re-checks open `no_rate` claims that haven't reached Ready and prices them, with an audit row.
- On `/billing` and `/admin-claims`: a "No rate on file" badge, a count in the summary, and a filter.

### UI (`/billing`)

- Remove `RATE_TABLE` and the false versioning footer.
- New Rates section with a table: code, program, amount, effective dates, placeholder tag, who added it. There is an "Add rate" form, and each row has an "End-date" action. Billing and Billing Coordinator see these controls. Sys Admin sees the table with no controls, and the data layer refuses a Sys Admin change even if one gets through.
- The phone layout stacks the rows into cards.

### Tests

Effective-date lookup (boundaries, open-ended ranges, gaps); overlap rejection; end-date rules; payer/program selection (each branch); default code mapping and code correction; no-rate flag plus the Ready block; later rate prices the waiting claim; audit rows; Sys Admin refused with nothing changed; placeholder seed. Update the 7b tests that read `chargeForService`.

### Non-goals

No DHCS fee-schedule import, no EDI, no fix to the Part A gaps in this phase, no change to who can see billing pages.
