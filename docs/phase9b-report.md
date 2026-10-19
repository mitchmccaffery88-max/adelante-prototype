# Phase 9b — Chart foundation and palette (Oct 19)

Rollback SHA: `cc3f142b678ebb400428fbb50d6013d710fa95cd` (HEAD at start `dcbb6191`, which differs only in roadmap/AGENTS docs).
No permissions, roles, Part 2 rules or visible data changed. Not published. Dashboards and stat tiles not restyled (9a/9c).

## Pre-edit inventory (every chart / recharts usage)
| File:line (rollback) | Chart | Colors before |
|---|---|---|
| src/components/clinical/RecordTabs.tsx:3322 | Tracking timeline score trend (LineChart) | line `var(--navy)`, grid `hsl(var(--border))` |
| src/components/clinical/RecordTabs.tsx:3467 | Per-screener score trend (LineChart + ReferenceLine timepoints) | line `var(--navy)`, timepoints `var(--teal)`, grid `hsl(var(--border))` |
| src/components/chart/LabsAndMeasures.tsx:292 | BMI + systolic (LineChart, 2 series) | `var(--navy)`, `var(--teal)` |
| src/components/ui/chart.tsx | shadcn ChartContainer wrapper | no callers in the app |

## var(--chart-N) consumers, before vs after
| Consumer | Before | After |
|---|---|---|
| `--color-chart-1..5` in `@theme inline` (Tailwind `*-chart-N` utilities) | path / info / sunrise-mark / ink-subtle / ink-subtle | Blue / Orange / Green / Yellow / Pink (exact hex, light+dark) |
| Any component class or style using chart-N | none found (`rg` over src) | none |

No existing chart read `var(--chart-*)`, so no chart changed color. The three charts above keep their colors; they were only wrapped for "View as table". (`--chart-sticky-offset` in ChartTabView is an unrelated layout variable.)

## Added
- `src/styles.css`: all approved tokens light + dark (series 1–8, single, other, target, grid, axis, status good/warning/serious/critical, seq-1..7, div-mid) with Tailwind mappings.
- `src/lib/chartTheme.ts`: `seriesColorFor/seriesColors` (color by stable entity key from the full unfiltered list; slots 1–8 then Other), `chartStatus` (always icon + word; Met / Close / Below target / Critical; staff/admin only), `chartDefaults` (2px lines, end-point dot, 4px rounded bar ends, 2px gaps, faint grid, one y-axis, ink-token tooltip/axis text, legend for 2+ series, direct labels ≤4), "Draft target" label, sequential and diverging scales.
- `src/components/ui/chart-frame.tsx`: `ChartFrame` with "View as table" toggle; wraps all three existing charts using the rows each chart already receives.

## Tests (new files only)
- `src/lib/__tests__/chartTheme9b.test.tsx` (12): tokens light/dark, stable entity colors + Other, status icon+word, defaults, table toggle present on every LineChart.
- `e2e/chartFoundation9b.spec.ts` (2): tracking and labs charts toggle to a populated table, axe clean, light/dark captures.
- Evidence: `docs/phase9b-evidence/*.png`.

## Validation
- Units: 2,735 / 2,735 passed (339 files). `cleanupReschedule.test.ts` passed 6/6 on both rollback and current today (clock moved past the Oct 20 clash window); no edits.
- Full browser suite: 179 / 179 passed (29.3m, --workers=1, :8080, exit 0), run last after the final source change. Tracked screenshots unchanged vs rollback.
