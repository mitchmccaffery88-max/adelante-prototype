# Chart entry matrix — Draft proposal, not enabled

**Draft — pending go-live permissions audit.** Mitch confirmed existing treating-clinician Part 2 exceptions remain; current app/SQL entry rule is still restored, pending coordinated acceptance.

| Role group | Proposed direct entry | Proposed reasoned entry | Clinical record classes |
|---|---|---|---|
| Physician, PMHNP, RN, LVN, therapist, SUD counselor, clinical trainee, MA, ECM provider, CF care manager, peer, CHW | Active care-team assignment; applicable dated on-call/coverage/supervision relationship | Yes, until site end of day | Existing matrix only, including existing treating-clinician Part 2 exceptions |
| Clinical coordinator | Oversight | Restricted gate still applies | Existing narrow coordinator/Part 2 rules |
| sys_admin | Oversight (new chart-entry change) | Restricted gate still applies | Existing matrix; no implicit consent-sending action |
| Intake Coordinator | No full chart | No | Packet/checklist-only follow-up for 60 days proposed; no edits |
| Billing, billing coordinator, credentialing coordinator | No | No | Existing separate lanes |
| Group facilitator relationship | Existing group context only | Full chart requires an independent direct/reason grant | Group-context class limits and Part 2 unchanged |
| Patient / advocate | Unchanged | Not applicable | Existing own-row / consented slice |

No permission-matrix runtime values or snapshots changed at this stop. Group scope never grants a full chart; care-team membership never grants Part 2 consent. No-consent negative tests apply only to roles/classes already requiring consent.