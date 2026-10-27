import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { getStaffMember, useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { canManageOnCall, listOnCallShifts, onCallAt, onCallEligibleStaff, ON_CALL_DRAFT, ON_CALL_DUTY_DESCRIPTION } from "@/lib/onCall";
import { ON_CALL_GAP } from "@/lib/onCallBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/ui/status-chip";

export const Route = createFileRoute("/admin-on-call")({
  head: () => ({ meta: [
    { title: "On-call schedule — Adelante" },
    { name: "description", content: "Draft crisis on-call duty schedule for licensed clinicians." },
    { property: "og:title", content: "On-call schedule — Adelante" },
    { property: "og:description", content: "Who receives crisis escalations when no clinician is assigned." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OnCallPage,
});

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

function OnCallPage() {
  const staff = useActingStaff();
  const shifts = useEhr(listOnCallShifts);
  const now = useEhr(() => onCallAt(new Date()));
  const [staffId, setStaffId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  if (!canManageOnCall(staff.role)) return <p className="flex gap-2 p-6"><Lock aria-hidden />Clinical coordinator or system admin access required.</p>;
  const actor = { role: staff.role, staffId: staff.staffId, staffName: staff.staffName };
  const run = (id: string, args: unknown[]) => {
    const r = runAction(id, actor, undefined, { args, auditReason: reason });
    if (!r.ok) { toast.error(r.reason); return; }
    setReason("");
    toast.success("On-call schedule updated");
  };
  return <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-5">
    <h1 className="text-2xl font-bold">On-call schedule</h1>
    <p className="text-sm text-ink-muted">{ON_CALL_DRAFT} · Owner to be decided.</p>
    <p>{ON_CALL_DUTY_DESCRIPTION}</p>
    <section aria-label="On call now" className="rounded-md border border-line-strong p-4">
      <h2 className="font-bold">On call now</h2>
      {now ? <p>{now.name}</p> : <p className="flex items-center gap-2"><StatusChip lang="en" state="yourturn" label="Not set" /> {ON_CALL_GAP}</p>}
    </section>
    <section aria-label="Add a shift" className="space-y-3 rounded-md border border-line-strong p-4">
      <h2 className="font-bold">Add a shift</h2>
      <label className="block space-y-1">Clinician
        <select className="block h-12 w-full rounded-sm border border-line-strong bg-surface px-3" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">Choose a licensed clinician</option>
          {onCallEligibleStaff().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">Starts<Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="block space-y-1">Ends<Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <label className="block space-y-1">Reason — Required<Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <Button disabled={!staffId || !start || !end || reason.trim().length < 3} onClick={() => run("on_call_shift_add", [actor, { staffId, start, end }, reason])}>Add shift</Button>
    </section>
    <section aria-label="Shifts" className="space-y-2">
      <h2 className="font-bold">Shifts</h2>
      {shifts.length === 0 ? <p className="text-ink-muted">No shifts yet.</p> : <ul className="space-y-2">{shifts.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3">
        <span>{getStaffMember(s.staffId)?.name ?? s.staffId} · {fmt(s.start)} – {fmt(s.end)}</span>
        <Button variant="outline" disabled={reason.trim().length < 3} onClick={() => run("on_call_shift_remove", [actor, s.id, reason])}>Remove</Button>
      </li>)}</ul>}
    </section>
  </main>;
}
