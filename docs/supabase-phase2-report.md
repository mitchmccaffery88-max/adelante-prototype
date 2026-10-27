# Supabase Phase 2 — partial closed foundation

27 Oct 2026. **Not complete; persistence remains OFF; nothing published.** Existing connected Supabase Pro project only. No Lovable Cloud, GitHub link, connector, auth-user changes, or buckets.

## Installed tables
26 public tables, organization-bound foreign keys, timestamps/update triggers, synthetic-only guards, RLS and explicit grants; authenticated/service-role direct writes revoked; anonymous access revoked:

- Chart: `care_team_assignments`, `patient_site_enrollments`, `staff_site_assignments`, `restricted_record_flags`, `restricted_record_opens`.
- Advocate: `advocates`, `advocate_links`.
- Referral: `referrals`, `referral_codes`, `referral_status_updates`, `referral_outreach_log`.
- Signup: `signup_sessions`, `signup_attempts`, `signup_safety_scans`.
- Separate review lanes: `identity_review_items`, `account_support_items`, `website_inbox_items`.
- Intake: `intake_checklists`, `intake_form_status`, `intake_packet_needs`, `pre_chart_triage`, `first_visit_handoffs`.
- Staging: `staging_imports`, `staging_rows`, `packet_documents`.
- Draft on-call: `on_call_shifts`.

## Functions and permissions
Chart helpers separate acting role, actual work-site enrollment, care team, restriction/search, and existing `app.can_access`; no grant-matrix widening. NULL roles fail closed. Packet projections return only `{id,locked:true,reason}` when locked and metadata only when unlocked. Standard treatment consent does not unlock Intake chart, SUD screeners or treatment classes. Advocate identity helper checks link, scope, recipient and associated consent; it remains unexposed pending positive tests.

`app.phase2_run_action` prototypes narrow fictional template import, packet attachment, verified linking, team assignment and on-call creation with one neutral simulated audit. **Its execution is revoked from authenticated callers; no runtime server wrapper is attached.** The `phase2_referral_link` prototype is not an approved registry contract and must not be enabled. Identity decisions, capture/signature writes and other unported mutations refuse or remain unavailable.

`app.resolve_crisis_owner` prototype preserves the special SDOH branch and normal assigned/on-call/fallback routing; no runtime exposure and no claim of full parity. On-call shifts require active licensed roles, positive dates, at most seven days and the Draft label.

Signup guards cover the existing 5/15-minute code, 5-try OTP, 10-minute OTP and 30-second resend rules; hashes only. Safety scans and attempts are immutable. Inbox stores résumé name/size only. Staging identity fields reject clinical payload fields; packet paths are rejected pending Phase 5.

**Final access is closed:** all 26 table read policies are false, new staff identity/contact/consent policies are false, public packet/advocate RPCs and command RPC are revoked. Helpers remain for isolated rollback testing only. No new app patient read is enabled.

## Seeds
No retained Phase 2 database seeds. A temporary export exercised the fictional general signup and verified packet signup through the real registry; the database rollback test covered staged packet → patient enrollment and consent lock/unlock. This does **not** satisfy the requested full current patient suite, three retained intakes, care teams, or store-owned seed persistence. The temporary export also exposed TypeScript capture/SQL standard-TPO expiry mismatch; it is not shipped or used as database signature evidence. No invented real signature or raw fixture identity export is committed.

## Repositories and runtime
`phase2.ts` adds disconnected read types, off-default domain declarations and an ID-only defensive packet projection. Memory/Supabase wrappers are port scaffolds, **not implemented domain repositories or full contract parity**. No new server functions, no persistence switch, no UI/shell changes.

## Validation
- Database: **2,023 passing rollback assertions**, main project; see `docs/rls-evidence/phase2-rollback.md`. Matrix reads on empty tables are not comprehensive positive access proof.
- Full units: **3,479/3,479**, 399 files. New projection/default-off tests: 14/14.
- First browser run was terminated at 600 seconds: 24 passed, 2 timed out, 21 uncompleted; overlapping full unit work contributed load. No tests/config/timeouts changed.
- Isolated landing rerun: **5/5**. Clean full public rerun result recorded below after completion.
- Preview build log: build OK. No content route was modified; index metadata preserved.

## Remaining work / blockers
This implementation batch is partial, not Phase 2 acceptance. Remaining implementation gaps are not a request for new secrets or approval: generated full store-driven seeds; real domain repositories and server/registry command contracts; patient/advocate/identity positive RLS scenarios; complete handoff/care-team end-to-end; reasoned restricted-open/compliance path; broad consent/class locked projections; trusted signup matching and crisis-owner parity.

Separate test project credentials remain external; until supplied, only rollback tests are used. Hosted authenticated end-to-end remains unavailable with zero provisioned accounts/auth users. These limits are distinct from unfinished implementation. All persistence remains off until the missing work passes.