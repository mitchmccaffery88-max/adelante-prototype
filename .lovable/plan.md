## Adelante MVP EMR Wireframe — Prototype Rebuild

This prompt reframes the project as a **role-based clickable wireframe** — a prototype for scope definition, not the live MVP we've been polishing. It largely supersedes the current app (patient portal, live scheduling, Healthie mocks, PWA polish, i18n, etc.) with a broader, shallower EMR shell spanning 8 roles, a full RBAC matrix, consent ledger, funding-lane tagging, and billing/claims.

Before I start building, I want to confirm the direction so we don't discard work you may still want.

### What this prompt changes vs. what we have

| Area | Current app | New prompt |
|---|---|---|
| Roles | Patient, Case Manager, Clinician, Admin (4) | 8 roles incl. Peer, Therapist, PMHNP, Billing, Referral submitter |
| Data model | Patient + Referral + appointments | Person → Episodes, Consent Ledger, Release-date object, Funding-lane tag on every event |
| Chart | Patient portal + clinician workspace | Tabbed EMR chart with per-role RBAC gating on ~14 record classes |
| Part 2 / SUD | Light consent flag | First-class Part 2 segmentation, lock/unlock live on consent revoke |
| Billing | None | Claims worklist, ISL encounters, versioned code/rate table, credentialing tracker, Bagga vs Adelante NPI toggle |
| Docs | None | Upload → Unverified → Verify queue → Promote to chart |
| Scheduling | Live Healthie availability, SMS fallbacks, notifications | Out — stubs only. Prototype explicitly forbids real integrations |
| Patient PWA, i18n, self-scheduling, live-availability booking | Built | Prompt says patient dashboard is "deliberately light" and PWA is post-MVP |
| Tone | Warm, hopeful, 6th-grade landing | Clean, calm, clinical. Sentence case, no emoji, teal #0B5563 |
| County | Generic | Tulare-only demo data; Kings appears only in ISL banner + pipeline note |
| Backend | Healthie mock service, localStorage persistence | No backend, synthetic data only, persistent "PROTOTYPE" banner |

### Key questions before I plan the build

1. **Scope of replacement.** Do you want this to **replace** the current app (archive Landing / PatientHome / live scheduling / i18n / PWA) and rebuild as a wireframe prototype? Or **layer** the new EMR shell alongside, keeping the existing patient-facing flows as one of the demoable surfaces?

2. **Patient portal depth.** The prompt says patient dashboard is thin (next appt, self-help checkboxes, care-plan summary, 988). Our current `PatientHome` is much richer (goals, self-scheduling, profile, i18n). Trim to match the prompt, or keep the richer version as-is under the "Patient-user" role?

3. **Auth & persistence.** Prompt says role switcher in top bar, "no auth backend," local component state. Should I rip out the current `/auth` persona picker + localStorage session and replace with a pure in-memory role dropdown? (This also means dropping Lovable Cloud plans if any were on the table.)

4. **Landing page.** The warm public landing we built doesn't fit a clinical prototype shell. Keep it at `/` for external referrers, or replace `/` with the app shell + role switcher and move the referral portal to `/referral` as a "standalone unauthenticated-feeling" page?

### If you approve, the build order (mirrors §21)

1. **Shell + role switcher + PROTOTYPE banner + brand reset** (teal #0B5563, sentence case, remove emoji, left nav, top bar, role-filtered nav).
2. **Data model rewrite** in `src/lib/healthie.ts` → rename to `src/lib/emr.ts`: `Person` with `episodes[]` (MH/SUD/ECM/JI/BHSA), `ConsentLedger`, `ReleaseDate` object with confidence + history, funding-lane enum on every clinical event.
3. **Patient list + tabbed chart + RBAC matrix** — one `<ChartSection role={} recordClass={}>` wrapper that renders Read/Write/Locked/Hidden per the §4 matrix. "Why can't I see this?" affordance on locked sections.
4. **Consent ledger** with live Part 2 lock/unlock demo (revoke → re-lock chart sections → audit entry).
5. **Intake & screening** — eligibility (dated payer span), safety screen with 48h clock, PHQ-9/GAD-7/PCL-5/AUDIT/DAST-10 with item-level structured capture, SDOH assessment, consent capture, document prompt.
6. **Referral portal** — standalone `/referral`, Tulare default, consent checkboxes, creates Person + JI pre-release episode in Pending eligibility, queues welcome SMS behind consent.
7. **Document upload + verify queue** with Part 2 redisclosure badge.
8. **Caseload views** (CM + Peer) with risk-tiered retention, adherence alerts, closure-reason dropdown.
9. **Billing & claims** — worklist by lane, ISL encounters view with 1/1/2027 banner, versioned code/rate table (Tulare rows only), credentialing tracker, Bagga/Adelante NPI toggle.
10. **Population health dashboard** (read-only, 70% completion threshold line, structured-score dependency note).
11. **SUD/DMC-ODS surface** (episode states, ASAM placeholder, LPHA-as-permission, MAT/EPCS stub, closed-loop referral).
12. **Crisis panel** (dual clinical vs SDOH ladders), timely-access SLA chips, admin (users/roles, break-glass audit only).
13. **Seed 8 synthetic patients** covering all §18 scenarios.

### Technical notes

- Single React app, no backend. All state in-memory + a seed module. Persistent `PROTOTYPE — synthetic data, not for clinical use` banner in the top bar.
- Restyle `src/styles.css` around teal `#0B5563` + neutral grays; strip warm-tone tokens.
- Preserve existing route file scaffolding; heavily rewrite contents. `src/lib/i18n.tsx`, `ReadAloudButton`, PWA manifest can stay but will be de-emphasized unless you want them kept.
- Kings County appears in exactly two places: ISL 1/1/2027 banner + optional pipeline note. No demo data, no code/rate rows.

Please answer Q1–Q4 above (or say "just build it all as the prompt describes and archive what conflicts") and I'll produce the full build.
