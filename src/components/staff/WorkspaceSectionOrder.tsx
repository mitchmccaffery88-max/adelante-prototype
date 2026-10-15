import { Children, isValidElement, type ReactNode } from "react";

/** Presentation only: children have already passed their caller's access gates. */
export function WorkspaceSectionOrder({ children, waitingIds = [], todayIds = [] }: { children: ReactNode; waitingIds?: string[]; todayIds?: string[] }) {
  const groups: Record<"needs" | "waiting" | "today", ReactNode[]> = { needs: [], waiting: [], today: [] };
  Children.forEach(children, child => {
    if (!child) return;
    const props = isValidElement<{ "data-testid"?: string }>(child) ? child.props : {};
    const id = props["data-testid"] ?? "";
    groups[todayIds.includes(id) ? "today" : waitingIds.includes(id) ? "waiting" : "needs"].push(child);
  });
  return <>{([["needs", "Needs you"], ["waiting", "Waiting on others"], ["today", "Today"]] as const).map(([key, label]) => <section key={key} aria-label={label} data-testid={`workspace-section-${key}`} className="space-y-4"><h2 className="text-lg font-semibold text-ink">{label}</h2>{groups[key].length ? groups[key] : <p className="text-sm text-ink-muted">No items.</p>}</section>)}</>;
}