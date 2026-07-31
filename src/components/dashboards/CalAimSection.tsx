// §Population health Phase 2 — CalAIM eligibility tiles.
//
// Three tiles: configured qualifying codes, the eligible caseload, and
// releases in the trailing 24h. Zero configured codes renders an explicit
// "not configured yet" state rather than a 0, which would read as a measured
// result instead of missing configuration.
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, DoorOpen, ListChecks } from "lucide-react";

interface Props {
  codeCount: number;
  caseloadCount: number;
  dischargeCount: number;
  canManage: boolean;
  onOpenCaseload: () => void;
  onOpenDischarges: () => void;
}

export function CalAimSection({
  codeCount,
  caseloadCount,
  dischargeCount,
  canManage,
  onOpenCaseload,
  onOpenDischarges,
}: Props) {
  const configured = codeCount > 0;
  return (
    <section className="space-y-3" aria-labelledby="calaim-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="calaim-heading" className="font-display text-lg text-navy">
            CalAIM eligibility
          </h2>
          <p className="text-xs text-muted-foreground">
            Eligibility visibility only — derived live from active problems and custody releases.
            No claims are generated from this view.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4" data-tile="calaim-codes">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ListChecks className="h-4 w-4" /> Qualifying codes configured
          </div>
          {configured ? (
            <p className="mt-2 font-display text-3xl text-navy">{codeCount}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No qualifying codes configured yet — eligibility can&apos;t be computed.
            </p>
          )}
          {canManage && (
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link to="/admin-kpi-targets" hash="calaim-codes">
                {configured ? "Manage codes" : "Configure codes"}
              </Link>
            </Button>
          )}
        </Card>

        <Card
          className={`p-4 ${configured ? "cursor-pointer hover:border-teal" : ""}`}
          data-tile="calaim-caseload"
          onClick={configured ? onOpenCaseload : undefined}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClipboardList className="h-4 w-4" /> CalAIM caseload
          </div>
          {configured ? (
            <>
              <p className="mt-2 font-display text-3xl text-navy">{caseloadCount}</p>
              <p className="text-xs text-muted-foreground">
                Patients with an active qualifying diagnosis. Click to see the records.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not yet configured.</p>
          )}
        </Card>

        <Card
          className={`border-amber-400/60 bg-amber-50/50 p-4 ${
            configured ? "cursor-pointer hover:border-amber-500" : ""
          }`}
          data-tile="calaim-discharges"
          onClick={configured ? onOpenDischarges : undefined}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DoorOpen className="h-4 w-4" /> Eligible discharges (24h)
          </div>
          {configured ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <p className="font-display text-3xl text-navy">{dischargeCount}</p>
                {dischargeCount > 0 && (
                  <Badge className="bg-amber-500 text-white">Time-sensitive handoff</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Released in the last 24 hours with a qualifying condition, current or historical.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not yet configured.</p>
          )}
        </Card>
      </div>
    </section>
  );
}
