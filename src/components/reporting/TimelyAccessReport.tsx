// §Batch B1 — per-person days-to-first-offered / days-to-first-kept, with
// period medians. Medians are withheld below the small-cohort minimum (11).
import { useState } from "react";
import { useEhr } from "@/lib/ehr";
import { TIMELY_TARGETS_DRAFT, timelyAccessReport } from "@/lib/timelyAccess";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PERIODS = [{ id: 30, label: "30 days" }, { id: 90, label: "90 days" }, { id: 0, label: "All time" }] as const;

export function TimelyAccessReport() {
  const [period, setPeriod] = useState<number>(90);
  const rep = useEhr(() => timelyAccessReport({ sinceDays: period || undefined }));
  const [showAll, setShowAll] = useState(false);
  const med = (v?: number) => (rep.guard.belowMinimumCohort ? "Hidden" : v === undefined ? "—" : `${v}d`);
  return (
    <Card className="p-4 space-y-3" data-testid="timely-access-report">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-navy">Timely access</h2>
          <p className="text-xs text-muted-foreground">Days from service request to first appointment offered and first kept. {TIMELY_TARGETS_DRAFT.label}.</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button key={p.id} size="sm" variant={period === p.id ? "default" : "outline"} onClick={() => setPeriod(p.id)}>{p.label}</Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">People with a request</p><p className="text-xl font-semibold">{rep.rows.length}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Median days to first offered</p><p className="text-xl font-semibold">{med(rep.medianDaysToOffered)}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Median days to first kept</p><p className="text-xl font-semibold">{med(rep.medianDaysToKept)}</p></div>
      </div>
      {rep.guard.belowMinimumCohort && (
        <p className="text-xs text-muted-foreground"><Badge variant="secondary" className="mr-1">Small group</Badge>Fewer than {rep.guard.minimumCohortSize} people in this period, so medians are hidden.</p>
      )}
      {rep.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Person</th><th>Requested</th><th>To offered</th><th>To kept</th></tr></thead>
            <tbody>
              {(showAll ? rep.rows : rep.rows.slice(0, 8)).map((r) => (
                <tr key={r.key} className="border-t"><td className="py-1.5">{r.name}</td><td>{new Date(r.requestAt).toLocaleDateString()}</td><td>{r.daysToOffered === undefined ? "—" : `${r.daysToOffered}d`}</td><td>{r.daysToKept === undefined ? "—" : `${r.daysToKept}d`}</td></tr>
              ))}
            </tbody>
          </table>
          {rep.rows.length > 8 && <Button size="sm" variant="link" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${rep.rows.length}`}</Button>}
        </div>
      )}
    </Card>
  );
}
