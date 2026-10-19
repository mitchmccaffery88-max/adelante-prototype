# Phase 9 audit and proposed scope: 9a (stat tiles) and 9c (role dashboards and page-overflow fixes)

This audit only reads the code. HEAD is 80a9f640. It changes no access, Part 2 rule or data visibility. Denied claims stay as they are (9d is on hold).

## 1. Dashboard and home pages, by role (current access, no changes)

| Route | Roles allowed today | Gate |
|---|---|---|
| /admin, /admin-kpi-targets | sys_admin, clinical_coordinator | population_health:write (navSections.ts:198-244; roles.ts:213-242) |
| /dashboards, /reporting | sys_admin, clinical_coordinator, billing, billing_coordinator, pmhnp, physician, therapist, ecm_provider | population_health OR billing (navSections.ts:834-842) |
| /billing | billing, billing_coordinator, sys_admin (sys_admin read-only) | roles.ts:311-324 |
| /quality-compliance | sys_admin, credentialing_coordinator | complianceRoles.ts:4 |
| /clinician | therapist, pmhnp, physician, sud_counselor, clinical_trainee, ecm_provider, peer_specialist, clinical_coordinator, sys_admin | therapy readers + coordinationRoles.ts:5-13 |
| /case-manager | ecm_provider, cf_care_manager, sud_counselor, clinical_trainee, peer_specialist, community_health_worker, therapist, pmhnp, physician | case/peer note readers |
| /my-work | therapy_notes, worklist or crisis_queue holders; rows scoped to the person | navSections.ts |
| /caseload-review | ecm_provider, cf_care_manager (coordinator/admin roll-up) | caseloadRoles.ts:3-7 |
| /county-reporting | sys_admin, billing, billing_coordinator, credentialing_coordinator, clinical_coordinator | countyReporting.ts:37-40 |
| /dmc-ods-readiness | sud_counselor, therapist, pmhnp, physician, billing_coordinator (SUD reporting) | sudReportingAccess.ts:14-20 |
| /admin-coordination | clinical_coordinator, sys_admin (act); therapist, pmhnp, physician, ecm_provider (view) | coordinationRoles.ts |

There is no separate program-lead route. Program leads use /admin, /reporting and coordination. The guard redirects in the browser (RouteAccessGuard.tsx:19-25). /home is a patient page and is out of scope.

## 2. Stat tile inventory (summary)

The data comes from in-memory store calculations unless a row says otherwise. Only county DATAR capacity is labelled "Simulated".

| Surface | Tiles | Source | Colors today | Target / comparison / status | Drill-down | Cohort 11 |
|---|---|---|---|---|---|---|
| /admin (admin.tsx:95-115, 218-260) | Enrolled patients, Session completion, Intake velocity, Active referrals, Medi-Cal verified, ECM caseload | stats(), intakeVelocityMedian(), listReferrals(), coverage | navy values, teal/gold accents | none | none | only Intake velocity |
| /admin group activity | Active groups, Patients enrolled, Scheduled seats (7d) | group selectors | text-navy, teal | none | groups link | no |
| /admin Today (OpsWorkspace.tsx:19-128) | Matching queue, Blocked actions 24h, Failed notifications, Flags changed 7d | adminToday() | neutral | none | links | n/a (operations) |
| KpiVsTargetSection.tsx:33-148 | One row per target | computeLiveMetrics + listKpiTargets | emerald/amber/red-100 badges | target, delta, "Meeting/Just off/Off target", "No live metric yet" | 4 metrics | no |
| CalAimSection.tsx:45-105 | Codes configured, CalAIM caseload, Eligible discharges 24h | listQualifyingCodes, calaimEligible* | navy, teal hover, amber border/badge | none | dialogs | no |
| GroupUtilizationSection.tsx:106-195 | Active groups, Enrolled, Attendance rate, Open engagement | group selectors | navy/teal | none | attendance details | no |
| EngagementSection.tsx:58-187 | Active N days, Ever engaged, Completions/patient, Median days; track table; self-tracking (cravings, lapses, recovery date) | engagementProjection | navy/teal, amber warning | none | none | warning only |
| FacilityCustodySection.tsx:28-79 | Booking, Booked, Housing moves, Shift counts | facility selectors | navy | none | none | no (hidden behind the in-facility flag) |
| /billing (billing.tsx:115-125, 270-296) | Outstanding, Paid, Denied, Drafts/write-offs | claim kpis | default/navy/teal/destructive | none | none | n/a |
| BillingStatusSummary.tsx:11-57 | Draft…Partial | claimBucketCounts | muted/accent/teal/success/destructive/gold | word, no icon | filters | n/a |
| /reporting Stat (reporting.tsx:129-142, 388-1038) | MAR, Group attendance, Unsigned, Tasks; CalAIM; SDOH funnel; referral funnel; request-to-booked; appointment outcomes; ASAM; CalOMS; justice; engagement; claims | computeLiveMetrics, sdohFunnel, referralFunnel, requestToBooked, appointmentOutcomes, asamClinicalReport(role), calomsCompleteness | navy/muted | none inline | section links | only appointment outcomes suppress; request-to-booked warns |
| PopulationHealthSection.tsx:20-147 | Screened, Positive rate, change, C-SSRS mix, HRSN, ASAM mix | populationHealthReport(role) | navy, warning classes | Draft cutoffs | none | warning only |
| TimelyAccessReport.tsx:12-48 | People with a request, Median days to offered/kept | timelyAccessReport | navy | Draft target in the text only | rows | medians only |
| CatalogResolutionMetricsCard.tsx:13-110 | DailyMed fallback, Manual justifications, mix | catalogResolutionMetrics() | navy, teal | none | list | no |
| Clinician strip (WorkspaceDashboard.tsx:58-77), /my-work (258-761), /case-manager (176-276), /caseload-review (221-247) | personal work counts | own rows | mixed | none | yes | n/a (own work, not aggregates) |
| /county-reporting (57-183) | report status, DATAR, BHOATR | county selectors | navy | none | none | yes (nullable cells), capacity Simulated |
| /quality-compliance (83-125) | chart opens, outside-caseload opens, unusual volume | audit events | navy | none | none | n/a (staff metrics) |

