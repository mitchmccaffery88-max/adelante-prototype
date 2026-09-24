// §Phase 7a follow-up / §Phase 7b — one billing-status summary shared by the
// pilot dashboard card (/admin) and the top of the Billing page (/billing).
// §Phase 7b: counts CLAIM records — the same list /admin-claims works from —
// so every surface agrees for the same visit.
import { Link } from "@tanstack/react-router";
import { claimBucketCounts, type BillingBucket, type Claim } from "@/lib/ehr-ext";
import { Badge } from "@/components/ui/badge";

export type BillingStatus = BillingBucket;

export const BILLING_STATUS_ROWS: { status: BillingStatus; label: string; cls: string }[] = [
  { status: "draft", label: "Draft", cls: "bg-muted text-muted-foreground" },
  { status: "ready", label: "Ready", cls: "bg-accent text-accent-foreground" },
  { status: "submitted", label: "Submitted", cls: "bg-teal/15 text-teal" },
  { status: "paid", label: "Paid", cls: "bg-success/20 text-success" },
  { status: "denied", label: "Denied", cls: "bg-destructive/15 text-destructive" },
  { status: "write_off", label: "Write-off", cls: "bg-muted text-muted-foreground" },
  { status: "partial", label: "Partial", cls: "bg-gold/20 text-navy" },
];

export const BILLING_STATUS_NOTE =
  "Counts claim records — the same ones on the Claims worklist and Billing page. Draft covers documented, signed and coded claims. Partial has no payment amount recorded yet.";

export function billingStatusCounts(claims: Claim[]): Record<BillingStatus, number> {
  return claimBucketCounts(claims);
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
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
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
