// 26 Oct (Mitch) — per-group join rules on the clinical roster: who can see it,
// how they join, the group TYPE (which owns the requirement list) and the
// informational billable flag. Saved through the registry with a reason.
import { useState } from "react";
import { toast } from "sonner";
import type { GroupSession } from "@/lib/ehr";
import { CONTENT_AUDIENCES, type ContentAudience } from "@/lib/contentAudience";
import { GROUP_POLICY_ROLES, GROUP_REQUEST_DRAFT, GROUP_TYPES, REQUIREMENTS, groupPolicy, type GroupJoinRule, type GroupTypeId } from "@/lib/groupRequests";
import { runAction } from "@/lib/actions/runAction";
import { useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RULES: { id: GroupJoinRule; label: string }[] = [
  { id: "open", label: "Open — patients who can see it join directly" },
  { id: "care_team_approval", label: "Care team approval — patient asks, care team verifies" },
  { id: "invite_only", label: "Invite only — staff enroll; patients can't request" },
];

export function GroupJoinRulesEditor({ group }: { group: GroupSession }) {
  const acting = useActingStaff();
  const pol = groupPolicy(group);
  const [joinRule, setJoinRule] = useState<GroupJoinRule>(pol.joinRule);
  const [audiences, setAudiences] = useState<ContentAudience[]>(pol.audiences);
  const [groupType, setGroupType] = useState<GroupTypeId>(pol.groupType);
  const [billable, setBillable] = useState(pol.billable);
  const [reason, setReason] = useState("");
  const canEdit = GROUP_POLICY_ROLES.includes(acting.role);
  const save = () => {
    const actor = { role: acting.role, staffId: acting.staffId, staffName: acting.staffName };
    const r = runAction("group_policy_set", actor, undefined, { args: [actor, group.id, { joinRule, audiences, groupType, billable }, reason], auditReason: reason });
    if (r.ok) { toast.success("Join rules saved."); setReason(""); } else toast.error(r.reason);
  };
  return (
    <section className="rounded-md border p-3 space-y-2" data-testid="group-join-rules">
      <h3 className="font-semibold text-sm">Who may join and how</h3>
      <p className="text-xs text-muted-foreground">{GROUP_REQUEST_DRAFT}</p>
      <fieldset disabled={!canEdit} className="space-y-2 text-sm">
        <legend className="sr-only">Join rule</legend>
        {RULES.map((r) => (
          <label key={r.id} className="flex items-center gap-2">
            <input type="radio" name={`rule-${group.id}`} checked={joinRule === r.id} onChange={() => setJoinRule(r.id)} /> {r.label}
          </label>
        ))}
        <div className="flex flex-wrap gap-3" role="group" aria-label="Who can see it">
          <span className="text-xs text-muted-foreground">Who can see it (none = everyone):</span>
          {CONTENT_AUDIENCES.map((a) => (
            <label key={a.id} className="flex items-center gap-1">
              <input type="checkbox" checked={audiences.includes(a.id)} onChange={(e) => setAudiences(e.target.checked ? [...audiences, a.id] : audiences.filter((x) => x !== a.id))} /> {a.label}
            </label>
          ))}
        </div>
        <label className="flex flex-wrap items-center gap-2">
          Group type
          <select className="min-h-9 rounded-sm border border-input bg-background px-2" value={groupType} onChange={(e) => setGroupType(e.target.value as GroupTypeId)}>
            {Object.entries(GROUP_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          Requirements for this type: {GROUP_TYPES[groupType].requirements.map((id) => REQUIREMENTS[id].label).join(", ") || "none beyond the standard checks"}. Standard checks: group eligibility, space, telehealth consent when online.
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable (for billing's information; billing rules unchanged)
        </label>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Input aria-label="Reason for change" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-xs" />
            <Button size="sm" onClick={save}>Save join rules</Button>
          </div>
        )}
      </fieldset>
    </section>
  );
}
