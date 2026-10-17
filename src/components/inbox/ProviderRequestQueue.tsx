import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
// §Inbox — provider request queue. "Assigned to me" / "Unclaimed" sections,
// plus a Done section for recent closures. Claim is a claim, not a takeover:
// a claimed request is not claimable again (release is the escape hatch).
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type ProviderRequest } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { timeOpenLabel } from "@/components/clinical/CrisisPanel";
import { queueAgeTone } from "./UnsignedNotesQueue";
import { ClipboardList, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_LABEL: Record<ProviderRequest["requestType"], string> = {
  question: "Question",
  order_entry: "Order entry",
};

export function ProviderRequestQueue() {
  const { role, staffName } = useActingStaff();
  const canWrite = canAccess(role, "provider_requests").level === "write";
  const rows = useEhr(() => AdelanteEHR.listProviderRequests());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [completing, setCompleting] = useState<ProviderRequest | null>(null);
  const [outcome, setOutcome] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{
    patientId: string;
    requestType: ProviderRequest["requestType"];
    context: string;
  }>({ patientId: "", requestType: "question", context: "" });

  const { mine, unclaimed, done } = useMemo(() => {
    const mine: ProviderRequest[] = [];
    const unclaimed: ProviderRequest[] = [];
    const done: ProviderRequest[] = [];
    for (const r of rows) {
      if (r.status === "done") done.push(r);
      else if (r.status === "claimed" && r.assignedTo === staffName) mine.push(r);
      else if (r.status === "open") unclaimed.push(r);
    }
    return { mine, unclaimed, done };
  }, [rows, staffName]);

  const nameFor = (patientId: string) => {
    const p = patients.find((x) => x.id === patientId);
    return p ? `${p.firstName} ${p.lastName}` : patientId;
  };

  const claim = (r: ProviderRequest) => {
    const ok = AdelanteEHR.claimProviderRequest(r.id, staffName, role);
    toast[ok ? "success" : "error"](
      ok ? "Request claimed." : "Already claimed by someone else.",
    );
  };

  const submitDone = () => {
    if (!completing) return;
    const ok = AdelanteEHR.completeProviderRequest(completing.id, staffName, role, outcome);
    if (ok) toast.success(`Marked done — ${completing.requestedBy} was notified.`);
    setCompleting(null);
    setOutcome("");
  };


  return (
    <div className="space-y-5">
      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> New request
          </Button>
        </div>
      )}
      <StaffTable rows={[...mine,...unclaimed,...done.slice(-5)]} rowKey={(r)=>r.id} label="Provider requests" testId="provider-requests-table" defaultView="mine"
        views={[
          {id:"mine",label:"Assigned to me",matches:(r)=>r.status === "claimed" && r.assignedTo === staffName,emptyState:"Nothing claimed."},
          {id:"unclaimed",label:"Unclaimed",matches:(r)=>r.status === "open",emptyState:<EmptyState icon={ClipboardList} title="No unclaimed requests" />},
          {id:"done",label:"Recently completed",matches:(r)=>r.status === "done"},
          {id:"current",label:"Current view",matches:()=>true},
        ]}
        columns={[
          {id:"patient",label:"Patient",sortValue:(r)=>nameFor(r.patientId),cell:(r)=><Link to="/record/$patientId" params={{patientId:r.patientId}}>{nameFor(r.patientId)}</Link>},
          {id:"type",label:"Type",sortValue:(r)=>TYPE_LABEL[r.requestType],cell:(r)=><Badge variant="outline">{TYPE_LABEL[r.requestType]}</Badge>},
          {id:"ask",label:"Request",cell:(r)=><>{r.context}{r.outcome && <p>Outcome: {r.outcome}</p>}</>},
          {id:"owner",label:"Owner",sortValue:(r)=>r.assignedTo ?? r.requestedBy,cell:(r)=><>Asked by {r.requestedBy}{r.status === "claimed" && r.assignedTo ? ` · claimed by ${r.assignedTo}` : ""}{r.status === "done" && r.completedBy ? ` · done by ${r.completedBy}` : ""}</>},
          {id:"date",label:"Asked",sortValue:(r)=>r.createdAt,cell:(r)=><ClientDate value={r.createdAt} />},
          {id:"status",label:"Status",sortValue:(r)=>r.status,cell:(r)=><StatusChip lang="en" state={r.status === "done" ? "done" : r.status === "claimed" && r.assignedTo === staffName ? "yourturn" : "team"} label={r.status} />},
        ]}
        primaryAction={canWrite ? (r)=>r.status === "claimed" ? <Button size="sm" variant="outline" onClick={()=>setCompleting(r)}>Mark done</Button> : r.status === "open" ? <Button size="sm" variant="outline" onClick={()=>claim(r)}>Claim</Button> : null : undefined}
        moreActions={canWrite ? (r)=>r.status === "claimed" ? [{label:"Release",onSelect:()=>AdelanteEHR.releaseProviderRequest(r.id,staffName,role)}] : [] : undefined}
      />

      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark request done</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pr-outcome">Outcome note (optional)</Label>
            <Textarea
              id="pr-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What you did, if it helps the requester."
            />
            <p className="text-xs text-muted-foreground">
              {completing?.requestedBy} gets a notification either way.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button onClick={submitDone}>Mark done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New provider request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <Select
                value={draft.patientId}
                onValueChange={(v) => setDraft((d) => ({ ...d, patientId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={draft.requestType}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, requestType: v as ProviderRequest["requestType"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="order_entry">Order entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-context">The ask</Label>
              <Textarea
                id="pr-context"
                value={draft.context}
                onChange={(e) => setDraft((d) => ({ ...d, context: e.target.value }))}
                placeholder="What do you need, and by when?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.patientId || !draft.context.trim()}
              onClick={() => {
                AdelanteEHR.createProviderRequest({
                  patientId: draft.patientId,
                  requestType: draft.requestType,
                  context: draft.context,
                  requestedBy: staffName,
                  requestedByRole: role,
                });
                setCreating(false);
                setDraft({ patientId: "", requestType: "question", context: "" });
                toast.success("Request posted to the queue.");
              }}
            >
              Post request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
