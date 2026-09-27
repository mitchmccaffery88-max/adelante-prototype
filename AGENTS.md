# Architecture rules

- The 24-hour late-cancel check lives only in `src/lib/lateCancel.ts`; `SchedulingConstraints.isLateCancel` and the store both call it — one rule, no store↔scheduling import cycle.
- Visit cancel / no-show go through `staffCancelAppointment`, `markAppointmentNoShow`, `patientRequestCancel` / `advocateRequestCancel` + `resolveCancelRequest` in `ehr.ts` — never set `status` directly from UI; a cancelled or no-show visit can never open a claim.
