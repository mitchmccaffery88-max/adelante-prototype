// §Batch B2 — "Missing details" follow-ups on the referral queue. Peers / CHW
// can record a missing value (clears that item); only the coordinator claims
// or assigns. Nobody closes a follow-up by hand — it closes itself.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { act } from "@/lib/actions/act";
import {
  CHASE_DRAFT_LABEL,
  CHASE_FIELD_LABEL,
  canAssignReferralOwner,
  canClaimChase,
  canFillChase,
  chaseAging,
  chaseOwnerCandidates,
  chaseText,
  listChaseTasks,
  type ChaseField,
  type ChaseTask,
} from "@/lib/referralChase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const SELECTS: Partial<Record<ChaseField, { v: string; l: string }[]>> = {
  pendingCharges: [{ v: "yes", l: "Yes" }, { v: "no", l: "No" }, { v: "unknown", l: "Unknown" }],
  priorRecords: [{ v: "available", l: "Available / requested" }, { v: "none_known", l: "None known" }],
};

export function ReferralChasePanel() {
  const staff = useActingStaff();
  const tasks = useEhr(() => listChaseTasks().filter((t) => t.status === "open"));
  const referrals = useEhr(() => AdelanteEHR.listReferrals());
  const [openId, setOpenId] = useState<string | null>(null);
  if (!canFillChase(staff.role) || tasks.length === 0) return null;
  const open = tasks.find((t) => t.referralId === openId);
  return (
    <Card className="p-4 space-y-2" data-testid="referral-chase-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-navy">Missing details · {tasks.length}</h2>
        <Badge variant="outline">{CHASE_DRAFT_LABEL}</Badge>
      </div>
      <div className="divide-y">
        {tasks.slice(0, 12).map((t) => {
          const r = referrals.find((x) => x.id === t.referralId);
          if (!r) return null;
          const aging = chaseAging(t);
          return (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2" data-testid="chase-row">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.firstName} {r.lastName}</p>
                <p className="truncate text-xs text-muted-foreground">{chaseText(t.missing)} · {t.owner ? t.owner.name : "Coordinator pool"}{aging !== "fresh" ? ` · ${aging === "overdue" ? "Overdue" : "Due"}` : ""}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenId(t.referralId)}>Open</Button>
            </div>
          );
        })}
      </div>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {open && <ChaseDrawer task={open} onDone={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function ChaseDrawer({ task, onDone }: { task: ChaseTask; onDone: () => void }) {
  const staff = useActingStaff();
  const r = useEhr(() => AdelanteEHR.listReferrals().find((x) => x.id === task.referralId));
  const [vals, setVals] = useState<Partial<Record<ChaseField, string>>>({});
  const [owner, setOwner] = useState("");
  if (!r) return null;
  const actor = { role: staff.role, staffId: staff.staffId, name: staff.staffName };
  const run = (fn: () => void, msg: string) => { try { fn(); toast.success(msg); } catch (e) { toast.error((e as Error).message); } };
  return (
    <div className="space-y-4">
      <SheetTitle>{r.firstName} {r.lastName}</SheetTitle>
      <SheetDescription>{chaseText(task.missing)}. Filling an item clears it; the follow-up closes itself when nothing is missing.</SheetDescription>
      {task.missing.map((f) => (
        <div key={f} className="space-y-1">
          <Label htmlFor={`chase-${f}`} className="capitalize">{CHASE_FIELD_LABEL[f]}</Label>
          {SELECTS[f] ? (
            <div className="flex flex-wrap gap-1">
              {SELECTS[f]!.map((o) => (
                <Button key={o.v} size="sm" variant={vals[f] === o.v ? "default" : "outline"} onClick={() => setVals({ ...vals, [f]: o.v })}>{o.l}</Button>
              ))}
            </div>
          ) : (
            <Input id={`chase-${f}`} type={f === "releaseDate" ? "date" : "text"} value={vals[f] ?? ""} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} />
          )}
        </div>
      ))}
      <Button className="w-full" onClick={() => run(() => { act("referral_chase_fill", "fillChaseField", actor, r.id, vals); setVals({}); }, "Saved")}>Save details</Button>
      <p className="text-xs text-muted-foreground">To log a call or text, open the referral in the queue below and use “Log outreach attempt”.</p>
      {canClaimChase(staff.role) && !task.owner && (
        <Button variant="outline" className="w-full" onClick={() => run(() => act("referral_chase_claim", "claimChaseTask", actor, r.id), "Follow-up is now yours")}>Take this follow-up</Button>
      )}
      {canAssignReferralOwner(staff.role) && (
        <div className="space-y-1">
          <Label htmlFor="chase-owner">Assign to ECM / reentry care manager</Label>
          <select id="chase-owner" className="w-full rounded-md border bg-background p-2 text-sm" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Choose…</option>
            {chaseOwnerCandidates().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button variant="outline" className="w-full" disabled={!owner} onClick={() => run(() => { act("referral_assign_owner", "assignReferralOwner", actor, r.id, owner); onDone(); }, "Assigned")}>Assign</Button>
        </div>
      )}
    </div>
  );
}
