// §Group join requests — staff queue (therapist, PMHNP, ECM provider).
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type GroupJoinRequest } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { isGroupJoinReviewer, visibleGroupJoinRequests } from "@/lib/groupJoinView";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";

export function GroupJoinRequestsQueue() {
  const acting = useActingStaff();
  const view = useEhr(() => visibleGroupJoinRequests(acting.role));
  if (!isGroupJoinReviewer(acting.role)) return null;
  const pending = view.rows.filter((r) => r.status === "pending");
  const done = view.rows.filter((r) => r.status !== "pending").slice(0, 6);
  return (
    <Card className="p-4 sm:p-6 space-y-3" data-testid="group-join-queue">
      <div>
        <h2 className="font-display text-lg text-navy">Group join requests</h2>
        <p className="text-xs text-muted-foreground">
          Patients asking to join a group. Approving sets group eligibility if needed and enrolls
          them. Groups with online meetings need telehealth consent first.
        </p>
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests waiting.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <RequestRow key={r.id} r={r} />
          ))}
        </ul>
      )}
      {view.hidden > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="group-join-hidden">
          {view.hidden} protected request{view.hidden === 1 ? "" : "s"} not shown for your role.
        </p>
      )}
      {done.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recently reviewed</div>
          <ul className="space-y-1 text-xs">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2">
                <span className="text-navy">{label(r)}</span>
                <Badge variant={r.status === "approved" ? "secondary" : "outline"} className="text-[10px]">
                  {r.status === "approved" ? "Approved" : "Declined"}
                </Badge>
                <span className="text-muted-foreground">
                  {r.resolvedBy}
                  {r.declineReason ? ` · ${r.declineReason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function label(r: GroupJoinRequest) {
  const p = AdelanteEHR.getPatient(r.patientId);
  const g = AdelanteEHR.listGroupSessions().find((x) => x.id === r.sessionId);
  return `${p ? `${p.firstName} ${p.lastName}` : "Patient"} → ${g?.topic ?? "Group"}`;
}

function RequestRow({ r }: { r: GroupJoinRequest }) {
  const acting = useActingStaff();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [blocked, setBlocked] = useState<string | undefined>(r.lastBlocked?.reason);
  const actor = { name: acting.staffName, role: acting.role, id: acting.staffId };
  const eligible = AdelanteEHR.isGroupEligible(r.patientId);
  return (
    <li className="rounded-lg border p-3 space-y-2" data-testid="group-join-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-navy">{label(r)}</span>
        <span className="text-xs text-muted-foreground">
          Asked <ClientDate value={r.createdAt} options={{ month: "short", day: "numeric" }} />
          {!eligible && " · not yet group-eligible"}
        </span>
      </div>
      {r.note && <p className="text-sm text-muted-foreground">“{r.note}”</p>}
      {blocked && (
        <p role="alert" className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive" data-testid="group-join-blocked">
          {blocked}
        </p>
      )}
      {declining ? (
        <div className="space-y-2">
          <Textarea
            aria-label="Reason for declining"
            placeholder="Reason for declining (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="min-h-11"
              onClick={() => {
                try {
                  AdelanteEHR.declineGroupJoinRequest(r.id, reason, actor);
                  toast.success("Request declined. The patient was notified.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not decline.");
                }
              }}
            >
              Confirm decline
            </Button>
            <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-h-11 bg-navy text-navy-foreground hover:bg-navy/90"
            onClick={() => {
              try {
                AdelanteEHR.approveGroupJoinRequest(r.id, actor);
                toast.success("Approved and enrolled.");
              } catch (e) {
                setBlocked(e instanceof Error ? e.message : "Could not approve.");
              }
            }}
          >
            Approve
          </Button>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => setDeclining(true)}>
            Decline
          </Button>
        </div>
      )}
    </li>
  );
}
