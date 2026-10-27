import { StatusChip } from "@/components/ui/status-chip";
import { lifecycleChipLabel, lifecycleTurn, type LifecycleView } from "@/lib/careLifecycle";
import type { StaffRole } from "@/lib/roles";

/** One stage display for every staff surface (Draft — pending EHR/Admin audit). Neutral words only. */
export function LifecycleChip({ view, role, showOwner = false }: { view: LifecycleView; role: StaffRole; showOwner?: boolean }) {
  const turn = lifecycleTurn(view, role);
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="lifecycle-chip" data-stage={view.stage}>
      <StatusChip lang="en" state={turn} label={lifecycleChipLabel(view)} waitingDays={turn === "yourturn" || turn === "team" ? view.days : undefined} />
      {showOwner && !view.closed && <span className="text-sm text-ink-muted">{turn === "yourturn" ? "Your turn" : `With ${view.owner}`} · {view.nextAction}</span>}
    </span>
  );
}
