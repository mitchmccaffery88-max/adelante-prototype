// Quick-actions batch 2 — the ONE shared "+ New" menu body used by every
// staff launcher. Top section: the acting role's approved quick actions.
// Below: "All actions" — every registry action the role is permitted — with
// a search box. The menu never grants anything: items come pre-filtered
// through the registry's `allowed()`, and picking one runs the launcher's
// existing runAction path. Role-dependent content only renders after the
// acting role is known (the staff shell gate guarantees this).
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChartAction, ChartActionAnswer, ChartActor } from "@/lib/chartActions";
import type { Patient } from "@/lib/ehr";
import { quickActionsFor } from "@/lib/quickActions";
import { getStaffMember, STAFF_ROLES, type StaffRole } from "@/lib/roles";
import { personalMenuActions } from "@/lib/quickActionPrefs";
import { useQuickActionPrefs } from "@/hooks/useQuickActionPrefs";

export interface NewActionItem {
  action: ChartAction;
  answer: ChartActionAnswer;
  switchRole?: StaffRole;
}

export function NewActionMenu({
  actor,
  patient,
  available,
  onPick,
  itemTestId,
  header,
  footer,
}: {
  actor: ChartActor;
  patient?: Patient;
  /** Registry actions already filtered to what this actor may use. */
  available: NewActionItem[];
  onPick: (actionId: string) => void;
  /** Stable per-item test id, e.g. (id) => `chart-add-${id}`. */
  itemTestId?: (actionId: string) => string;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const prefs = useQuickActionPrefs(actor.staffId);

  const quick = useMemo(() => {
    if (prefs.ids !== null) return personalMenuActions(prefs.ids, getStaffMember(actor.staffId), actor, available.map((x) => x.action.id), patient);
    const byId = new Map(available.map((x) => [x.action.id, x]));
    return quickActionsFor(actor, patient)
      .map((a) => byId.get(a.id))
      .filter((x): x is NewActionItem => !!x);
  }, [actor, patient, available, prefs.ids]);
  const quickIds = new Set(quick.map((x) => x.action.id));

  const q = query.trim().toLowerCase();
  const rest = available.filter((x) => !quickIds.has(x.action.id));
  const matches = (x: NewActionItem) => !q || x.action.label.en.toLowerCase().includes(q);
  const shownQuick = quick.filter(matches);
  const shown = rest.filter(matches);
  const resultCount = shownQuick.length + shown.length;

  // Arrow keys move between items; Escape closes via the Popover itself.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-action-id]:not(:disabled)") ?? []);
    if (!buttons.length) return;
    e.preventDefault();
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const item = (x: NewActionItem) => (
    <Button
      key={x.action.id}
      variant="ghost"
      disabled={!!x.switchRole}
      data-action-id={x.action.id}
      data-testid={itemTestId?.(x.action.id)}
      className="h-auto min-h-9 w-full flex-col items-start justify-start py-2 text-left text-sm"
      onClick={() => { if (!x.switchRole && x.answer.state !== "hidden") onPick(x.action.id); }}
    >
      <span className="text-ink">{x.action.label.en}</span>
      {x.switchRole && <span className="text-sm text-ink-muted">Switch to {STAFF_ROLES.find((r) => r.key === x.switchRole)?.label ?? x.switchRole} to use this</span>}
      {x.answer.state === "cosign" && <span className="text-sm text-ink-muted">{x.answer.reason}</span>}
    </Button>
  );

  return (
    <div ref={listRef} onKeyDown={onKeyDown} data-testid="new-action-menu">
      {header}
      {(q ? shownQuick.length > 0 : quick.length > 0) && (
        <div className="mb-2">
          <p className="px-2 text-sm font-medium text-ink-muted">Quick actions</p>
          {shownQuick.map(item)}
        </div>
      )}
      {(!q || shown.length > 0) && <p className="px-2 text-sm font-medium text-ink-muted">All actions</p>}
      <div className="px-1 pb-1">
        <Input
          aria-label="Search actions"
          placeholder="Search actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-1"
        />
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {resultCount} {resultCount === 1 ? "action" : "actions"} available
      </p>
      {!q && shown.length === 0 && resultCount > 0 ? (
        <p className="px-2 py-3 text-sm text-ink-muted">Everything for your role is listed above.</p>
      ) : resultCount === 0 ? (
        <p className="px-2 py-3 text-sm text-ink-muted">{q ? "No matching actions." : "No actions for your role"}</p>
      ) : (
        shown.map(item)
      )}
      {footer}
    </div>
  );
}
