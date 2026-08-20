---
name: Recovery / sobriety start date
description: Patient-owned self-reported recovery start date on the Patient record, Part 2-gated like SUD screeners, with the never-auto-reset slip prompt rule
type: feature
---
**Where it lives.** `Patient.recoveryStartDate` (`YYYY-MM-DD`, local day key) in
`src/lib/ehr.ts`. On the Patient record — not self-tracking — because product
direction is that it belongs to the medical record and the streak surfaces need
one durable value.

**Part 2.** A self-reported abstinence date is close to a direct SUD status
marker, so it reuses the EXISTING Part 2 framework — no new consent category.
`AdelanteEHR.recoveryStartDateAccess/getRecoveryStartDate/viewRecoveryStartDate`
mirror `screenerAccess`: patient reads own always; advocate via
`advocatePart2Access(linkId)`; staff via `canAccess(role, "screeners_sud",
patient)`. Never read the raw field outside those helpers.

**Audit.** `setRecoveryStartDate` appends to the unified stream, category
`clinical`, actions `recovery_start_date_set` / `recovery_start_date_cleared`,
with `{ previous, next }`. No parallel history log.

**Never auto-reset on a slip.** The slip flow offers an OPTIONAL step (only when
a date exists) with "Keep my date" / "Start the count from today" / "Skip".
Nothing in the code changes the date without an explicit patient tap, and the
wording stays shame-free (no "clean", no "relapse-free", no score).

**Math + copy** live in the pure module `src/lib/recoveryStartDate.ts`
(`daysSober`, `daysSoberLabel`, milestones). A future date returns null rather
than a negative count. Surfaces: `/profile` card, Home header, Recovery Journey
header ("Set your date" when unset).