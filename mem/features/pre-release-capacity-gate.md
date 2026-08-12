---
name: Pre-release capacity & legal authority gate
description: CF Care Manager pre-release intake — in-custody profile creation and the required early capacity/surrogate step that blocks consent-dependent forms
type: feature
---
- Pre-release intake can create the patient record itself: `AdelanteEHR.openPreReleaseEpisodeForNewPatient` (people in custody usually have no record yet). The "New person in custody" mode is the default on `/pre-release`.
- Step 1 of every episode is capacity & legal authority (`capacity_authority` form category, first checklist row). It is recorded via `recordPreReleaseCapacity`, never as a normal form — shadow-capturing it throws.
- Competent → self-consent, checklist unblocks. Impaired/uncertain → surrogate required; all consent-dependent forms are `blocked` in `preReleaseChecklist` and `savePreReleaseForm` throws until legal authority is in force.
- Authority is only "in force" via the real four-tier advocate model: `identifyPreReleaseAdvocate` wraps `createAdvocateInvitation`, and an AHCD becomes usable only after the real Phase 4.2 validation checklist + clinician incapacity determination. Revoking the link re-closes the gate.
- Build 3: MAT and first appointments are NOT pre-release-only concepts. `orderPreReleaseMat`/`signPreReleaseMatOrders` wrap `addDraftOrder`/`signOrders` (prescriber gate = `canPrescribeMedications`, i.e. `meds_erx` write = pmhnp); `bookPreReleaseAppointment` wraps `bookAppointment` and links `apptId` onto the care-plan row (previously provider/location strings only). Both re-check the capacity gate; booking also runs `assertCfEntryScope`.

## Build 4 — CalAIM care-plan reconciliation
Direction: pre-release → CalAIM (one plan, not two). `_recomputeCarePlan` now
derives a `CarePlanSnapshot.preRelease` slice live from the episode, capacity
determination, advocate links, real appointments and real chart orders; it also
reads signed/held `p.orders` as a medication source and turns positive AHC-HRSN
domains into open SDOH rows. Recompute is triggered on every pre-release write
(episode open/close, capacity, advocate, form, screener, booking, plan save) —
so the plan is populated WHILE in custody, not only at release, and it survives
episode close. Part 2: MAT keeps `sensitive: true` and `CarePlanCard` gates the
continuity block's MAT list behind the same `sud_treatment` check as every other
SUD slice. Test: src/lib/__tests__/preReleaseBuild4.test.ts
