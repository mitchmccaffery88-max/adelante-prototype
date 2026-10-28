# Care-team chart access and Intake follow-up window

**Draft — pending go-live permissions audit.** Update the app and connected main database together. Persistence stays OFF. No publishing, TEST secrets/project, Lovable Cloud, or GitHub changes.

## Shared access rule
- Direct chart entry for chart-capable active care-team staff, in-shift site on-call clinicians, formally dated covering clinicians, and the assigned associate/trainee’s clinical supervisor. Clinical coordinator and sys_admin retain oversight entry.
- A group relationship grants the existing group context only, not full chart entry. A facilitator requesting the full chart follows the ordinary team/reason rule.
- Other chart-capable staff can find minimal patient identifiers and open through a reason valid until end of day. Roles without chart access remain denied, including Intake’s full-chart access.
- Record-class permissions and Part 2 consent remain independent gates. Preserve the existing stricter restricted-record open and search restrictions.
- Replace the old mandatory enrolled-site rule in both authorities; an active care-team relationship can authorize direct entry across sites. This request supersedes the existing architecture statement and old current-contract assertions, not the record-class matrix.

## One gate before chart content
- Use one shared gate for record and print routes, reached by search, pickers, Today, inbox, bell, and deep links, preserving the requested section.
- Render only name, age/DOB, and site until authorized. Do not mount chart sections, compute clinical summaries, log chart views, build exports, or load chart content behind the gate.
- Present the five specified reasons, require a note for Other, and offer Open chart, Cancel, and Ask to be added to the care team.
- Show reason-required search rows with a lock and “Reason needed”; remove clinical details, flags, and status chips from those rows.
- After opening, keep the non-dismissible reason/end-of-day banner. Expiry returns the person to the gate, including print/PDF paths.

## Audited actions and review
- Registry actions and store checks share eligibility for reason grants, care-team requests, and coordinator-created coverage assignments.
- Persist reason grants through a dedicated database function with one audit row and no direct staff table writes. The preview uses the same rules without enabling persistence transport.
- Record only identifiers, reason codes, and timestamps in access/audit events; never the Other note or clinical text. Validate the note without copying it into logs.
- Add reasoned opens to the patient-level access log and clinical coordinator’s weekly review, scoped to the acting role rather than held-role unions.
- Crisis/safety is an immediate chart-entry reason, not a Part 2 unlock. Document the separate medical-emergency counsel question; do not build that path.

## Intake’s read-only follow-up
- Keep Intake in its existing workspace. Packet documents and the administrative intake checklist remain readable for 60 days after completed handoff, without editing, clinical-chart access, or broader SDOH access.
- Log each actual packet/checklist open, not render-time polling. Preserve restricted-record and standard Part 2 intake/treatment consent checks.
- Deny the follow-up read on day 61. Existing completion timestamps remain the source; do not add an independent lifecycle store.

## Database proof and policy opening
1. Inventory the live helper definitions and policies, then submit the access foundation migration through the migration approval tool. Keep candidate chart/packet/handoff read policies closed during this step.
2. Use fictional fixtures inside rolled-back main-project transactions, local authenticated/anon roles, and actual request.jwt.claims. Never override the authentication/context helpers.
3. Mirror all 18 staff roles plus unchanged patient/advocate cases: team/off-team, grant/reason/expiry, role-switch no union, on-call dates/site, coverage dates, supervisee scope, group-context-only, restricted records, Part 2 consent/revocation, and Intake day 60/day 61 with write denial.
4. Compare before/after counts for every application table and auth.users, including any new access tables. Retain no fixtures, accounts, grants, or candidate policies.
5. Open each chart, packet, and handoff read-policy group in its own migration only after its positive and negative app/SQL proofs pass. List exact policy names and proving cases; leave all failing or unproved policies closed.

## Validation and deliverables
- Focused mirrored access tests for search, chart/deep links, print/PDF, role-safe buttons/stores, grant expiry, and Intake packet opens.
- Full unit suite to exit, then full public browser suite with one worker on :8080, never overlapping.
- Staff UI readback: locked search → shared gate → one reason audit → chart/banner/access log; deep-link and print agreement; Intake follow-up and coordinator review. Check desktop and 390px.
- Write docs/rls-evidence/access-rules-rollback.md and docs/access-rules-report.md; update the Phase 2 report, roadmap, architecture rules, and Draft permission matrix.

## Technical details and assumptions
- Keep chartAccess.ts / chartEntryFor / searchablePatientsFor and navGuard as the central entry boundary; use an explicit gate-needed result rather than a denied redirect or a blank chart.
- Reuse the existing care-team, on-call, supervision, group, completion, access-log, registry, and calendar authorities. Add formal coverage and reason-grant records only where missing; no parallel stores for existing relationships.
- Database app.chart_entry and related read helpers must use the same entry reasons and time boundaries as the app. Minimal search identification must not expose full patient rows through a broad read policy.
- **Time assumption:** end-of-day grants use the patient’s site timezone; the 60-day window uses the same site calendar, with a strict expiry boundary. Keep each duration in one Draft setting and include boundary tests.
- Server-side functions follow the authenticated TanStack pattern; authenticated database readers use the caller’s context, never an admin read bypass. Full repositories/write transport/storage/signup parity and persistence switches remain Phase 2d work.
- If an unrelated standing-rule conflict or unchanged assertion blocks the requested scope, stop at a documented clean boundary rather than weakening a privacy gate.
