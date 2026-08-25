// §Small UI gaps batch — refill runway + MAT chip.
//
// WHAT IS REAL HERE: every row is a real signed/held `MedOrder` off the
// patient's chart. The runway is computed from two first-class order fields
// (`startDate` + `daysSupply`) by `refillRunway` — there is no dispense/fill
// event stream in this build, so an order missing either field shows no
// runway rather than an invented one. The MAT chip reuses the existing real
// `isMatOrder` check; no new MAT list was introduced.
import { Link } from "@tanstack/react-router";
import { CalendarClock, Pill } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { isMatOrder, refillRunway } from "@/lib/medAdherence";
import { marRowLabel } from "@/lib/mar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TONE: Record<string, string> = {
  ok: "bg-success/20 text-success",
  soon: "bg-gold/30 text-navy",
  out: "bg-destructive/15 text-destructive",
};

export function RefillRunwayCard({ patientId }: { patientId: string }) {
  const orders = useEhr(() =>
    AdelanteEHR.listOrders(patientId).filter(
      (o) => o.status === "signed" || o.status === "held",
    ),
  );
  if (orders.length === 0) return null;

  const rows = orders.map((o) => ({
    order: o,
    runway: refillRunway(o),
    mat: isMatOrder(o),
  }));

  return (
    <Card className="p-5" data-testid="refill-runway-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <CalendarClock className="h-4 w-4" aria-hidden="true" /> How much you have left
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Counted from the day each prescription started and how many days it was written for.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map(({ order, runway, mat }, i) => (
          <li
            key={order.id}
            data-index={i}
            data-testid={`refill-runway-${i}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 font-medium text-navy">
                <Pill className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
                <span className="truncate">{marRowLabel(order)}</span>
                {mat && (
                  <Badge
                    className="border-0 bg-teal/15 text-[10px] text-teal"
                    data-testid={`mat-badge-${i}`}
                  >
                    MAT
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {runway
                  ? `Runs out ${runway.runsOutOn}`
                  : "No days-supply on this prescription yet — ask your care team."}
              </div>
            </div>
            {runway && (
              <Badge className={`${TONE[runway.tone]} shrink-0 border-0 text-[10px]`}>
                {runway.daysLeft <= 0
                  ? "Out of supply"
                  : `${runway.daysLeft} day${runway.daysLeft === 1 ? "" : "s"} left`}
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" size="sm" className="mt-3 min-h-11 rounded-2xl">
        <Link to="/home" hash="care-messages">
          Ask your care team about a refill
        </Link>
      </Button>
    </Card>
  );
}
