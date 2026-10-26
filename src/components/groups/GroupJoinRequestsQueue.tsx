import { StatusChip } from "@/components/ui/status-chip";
// §Group join requests — staff queue (therapist, PMHNP, ECM provider).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type GroupJoinRequest } from "@/lib/ehr";
import { getStaffMember, useActingStaff } from "@/lib/roles";
import { isGroupJoinReviewer, visibleGroupJoinRequests } from "@/lib/groupJoinView";
import { staffPatientLabel } from "@/lib/staffPatientLabel";
import { FOLLOW_UP_LABELS, GROUP_REQUEST_DRAFT, groupRequestReview, type FollowUpItem } from "@/lib/groupRequests";
import { runAction } from "@/lib/actions/runAction";
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
                <span className="text-navy">{label(r, { role: acting.role, staffId: acting.staffId })}</span> <StatusChip lang="en" state={isGroupJoinReviewer(acting.role) ? "yourturn" : "team"} label="Pending" />
                <StatusChip lang="en" state={r.status === "approved" ? "done" : "closed"} label={r.status === "approved" ? "Approved" : "Declined"} />
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

function label(r: GroupJoinRequest, viewer: Parameters<typeof staffPatientLabel>[0]) {
  const p = AdelanteEHR.getPatient(r.patientId);
  const g = AdelanteEHR.listGroupSessions().find((x) => x.id === r.sessionId);
  return `${p ? staffPatientLabel(viewer, p.id) : "Patient"} to ${g?.topic ?? "Group"}`;
}

const REQ_CHIP = { met: { state: "done", label: "Met" }, not_met: { state: "yourturn", label: "Not met" }, needs_review: { state: "upnext", label: "Needs review" }, locked: { state: "restricted", label: "Restricted" } } as const;

function RequestRow({ r }: { r: GroupJoinRequest }) {
  const acting = useActingStaff();
  const [reason, setReason] = useState("");
  const [item, setItem] = useState<FollowUpItem>("confidentiality_form");
  const [blocked, setBlocked] = useState<string | undefined>(r.lastBlocked?.reason);
  const actor = { role: acting.role, staffId: acting.staffId, staffName: acting.staffName };
  const review = useEhr(() => groupRequestReview(r.id, acting.role));
  const eligible = AdelanteEHR.isGroupEligible(r.patientId);
  const requester = r.requestedBy ? getStaffMember(r.requestedBy.staffId)?.name ?? "Staff" : "the patient";
  const decide = (id: "group_request_approve" | "group_request_not_now" | "group_request_needs_first", ok: string) => {
    const args = id === "group_request_needs_first" ? [actor, r.id, item, reason] : [actor, r.id, reason];
    const res = runAction(id, actor, undefined, { args, auditReason: reason });
    if (!res.ok) { setBlocked(res.reason); return; }
    setReason(""); toast.success(ok);
  };
  return (
    <li className="rounded-lg border p-3 space-y-2" data-testid="group-join-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-navy">{label(r, { role: acting.role, staffId: acting.staffId })}</span> <StatusChip lang="en" state={isGroupJoinReviewer(acting.role) ? "yourturn" : "team"} label="Pending" />
        <span className="text-xs text-muted-foreground">
          Asked by {requester} <ClientDate value={r.createdAt} options={{ month: "short", day: "numeric" }} />
          {!eligible && " · not yet group-eligible"}
          {r.followUp && ` · Follow-up: ${FOLLOW_UP_LABELS[r.followUp.item]}`}
        </span>
      </div>
      {r.note && <p className="text-sm text-muted-foreground">“{r.note}”</p>}
      {review && (
        <div className="space-y-1" data-testid="group-request-requirements">
          <p className="text-xs text-muted-foreground">
            {review.clinicianRequired ? "A clinician approves this group." : "The care manager can approve this group."} {GROUP_REQUEST_DRAFT}
          </p>
          <ul className="flex flex-wrap gap-2">
            {review.requirements.map((q) => (
              <li key={q.id} className="flex items-center gap-1 text-xs">
                <span>{q.label}</span>
                <StatusChip lang="en" state={REQ_CHIP[q.status].state} label={q.status === "locked" ? q.reason : REQ_CHIP[q.status].label} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {blocked && (
        <div role="alert" className="rounded border-2 border-input bg-surface-sunk p-2 text-xs text-attention" data-testid="group-join-blocked">
          {blocked}
          {/telehealth/i.test(blocked) && (
            <Button asChild size="sm" variant="outline" className="mt-2 min-h-11 flex w-fit">
              <Link to="/consent" search={{ patientId: r.patientId, category: "telehealth" }}>
                Open telehealth consent
              </Link>
            </Button>
          )}
        </div>
      )}
      <Textarea aria-label="Reason (required)" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="min-h-11" onClick={() => decide("group_request_approve", "Approved and added. The patient was messaged.")}>
          Approve and add
        </Button>
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => decide("group_request_not_now", "Marked not right now. The patient was messaged.")}>
          Not right now
        </Button>
        <select aria-label="What is needed first" className="min-h-11 rounded-sm border border-input bg-background px-2 text-sm" value={item} onChange={(e) => setItem(e.target.value as FollowUpItem)}>
          {Object.entries(FOLLOW_UP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => decide("group_request_needs_first", "Follow-up task created. The patient was messaged.")}>
          Needs something first
        </Button>
      </div>
    </li>
  );
}
