import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActingStaff, getStaffMember, STAFF_ROLES } from "@/lib/roles";
import { quickActionsFor } from "@/lib/quickActions";
import { addPersonalAction, personalActionOptions, sanitizePersonalActions } from "@/lib/quickActionPrefs";
import { useQuickActionPrefs } from "@/hooks/useQuickActionPrefs";

const COPY = {
  title: "Quick actions", prototype: "Prototype — Saved on this device only", add: "Add quick action",
  reset: "Reset to role defaults", choose: "Choose an action", unavailable: "This device could not save your setting. Try again.",
};

export function QuickActionSettings() {
  const actor = useActingStaff();
  const member = getStaffMember(actor.staffId);
  const prefs = useQuickActionPrefs(actor.staffId);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");
  const options = prefs.ready ? personalActionOptions(member) : [];
  const ids = prefs.ready ? prefs.ids === null ? quickActionsFor(actor).map((a) => a.id) : sanitizePersonalActions(prefs.ids, member) : [];
  function save(next: string[] | null) {
    try { prefs.save(next); setError(""); return true; } catch { setError(COPY.unavailable); return false; }
  }
  function move(index: number, delta: number) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  }
  return (
    <section aria-labelledby="quick-action-settings-title" data-testid="quick-action-settings" className="space-y-4 border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="quick-action-settings-title" className="text-xl font-bold">{COPY.title}</h2><p className="text-sm text-ink-muted">{COPY.prototype}</p></div>
        <Button variant="outline" disabled={!prefs.ready} onClick={() => { if (save(null)) setPicked(""); }}><RotateCcw className="h-4 w-4" />{COPY.reset}</Button>
      </div>
      <p className="text-sm text-ink-muted" aria-live="polite">{ids.length} of 8 · {actor.staffName}</p>
      <ol className="divide-y divide-line">
        {ids.map((id, index) => {
          const option = options.find((x) => x.action.id === id);
          if (!option) return null;
          const label = option.action.label.en;
          return <li key={id} className="flex items-center justify-between gap-2 py-2" data-testid={`pref-${id}`}>
            <div className="min-w-0"><span className="text-sm font-medium">{label}</span><p className="text-sm text-ink-muted">{option.roles.map((r) => STAFF_ROLES.find((s) => s.key === r)?.label ?? r).join(", ")}</p></div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" aria-label={`Move ${label} up`} title={`Move ${label} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Move ${label} down`} title={`Move ${label} down`} disabled={index === ids.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={() => save(ids.filter((x) => x !== id))}><X className="h-4 w-4" /></Button>
            </div>
          </li>;
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Select value={picked} onValueChange={setPicked} disabled={!prefs.ready}>
          <SelectTrigger aria-label={COPY.choose} className="min-w-0 flex-1"><SelectValue placeholder={COPY.choose} /></SelectTrigger>
          <SelectContent>{options.filter((x) => !ids.includes(x.action.id)).map((x) => <SelectItem key={x.action.id} value={x.action.id}>{x.action.label.en}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" disabled={!prefs.ready || !picked} onClick={() => {
          try { const next = addPersonalAction(ids, picked, member); if (save(next)) setPicked(""); }
          catch (e) { setError(e instanceof Error ? e.message : COPY.unavailable); }
        }}><Plus className="h-4 w-4" />{COPY.add}</Button>
      </div>
      {error && <p role="alert" className="rounded-md border border-attention bg-gold px-3 py-2 text-sm text-on-gold">{error}</p>}
    </section>
  );
}