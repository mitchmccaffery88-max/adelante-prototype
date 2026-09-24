# Phase 7d — General-population billing

## Current state (confirmed)
- `PayerProgram` has five values; everything without Medi-Cal on the service date lands in `non_medi_cal`, which has no seeded rates, so every general-population claim reads "No rate on file".
- Program selection happens in two places. `upsertClaimFromEncounter` forces `non_medi_cal` when the visit's `fundingLane` is `isl_non_medi_cal` or `private_pay`. Otherwise `selectProgram` rule 2 sends "no Medi-Cal coverage" to `non_medi_cal`.
- Rates are keyed by code + program. Claims hold `chargeCents` only, with no split between payer and patient and no payments.
- `FundingLane` already includes `private_pay`, `isl_non_medi_cal` and `bhsa`. No patient-level payment setting exists.

## Build

### 1. Programs
`non_medi_cal` is replaced by:
- `self_pay`: standard fee schedule.
- `sliding_fee`: the discounted schedule. Tiers are Phase 7e, so for now this uses one placeholder rate row per code.
- `grant_isl`: covers grant, ISL or BHSA funding. The patient is charged nothing and the claim is reportable to the funder.
- `commercial`: exists in the model but is inactive at launch. It is labelled "Commercial (inactive at launch)" and refused for new claims and corrections (`PROGRAM_INACTIVE`).

**Selection rule.** Rules 1 and 3–5 don't change. Rule 2 becomes:
1. Visit `fundingLane` is `isl_non_medi_cal` or `bhsa` → `grant_isl`.
2. Visit `fundingLane` is `private_pay` → the patient's payment setting (next item), else `self_pay`.
3. No Medi-Cal on the service date → the patient's payment setting, else `self_pay`.

- **Patient payment setting.** A new optional `Patient.selfPayArrangement` takes `"self_pay" | "sliding_fee" | "grant_isl"`. Only billing staff can set it, through the data layer, and every change is audited. When it's unset, the default is `self_pay`, and the claim notes "Payment arrangement not recorded — defaulted to self-pay". Sliding fee is never inferred from income; billing staff pick it on purpose, and tier assignment waits for 7e.
- **Existing `non_medi_cal` claims.** Each one is re-run through the new rule at load, with `programSource: "migrated"` and one audit row per claim. Today no seeded claim is `non_medi_cal` (all demo visits have Medi-Cal), so this is a safety net, not a data change. The rate end-date guard carries over to the new programs.
- **Correcting a claim's program.** `correctClaim` can move a claim between the three active programs, with a required reason. The claim is then re-priced.

### 2. Optional payer on rates
- `Rate.payerId?: string`. Without it the rate applies program-wide. With it, the rate applies to that payer only.
- Lookup takes the payer-specific rate first, then falls back to the program-wide rate, both effective on the service date. The overlap check runs per (code, program, payerId).
- Claims gain an optional `payerId`. It is only set from the coverage plan when the program is `commercial`, so nothing uses it at launch. There's no payer list or UI; tests prove it works.

### 3. Patient responsibility on the claim
Each claim gets `payerPortionCents`, `patientPortionCents`, `patientPaidCents`, and `patientBalanceCents` (patient portion minus paid). All are computed in `applyPricing`, the only function that sets amounts:
- `self_pay` and `sliding_fee`: the patient owes the full amount, the payer $0.
- `grant_isl`: the funder owes the full amount, the patient $0.
- Medi-Cal and ECM programs: the payer owes the full amount, the patient $0. This matches today.
- `commercial`: infrastructure fields `copayCents`, `deductibleCents` and `coinsuranceCents` (all optional) set the split when present. They're unused at launch and only tested.

### 4. Recording a patient payment by hand
- `recordPatientPayment({ claimId, amountCents, receivedOn, method: "cash" | "check" | "card_external" | "other", reference? })`.
  - The billing-write check runs in the data layer, so Sys Admin is refused (`BILLING_WRITE_REFUSED`) and nothing changes.
  - Each payment is stored on `claim.patientPayments[]` with its actor id, name, role and time, plus a `patient_payment_recorded` audit row. The reference is free text, labelled "Receipt / check no. — never a card number". Anything that looks like a card number (13–19 digits) is refused.
- **Overpayment is refused for now.** A payment larger than the patient balance is rejected (`PAYMENT_EXCEEDS_BALANCE`). Refunds and credits are production scope; a later phase would add a `refund` entry and a negative adjustment.
- **Reversing a mistaken payment.** `voidPatientPayment` (billing write, reason required, audited) marks the entry void instead of deleting it.
- If a re-price lowers the patient portion below what has already been paid, the balance stops at $0, and the claim is flagged "Paid more than current charge — review" rather than refunded automatically.

### 5. Placeholder rates
- `self_pay` rates use the current per-unit amounts. `sliding_fee` rates start at 50% of those as a single placeholder row per code. `grant_isl` gets the self-pay amount as the reportable value.
- All of them are marked "Placeholder — pending clinic fee policy", like the 7c draft labels.

### UI
- **`/billing`:**
  - The program filter lists the new programs, with Commercial shown as inactive.
  - Claim rows show "Patient owes $X" (or "Funder: grant/ISL") and a Record payment popover (billing write only).
  - A new "Patient balances" filter.
  - Sys Admin sees balances with no controls.
- **`/admin-claims`:** payer and patient portion columns, plus the balance.
- **Patient chart (billing section):** billing staff can set the payment arrangement. Everyone else sees it read-only.

## Non-goals
No card processing, patient statements, commercial EDI, Good Faith Estimates, superbills, or sliding-fee tiers (7e). No change to Medi-Cal pricing.

## Verification
- Typecheck, plus a new `phase7dGeneralPopulation.test.ts` covering:
  - program mapping (fundingLane, coverage, arrangement, default, migration);
  - a payer-specific rate is preferred over the program-wide one;
  - commercial can't be selected for new claims or corrections;
  - patient responsibility for each program;
  - payments reduce the balance, and overpayment and card numbers are refused;
  - voiding a payment;
  - Sys Admin is refused and nothing changes.
- Full suite.
- Live browser at desktop and phone sizes as Billing, Billing Coordinator and Sys Admin, with desktop readings after the role loads.