## 3. KPI targets

- Type: `KpiTarget` in ehr.ts:1562-1579. Fields: id, metricKey, label, targetValue, unit, effectiveMonth, source, notes, active, createdBy/At, updatedBy/At.
- Seed: ehr.ts:6491-6542 (MAR 95%, unsigned 5, overdue tasks 10, controlled discrepancies 0). Methods: ehr.ts:23478-23570. Editor: admin-kpi-targets.tsx:75-298.
- Metric keys: dashboardMetrics.ts:31-55 (mar_compliance_pct, unsigned_notes_count, overdue_task_count, group_attendance_rate_pct, controlled_count_discrepancies, open_kites_count, four ncchc_*). Targets are set at program level only, never per patient.
- Tiles that could read targets: MAR, Unsigned notes, Overdue tasks, Group attendance (on /reporting and /dashboards). Every other tile has no target and gets no comparison.
- 8–12 week sparkline: possible for MAR compliance (dated administrations, windowed) and group attendance (dated occurrences). Not possible for unsigned notes or overdue tasks, which only hold today's state and have no history snapshots, so they must not be faked. Controlled discrepancies, kites and NCCHC have no source. Billing has dated claim submit/pay dates, but a weekly series needs a new read-only projection; this needs Mitch's decision. Compliance has dated audit events, so weekly chart-open counts are possible.

## 4. Privacy flags (flagged only, no changes in Phase 9 without Mitch)

1. EngagementSection self-tracking (cravings, lapses, recovery date) is shown to every population-health role, including billing, with a warning only and no suppression.
2. The /reporting CalOMS substance-use and prior-treatment cards call their selectors without a role. They are gated by population_health, not by Part 2 access.
3. Clinical coordinators get ASAM/SUD totals as an exception recorded as "Draft pending compliance review" (asamReporting.ts:75-93).
4. Raw cross-patient counts under 11 with no suppression: admin totals, CalAIM, groups, engagement, funnels, PopulationHealth (warning only), the TimelyAccess request count, catalog metrics.
5. Partial suppression: TimelyAccess hides medians but shows the count; request-to-booked warns but still shows counts.

9a adds display-only "<11" suppression for aggregate tiles it converts. It does not apply to personal work counts. This narrows what is shown and never widens it. Flags 1–3 need Mitch and compliance to decide.

## 5. Overflow root causes

- Case manager at 768px: the grid item `Card lg:col-span-2` at case-manager.tsx:279-280 has no `min-w-0`. So the 8-column table, active from sm (387-410, nowrap DOB), widens the page. The table wrapper scrolls, but its parent grid track keeps the table's min-content width. Fix: add `min-w-0` to the grid item and use a `grid-cols-1` track below lg. The 1,104px figure will be measured before the change.
- Billing header: billing.tsx:230-249 is a `flex justify-between` header with the title and three links and no wrap. Fix: stack it on small screens and let the links group wrap.
- Admin filter bar: the filters already wrap (admin.tsx:272-314). The real cause is the same as on the case-manager page: the grid/card at admin.tsx:270-271 has no `min-w-0` and the StaffTable has no scroll wrapper (StaffTable.tsx:56-67). The element that overflows will be confirmed by measurement first.
- Roster mouse lock: StaffTable.tsx:64 renders a modal Radix `DropdownMenu`. Its "Change roles/sites" item (admin-staff.tsx:78) opens a controlled Sheet (admin-staff.tsx:151) in the same tick, so the menu's pointer lock outlives the sheet. Fix: open the sheet after the menu has closed (defer to the next tick) and stop the menu's close from moving focus over the sheet, scoped to StaffTable's More menu. The alternative, `modal={false}`, also works. Never clear the body style by hand.

