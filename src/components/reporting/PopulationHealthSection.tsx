// §Phase 10d-2 — "Population health" section on /reporting.
// Read-only; every number comes from `populationHealthReport` (src/lib/populationHealth.ts).
import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { useEhr } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import {
  TOTALS_ONLY_NOTE,
  POPULATION_CUTOFF_DRAFT_NOTE,
  POPULATION_HEALTH_ASSOCIATION_NOTE,
  populationHealthReport,
  type SliceReport,
} from "@/lib/populationHealth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const RISK_LABEL = { none: "None", low: "Low", moderate: "Moderate", high: "High" } as const;

function GuardNote({ r }: { r: SliceReport }) {
  if (!r.guard.belowMinimumCohort) return null;
  return (
    <p className="rounded-md border border-warning/40 bg-warning/10 p-1.5 text-[11px] text-foreground" data-testid="pop-cohort-caveat">
      Group of {r.guard.cohortSize} is below the {r.guard.minimumCohortSize}-person minimum — counts may identify people.
      Shown for the demo; must be suppressed before real pilot data.
    </p>
  );
}

function SliceBody({ r, compact }: { r: SliceReport; compact?: boolean }) {
  return (
    <div className="space-y-3">
      <GuardNote r={r} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">Screener</th>
              <th className="font-normal">Screened</th>
              <th className="font-normal">Positive (draft cutoff)</th>
              <th className="font-normal">Intake → latest</th>
            </tr>
          </thead>
          <tbody>
            {r.instruments.map((t) => (
              <tr key={t.key} data-testid={`pop-tile-${t.key}`} className="border-t border-border/40 align-top">
                <td className="py-1">
                  {t.name}
                  {t.caveat && <span className="block text-[10px] text-muted-foreground">{t.caveat}</span>}
                </td>
                <td className="text-center">{t.administered}</td>
                <td className="text-center">
                  {t.positive} ({pct(t.positiveRate)})
                  {t.cutoff !== undefined && <span className="block text-[10px] text-muted-foreground">≥ {t.cutoff}, draft</span>}
                </td>
                <td className="text-center">
                  {t.withChange === 0
                    ? "—"
                    : `${t.improved} lower · ${t.unchanged} same · ${t.worsened} higher (mean ${t.meanChange! > 0 ? "+" : ""}${t.meanChange})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`grid gap-3 ${compact ? "" : "md:grid-cols-3"}`}>
        <Card className="space-y-1 p-3" data-testid="pop-tile-cssrs">
          <p className="text-xs font-medium text-navy">C-SSRS latest risk level (draft mapping)</p>
          <p className="text-xs">
            {r.cssrs.latestByRisk.map((x) => `${RISK_LABEL[x.risk]} ${x.count}`).join(" · ")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {r.cssrs.counted} counted; {r.cssrs.excludedPlaceholder} left out (collected on placeholder text).
            {r.cssrs.withChange > 0 && ` Change: ${r.cssrs.lower} lower, ${r.cssrs.unchanged} same, ${r.cssrs.higher} higher.`}
          </p>
        </Card>
        <Card className="space-y-1 p-3" data-testid="pop-tile-social">
          <p className="text-xs font-medium text-navy">Social needs (AHC-HRSN domains)</p>
          {r.social.length === 0 ? (
            <p className="text-xs text-muted-foreground">No AHC-HRSN screens on file.</p>
          ) : (
            <ul className="space-y-0.5 text-xs">
              {r.social.map((d) => (
                <li key={d.key}>
                  {d.label}: {d.positive} of {d.screened}
                  {d.staffOnly && <span className="ml-1 text-[10px] text-muted-foreground">(staff-only)</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {r.levels && (
          <Card className="space-y-1 p-3" data-testid="pop-tile-levels">
            <p className="text-xs font-medium text-navy">Level-of-care mix (signed, current version)</p>
            {r.levels.length === 0 ? (
              <p className="text-xs text-muted-foreground">No signed ASAM level.</p>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {r.levels.map((l) => (
                  <li key={l.level}>{l.level}: {l.count}</li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-muted-foreground">Level list is a draft — pending clinical sign-off.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

export function PopulationHealthSection({ role }: { role: StaffRole }) {
  const report = useEhr(() => populationHealthReport(role));
  const [sliceIdx, setSliceIdx] = useState(0);
  if (!report) return null;
  const slice = report.slices[sliceIdx]!;
  return (
    <section className="space-y-3" aria-labelledby="population-health-heading" data-area="population-health" data-testid="reporting-population-health">
      <div>
        <h2 id="population-health-heading" className="flex items-center gap-2 font-display text-lg text-navy">
          <HeartPulse className="h-4 w-4 text-teal" aria-hidden /> Population health
        </h2>
        <p className="max-w-2xl text-xs text-muted-foreground">
          Screener positivity and change, C-SSRS risk levels, social needs and level-of-care mix, overall and by group.
        </p>
      </div>
      <Card className="space-y-1 p-3">
        <Badge variant="outline" className="text-[10px]">Draft values</Badge>
        <p className="text-xs text-muted-foreground">
          {POPULATION_CUTOFF_DRAFT_NOTE} C-SSRS risk mapping: draft — pending clinical sign-off. Retired PCL-5 short-form
          results are not counted. {POPULATION_HEALTH_ASSOCIATION_NOTE}
        </p>
        {report.sudMode === "totals" && (
          <p className="text-[11px] text-muted-foreground" data-testid="pop-totals-only">
            <Badge variant="outline" className="mr-1 text-[10px]">Totals only</Badge>
            {TOTALS_ONLY_NOTE}
          </p>
        )}
        {report.sudMode === null && (
          <p className="text-[11px] text-muted-foreground" data-testid="pop-no-sud">
            Substance-use figures (AUDIT, DAST-10, level of care) are protected under 42 CFR Part 2 and are not shown for your role.
          </p>
        )}
      </Card>
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-medium text-navy">Everyone</h3>
        <SliceBody r={report.overall} />
      </Card>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Group by">
          {report.slices.map((s, i) => (
            <button
              key={s.kind}
              role="tab"
              aria-selected={i === sliceIdx}
              onClick={() => setSliceIdx(i)}
              className={`rounded-full border px-3 py-1 text-xs ${i === sliceIdx ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"}`}
            >
              {s.title}
            </button>
          ))}
        </div>
        {slice.note && <p className="text-[11px] text-muted-foreground">{slice.note}</p>}
        <div className="space-y-4">
          {slice.groups.map((g) => (
            <div key={g.key} className="space-y-2 border-t border-border/50 pt-3" data-testid={`pop-group-${slice.kind}-${g.key}`}>
              <p className="text-sm font-medium text-navy">
                {g.label} <span className="text-xs font-normal text-muted-foreground">({g.report.guard.cohortSize})</span>
              </p>
              <SliceBody r={g.report} compact />
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
