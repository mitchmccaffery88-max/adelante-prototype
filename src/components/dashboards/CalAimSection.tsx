// §Population health Phase 2 — CalAIM eligibility tiles.
//
// Three tiles: configured qualifying codes, the eligible caseload, and
// releases in the trailing 24h. Zero configured codes renders an explicit
// "not configured yet" state rather than a 0, which would read as a measured
// result instead of missing configuration.
// §9a-2 — StatTile presentation; patient counts below 11 show "<11". The
// time-sensitive handoff cue is a gold "Your turn" status chip (word + icon).
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusChip } from "@/components/ui/status-chip";

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
  const notConfigured = <p className="mt-1 text-sm text-muted-foreground">Not yet configured.</p>;
  return (
    <section className="space-y-3" aria-labelledby="calaim-heading">
      <div>
        <h2 id="calaim-heading" className="font-display text-lg text-foreground">
          CalAIM eligibility
        </h2>
        <p className="text-sm text-muted-foreground">
          Eligibility visibility only — derived live from active problems and custody releases.
          No claims are generated from this view.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div data-tile="calaim-codes" className="min-w-0">
          <StatTile
            label="Qualifying codes configured"
            value={configured ? codeCount : null}
            nonPatient
            noDetail={
              canManage ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/billing-calaim-codes">
                    {configured ? "Qualifying codes" : "Qualifying codes (managed by billing)"}
                  </Link>
                </Button>
              ) : undefined
            }
          >
            {!configured && (
              <p className="mt-1 text-sm text-muted-foreground">
                No qualifying codes configured yet — eligibility can&apos;t be computed.
              </p>
            )}
          </StatTile>
        </div>

        <div data-tile="calaim-caseload" className="min-w-0">
          <StatTile
            label="CalAIM caseload"
            value={configured ? caseloadCount : null}
            basis="Patients with an active qualifying diagnosis."
            onDrillDown={configured ? onOpenCaseload : undefined}
          >
            {!configured && notConfigured}
          </StatTile>
        </div>

        <div data-tile="calaim-discharges" className="min-w-0">
          <StatTile
            label="Eligible discharges (24h)"
            value={configured ? dischargeCount : null}
            basis="Released in the last 24 hours with a qualifying condition, current or historical."
            onDrillDown={configured ? onOpenDischarges : undefined}
          >
            {!configured && notConfigured}
            {configured && dischargeCount > 0 && (
              <StatusChip state="yourturn" label="Time-sensitive handoff" className="mt-2" />
            )}
          </StatTile>
        </div>
      </div>
    </section>
  );
}
