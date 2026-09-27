# Architecture rules

- The 24-hour late-cancel check lives only in `src/lib/lateCancel.ts`; `SchedulingConstraints.isLateCancel` and the store both call it — one rule, no store↔scheduling import cycle.
- Visit cancel / no-show go through `staffCancelAppointment`, `markAppointmentNoShow`, `patientRequestCancel` / `advocateRequestCancel` + `resolveCancelRequest` in `ehr.ts` — never set `status` directly from UI; a cancelled or no-show visit can never open a claim.
- Group join goes through `requestJoinGroup` / `approveGroupJoinRequest` / `declineGroupJoinRequest` in `ehr.ts`; patients never self-enroll from the UI. Why: every join is reviewed, telehealth-consent-checked and audited.
- The chart ASAM section is gated by `roleSeesAsamSection` (asamReporting.ts); Part 2 sections are hidden, not locked-stubbed (`recordSectionGate.ts`). Why: menu and ?section= URL must agree with the ASAM task gate.
