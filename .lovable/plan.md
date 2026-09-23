# Phase 5d-3 — activity log, follow-up tasks, and aging

## What I found (current state)

- `SdohPlanItem.note` and `ResourceReferral.note` are single overwritable strings; `setSdohStatus` (ehr.ts:10140) and `setResourceReferralStatus` (ehr.ts:10321) replace them in place. No author, no history.
- `ResourceReferral.followUpDate` (ehr.ts:1855) exists; nothing reads or writes it.
- `createCaseTask` is never called from any need/referral path. Tasks reach My Work through `myOpenItems()` (myWork.ts:132), which counts a task when it is assigned to or claimed by the viewer **and past due**.
- `patientOpenItems.ts` lists unresolved needs with no age and no referrals at all.
- `referralAging.ts` covers inbound intake referrals only (3 days due / 7 overdue, labelled draft).
- Patient/advocate surfaces read `visibleToPatient` and a small set of fields; none of them render `note` on a need or referral today (`PatientHome`, `next-steps`, `advocate.coordination`). So the log has no existing leak path — I will keep it that way by not exporting log entries from any patient-facing selector.

## Build

### 1. Activity log (`src/lib/ehr.ts`)

New shared type, modelled on `CaseTaskNote`:

```ts
export type SdohLogEntryType =
  | "contact_attempt" | "org_update" | "client_update"
  | "barrier" | "document" | "next_step";
export type SdohContactMethod = "phone" | "email" | "in_person" | "portal" | "fax";
export const SDOH_BARRIERS = [...] // draft list from the brief, labelled draft on screen
export interface SdohLogEntry {
  id: string; text: string; entryType: SdohLogEntryType;
  authorName: string; authorRole: StaffRole; at: string;
  contactName?: string; contactMethod?: SdohContactMethod; contactResult?: string;
  barriers?: SdohBarrier[];
  documentsNeeded?: string[]; documentsCollected?: string[];
  nextStep?: string; nextStepDueDate?: string; taskId?: string;
}
```

Added as `log?: SdohLogEntry[]` on both `SdohPlanItem` and `ResourceReferral`. Append-only writers `appendSdohNeedLog(patientId, itemId, entry, actor)` and `appendReferralLog(patientId, referralId, entry, actor)` — no edit, no delete — each writing an audit entry in the existing shape (`sdoh_need_log_added`, `resource_referral_log_added`). Actor is required for a log entry (unlike legacy status writes); unattributed entries are not creatable.

**Pre-existing `note`:** shown above the log as a clearly marked "Earlier note (pre-dates the activity log — no author recorded)" block, not migrated into the log. Migrating would fabricate an author and a timestamp.

**Gating:** the log renders only inside the record's SDOH/Referrals tabs. A Part 2-gated viewer already gets the generic restricted row for SUD-sensitive referrals (5d-1) — the log is inside that row, so it is masked with everything else, and the append form is not rendered. Safety-sensitive needs already carry the staff-only badge; the log is staff-only for every need regardless of `visibleToPatient`, and no patient/advocate selector reads `log`.

### 2. Follow-up tasks

`followUpDate` gets real UI on the referral row (set/clear, attributed via a log entry). Setting a follow-up date, or an entry with `nextStep` + `nextStepDueDate`, offers "Create a task for this".

Task creation goes through the existing `createCaseTask`:
- `patientId`, `assignedTo: patient.caseManagerId`, `dueDate` = follow-up/next-step date
- new origin `"sdoh_follow_up"`, `taskType: "sdoh_follow_up"`
- `detail` names the need or the provider so the task links back; `dedupeKey` = `sdoh-follow:<needOrReferralId>:<dueDate>`
- resulting `taskId` stored on the log entry

**No case manager assigned:** the control states plainly "No case manager is assigned to this client — a follow-up task cannot be assigned" and does not create anything (Phase 3a pattern). Never a silent no-op.

**Part 2:** a task for a SUD-sensitive referral carries no category or provider in its title/detail — only "Social-needs follow-up" plus the client, since task titles surface in queues to staff who may be gated.

### 3. Aging (`src/lib/sdohAging.ts`, new)

Draft thresholds, labelled on screen "Draft threshold — pending care-operations sign-off", matching `REFERRAL_AGING_DRAFT`:

| State | Due | Overdue | Reasoning |
|---|---|---|---|
| Need identified, never referred | 5 d | 14 d | A need that's been named but not acted on is the classic dropout point; a working week to act, two weeks is a failure. |
| Referral sent, no outcome | 7 d | 21 d | Community orgs commonly answer within a week; three weeks with no word means the referral is not going to close itself. |
| Waitlisted | 30 d | 60 d | A waitlist is a legitimately slow state — clocking it weekly would create noise — but a monthly check-in is real practice. |

`sdohLastActionAt()` = the latest of `createdAt`, `updatedAt`, and the newest log entry's `at`, so any real action (including a log entry) resets the clock. Closed outcomes and completed/not-completed needs age out to `closed`.

Feeds:
- `patientOpenItems.ts` — adds `kind: "resource_referral"` rows for open referrals, and an age/aging detail on both needs and referrals.
- `myWork.ts` — a new `sdohAging: MySdohItem[]` bucket for needs/referrals on patients whose `caseManagerId` resolves to the viewer's alias set and whose aging state is `due`/`overdue`, counted into `total`. Existing buckets untouched.

### 4. UI

- `RecordTabs.tsx` SdohTab: per-need aging badge, collapsible activity log with the structured append form, "Earlier note" block.
- `RecordTabs.tsx` ReferralsTab: same log on referrals, plus follow-up date control and aging badge; masked inside the existing restricted row for gated viewers.
- Shared `src/components/clinical/SdohActivityLog.tsx` so the need and referral versions cannot drift.

## Verification

Typecheck, full suite, plus new tests in `src/lib/__tests__/sdohActivityLog.test.ts`: append-only with attribution; structured fields persist; log never appears in any patient/advocate selector output; Part 2 gating on entries; safety staff-only; follow-up task creation with and without a case manager; aging thresholds and reset on a new log entry; open-items summary includes referrals. Live browser at both viewports including a Part 2-gated role and a patient view.

## Non-goals

No reporting funnel (5d-4), no patient/advocate view changes beyond confirming no leak, no barrier categories beyond the draft list.
