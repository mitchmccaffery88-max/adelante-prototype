# Phase 8 — "+ New" inventory (read-only)

Captured Oct 15 2026 from the running preview (in-app navigation; each role set through the demo acting-staff switch) plus the chart action registry (`CHART_ACTIONS.allowed`). No code changed. "Lands on" is where the existing route guard sends the role. "Already allowed, not in + New" lists registry actions the role can already run (not hidden) that belong to that page area (chart groups on /clinician and /record; billing/admin ops actions on /admin, /admin-claims and /billing; content, resource and consent-form authoring on /admin-content; no-patient coordination actions on /my-work) and that the menu there does not offer: candidates only, no new permissions. Pending / coming-soon actions are excluded.

Launchers today: `DashboardActionLauncher` (/clinician), `ChartActionLauncher` (/record/<id>), `OpsActionLauncher` (/admin, /admin-claims, /billing). /admin-content and /my-work show no + New for any role; every other staff route also has none (StaffShell `hasLauncher`).

## ecm_provider

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Progress note, Link a care partner, Request a screener, Save screener draft (in progress), Care plan goal, Assign activity, SDOH referral, Schedule visit, Message patient, Task, Upload document, Capture consent, Log contact, Raise crisis flag, Task for me / my team, Book a visit, Log contact, Referral from resource directory, Field outreach contact (AFBI), Message team | Log a partner handoff, Dictate after the encounter, Save AFBI contact from AI draft, Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Discharge episode, Edit demographics, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record appointment offer, Record missing referral detail, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Progress note, Upload document, Capture consent, Request a screener, Save screener draft (in progress), Raise crisis flag, Care plan goal, Assign activity, SDOH referral, Discharge episode, Referral from resource directory, Link a care partner, Schedule visit, Message patient, Task, Log contact, Edit demographics, Task for me / my team, Book a visit, Log contact, Field outreach contact (AFBI), Message team | Log a partner handoff, Dictate after the encounter, Save AFBI contact from AI draft, Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record custody duration (FSP), Record appointment offer, Record missing referral detail, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /clinician (redirected) | No | — | — |
| /admin-claims | /clinician (redirected) | No | — | — |
| /billing | /clinician (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Download content changes, Load content changes, Discard content draft, Verify and publish resource |
| /my-work | /my-work | No | none | Save AFBI contact from AI draft, Task for me / my team, Book a visit, Log contact, Field outreach contact (AFBI), Record missing referral detail, Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## clinical_trainee

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Progress note, Care plan goal, Assign activity, Schedule visit, Task, Raise crisis flag, Task for me / my team, Book a visit, Message team | Addendum, Review score change, Discharge episode, Check in, Mark attended, Mark missed visit, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Progress note, Addendum, ASAM assessment, Raise crisis flag, Care plan goal, Assign activity, Discharge episode, Schedule visit, Task, Task for me / my team, Book a visit, Message team | Care plan suggestion, Review score change, Check in, Mark attended, Mark missed visit, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /clinician (redirected) | No | — | — |
| /admin-claims | /clinician (redirected) | No | — | — |
| /billing | /clinician (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Download content changes, Load content changes, Discard content draft |
| /my-work | /my-work | No | none | Task for me / my team, Book a visit, Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## community_health_worker

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /case-manager (redirected) | No | — | — |
| /record/<id> | /record/<id> | Yes | Progress note, Raise crisis flag, SDOH referral, Referral from resource directory, Schedule visit, Request visit cancellation, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team | Dictate after the encounter, Save AFBI contact from AI draft, Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Record appointment offer, Record missing referral detail, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /case-manager (redirected) | No | — | — |
| /admin-claims | /case-manager (redirected) | No | — | — |
| /billing | /case-manager (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Download content changes, Load content changes, Discard content draft, Verify and publish resource |
| /my-work | /my-work | No | none | Save AFBI contact from AI draft, Task for me / my team, Book a visit, Field outreach contact (AFBI), Record missing referral detail, Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## pmhnp

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Progress note, Medication order, Refill decision, Clinic-administered medication, Refer to an NTP, Record outside NTP medication, Link a care partner, Lab order, Request a screener, Save screener draft (in progress), Vitals / metabolic measures, ASAM assessment, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Schedule visit, Message patient, Raise crisis flag, Task for me / my team, Book a visit, Referral from resource directory, Field outreach contact (AFBI), Message team | Addendum, CURES check, Cosign LVN dose, Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, Save AFBI contact from AI draft, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Discharge episode, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Progress note, Addendum, Medication order, Refill decision, CURES check, Clinic-administered medication, Record outside NTP medication, Lab order, Request a screener, Save screener draft (in progress), Vitals / metabolic measures, ASAM assessment, Raise crisis flag, Refer to an NTP, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Discharge episode, Referral from resource directory, Link a care partner, Schedule visit, Message patient, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team | Cosign LVN dose, Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, Save AFBI contact from AI draft, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /clinician (redirected) | No | — | — |
| /admin-claims | /clinician (redirected) | No | — | — |
| /billing | /clinician (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Approve content, Publish content, Return content, Withdraw content, Download content changes, Load content changes, Discard content draft |
| /my-work | /my-work | No | none | Save AFBI contact from AI draft, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## billing

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /inbox (redirected) | No | — | — |
| /record/<id> | /inbox (redirected) | No | — | — |
| /admin | /inbox (redirected) | No | — | — |
| /admin-claims | /admin-claims | Yes | Fix a claim, Move claim status / resubmit, Record payment, Payment arrangement, Run eligibility check, ISL export, Review duplicate-claim holds, Export (ISL / claims), Superbill (disabled), Good-faith estimate (disabled) | Correct claim, Change claim status, Void payment, Eligibility check |
| /billing | /billing | Yes | Fix a claim, Move claim status / resubmit, Record payment, Payment arrangement, Run eligibility check, ISL export, Review duplicate-claim holds, Export (ISL / claims), Superbill (disabled), Good-faith estimate (disabled) | Correct claim, Change claim status, Void payment, Eligibility check |
| /admin-content | /inbox (redirected) | No | — | — |
| /my-work | /inbox (redirected) | No | — | — |

## billing_coordinator

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /inbox (redirected) | No | — | — |
| /record/<id> | /inbox (redirected) | No | — | — |
| /admin | /inbox (redirected) | No | — | — |
| /admin-claims | /admin-claims | Yes | Fix a claim, Move claim status / resubmit, Record payment, Payment arrangement, Run eligibility check, ISL export, Review duplicate-claim holds, Export (ISL / claims), Superbill (disabled), Good-faith estimate (disabled) | Correct claim, Change claim status, Void payment, Eligibility check, Override funding / category |
| /billing | /billing | Yes | Fix a claim, Move claim status / resubmit, Record payment, Payment arrangement, Run eligibility check, ISL export, Review duplicate-claim holds, Export (ISL / claims), Superbill (disabled), Good-faith estimate (disabled) | Correct claim, Change claim status, Void payment, Eligibility check, Override funding / category |
| /admin-content | /inbox (redirected) | No | — | — |
| /my-work | /inbox (redirected) | No | — | — |

## cf_care_manager

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /case-manager (redirected) | No | — | — |
| /record/<id> | /record/<id> | Yes | Raise crisis flag, Care plan goal, Assign activity, SDOH referral, Referral from resource directory, Link a care partner, Schedule visit, Log contact, Task for me / my team, Book a visit, Log contact, Message team | Log a partner handoff, Dictate after the encounter, Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Record custody duration (FSP), Record appointment offer, Record missing referral detail, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /case-manager (redirected) | No | — | — |
| /admin-claims | /case-manager (redirected) | No | — | — |
| /billing | /case-manager (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Download content changes, Load content changes, Discard content draft, Verify and publish resource |
| /my-work | /my-work | No | none | Task for me / my team, Book a visit, Log contact, Record missing referral detail, Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## medical_assistant

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /worklist (redirected) | No | — | — |
| /record/<id> | /record/<id> | Yes | Message team | AI recording consent, Withdraw AI recording consent, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /worklist (redirected) | No | — | — |
| /admin-claims | /worklist (redirected) | No | — | — |
| /billing | /worklist (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics |
| /my-work | /my-work | No | none | Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## therapist

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Progress note, Refer to an NTP, Link a care partner, Request a screener, Save screener draft (in progress), ASAM assessment, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Schedule visit, Message patient, Raise crisis flag, Task for me / my team, Book a visit, Referral from resource directory, Field outreach contact (AFBI), Message team | Addendum, Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, Save AFBI contact from AI draft, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Discharge episode, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Progress note, Addendum, Request a screener, Save screener draft (in progress), ASAM assessment, Raise crisis flag, Refer to an NTP, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Discharge episode, Referral from resource directory, Link a care partner, Schedule visit, Message patient, Edit demographics, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team | Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, Save AFBI contact from AI draft, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /clinician (redirected) | No | — | — |
| /admin-claims | /clinician (redirected) | No | — | — |
| /billing | /clinician (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Approve content, Publish content, Return content, Withdraw content, Download content changes, Load content changes, Discard content draft |
| /my-work | /my-work | No | none | Save AFBI contact from AI draft, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## nurse_rn

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /worklist (redirected) | No | — | — |
| /record/<id> | /record/<id> | Yes | Collect specimen, Triage call, Record outside NTP medication, Vitals / metabolic measures, Link a care partner, Message team | Nurse review of an order, Give clinic dose, Cosign LVN dose, Coordinate a refill, Log a partner handoff, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /worklist (redirected) | No | — | — |
| /admin-claims | /worklist (redirected) | No | — | — |
| /billing | /worklist (redirected) | No | — | — |
| /admin-content | /worklist (redirected) | No | — | — |
| /my-work | /my-work | No | none | Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## clinical_coordinator

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Link a care partner, Schedule visit, Raise crisis flag, Task for me / my team, Book a visit, Message team, Review patient matching, Re-confirm consent (merged records) | Log a partner handoff, AI recording consent, Withdraw AI recording consent, Discharge episode, Edit demographics, Check in, Mark attended, Mark missed visit, End group enrollment, Record appointment offer, Record missing referral detail, Take referral follow-up, Assign referral, Hand off crisis, Acknowledge escalation, Hand off escalation, Reassign escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Raise crisis flag, Discharge episode, Link a care partner, Schedule visit, Edit demographics, Task for me / my team, Book a visit, Message team | Log a partner handoff, AI recording consent, Withdraw AI recording consent, Check in, Mark attended, Mark missed visit, End group enrollment, Record custody duration (FSP), Record appointment offer, Record missing referral detail, Take referral follow-up, Assign referral, Hand off crisis, Acknowledge escalation, Hand off escalation, Reassign escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /admin | Yes | Note template (create), Note template (clone), Scheduling rule, Resend notification, Review patient matching, Re-confirm consent (merged records) | Edit consent form, Create note template, Clone note template, Save scheduling rule, Override funding / category |
| /admin-claims | /worklist (redirected) | No | — | — |
| /billing | /worklist (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Edit consent form, Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Approve content, Publish content, Return content, Withdraw content, Download content changes, Load content changes, Discard content draft, Verify and publish resource |
| /my-work | /my-work | No | none | Task for me / my team, Book a visit, Record missing referral detail, Take referral follow-up, Assign referral, Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## sys_admin

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Higher-level referral, Capture consent, Message team, Review patient matching, Re-confirm consent (merged records) | Discharge episode, Edit demographics, End group enrollment, Hand off crisis, Acknowledge escalation, Hand off escalation, Reassign escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /worklist (redirected) | No | — | — |
| /admin | /admin | Yes | ISL export, Export (ISL / claims), Note template (create), Note template (clone), Scheduling rule, Resend notification, Toggle a feature flag, Open Permissions & features, Review patient matching, Re-confirm consent (merged records), Add user (disabled), Reset sign-in (disabled), Edit staff roles (disabled) | Edit consent form, Approve / publish consent form, Create note template, Clone note template, Save scheduling rule |
| /admin-claims | /admin-claims | Yes | ISL export, Export (ISL / claims), Note template (create), Note template (clone), Scheduling rule, Resend notification, Toggle a feature flag, Open Permissions & features, Review patient matching, Re-confirm consent (merged records), Add user (disabled), Reset sign-in (disabled), Edit staff roles (disabled) | Edit consent form, Approve / publish consent form, Create note template, Clone note template, Save scheduling rule |
| /billing | /billing | Yes | ISL export, Export (ISL / claims), Note template (create), Note template (clone), Scheduling rule, Resend notification, Toggle a feature flag, Open Permissions & features, Review patient matching, Re-confirm consent (merged records), Add user (disabled), Reset sign-in (disabled), Edit staff roles (disabled) | Edit consent form, Approve / publish consent form, Create note template, Clone note template, Save scheduling rule |
| /admin-content | /admin-content | No | none | Edit consent form, Approve / publish consent form, Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Approve content, Publish content, Return content, Withdraw content, Download content changes, Load content changes, Discard content draft, Verify and publish resource |
| /my-work | /my-work | No | none | Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## sud_counselor

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Progress note, Refer to an NTP, Record outside NTP medication, Link a care partner, ASAM assessment, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Schedule visit, Message patient, Task, Capture consent, Raise crisis flag, Task for me / my team, Book a visit, Referral from resource directory, Message team | Addendum, Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Discharge episode, Check in, Mark attended, Mark missed visit, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Progress note, Addendum, Capture consent, Record outside NTP medication, ASAM assessment, Raise crisis flag, Refer to an NTP, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Discharge episode, Referral from resource directory, Link a care partner, Schedule visit, Message patient, Task, Task for me / my team, Book a visit, Message team | Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Check in, Mark attended, Mark missed visit, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /clinician (redirected) | No | — | — |
| /admin-claims | /clinician (redirected) | No | — | — |
| /billing | /clinician (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Download content changes, Load content changes, Discard content draft |
| /my-work | /my-work | No | none | Task for me / my team, Book a visit, Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## peer_specialist

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Progress note, SDOH referral, Schedule visit, Request visit cancellation, Message patient, Raise crisis flag, Task for me / my team, Book a visit, Referral from resource directory, Field outreach contact (AFBI), Message team | Dictate after the encounter, Save AFBI contact from AI draft, Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Check in, Mark attended, Mark missed visit, Record appointment offer, Record missing referral detail, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Progress note, Raise crisis flag, SDOH referral, Referral from resource directory, Schedule visit, Request visit cancellation, Message patient, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team | Dictate after the encounter, Save AFBI contact from AI draft, Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Check in, Mark attended, Mark missed visit, Record appointment offer, Record missing referral detail, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /clinician (redirected) | No | — | — |
| /admin-claims | /clinician (redirected) | No | — | — |
| /billing | /clinician (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Download content changes, Load content changes, Discard content draft, Verify and publish resource |
| /my-work | /my-work | No | none | Save AFBI contact from AI draft, Task for me / my team, Book a visit, Field outreach contact (AFBI), Record missing referral detail, Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## physician

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician | Yes | Progress note, Medication order, Refill decision, Clinic-administered medication, Refer to an NTP, Record outside NTP medication, Link a care partner, Lab order, Request a screener, Save screener draft (in progress), Vitals / metabolic measures, ASAM assessment, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Schedule visit, Message patient, Raise crisis flag, Task for me / my team, Book a visit, Referral from resource directory, Field outreach contact (AFBI), Message team | Addendum, CURES check, Cosign LVN dose, Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, Save AFBI contact from AI draft, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Discharge episode, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /record/<id> | /record/<id> | Yes | Progress note, Addendum, Medication order, Refill decision, CURES check, Clinic-administered medication, Record outside NTP medication, Lab order, Request a screener, Save screener draft (in progress), Vitals / metabolic measures, ASAM assessment, Raise crisis flag, Refer to an NTP, Care plan goal, Assign activity, SDOH referral, Higher-level referral, Discharge episode, Referral from resource directory, Link a care partner, Schedule visit, Message patient, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team | Cosign LVN dose, Log a partner handoff, Care plan suggestion, Review score change, AI recording consent, Withdraw AI recording consent, Start AI scribe, Stop and discard capture, Pause capture, Resume capture, Dictate after the encounter, Save AFBI contact from AI draft, End session (AI draft), Open AI draft, Edit AI sentence, Fill AI draft visit details, Keep AI sentence with reason, Delete AI sentence, Confirm AI draft review, Accept suggested follow-up, Check in, Mark attended, Mark missed visit, Send re-screen, Keep or retire after flag removed, Close care-plan goal, Do not use care-plan suggestion, Clear care-plan note, Remove group eligibility, End group enrollment, Record appointment offer, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /clinician (redirected) | No | — | — |
| /admin-claims | /clinician (redirected) | No | — | — |
| /billing | /clinician (redirected) | No | — | — |
| /admin-content | /admin-content | No | none | Load Simulated sample metrics, Mark content reviewed, Create content, Edit content, Send content for review, Approve content, Publish content, Return content, Withdraw content, Download content changes, Load content changes, Discard content draft |
| /my-work | /my-work | No | none | Save AFBI contact from AI draft, Task for me / my team, Book a visit, Field outreach contact (AFBI), Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## lvn

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /worklist (redirected) | No | — | — |
| /record/<id> | /record/<id> | Yes | Collect specimen, Vitals / metabolic measures, Message team | Give clinic dose, Hand off crisis, Acknowledge escalation, Hand off escalation, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |
| /admin | /worklist (redirected) | No | — | — |
| /admin-claims | /worklist (redirected) | No | — | — |
| /billing | /worklist (redirected) | No | — | — |
| /admin-content | /worklist (redirected) | No | — | — |
| /my-work | /my-work | No | none | Message team, Reply in team thread, Add to team thread, Flag thread as SUD, Resolve team thread, Reopen team thread, Mark team thread read, Mark reply done |

## credentialing_coordinator

| Route | Lands on | + New | Options today | Already allowed, not in + New |
|---|---|---|---|---|
| /clinician | /clinician-profile (redirected) | No | — | — |
| /record/<id> | /clinician-profile (redirected) | No | — | — |
| /admin | /clinician-profile (redirected) | No | — | — |
| /admin-claims | /clinician-profile (redirected) | No | — | — |
| /billing | /clinician-profile (redirected) | No | — | — |
| /admin-content | /clinician-profile (redirected) | No | — | — |
| /my-work | /clinician-profile (redirected) | No | — | — |

## Notes

- Chart options depend on the patient (consent, Part 2, assignment); captured on the first listed patient of each run. The chart menu shows patient-scoped actions only.
- /clinician and ops candidates are computed without a patient; patient-scoped actions there open a patient picker first.
- Ops menus label some actions differently (e.g. "Fix a claim" for claim_correct); a few candidates may be the same action under another label and need a manual check in the plan.
- Roles redirected away from a route cannot see that route's + New; no change proposed.
- Audit behaviour is verified in `e2e/staffNewAudit8a2.spec.ts`: opening an option writes nothing; navigation-only options (Review patient matching, Open Permissions & features) write one opened event; created items write exactly one `action.succeeded`.

## Addendum Oct 16 — missing landing pages (plan step A0, read-only)

Computed from `resolveNavAccess` and `CHART_ACTIONS.allowed` with no patient selected (patient-scoped actions open a picker). "+ New" is absent on all four pages today (`StaffShell.tsx:29`). "own screen" = `menu: false` today.

| Route | Role | Access | + New | Already allowed (registry id) |
|---|---|---|---|---|
| /worklist | nurse_rn | stays | No | Send forms to sign (`consent_form_send`, own screen), Sign in person (`consent_form_in_person`, own screen), Open restricted record (`chart_restricted_open`, own screen), Load Simulated sample metrics (`content_simulated_sample`, own screen), Nurse review of an order (`nurse_review`, own screen), Give clinic dose (`clinic_dose_give`, own screen), Cosign LVN dose (`clinic_dose_cosign`, own screen), Collect specimen (`specimen_collect`), Triage call (`triage_call`), Coordinate a refill (`refill_coordinate`, own screen), Record outside NTP medication (`ntp_external_med`), Link a care partner (`partner_link`), Log a partner handoff (`partner_handoff`, own screen), Vitals / metabolic measures (`metabolic`), Review score change (`severity_flag_review`, own screen), AI recording consent (`scribe_consent_grant`, own screen), Withdraw AI recording consent (`scribe_consent_withdraw`, own screen), Start AI scribe (`scribe_start`, own screen), Stop and discard capture (`scribe_discard`, own screen), Pause capture (`scribe_pause`, own screen), Resume capture (`scribe_resume`, own screen), Dictate after the encounter (`scribe_dictate`, own screen), End session (AI draft) (`scribe_end`, own screen), Open AI draft (`scribe_open_draft`, own screen), Edit AI sentence (`scribe_sentence_edit`, own screen), Fill AI draft visit details (`scribe_visit_field`, own screen), Keep AI sentence with reason (`scribe_sentence_keep`, own screen), Delete AI sentence (`scribe_sentence_delete`, own screen), Confirm AI draft review (`scribe_review_confirm`, own screen), Accept suggested follow-up (`scribe_followup_accept`, own screen), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Hand off crisis (`crisis_handoff`, own screen), Acknowledge escalation (`escalation_acknowledge`, own screen), Hand off escalation (`escalation_handoff`, own screen), Message team (`message_team`), Reply in team thread (`staff_thread_post`, own screen), Add to team thread (`staff_thread_add_participant`, own screen), Flag thread as SUD (`staff_thread_flag_sud`, own screen), Resolve team thread (`staff_thread_resolve`, own screen), Reopen team thread (`staff_thread_reopen`, own screen), Mark team thread read (`staff_thread_read`, own screen), Mark reply done (`staff_thread_mention_done`, own screen) |
| /worklist | lvn | stays | No | Send forms to sign (`consent_form_send`, own screen), Sign in person (`consent_form_in_person`, own screen), Open restricted record (`chart_restricted_open`, own screen), Load Simulated sample metrics (`content_simulated_sample`, own screen), Give clinic dose (`clinic_dose_give`, own screen), Collect specimen (`specimen_collect`), Vitals / metabolic measures (`metabolic`), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Hand off crisis (`crisis_handoff`, own screen), Acknowledge escalation (`escalation_acknowledge`, own screen), Hand off escalation (`escalation_handoff`, own screen), Message team (`message_team`), Reply in team thread (`staff_thread_post`, own screen), Add to team thread (`staff_thread_add_participant`, own screen), Flag thread as SUD (`staff_thread_flag_sud`, own screen), Resolve team thread (`staff_thread_resolve`, own screen), Reopen team thread (`staff_thread_reopen`, own screen), Mark team thread read (`staff_thread_read`, own screen), Mark reply done (`staff_thread_mention_done`, own screen) |
| /worklist | medical_assistant | stays | No | Send forms to sign (`consent_form_send`, own screen), Sign in person (`consent_form_in_person`, own screen), Open restricted record (`chart_restricted_open`, own screen), Load Simulated sample metrics (`content_simulated_sample`, own screen), AI recording consent (`scribe_consent_grant`, own screen), Withdraw AI recording consent (`scribe_consent_withdraw`, own screen), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Record appointment offer (`timely_offer_record`, own screen), Hand off crisis (`crisis_handoff`, own screen), Acknowledge escalation (`escalation_acknowledge`, own screen), Hand off escalation (`escalation_handoff`, own screen), Message team (`message_team`), Reply in team thread (`staff_thread_post`, own screen), Add to team thread (`staff_thread_add_participant`, own screen), Flag thread as SUD (`staff_thread_flag_sud`, own screen), Resolve team thread (`staff_thread_resolve`, own screen), Reopen team thread (`staff_thread_reopen`, own screen), Mark team thread read (`staff_thread_read`, own screen), Mark reply done (`staff_thread_mention_done`, own screen) |
| /case-manager | community_health_worker | stays | No | Send forms to sign (`consent_form_send`, own screen), Sign in person (`consent_form_in_person`, own screen), Open restricted record (`chart_restricted_open`, own screen), Load Simulated sample metrics (`content_simulated_sample`, own screen), Mark content reviewed (`content_mark_reviewed`, own screen), Create content (`content_create`, own screen), Edit content (`content_edit`, own screen), Send content for review (`content_submit`, own screen), Download content changes (`content_export`, own screen), Load content changes (`content_restore`, own screen), Discard content draft (`content_discard`, own screen), Verify and publish resource (`resource_verify`, own screen), Progress note (`progress_note`), SDOH referral (`sdoh_referral`), Schedule visit (`schedule_visit`), Dictate after the encounter (`scribe_dictate`, own screen), Save AFBI contact from AI draft (`scribe_afbi_save`, own screen), Open AI draft (`scribe_open_draft`, own screen), Edit AI sentence (`scribe_sentence_edit`, own screen), Fill AI draft visit details (`scribe_visit_field`, own screen), Keep AI sentence with reason (`scribe_sentence_keep`, own screen), Delete AI sentence (`scribe_sentence_delete`, own screen), Confirm AI draft review (`scribe_review_confirm`, own screen), Accept suggested follow-up (`scribe_followup_accept`, own screen), Request visit cancellation (`visit_request_cancel`), Raise crisis flag (`crisis_flag`), Task for me / my team (`dashboard_task`), Book a visit (`dashboard_book`), Referral from resource directory (`dashboard_referral`), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Field outreach contact (AFBI) (`afbi_contact`), Record appointment offer (`timely_offer_record`, own screen), Record missing referral detail (`referral_chase_fill`, own screen), Hand off crisis (`crisis_handoff`, own screen), Acknowledge escalation (`escalation_acknowledge`, own screen), Hand off escalation (`escalation_handoff`, own screen), Message team (`message_team`), Reply in team thread (`staff_thread_post`, own screen), Add to team thread (`staff_thread_add_participant`, own screen), Flag thread as SUD (`staff_thread_flag_sud`, own screen), Resolve team thread (`staff_thread_resolve`, own screen), Reopen team thread (`staff_thread_reopen`, own screen), Mark team thread read (`staff_thread_read`, own screen), Mark reply done (`staff_thread_mention_done`, own screen) |
| /case-manager | cf_care_manager | stays | No | Send forms to sign (`consent_form_send`, own screen), Sign in person (`consent_form_in_person`, own screen), Open restricted record (`chart_restricted_open`, own screen), Load Simulated sample metrics (`content_simulated_sample`, own screen), Mark content reviewed (`content_mark_reviewed`, own screen), Create content (`content_create`, own screen), Edit content (`content_edit`, own screen), Send content for review (`content_submit`, own screen), Download content changes (`content_export`, own screen), Load content changes (`content_restore`, own screen), Discard content draft (`content_discard`, own screen), Verify and publish resource (`resource_verify`, own screen), Link a care partner (`partner_link`), Log a partner handoff (`partner_handoff`, own screen), Care plan goal (`care_plan_goal`), Assign activity (`activity_assignment`), SDOH referral (`sdoh_referral`), Schedule visit (`schedule_visit`), Dictate after the encounter (`scribe_dictate`, own screen), Open AI draft (`scribe_open_draft`, own screen), Edit AI sentence (`scribe_sentence_edit`, own screen), Fill AI draft visit details (`scribe_visit_field`, own screen), Keep AI sentence with reason (`scribe_sentence_keep`, own screen), Delete AI sentence (`scribe_sentence_delete`, own screen), Confirm AI draft review (`scribe_review_confirm`, own screen), Accept suggested follow-up (`scribe_followup_accept`, own screen), Log contact (`contact_log`), Raise crisis flag (`crisis_flag`), Task for me / my team (`dashboard_task`), Book a visit (`dashboard_book`), Log contact (`dashboard_contact`), Referral from resource directory (`dashboard_referral`), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Keep or retire after flag removed (`plan_flag_review`, own screen), Update coverage at release (`coverage_release_status_set`, own screen), Check eligibility (Simulated) (`coverage_release_check`, own screen), Create record despite a match (`patient_create_anyway`, own screen), Close care-plan goal (`plan_goal_close`, own screen), Do not use care-plan suggestion (`plan_suggestion_dismiss`, own screen), Clear care-plan note (`plan_summary_clear`, own screen), Remove advocate access (`advocate_access_remove`, own screen), Record appointment offer (`timely_offer_record`, own screen), Record missing referral detail (`referral_chase_fill`, own screen), Hand off crisis (`crisis_handoff`, own screen), Acknowledge escalation (`escalation_acknowledge`, own screen), Hand off escalation (`escalation_handoff`, own screen), Message team (`message_team`), Reply in team thread (`staff_thread_post`, own screen), Add to team thread (`staff_thread_add_participant`, own screen), Flag thread as SUD (`staff_thread_flag_sud`, own screen), Resolve team thread (`staff_thread_resolve`, own screen), Reopen team thread (`staff_thread_reopen`, own screen), Mark team thread read (`staff_thread_read`, own screen), Mark reply done (`staff_thread_mention_done`, own screen) |
| /inbox | billing | stays | No | Correct claim (`claim_correct`, own screen), Change claim status (`claim_status`, own screen), Record payment (`payment_record`, own screen), Void payment (`payment_void`, own screen), Payment arrangement (`payment_arrangement`, own screen), Eligibility check (`eligibility_check`, own screen), ISL export (`isl_export`, own screen), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Review duplicate-claim holds (`claim_duplicate_review`, own screen), Export (ISL / claims) (`claims_export`, own screen), Generate county report draft (`county_generate`, own screen), Send county report (Simulated) (`county_submit`, own screen), Simulate county response (`county_simulate_response`, own screen), Mark county error fixed (`county_fix_error`, own screen), Resend county report (Simulated) (`county_resend`, own screen) |
| /inbox | billing_coordinator | stays | No | Correct claim (`claim_correct`, own screen), Change claim status (`claim_status`, own screen), Record payment (`payment_record`, own screen), Void payment (`payment_void`, own screen), Payment arrangement (`payment_arrangement`, own screen), Eligibility check (`eligibility_check`, own screen), ISL export (`isl_export`, own screen), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Review duplicate-claim holds (`claim_duplicate_review`, own screen), Export (ISL / claims) (`claims_export`, own screen), Generate county report draft (`county_generate`, own screen), Send county report (Simulated) (`county_submit`, own screen), Simulate county response (`county_simulate_response`, own screen), Mark county error fixed (`county_fix_error`, own screen), Resend county report (Simulated) (`county_resend`, own screen), Mark survey offered / completed / declined (`tps_mark`, own screen), Send survey link (Simulated) (`tps_send_link`, own screen), Override funding / category (`service_classification_override`, own screen), Hand off crisis (`crisis_handoff`, own screen) |
| /clinician-profile | credentialing_coordinator | stays | No | Review restricted-record open (`compliance_restricted_review`, own screen), Save working hours (`calendar_staff_hours_save`, own screen), Remove working hours (`calendar_staff_hours_remove`, own screen), Enter time off (`calendar_time_off_add`, own screen), Withdraw time off (`calendar_time_off_remove`, own screen), Set external calendar id (`calendar_external_id_set`, own screen), Save my profile (`profile_save`, own screen), Freeze / reactivate bookings (`bookings_freeze`, own screen), Generate county report draft (`county_generate`, own screen), Send county report (Simulated) (`county_submit`, own screen), Simulate county response (`county_simulate_response`, own screen), Mark county error fixed (`county_fix_error`, own screen), Resend county report (Simulated) (`county_resend`, own screen) |

## Addendum Oct 16 — Mitch's draft quick actions mapped to registry ids

"hidden" = not allowed for that role (would be flagged, not offered). "cosign" = allowed with cosignature. Where two ids match, the first is a patient/other-surface action and is not used.

| Role | Draft label | Registry id(s) | State |
|---|---|---|---|
| therapist | Progress note | `progress_note` Progress note | allowed |
| therapist | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| therapist | Message patient | `message_patient` Message patient | allowed |
| therapist | Request a screener | `screener_request` Request a screener | allowed |
| therapist | Task | `task` Task; `dashboard_task` Task for me / my team | hidden; allowed |
| sud_counselor | Progress note | `progress_note` Progress note | cosign |
| sud_counselor | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| sud_counselor | Message patient | `message_patient` Message patient | allowed |
| sud_counselor | Request a screener | `screener_request` Request a screener | hidden |
| sud_counselor | Task | `task` Task; `dashboard_task` Task for me / my team | allowed; allowed |
| physician | Progress note | `progress_note` Progress note | allowed |
| physician | Medication order | `med_order` Medication order | allowed |
| physician | Refill decision | `refill_decision` Refill decision | allowed |
| physician | Lab order | `lab_order` Lab order | allowed |
| physician | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| pmhnp | Progress note | `progress_note` Progress note | allowed |
| pmhnp | Medication order | `med_order` Medication order | allowed |
| pmhnp | Refill decision | `refill_decision` Refill decision | allowed |
| pmhnp | Lab order | `lab_order` Lab order | allowed |
| pmhnp | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| ecm_provider | Log contact | `contact_log` Log contact; `dashboard_contact` Log contact | allowed; allowed |
| ecm_provider | Field outreach contact | `afbi_contact` Field outreach contact (AFBI) | allowed |
| ecm_provider | Referral from resource directory | `dashboard_referral` Referral from resource directory | allowed |
| ecm_provider | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| ecm_provider | Message team | `message_team` Message team | allowed |
| cf_care_manager | Log contact | `contact_log` Log contact; `dashboard_contact` Log contact | allowed; allowed |
| cf_care_manager | Field outreach contact | `afbi_contact` Field outreach contact (AFBI) | hidden |
| cf_care_manager | Referral from resource directory | `dashboard_referral` Referral from resource directory | allowed |
| cf_care_manager | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| cf_care_manager | Message team | `message_team` Message team | allowed |
| community_health_worker | Log contact | `contact_log` Log contact; `dashboard_contact` Log contact | hidden; hidden |
| community_health_worker | Field outreach contact | `afbi_contact` Field outreach contact (AFBI) | allowed |
| community_health_worker | Referral from resource directory | `dashboard_referral` Referral from resource directory | allowed |
| community_health_worker | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| community_health_worker | Message team | `message_team` Message team | allowed |
| peer_specialist | Log contact | `contact_log` Log contact; `dashboard_contact` Log contact | hidden; hidden |
| peer_specialist | Field outreach contact | `afbi_contact` Field outreach contact (AFBI) | allowed |
| peer_specialist | Referral from resource directory | `dashboard_referral` Referral from resource directory | allowed |
| peer_specialist | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| peer_specialist | Message team | `message_team` Message team | allowed |
| nurse_rn | Triage call | `triage_call` Triage call | allowed |
| nurse_rn | Vitals | `metabolic` Vitals / metabolic measures | allowed |
| nurse_rn | Collect specimen | `specimen_collect` Collect specimen | allowed |
| lvn | Vitals | `metabolic` Vitals / metabolic measures | allowed |
| lvn | Collect specimen | `specimen_collect` Collect specimen | allowed |
| medical_assistant | Message team | `message_team` Message team | allowed |
| medical_assistant | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; hidden |
| clinical_coordinator | Task for me / my team | `dashboard_task` Task for me / my team | allowed |
| clinical_coordinator | Book a visit | `patient_self_book` Book my visit; `dashboard_book` Book a visit | hidden; allowed |
| clinical_coordinator | Assign referral | `referral_assign_owner` Assign referral | allowed |
| clinical_coordinator | Link a care partner | `partner_link` Link a care partner | allowed |
| clinical_coordinator | Message team | `message_team` Message team | allowed |
| billing | Fix a claim | — | missing |
| billing | Run eligibility check | — | missing |
| billing | Record payment | `payment_record` Record payment | allowed |
| billing | Payment arrangement | `payment_arrangement` Payment arrangement | allowed |
| billing_coordinator | Fix a claim | — | missing |
| billing_coordinator | Run eligibility check | — | missing |
| billing_coordinator | Record payment | `payment_record` Record payment | allowed |
| billing_coordinator | Payment arrangement | `payment_arrangement` Payment arrangement | allowed |
| sys_admin | Toggle a feature flag | `feature_flag_set` Toggle a feature flag | allowed |
| sys_admin | Note template | `note_template_create` Create note template; `note_template_update` Update note template; `note_template_activate` Activate / deactivate note template; `note_template_clone` Clone note template | allowed; allowed; allowed; allowed |
| sys_admin | Scheduling rule | `scheduling_rule_save` Save scheduling rule; `scheduling_rule_deactivate` Deactivate scheduling rule; `scheduling_rule_run` Run scheduling rules | allowed; allowed; allowed |
| sys_admin | Resend notification | `notification_resend` Resend notification | allowed |

Flags for Mitch:
- "Fix a claim" = `claim_correct` (registry label "Correct claim"); "Run eligibility check" = `eligibility_check` (label "Eligibility check"). Both allowed for billing and billing_coordinator; they only failed to match by name.
- sud_counselor: "Request a screener" is hidden; "Progress note" needs cosignature.
- community_health_worker and peer_specialist: "Log contact" is hidden (both ids).
- cf_care_manager: "Field outreach contact (AFBI)" is hidden.
- medical_assistant: "Book a visit" is hidden. Other allowed actions for Mitch to choose: Send forms to sign, Sign in person, AI recording consent, Enter time off (see table above).
- nurse_rn / lvn pending clinical sign-off, not offered: Give clinic dose (`clinic_dose_give`), Coordinate a refill (`refill_coordinate`).
- credentialing_coordinator proposal: Enter time off (`calendar_time_off_add`), Freeze / reactivate bookings (`bookings_freeze`), Generate county report draft — only start/create items from the table above.
- sys_admin "Note template" = `note_template_create`; "Scheduling rule" = `scheduling_rule_save`.

## Duplicates
- "Log contact": `contact_log` and `dashboard_contact`.
- Ops launcher relabels (`OpsActionLauncher.tsx:36`): claim_correct "Fix a claim"/"Correct claim"; claim_status "Move claim status / resubmit"/"Change claim status"; eligibility_check "Run eligibility check"/"Eligibility check"; note_template_create "Note template (create)"/"Create note template"; note_template_clone "Note template (clone)"/"Clone note template".

## Existing test lines that would change
Search of `src/**/__tests__` and `e2e/` for these labels: **no matches**. Batches 2–5 as planned need no existing test-line changes so far; any found during the build will stop the work and be listed for approval.
