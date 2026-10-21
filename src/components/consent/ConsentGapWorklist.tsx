// §B2-3 — staff "Missing or expiring consents" views (read-only). Per-patient
// panel for the chart Consents section, plus the all-patient worklist on the
// consent ledger screen for roles with chart entry. Patient labels follow
// staffPatientLabel (program ID without chart access); aggregated counts
// carry the shared cohort guard (11). Draft — pending clinical sign-off.
import { Link } from "@tanstack/react-router";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { roleHasChartEntry } from "@/lib/chartAccess";
import {
  EXPIRING_WITHIN_DAYS,
  REQUIRED_CONSENTS_DRAFT_LABEL,
  consentGapCounts,
  consentGapFor,
  consentGapWorklist,
  type ConsentGapState,
} from "@/lib/consentLifecycle";
import { CONSENT_TYPE_LABEL } from "@/lib/consentCapture";
import { StatusChip } from "@/components/ui/status-chip";

const STATE_CHIP: Record<Exclude<ConsentGapState, "ok">, { state: "yourturn" | "upnext"; word: string }> = {
  missing: { state: "yourturn", word: "Missing" },
  expired: { state: "yourturn", word: "Expired" },
  expiring: { state: "upnext", word: "Expiring soon" },
};

/** Per-patient gap list for the chart's Consents area. */
export function ConsentGapsPanel({ patientId }: { patientId: string }) {
  const gaps = JSON.parse(useEhr(() => JSON.stringify(consentGapFor(patientId)))) as ReturnType<typeof consentGapFor>;
  const open = gaps.filter((g) => g.state !== "ok");
  return (
    <section className="rounded-md border border-border p-3" data-testid="consent-gaps-panel">
      <h3 className="text-sm font-semibold">Missing or expiring consents</h3>
      <p className="text-[14px] text-muted-foreground">{REQUIRED_CONSENTS_DRAFT_LABEL}</p>
      {open.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted-foreground">Every required consent is on file and in date.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-[14px]">
          {open.map((g) => (
            <li key={g.consentType} className="flex flex-wrap items-center gap-2" data-testid={`consent-gap-${g.consentType}`}>
              <StatusChip lang="en" state={STATE_CHIP[g.state as Exclude<ConsentGapState, "ok">].state} label={STATE_CHIP[g.state as Exclude<ConsentGapState, "ok">].word} />
              <span>{CONSENT_TYPE_LABEL[g.consentType].en}</span>
              {g.expirationDate && <span className="text-muted-foreground">· ends {g.expirationDate}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** All-patient worklist on the consent ledger screen (chart-entry roles only). */
export function ConsentGapWorklist() {
  const acting = useActingStaff();
  const rows = JSON.parse(
    useEhr(() => JSON.stringify(roleHasChartEntry(acting.role) ? consentGapWorklist({ role: acting.role, ...(acting.staffId ? { staffId: acting.staffId } : {}) }) : [])),
  ) as ReturnType<typeof consentGapWorklist>;
  if (!roleHasChartEntry(acting.role)) return null;
  const counts = consentGapCounts(rows);
  const countText = (c: { count: number; guard: { belowMinimumCohort: boolean } }) => (c.guard.belowMinimumCohort ? "<11" : String(c.count));
  return (
    <section className="rounded-xl border bg-card p-4" data-testid="consent-gap-worklist">
      <h2 className="font-display text-lg text-navy">Missing or expiring consents</h2>
      <p className="text-xs text-muted-foreground">
        {REQUIRED_CONSENTS_DRAFT_LABEL} · expiring means within {EXPIRING_WITHIN_DAYS} days · read-only — use the chart's Consents section to record or send.
      </p>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="consent-gap-counts">
        Missing {countText(counts.missing)} · Expired {countText(counts.expired)} · Expiring {countText(counts.expiring)}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing missing or expiring.</p>
      ) : (
        <ul className="mt-2 divide-y text-sm">
          {rows.map((r, i) => (
            <li key={`${r.patientId}-${r.consentType}-${i}`} className="flex flex-wrap items-center gap-2 py-2" data-testid="consent-gap-row">
              <span className="font-medium" data-testid="consent-gap-label">{r.label}</span>
              <span>{CONSENT_TYPE_LABEL[r.consentType].en}</span>
              <StatusChip lang="en" state={STATE_CHIP[r.state as Exclude<ConsentGapState, "ok">].state} label={STATE_CHIP[r.state as Exclude<ConsentGapState, "ok">].word} />
              {r.expirationDate && <span className="text-muted-foreground">ends {r.expirationDate}</span>}
              <Link to="/record/$patientId" params={{ patientId: r.patientId }} search={{ section: "consents" } as never} className="text-xs text-teal hover:underline">
                Open consents
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
