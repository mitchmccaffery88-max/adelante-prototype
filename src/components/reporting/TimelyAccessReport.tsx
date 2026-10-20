// §Batch B1 — per-person days-to-first-offered / days-to-first-kept, with
// period medians. Medians are withheld below the small-cohort minimum (11).
// §9a-2 — StatTile presentation. Below 11 the person count is "<11" too and the
// per-person list is not shown. Names appear only when the viewer could open
// that chart; otherwise the program ID (referrals without a chart show none).
import { useState } from "react";
import { useEhr } from "@/lib/ehr";
import { TIMELY_TARGETS_DRAFT, timelyAccessReport } from "@/lib/timelyAccess";
import { useActingStaff } from "@/lib/roles";
import { staffPatientLabel } from "@/lib/staffPatientLabel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";

const PERIODS = [{ id: 30, label: "30 days" }, { id: 90, label: "90 days" }, { id: 0, label: "All time" }] as const;

export function TimelyAccessReport() {
  const [period, setPeriod] = useState<number>(90);
  const rep = useEhr(() => timelyAccessReport({ sinceDays: period || undefined }));
  const staff = useActingStaff();
  const viewer = { role: staff.role, staffId: staff.staffId };
  const [showAll, setShowAll] = useState(false);
  const small = rep.guard.belowMinimumCohort;
  const label = (key: string) => (key.startsWith("r:") ? "Referral (no chart yet)" : staffPatientLabel(viewer, key));
  return (
    <Card className="p-4 space-y-3" data-testid="timely-access-report">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-foreground">Timely access</h2>
          <p className="text-sm text-muted-foreground">Days from service request to first appointment offered and first kept. {TIMELY_TARGETS_DRAFT.label}.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <Button key={p.id} size="sm" variant={period === p.id ? "default" : "outline"} onClick={() => setPeriod(p.id)}>{p.label}</Button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="People with a request" value={rep.rows.length} numberTestId="timely-count" />
        <StatTile label="Median days to first offered" value={rep.medianDaysToOffered ?? null} formattedValue={rep.medianDaysToOffered === undefined ? undefined : `${rep.medianDaysToOffered}d`} cohortSize={rep.guard.cohortSize} />
        <StatTile label="Median days to first kept" value={rep.medianDaysToKept ?? null} formattedValue={rep.medianDaysToKept === undefined ? undefined : `${rep.medianDaysToKept}d`} cohortSize={rep.guard.cohortSize} />
      </div>
      {small && rep.rows.length > 0 && (
        <p className="text-sm text-muted-foreground">Fewer than {rep.guard.minimumCohortSize} people in this period, so counts, medians and the list are hidden.</p>
      )}
      {!small && rep.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-sm text-muted-foreground"><th className="py-1">Person</th><th>Requested</th><th>To offered</th><th>To kept</th></tr></thead>
            <tbody>
              {(showAll ? rep.rows : rep.rows.slice(0, 8)).map((r) => (
                <tr key={r.key} className="border-t"><td className="py-1.5">{label(r.key)}</td><td>{new Date(r.requestAt).toLocaleDateString()}</td><td>{r.daysToOffered === undefined ? "—" : `${r.daysToOffered}d`}</td><td>{r.daysToKept === undefined ? "—" : `${r.daysToKept}d`}</td></tr>
              ))}
            </tbody>
          </table>
          {rep.rows.length > 8 && <Button size="sm" variant="link" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${rep.rows.length}`}</Button>}
        </div>
      )}
    </Card>
  );
}