## 6. Hardcoded chart colors and mapping

| Where | Today | Proposed |
|---|---|---|
| clinical/RecordTabs.tsx:3329 score line | var(--navy) | SINGLE_COLOR |
| RecordTabs.tsx:3490 per-screener line | var(--navy) | SINGLE_COLOR |
| RecordTabs.tsx:3481-3483 timepoint reference | var(--teal) | chartDefaults.axis stroke, label ink-muted (not a target) |
| chart/LabsAndMeasures.tsx:299 BMI | var(--navy) | seriesColorFor("bmi", universe) = slot 1 |
| LabsAndMeasures.tsx:300 Systolic | var(--teal) | slot 2 (stable key order) |
| RecordTabs 3325/3472, Labs 295 grids | hsl(var(--border)) (wrong syntax) | chartDefaults.grid |

ui/chart.tsx:51 `#ccc/#fff` are Recharts override selectors and are left alone.

## 7. Proposed batches

**9a-1 StatTile component and the KPI vs target section (medium)**
- Add a new `ui/stat-tile.tsx`: one number, label, optional "Draft target" line, status through chartStatus (icon + Met/Close/Below target), "No live metric yet", a "<11" suppressed state, an optional sparkline (SINGLE_COLOR + TARGET_COLOR dashed line), and drill-down as a button.
- Convert KpiVsTargetSection: replace the emerald/amber/red badges with chartStatus. Logic, drill-down and testids stay. Status reds only on staff pages; StatTile refuses to render inside member shells.
- Sparklines only for MAR and group attendance, from new read-only weekly projections.

**9a-2 Admin, dashboards and reporting tiles (medium-high)**
- Move /admin, CalAIM, groups, engagement, /reporting Stat, PopulationHealth and TimelyAccess onto StatTile. Neutral tiles show no status. Apply "<11" suppression on aggregate tiles only (this narrows). The amber CalAIM discharge card becomes a gold "Your turn" chip with a word.
- Leave billing tiles alone.

**9a-3 Billing, compliance and county tiles (high for revenue)**
- Billing KPI cards and BillingStatusSummary get icons and tokens. Amounts stay byte-identical and exports are untouched. The denied card and the denied chip keep today's exact look.
- Quality-compliance and county tiles. The Simulated label stays.

**9c-1 Role dashboards and overflow (medium)**
- Fix the case-manager, billing-header and admin grid overflow, the roster lock, and the chart color mapping from section 6.
- Measure scrollWidth to equal the viewport at 390/768/1280 on /case-manager, /billing, /admin, /admin-staff, /dashboards, /reporting, /clinician and /my-work.

**9c-2 Role dashboard layout (medium)**
- Each role's home gets its summary and next action above the fold: clinician, case manager, billing, admin, compliance. Only existing tiles are reordered, with no new data and no access changes.

## Tests (new files only, per batch)

- `src/components/__tests__/statTile9a.test.tsx`: suppression below 11, "No live metric yet" never shows 0, chartStatus word + icon, no status color in member shells.
- `src/lib/__tests__/kpiSparkline9a.test.ts`: weekly projection values from fixed dated fixtures (MAR, attendance). Unsigned notes and tasks return null.
- `src/lib/__tests__/statTileParity9a.test.ts`: every converted tile's number equals the rollback selector output, checked with git-show projections.
- `e2e/statTiles9a{1,2,3}.spec.ts`: number parity in the page, axe, and one role that must not see a tile (billing on /admin, therapist on /billing).
- `e2e/overflow9c.spec.ts`: scrollWidth checks at 390/768/1280 and the roster mouse click works after the sheet closes.
- `e2e/roleDashboards9c.spec.ts`: next action above the fold per role, axe.
- No existing assertions are edited. The contentWiring.spec.ts:47 flake exception stays. The cleanupReschedule tests stay pre-existing.

## Screenshot matrix

Each converted page at 390/768/1280 in light and dark: /admin, /dashboards, /reporting, /billing, /quality-compliance, /county-reporting, /case-manager, /clinician, /my-work, /admin-staff, plus the record chart tabs and labs. The tracked screenshots are restored after each run.

## Validation per batch

Run the unit suite (total next to the pass count), then the full browser suite (--workers=1 on :8080) last. Then the report in docs/phase9{a,c}-N-report.md and a roadmap update. Each batch records its rollback SHA first.

## Decisions needed from Mitch

1. Should privacy flags 1–3 stay recorded only, or be fixed in a separate Group B?
2. Should billing get weekly sparklines (new read-only projection) or no sparkline in 9a-3?
3. Personal work counts (my-work, clinician strip) are exempt from "<11" suppression. Confirm.
