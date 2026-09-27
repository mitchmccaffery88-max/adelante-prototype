// §Inbox actions — claim / assign / done / reopen / make-a-task on staff
// inbox items. All rules live in `inboxActions.ts`; this is display only.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  assignInboxItem,
  assignableStaff,
  claimInboxItem,
  inboxItemLabel,
  isProtectedItem,
  listInboxRows,
  makeTaskFromInboxItem,
  markInboxItemDone,
  reopenInboxItem,
  useInboxActionsVersion,
  type InboxActor,
  type InboxRow,
} from "@/lib/inboxActions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ClientDate } from "@/components/ClientDate";
import { Lock } from "lucide-react";

function run(fn: () => void, ok: string) {
  try {
    fn();
    toast.success(ok);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export function InboxActionQueue({ billing = false }: { billing?: boolean }) {
  const acting = useActingStaff();
  const actor: InboxActor = { id: acting.staffId, name: acting.staffName, role: acting.role };
  const v = useInboxActionsVersion();
  const [filter, setFilter] = useState<"open" | "done">("open");
  const rows = useEhr(() => listInboxRows(actor, { billingOnly: billing }));
  void v;
  const shown = rows.filter((r) => r.state.status === filter);
  return (
    <div className="space-y-3" data-testid={billing ? "billing-feed" : "inbox-actions"}>
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "open" ? "default" : "outline"} className="min-h-11" onClick={() => setFilter("open")}>
          Open ({rows.filter((r) => r.state.status === "open").length})
        </Button>
        <Button size="sm" variant={filter === "done" ? "default" : "outline"} className="min-h-11" onClick={() => setFilter("done")}>
          Done ({rows.filter((r) => r.state.status === "done").length})
        </Button>
      </div>
      {shown.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Nothing here.</Card>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => (
            <ItemRow key={r.key} row={r} actor={actor} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemRow({ row, actor }: { row: InboxRow; actor: InboxActor }) {
  const [mode, setMode] = useState<"none" | "assign" | "done" | "task">("none");
  const [note, setNote] = useState("");
  const [staffId, setStaffId] = useState("");
  const [due, setDue] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const prot = isProtectedItem(row.key);
  const label = inboxItemLabel(row.key);
  const s = row.state;
  const staff = assignableStaff(row.key);
  const reset = () => {
    setMode("none");
    setNote("");
  };
  return (
    <Card className="space-y-2 p-3 text-sm" data-testid="inbox-item">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-navy">
          {prot && <Lock className="h-3.5 w-3.5" />} {label.title}
        </span>
        <span className="text-xs text-muted-foreground">
          <ClientDate value={row.createdAt} options={{ month: "short", day: "numeric" }} />
        </span>
      </div>
      {label.body && <p className="text-xs text-muted-foreground">{label.body}</p>}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {s.ownerName ? (
          <Badge variant="secondary" data-testid="inbox-owner">Owner: {s.ownerName}</Badge>
        ) : (
          <Badge variant="outline">Unclaimed</Badge>
        )}
        {s.assignedBy && <Badge variant="outline">Assigned by {s.assignedBy}</Badge>}
        {s.taskId && <Badge variant="outline">Task made</Badge>}
        {s.status === "done" && <Badge variant="outline">Done · {s.doneBy}</Badge>}
      </div>
      {s.assignNote && <p className="text-xs text-navy">Note: “{s.assignNote}”</p>}
      {s.doneNote && <p className="text-xs text-navy">Closing note: “{s.doneNote}”</p>}

      {mode === "assign" && (
        <div className="space-y-2">
          <select aria-label="Assign to" className="h-11 w-full rounded-md border bg-background px-2" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Assign to…</option>
            {staff.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <Textarea aria-label="Assignment note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" className="min-h-11" onClick={() => run(() => { assignInboxItem(row.key, staffId, note, actor); reset(); }, "Assigned.")}>Confirm assign</Button>
        </div>
      )}
      {mode === "done" && (
        <div className="space-y-2">
          <Textarea aria-label="Closing note" placeholder="Closing note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" className="min-h-11" onClick={() => run(() => { markInboxItemDone(row.key, note, actor); reset(); }, "Marked done.")}>Confirm done</Button>
        </div>
      )}
      {mode === "task" && (
        <div className="space-y-2">
          <select aria-label="Task owner" className="h-11 w-full rounded-md border bg-background px-2" value={staffId || actor.id} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <Input aria-label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button size="sm" className="min-h-11" onClick={() => run(() => { makeTaskFromInboxItem(row.key, { ownerId: staffId || actor.id, dueDate: due }, actor); reset(); }, "Task created.")}>Create task</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {s.status === "open" ? (
          <>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => run(() => claimInboxItem(row.key, actor), "Claimed.")}>Claim</Button>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => setMode(mode === "assign" ? "none" : "assign")}>Assign to…</Button>
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => setMode(mode === "done" ? "none" : "done")}>Mark done</Button>
            {!s.taskId && (
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => setMode(mode === "task" ? "none" : "task")}>Make a task</Button>
            )}
          </>
        ) : (
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => run(() => reopenInboxItem(row.key, actor), "Reopened.")}>Reopen</Button>
        )}
        {row.kind === "message" && row.patientId ? (
          <Button asChild size="sm" variant="ghost" className="min-h-11">
            <Link to="/record/$patientId" params={{ patientId: row.patientId }} search={{ section: "messages" }}>Open</Link>
          </Button>
        ) : row.linkRoute && !row.linkRoute.includes("$") ? (
          <Button asChild size="sm" variant="ghost" className="min-h-11">
            <a href={row.linkRoute}>Open</a>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
