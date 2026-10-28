# Chart entry matrix — Draft, partial implementation

**Draft — pending go-live permissions audit. Part 2 internal-use basis: pending counsel confirmation.** Access-rules entry helpers reapplied; persistence OFF and unproved read policies closed.

| Role group | Proposed direct entry | Proposed reasoned entry | Clinical record classes |
|---|---|---|---|
| Physician, PMHNP, RN, LVN, therapist, SUD counselor, clinical trainee, MA, ECM provider, CF care manager, peer, CHW | Active care-team assignment; applicable dated on-call/coverage/supervision relationship | Yes, until site end of day | Existing matrix only, including existing treating-clinician Part 2 exceptions |
| Clinical coordinator | Oversight | Restricted gate still applies | Existing narrow coordinator/Part 2 rules |
| sys_admin | Oversight (new chart-entry change) | Restricted gate still applies | Existing matrix; no implicit consent-sending action |
| Intake Coordinator | No full chart | No | Packet/checklist-only logged follow-up implemented for 60 days; day 61 denied; no edits; consent/restrictions remain |
| Billing, billing coordinator, credentialing coordinator | No | No | Existing separate lanes |
| Group facilitator relationship | Existing group context only | Full chart requires an independent direct/reason grant | Group-context class limits and Part 2 unchanged |
| Patient / advocate | Unchanged | Not applicable | Existing own-row / consented slice |

Matrix grants unchanged. Direct treating relationships preserve only existing matrix-granted Part 2 classes. Reason-only clinical entry requires applicable class-specific consent plus matrix permission; revoke re-locks. Standard TPO only satisfies the existing packet rule, not this reason-only clinical gate. Coordinator/operations consent gates and group limits remain separate. Approved source re-pins and registry snapshot reconciliation are complete; accepted snapshot deltas are listed in the access report. Coordinator hosts and Intake follow-up are implemented. Step 4 partial checkpoint: units 3,658/3,658; canonical reason-code access-log readback and search/deep-link/print/embedded-picker gates verified. Today/inbox/bell/quick-peek, DEA Billing integration and SQL policy acceptance remain unfinished. No chart/packet/handoff read-policy group opened.