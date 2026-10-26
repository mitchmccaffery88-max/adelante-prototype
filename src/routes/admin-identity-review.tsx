import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { canActOnIdentityReview, canViewIdentityReview, identityReviewCompare, identityReviewWaitingDays, listIdentityReviewItems, linkableReferrals, IDENTITY_REVIEW_TYPE_LABELS, IDENTITY_REVIEW_EMPTY, IDENTITY_REVIEW_PERMISSIONS_DRAFT } from "@/lib/identityReview";
import { runAction } from "@/lib/actions/runAction";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { StaffTable } from "@/components/staff/StaffTable";
export const Route = createFileRoute("/admin-identity-review")({
  head: () => ({meta: [{title: "Identity review — Adelante"}, {name: "description", content: "Staff review of possible referral matches and duplicate accounts."}, {property: "og:title", content: "Identity review — Adelante"}, {property: "og:description", content: "Record-integrity decisions with identity-only comparisons."}, {property: "og:type", content: "website"}, {name: "twitter:card", content: "summary"}]}),
  component: IdentityReviewPage,
});
function IdentityReviewPage() {
  const staff = useActingStaff();
  const actor = {...staff, staffName: staff.staffName};
  const items = useEhr(listIdentityReviewItems);
  const [selected, setSelected] = useState<string>();
  const [reason, setReason] = useState("");
  const [how, setHow] = useState("");
  const [code, setCode] = useState("");
  if (!canViewIdentityReview(actor)) return <p className="flex gap-2 p-6"><Lock />Identity review permission required.</p>;
  const canAct = canActOnIdentityReview(actor);
  const item = items.find(i => i.id === selected);
  const run = (id: string, extra: unknown) => {
    if (!item) return;
    const result = runAction<{code?: {code: string}}>(id, actor, undefined, {args: [actor, item.id, extra]});
    if (!result.ok) {toast.error(result.reason); return;}
    setCode(result.value?.code?.code ?? "");
    AdelanteEHR._emit();
    toast.success("Review updated");
  };
  return <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-5">
    <h1 className="text-2xl font-bold">Identity review</h1><p className="text-sm text-ink-muted">{IDENTITY_REVIEW_PERMISSIONS_DRAFT} · Simulated — preview records only.{!canAct && " View only."}</p>
    <StaffTable rows={items} rowKey={i => i.id} label="Identity review" columns={[
      {id: "type", label: "Type", cell: i => IDENTITY_REVIEW_TYPE_LABELS[i.type]},
      {id: "created", label: "Created", cell: i => i.createdAt.slice(0,10)},
      {id: "age", label: "Age", cell: i => `Waiting ${identityReviewWaitingDays(i)} days`},
      {id: "source", label: "Source", cell: i => i.source},
      {id: "status", label: "Status", cell: i => <StatusChip lang="en" state={i.status === "withothers" ? "team" : i.status} label={i.status === "yourturn" ? "Your turn" : i.status === "withothers" ? "With others" : "Closed"} />},
      {id: "assignee", label: "Assignee", cell: i => i.assignee === "intake_coordinator" ? "Intake Coordinator" : i.assignee ?? "Unassigned"},
    ]} primaryAction={i => <Button variant="outline" onClick={() => {setSelected(i.id);setReason("");setHow("");setCode("");}}>Review</Button>} emptyState={IDENTITY_REVIEW_EMPTY} />
    {item && <section className="space-y-4 border-t border-line pt-5" key={`${staff.staffId}:${staff.role}:${item.id}`}>
      <h2 className="text-xl font-bold">{IDENTITY_REVIEW_TYPE_LABELS[item.type]}</h2>
      <div className="grid gap-4 md:grid-cols-2"><dl className="space-y-2 border border-line rounded-md p-4"><dt className="font-bold">Sign-up entries</dt>{Object.entries(item.entries).map(([key,value]) => <div key={key}><dt className="text-sm text-ink-muted">{key}</dt><dd className="break-words">{value || "Not provided"}</dd></div>)}</dl>
        {identityReviewCompare(item,actor).map(candidate => <dl key={candidate.id} className="space-y-2 border border-line rounded-md p-4"><dt className="font-bold">{candidate.kind === "account" ? "Account" : "Referral"}</dt>{candidate.restrictedReason ? <dd className="flex gap-2"><Lock />{candidate.restrictedReason}</dd> : Object.entries(candidate).filter(([key]) => !["kind", "hasAccount"].includes(key)).map(([key,value]) => <div key={key}><dt className="text-sm text-ink-muted">{key}</dt><dd className="break-words">{String(value ?? "Not provided")}</dd></div>)}</dl>)}
      </div>
      {canAct && item.status !== "closed" && <><label className="block space-y-2">Reason — Required<Textarea value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex flex-wrap gap-2">
        {linkableReferrals(item,actor).map(r => <Button key={r.id} variant="outline" disabled={!item.patientId || reason.trim().length < 3} onClick={() => run("identity_review_link", {referralId:r.id,reason})}>Link to referral {r.id}</Button>)}
        <Button variant="outline" disabled={reason.trim().length < 3} onClick={() => run("identity_review_not_same",reason)}>Not the same person</Button>
        <Button variant="outline" disabled={reason.trim().length < 3} onClick={() => run("identity_review_need_info",reason)}>Need more information</Button>
      </div><label className="block space-y-2">How identity was confirmed — Required<Input value={how} onChange={e => setHow(e.target.value)} /></label><Button variant="outline" disabled={!how.trim() || reason.trim().length < 3 || !item.candidateReferralIds.length && !item.referralId} onClick={() => run("identity_review_confirm",{how,reason})}>Mark identity confirmed by staff</Button></>}
      {code && <p className="text-sm">Simulated claim code: <span className="font-mono">{code}</span></p>}
      <Button variant="ghost" onClick={() => setSelected(undefined)}>Close review</Button>
    </section>}
  </main>;
}