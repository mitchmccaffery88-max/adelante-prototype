---
name: Safety Plan (Adelante Journey Phase 7 part 1)
description: Stanley-Brown safety plan store, its clinical-adjacent (not engagement) architecture call, the safety_plan record class, and the pending clinical-review flag
type: feature
---
**Architecture call:** the Safety Plan is CLINICAL-ADJACENT, not engagement.
Unlike Library/Exercise progress (`src/lib/engagement.ts`), a crisis responder
may need to read it during an active safety concern, so it is gated by a real
record class (`safety_plan` in `roles.ts`), audited into the one clinical audit
stream, and rendered as a Chart section next to Alerts. It is still NOT fields
on `Patient`: it is a third bucket — **patient-authored clinical-support
content** — living in `src/lib/safetyPlan.ts` keyed by `patientId`, with
`AdelanteEHR.*` facade wrappers, a subscribe→emit bridge and an injected audit
sink (same wiring pattern as engagement).

`safety_plan` RBAC: treating roles + clinical_coordinator write; peer_specialist,
CHW, cf_care_manager, trainee, MA, sys_admin read (peers respond to crises);
billing roles excluded — never claim data.

Structure is the published Stanley-Brown 7 sections (warning signs → internal
coping → distractions → support people → professionals → environment safety →
reasons for living). The 988 Suicide & Crisis Lifeline is pre-populated, locked
(cannot be edited or removed) and uses the same real number (`988`) as the
AppShell banner. Audit detail carries section/entry ids only — never the
patient's words.

**Clinical review still open:** `SAFETY_PLAN_REVIEW.pending` and each section's
`clinicalReviewPending` are real flags rendered as banners in the patient and
clinician UI and in `ClinicalContentReviewCard` on `/admin-audit`. Only the
prompt/example text needs Christi / Dr. Bagga sign-off; the section structure
is the published framework. Do not clear the flags in code without sign-off.
