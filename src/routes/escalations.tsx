// §U1 — unified Escalations queue. One view model (src/lib/escalations.ts)
// over the existing pathways; their stores and rules are unchanged.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, MoreHorizontal, Siren } from "lucide-react";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { actFor } from "@/lib/actions/act";
import {
  canSeeAllEscalations,
  canUseEscalations,
  ESCALATION_DRAFT_LABEL,
  ESCALATION_TYPE_LABEL,
  escalationHandoffCandidates,
  filterEscalations,
  isCoordinator,
  listEscalations,
  type EscalationRow,
  type EscalationType,
  type EscalationView,
} from "@/lib/escalations";
import { inFacilityEnabled } from "@/lib/inFacility";
import { threadsForEscalation, type StaffThread } from "@/lib/staffThreads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { CrisisQueueDetails } from "@/components/escalations/CrisisQueueDetails";

const TYPES: EscalationType[] = ["crisis", "score_change", "crisis_note", "urgent_social_need", "missed_handoff", "refusal"];

export const Route = createFileRoute("/escalations")({
  validateSearch: (s: Record<string, unknown>) => ({
    view: s["view"] === "all" ? ("all" as const) : s["view"] === "mine" ? ("mine" as const) : undefined,
    type: TYPES.includes(s["type"] as EscalationType) ? (s["type"] as EscalationType) : undefined,
    owner: typeof s["owner"] === "string" && s["owner"] ? (s["owner"] as string) : undefined,
    overdue: s["overdue"] === true || s["overdue"] === "1" || s["overdue"] === 1 ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Escalations — Adelante" },
      { name: "description", content: "One queue for crisis escalations, score changes, overdue crisis notes, urgent social needs and missed handoffs." },
      { property: "og:title", content: "Escalations — Adelante" },
      { property: "og:description", content: "Every escalation in one place, overdue first, with a named owner and countdown." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EscalationsPage,
});

const STATUS_LABEL: Record<EscalationRow["status"], string> = { new: "New", acknowledged: "Acknowledged", handed_off: "Handed off", overdue: "Overdue", resolved: "Resolved" };

function EscalationsPage() {
  const s = useActingStaff();
  const viewer = { role: s.role, staffId: s.staffId };
  const search = Route.useSearch();
  const navigate = useNavigate();
  const allowedAll = canSeeAllEscalations(viewer);
  const view: EscalationView = search.view ?? (allowedAll && isCoordinator(s.role) ? "all" : "mine");
  const json = useEhr(() => JSON.stringify(listEscalations(viewer)));
  const rows = JSON.parse(json) as EscalationRow[];
  const shown = filterEscalations(rows, viewer, { view, type: search.type, ownerStaffId: search.owner, overdueOnly: search.overdue });
  const [move, setMove] = useState<{ row: EscalationRow; kind: "handoff" | "reassign" } | null>(null);
  const setSearch = (patch: Partial<typeof search>) => navigate({ to: "/escalations", search: { ...search, ...patch } });
  const owners = [...new Map(rows.filter((r) => r.ownerStaffId).map((r) => [r.ownerStaffId!, r.ownerName])).entries()];
  const actor = { staffId: s.staffId, name: s.staffName, role: s.role };

  if (!canUseEscalations(s.role)) return <div className="mx-auto max-w-5xl p-4"><EmptyState icon={Siren} title="Escalations are for the care team" /></div>;

  const primary = (r: EscalationRow) => {
    try {
      if (r.primaryAction === "Acknowledge") { actFor("escalation_acknowledge", "acknowledgeEscalation", r.patientId, r.key, actor); toast.success("Acknowledged"); return; }
      const section = r.masked ? undefined : r.type === "crisis" ? "alerts" : r.type === "score_change" ? "tracking" : r.type === "crisis_note" ? "notes" : r.type === "urgent_social_need" ? "care_plan" : undefined;
      navigate({ to: "/record/$patientId", params: { patientId: r.patientId }, search: section ? { section } : {} });
    } catch (e) { toast.error((e as Error).message); }
  };
  const discuss = (r: EscalationRow) => {
    try {
      const existing = threadsForEscalation(r.key, viewer)[0];
      const t = existing ?? actFor<StaffThread>("message_team", "startStaffThread", r.patientId, { kind: "care_team", patientId: r.patientId, subject: `Escalation — ${r.typeLabel}`, participantIds: r.ownerStaffId && r.ownerStaffId !== s.staffId ? [r.ownerStaffId] : [], escalationKey: r.key }, actor);
      navigate({ to: "/team-messages", search: { thread: t.id } });
    } catch (e) { toast.error((e as Error).message); }
  };
  const canWork = (r: EscalationRow) => isCoordinator(s.role) || r.ownerStaffId === s.staffId;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 font-display text-2xl text-navy"><Siren className="h-5 w-5 text-destructive" /> Escalations</h1>
        <p className="text-sm text-muted-foreground">Crisis, score changes, overdue crisis notes, urgent social needs and missed handoffs — overdue first, then by due time.</p>
        <p className="text-[11px] text-amber-900">Due times use each pathway's own clock. {ESCALATION_DRAFT_LABEL}</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Escalation view">
          <Button size="sm" variant={view === "mine" ? "default" : "outline"} onClick={() => setSearch({ view: "mine" })}>Mine</Button>
          {allowedAll && <Button size="sm" variant={view === "all" ? "default" : "outline"} onClick={() => setSearch({ view: "all" })}>All</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select aria-label="Filter by type" className="rounded-md border bg-background p-1.5" value={search.type ?? ""} onChange={(e) => setSearch({ type: (e.target.value || undefined) as EscalationType | undefined })}>
            <option value="">All types</option>
            {TYPES.filter((t) => t !== "refusal" || inFacilityEnabled()).map((t) => <option key={t} value={t}>{ESCALATION_TYPE_LABEL[t]}</option>)}
          </select>
          <select aria-label="Filter by owner" className="rounded-md border bg-background p-1.5" value={search.owner ?? ""} onChange={(e) => setSearch({ owner: e.target.value || undefined })}>
            <option value="">Any owner</option>
            <option value="pool">Coordinator pool</option>
            {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!search.overdue} onChange={(e) => setSearch({ overdue: e.target.checked || undefined })} /> Overdue only</label>
        </div>
      </header>

      {shown.length === 0 ? (
        <EmptyState icon={Siren} title={view === "mine" ? "No escalations assigned to you" : "No escalations"} />
      ) : (
        <ul className="space-y-2" data-testid="escalation-list">
          {shown.map((r) => (
            <Card key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-sm" data-testid={`escalation-row-${r.type}`}>
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={r.type === "crisis" ? "destructive" : "secondary"}>{r.typeLabel}</Badge>
                  <Link to="/record/$patientId" params={{ patientId: r.patientId }} search={{}} className="font-medium underline-offset-2 hover:underline">{r.patientName}</Link>
                  <Badge variant={r.overdue ? "destructive" : "outline"}>{STATUS_LABEL[r.status]}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">Owner: <span data-testid="escalation-owner">{r.ownerName}</span> · <span className={r.overdue ? "text-destructive" : ""}>{r.countdown}</span></p>
                {r.detail && <p className="truncate text-xs text-muted-foreground">{r.detail}</p>}
              </div>
              <div className="flex items-center gap-1">
                {r.status !== "resolved" && <Button size="sm" variant={r.type === "crisis" ? "destructive" : "outline"} onClick={() => primary(r)}>{r.primaryAction}</Button>}
                <Button size="sm" variant="ghost" onClick={() => discuss(r)}><MessageSquare className="h-4 w-4" /> Discuss</Button>
                {r.status !== "resolved" && canWork(r) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="More escalation actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setMove({ row: r, kind: "handoff" })}>Hand off</DropdownMenuItem>
                      {isCoordinator(s.role) && <DropdownMenuItem onSelect={() => setMove({ row: r, kind: "reassign" })}>Reassign</DropdownMenuItem>}
                      <DropdownMenuItem onSelect={() => primary({ ...r, primaryAction: "open" })}>Open chart</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}

      {(search.type === "crisis" || search.type === "urgent_social_need") && <CrisisQueueDetails lane={search.type === "urgent_social_need" ? "sdoh" : "clinical"} />}
      <MoveDialog move={move} onClose={() => setMove(null)} actor={actor} />
    </div>
  );
}

function MoveDialog({ move, onClose, actor }: { move: { row: EscalationRow; kind: "handoff" | "reassign" } | null; onClose: () => void; actor: { staffId: string; name: string; role: ReturnType<typeof useActingStaff>["role"] } }) {
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const people = escalationHandoffCandidates(actor.staffId);
  const save = () => {
    if (!move) return;
    try {
      if (move.kind === "handoff") actFor("escalation_handoff", "handOffEscalation", move.row.patientId, move.row.key, { toStaffId: to, reason }, actor);
      else actFor("escalation_reassign", "reassignEscalation", move.row.patientId, move.row.key, { toStaffId: to, reason }, actor);
      toast.success(move.kind === "handoff" ? "Handed off" : "Reassigned");
      setTo(""); setReason(""); onClose();
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Dialog open={!!move} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{move?.kind === "reassign" ? "Reassign" : "Hand off"} · {move?.row.patientName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">New owner<select aria-label="New owner" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a person</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="block text-sm">Reason<textarea aria-label="Handoff reason" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <Button onClick={save} disabled={!to || reason.trim().length < 3}>{move?.kind === "reassign" ? "Reassign" : "Hand off"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
