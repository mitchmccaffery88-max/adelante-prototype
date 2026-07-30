// §Admin — how often catalog selections needed a fallback path.
// Reads the audit trail (catalog_strength_resolution + order_strength_provenance)
// so the numbers are the same source of truth reviewers see event-by-event.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FlaskConical, PencilLine } from "lucide-react";
import { ClientDate } from "@/components/ClientDate";

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function CatalogResolutionMetricsCard() {
  const m = useEhr(() => AdelanteEHR.catalogResolutionMetrics());

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-navy flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-teal" /> Dose resolution fallbacks
          </h2>
          <p className="text-xs text-muted-foreground">
            How often catalog selections needed DailyMed, and how often a clinician had to enter a
            dose by hand.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {m.selections} selections
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric
          label="DailyMed fallback used"
          value={m.dailymedAttempted}
          share={pct(m.dailymedAttempted, m.selections)}
          hint={`${m.dailymedResolved} resolved · ${m.dailymedEmpty} came back empty`}
        />
        <Metric
          label="Manual dose justifications"
          value={m.manualDoseOrders}
          share={pct(m.manualDoseOrders, m.signedOrders)}
          hint={`of ${m.signedOrders} signed orders with recorded provenance`}
          destructive
        />
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <Badge variant="secondary">RxNav only: {m.rxnav}</Badge>
        <Badge variant="secondary">Units axis: {m.unitsParsed}</Badge>
        <Badge variant="secondary">Topical: {m.topical}</Badge>
        <Badge variant="secondary">DailyMed resolved: {m.dailymedResolved}</Badge>
        <Badge variant="secondary">DailyMed empty: {m.dailymedEmpty}</Badge>
      </div>

      {m.recentManualJustifications.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-navy flex items-center gap-1.5">
            <PencilLine className="h-3 w-3" /> Recent manual-dose justifications
          </p>
          <ul className="space-y-1">
            {m.recentManualJustifications.map((j, i) => (
              <li key={i} className="rounded-md bg-muted/50 p-2 text-[11px]">
                <span className="font-medium">{j.drugName}</span>{" "}
                <span className="text-muted-foreground">
                  · <ClientDate value={j.at} />
                </span>
                <div className="text-muted-foreground">{j.justification}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.selections === 0 && m.signedOrders === 0 && (
        <p className="text-xs text-muted-foreground">
          No catalog selections recorded yet in this session.
        </p>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  share,
  hint,
  destructive,
}: {
  label: string;
  value: number;
  share: number;
  hint: string;
  destructive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={`font-display text-xl ${destructive && value > 0 ? "text-destructive" : "text-navy"}`}
        >
          {value}
        </span>
      </div>
      <Progress value={share} className="mt-2 h-1.5" />
      <p className="mt-1 text-[10px] text-muted-foreground">
        {share}% · {hint}
      </p>
    </div>
  );
}
