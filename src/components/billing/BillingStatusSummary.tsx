// §Phase 7a follow-up — one billing-status summary shared by the pilot
// dashboard card (/admin) and the top of the Billing page (/billing), so the
// two can't drift on which statuses they show, how they're counted, or the
// honesty note. Counts appointment billing status only — the same rows the
// Billing page lists (anything past "scheduled").
import { Link } from "@tanstack/react-router";
import type { Appointment, BillingStatus } from "@/lib/ehr";
import { Badge } from "@/components/ui/badge";

export const BILLING_STATUS_ROWS: { status: BillingStatus; label: string; cls: string }[] = [
  { status: "draft", label: "Draft", cls: "bg-muted text-muted-foreground" },
  { status: "ready", label: "Ready", cls: "bg-accent text-accent-foreground" },
  { status: "submitted", label: "Submitted", cls: "bg-teal/15 text-teal" },
  { status: "paid", label: "Paid", cls: "bg-success/20 text-success" },
  { status: "denied", label: "Denied", cls: "bg-destructive/15 text-destructive" },
  { status: "write_off", label: "Write-off", cls: "bg-muted text-muted-foreground" },
];

export const BILLING_STATUS_NOTE =
  "Counts appointment billing status (the Billing page). Claim records on the Claims worklist are counted separately until the two billing models are unified.";

/** Appointments that appear on the Billing page — everything past "scheduled". */
export function billableAppointments(appts: Appointment[]): Appointment[] {
  return appts.filter((a) => a.status !== "scheduled");
}

export function billingStatusCounts(appts: Appointment[]): Record<BillingStatus, number> {
  const out: Record<BillingStatus, number> = {
    draft: 0,
    ready: 0,
    submitted: 0,
    paid: 0,
    denied: 0,
    write_off: 0,
  };
  for (const a of billableAppointments(appts)) out[a.billingStatus] += 1;
  return out;
}

type Mode =
  | { kind: "plain" }
  | { kind: "link" }
  | { kind: "filter"; active: "all" | BillingStatus; onSelect: (s: "all" | BillingStatus) => void };

/** Vertical list (dashboard card). */
export function BillingStatusList({
  counts,
  mode,
}: {
  counts: Record<BillingStatus, number>;
  mode: Mode;
}) {
  return (
    <ul className="space-y-2 text-sm" data-testid="billing-status-card">
      {BILLING_STATUS_ROWS.map(({ status, label, cls }) => (
        <li key={status} className="flex items-center justify-between border-b last:border-0 py-2">
          {mode.kind === "link" ? (
            <Link
              to="/billing"
              search={{ status }}
              className="underline-offset-2 hover:underline"
              data-billing-status-link={status}
            >
              {label}
            </Link>
          ) : (
            <span>{label}</span>
          )}
          <Badge className={`${cls} border-0`}>{counts[status]}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** Horizontal clickable strip (top of the Billing page) — filters in place. */
export function BillingStatusStrip({
  counts,
  active,
  onSelect,
}: {
  counts: Record<BillingStatus, number>;
  active: "all" | BillingStatus;
  onSelect: (s: "all" | BillingStatus) => void;
}) {
  return (
    <section className="rounded-xl border bg-card p-3 space-y-2" data-testid="billing-status-summary">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base text-navy">Billing status</h2>
        {active !== "all" && (
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="text-xs text-navy underline"
          >
            Show all statuses
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {BILLING_STATUS_ROWS.map(({ status, label, cls }) => {
          const on = active === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={on}
              data-billing-status-filter={status}
              onClick={() => onSelect(on ? "all" : status)}
              className={`rounded-lg border px-2 py-2 text-left hover:bg-secondary ${on ? "ring-2 ring-navy" : ""}`}
            >
              <div className="text-xs text-muted-foreground">{label}</div>
              <Badge className={`${cls} border-0 mt-1`}>{counts[status]}</Badge>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{BILLING_STATUS_NOTE}</p>
    </section>
  );
}
