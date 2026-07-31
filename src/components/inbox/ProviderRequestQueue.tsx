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
import { ClipboardList } from "lucide-react";

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

  const row = (r: ProviderRequest, actions: React.ReactNode) => (
    <Card key={r.id} className="p-3 text-xs space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/record/$patientId"
          params={{ patientId: r.patientId }}
          className="font-display text-base text-navy underline-offset-2 hover:underline"
        >
          {nameFor(r.patientId)}
        </Link>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {TYPE_LABEL[r.requestType]}
          </Badge>
          {r.status !== "done" && (
            <Badge className={queueAgeTone(r.createdAt)}>{timeOpenLabel(r.createdAt)}</Badge>
          )}
        </div>
      </div>
      <p className="text-navy">{r.context}</p>
      <p className="text-muted-foreground">
        Asked by {r.requestedBy} · <ClientDate value={r.createdAt} />
        {r.status === "claimed" && r.assignedTo ? ` · claimed by ${r.assignedTo}` : ""}
        {r.status === "done" && r.completedBy ? ` · done by ${r.completedBy}` : ""}
      </p>
      {r.outcome && <p className="text-navy">Outcome: {r.outcome}</p>}
      {actions}
    </Card>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="font-display text-sm text-navy">Assigned to me ({mine.length})</h2>
        {mine.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing claimed.</p>
        ) : (
          <ul className="space-y-2">
            {mine.map((r) =>
              row(
                r,
                canWrite ? (
                  <div className="flex gap-2 pt-0.5">
                    <Button size="sm" onClick={() => setCompleting(r)}>
                      Mark done
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => AdelanteEHR.releaseProviderRequest(r.id, staffName, role)}
                    >
                      Release
                    </Button>
                  </div>
                ) : null,
              ),
            )}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-sm text-navy">Unclaimed ({unclaimed.length})</h2>
        {unclaimed.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No unclaimed requests" />
        ) : (
          <ul className="space-y-2">
            {unclaimed.map((r) =>
              row(
                r,
                canWrite ? (
                  <Button size="sm" variant="outline" onClick={() => claim(r)}>
                    Claim
                  </Button>
                ) : null,
              ),
            )}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-sm text-navy">Recently completed</h2>
          <ul className="space-y-2">{done.slice(-5).map((r) => row(r, null))}</ul>
        </section>
      )}

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
    </div>
  );
}
