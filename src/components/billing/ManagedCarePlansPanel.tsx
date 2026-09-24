// §Phase 8b — editable Medi-Cal managed care plan list (billing roles edit,
// everyone else read-only; enforcement lives in managedCarePlans.ts).
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEhr } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  MANAGED_CARE_DRAFT_LABEL,
  addManagedCarePlan,
  listManagedCarePlans,
  updateManagedCarePlan,
} from "@/lib/managedCarePlans";

export function ManagedCarePlansPanel() {
  const { role } = useActingStaff();
  const canWrite = canAccess(role, "billing").level === "write";
  const [tick, setTick] = useState(0);
  const plans = useEhr(() => listManagedCarePlans({ includeRetired: true }));
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  void tick;
  const done = (r: { ok: boolean; error?: string }, msg: string) => {
    if (!r.ok) return void toast.error(r.error);
    toast.success(msg);
    setTick((t) => t + 1);
  };

  return (
    <Card className="p-4 space-y-3" data-testid="managed-care-plans">
      <div>
        <h2 className="font-display text-lg text-navy">Medi-Cal managed care plans</h2>
        <p className="text-xs text-muted-foreground">
          The list intake and referrals offer. Picking a plan saves its name as it reads today.
          {canWrite ? " Retire a plan instead of deleting it." : " Read-only for your role."}
        </p>
      </div>
      <ul className="divide-y text-sm">
        {plans.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
            {editing?.id === p.id ? (
              <>
                <Input
                  className="h-8 max-w-xs"
                  aria-label="Plan name"
                  value={editing.name}
                  onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                />
                <Button size="sm" onClick={() => { done(updateManagedCarePlan(p.id, { name: editing.name }), "Plan updated"); setEditing(null); }}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </>
            ) : (
              <span className={p.active ? "" : "text-muted-foreground line-through"}>{p.name}</span>
            )}
            {p.draft && <Badge variant="outline" className="text-[10px]">{MANAGED_CARE_DRAFT_LABEL}</Badge>}
            {!p.active && <Badge variant="outline" className="text-[10px]">Retired</Badge>}
            {p.updatedBy && (
              <span className="text-xs text-muted-foreground">edited by {p.updatedBy}</span>
            )}
            {canWrite && editing?.id !== p.id && (
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: p.id, name: p.name })}>
                  Edit
                </Button>
                {p.kind === "plan" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => done(updateManagedCarePlan(p.id, { active: !p.active }), p.active ? "Plan retired" : "Plan restored")}
                  >
                    {p.active ? "Retire" : "Restore"}
                  </Button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Input className="h-8 max-w-xs" placeholder="New plan name" aria-label="New plan name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" onClick={() => { const r = addManagedCarePlan({ name }); done(r, "Plan added"); if (r.ok) setName(""); }}>
            Add plan
          </Button>
        </div>
      )}
    </Card>
  );
}
