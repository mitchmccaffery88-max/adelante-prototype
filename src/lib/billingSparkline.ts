// Phase 9a-3 — read-only weekly claim projections from dated claim history
// (submit / paid entries). No writes, no snapshots, no patient fields read.
// Claim counts and dollars are claims, not people: no cohort suppression.
import type { Claim } from "./ehr-ext";
import type { KpiSparkline } from "./kpiSparkline";

const WEEK = 7 * 86_400_000;
export type BillingSparkKind = "paid" | "submitted";

/** Twelve (start, end] weeks ending at `now`, oldest first, in whole dollars
 * first reaching `kind` that week. Weeks before the earliest dated entry are
 * null (unmeasured); returns null when no dated entry falls in the window. */
export function claimWeeklyProjection(kind: BillingSparkKind, claims: Pick<Claim, "chargeCents" | "history">[], now: Date): KpiSparkline | null {
  const end0 = now.getTime();
  const windowStart = end0 - 12 * WEEK;
  const events: { at: number; cents: number }[] = [];
  for (const c of claims) {
    const hit = (c.history ?? []).find((h) => h.state === kind);
    const at = hit ? Date.parse(hit.at) : NaN;
    if (Number.isFinite(at) && at > windowStart && at <= end0) events.push({ at, cents: c.chargeCents ?? 0 });
  }
  if (!events.length) return null;
  const earliest = Math.min(...events.map((e) => e.at));
  const points = [];
  for (let i = 11; i >= 0; i--) {
    const end = end0 - i * WEEK;
    const start = end - WEEK;
    const value = end < earliest ? null : events.filter((e) => e.at > start && e.at <= end).reduce((s, e) => s + e.cents, 0) / 100;
    points.push({ period: new Date(end).toISOString(), value });
  }
  return { points, caption: `${kind === "paid" ? "Paid" : "Submitted"} dollars per week, last 12 weeks` };
}
