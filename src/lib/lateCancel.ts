// §Cancel/no-show — the single 24-hour late-cancel check. `SchedulingConstraints
// .isLateCancel` delegates here so the store (which cannot import scheduling.ts
// without a cycle) and the scheduling engine share one rule.
// Label only — DRAFT, no fee logic.
export const LATE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LATE_CANCEL_LABEL = "Late cancel";

export function isLateCancelWindow(startISO: string, nowISO = new Date().toISOString()): boolean {
  const start = +new Date(startISO);
  const now = +new Date(nowISO);
  return start - now < LATE_CANCEL_WINDOW_MS && start - now > 0;
}
