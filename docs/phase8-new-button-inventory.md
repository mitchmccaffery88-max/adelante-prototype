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
