---
name: Recovery / sobriety start date
description: Patient-private self-reported recovery start date in selfTracking.ts (NOT the EHR), with the never-auto-reset slip prompt rule and the open clinical-validation decision
type: feature
---
**Where it lives.** `selfTracking.ts` — `recoveryStartDate(patientId)` /
`setRecoveryStartDate(patientId, date | null)`, `YYYY-MM-DD` local day key.
Same isolation tier as craving logs and lapse records: patient-scoped, no EHR
write, no audit-sink entry, no cross-patient listing, and NO staff or advocate
read path under any role or consent state.

**OPEN CLINICAL DECISION — do not silently reverse.** This field briefly lived
on `Patient.recoveryStartDate` in `ehr.ts`, Part 2-gated like a SUD screener.
It was moved out because it has NOT been clinically validated by Dr. Bagga as
medically necessary. Putting it back into the EHR / clinical record is a real,
open decision that requires that sign-off — it is not a refactor and must not
be reconsidered without it. Until then there is no Part 2 gate for it, because
there is nothing for staff to gate.

**Never auto-reset on a slip.** The slip flow offers an OPTIONAL step (only
when a date exists) with "Keep my date" / "Start the count from today" /
"Skip". Nothing changes the date without an explicit patient tap, and the
wording stays shame-free (no "clean", no "relapse-free", no score). The prompt
states the truth: nobody else sees the date.

**Math + copy** live in the pure module `src/lib/recoveryStartDate.ts`
(`daysSober`, `daysSoberLabel`, milestones). A future date returns null rather
than a negative count. Surfaces: `/profile` card (`RecoveryDateCard`), Home
header and Recovery Journey header (`DaysSoberLine`, "Set your date" when
unset).
