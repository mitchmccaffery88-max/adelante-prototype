// §C1 — Adel's ASAM-derived care-plan suggestions (staff, Part 2). Only for
// roles passing roleSeesAsamSection (the list is empty otherwise — hidden,
// not stubbed). Every decision goes through the registry + runAction.
import { useState } from "react";
import { toast } from "sonner";
import { actFor } from "@/lib/actions/act";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import {
  ASAM_PLAN_ADEL_LABEL, ASAM_PLAN_DRAFT_LABEL, asamProvenanceLabel, listAsamSuggestions,
  type AsamPlanSuggestion, type AsamSuggestionEdits,
} from "@/lib/asamCarePlan";
import type { StructuredGoal } from "@/lib/structuredCarePlan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

function useMe() {
  const a = useActingStaff();
  return { role: a.role, me: { name: a.staffName, role: a.role, staffId: a.staffId } };
}
function run(fn: () => void, msg: string) {
  try {
    fn();
    toast.success(msg);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not save.");
  }
}

export function AsamSuggestions({ patientId }: { patientId: string }) {
  const { role } = useMe();
  const list = useEhr(() => listAsamSuggestions(patientId, role));
  if (!list.length) return null;
  return (
    <section className="rounded-lg border border-teal/40 bg-secondary/40 p-3" data-testid="asam-plan-suggestions">
      <h5 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-navy">
        <Sparkles className="h-3.5 w-3.5" /> Suggested from the signed ASAM · {list.length}
      </h5>
      <p className="text-[11px] text-muted-foreground">
        {ASAM_PLAN_ADEL_LABEL} · {ASAM_PLAN_DRAFT_LABEL}. Nothing is added until you accept it.
      </p>
      <ul className="mt-2 space-y-2">
        {list.map((s) => <SuggestionCard key={s.id} patientId={patientId} s={s} />)}
      </ul>
    </section>
  );
}

function SuggestionCard({ patientId, s }: { patientId: string; s: AsamPlanSuggestion }) {
  const { me } = useMe();
  const [mode, setMode] = useState<"view" | "edit" | "dismiss">("view");
  const [f, setF] = useState({ problem: s.problem, goal: s.goal, measure: s.measure, reviewDate: s.reviewDate, i1: s.interventions[0]?.text ?? "", i2: s.interventions[1]?.text ?? "" });
  const [reason, setReason] = useState("");
  const edits = (): AsamSuggestionEdits => ({ problem: f.problem, goal: f.goal, measure: f.measure, reviewDate: f.reviewDate, interventions: [f.i1, f.i2] });
  const needs = useEhr(() => (AdelanteEHR.getPatient(patientId)?.sdohPlan?.items ?? []).filter((i) => s.needIds.includes(i.id)).map((i) => i.need));
  const accept = (withEdits: boolean) =>
    run(() => actFor("asam_plan_suggestion", "acceptAsamSuggestion", patientId, patientId, s.id, me, withEdits ? edits() : {}), "Goal added to the plan");

  return (
    <li className="space-y-2 rounded-md border bg-card p-3 text-sm" data-testid={`asam-suggestion-${s.dimensionKey}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px]">Suggested</Badge>
        <Badge variant="outline" className="text-[10px]">Dimension {s.dimensionKey.slice(1)} · rating {s.rating}</Badge>
        <Badge variant="outline" className="text-[10px]">{ASAM_PLAN_ADEL_LABEL}</Badge>
        {s.edited && <Badge variant="outline" className="text-[10px]">Edited</Badge>}
      </div>
      {mode === "edit" ? (
        <div className="grid gap-2">
          <Input aria-label="Problem statement" value={f.problem} onChange={(e) => setF({ ...f, problem: e.target.value })} />
          <Input aria-label="Goal" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
          <Input aria-label="Measure" value={f.measure} onChange={(e) => setF({ ...f, measure: e.target.value })} />
          <Input aria-label="Intervention 1" value={f.i1} onChange={(e) => setF({ ...f, i1: e.target.value })} />
          <Input aria-label="Intervention 2" value={f.i2} onChange={(e) => setF({ ...f, i2: e.target.value })} />
          <Input aria-label="Review date" type="date" value={f.reviewDate} onChange={(e) => setF({ ...f, reviewDate: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => accept(true)} data-testid="asam-suggestion-accept-edited">Accept with edits</Button>
            <Button size="sm" variant="outline" onClick={() => run(() => { actFor("asam_plan_suggestion", "editAsamSuggestion", patientId, patientId, s.id, edits(), me); setMode("view"); }, "Suggestion updated")}>Save edits</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("view")}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-medium text-navy">{s.goal}</p>
          <p className="text-xs text-muted-foreground">Problem: {s.problem}</p>
          <p className="text-xs text-muted-foreground">Measure: {s.measure} · Review {s.reviewDate}</p>
          <ul className="text-xs">
            {s.interventions.map((i) => <li key={i.text}>• {i.text}{i.moduleId ? " (recovery lesson)" : ""}</li>)}
          </ul>
          {needs.length > 0 && <p className="text-xs" data-testid="asam-suggestion-needs">Linked social needs: {needs.join(", ")}</p>}
          {s.reentry && <p className="text-xs">Linked: re-entry plan</p>}
        </>
      )}
      {mode === "dismiss" && (
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Reason for dismissing" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1" />
          <Button size="sm" variant="destructive" onClick={() => run(() => actFor("asam_plan_suggestion", "dismissAsamSuggestion", patientId, patientId, s.id, reason, me), "Suggestion dismissed")}>Dismiss</Button>
        </div>
      )}
      {mode === "view" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => accept(false)} data-testid="asam-suggestion-accept">Accept</Button>
          <Button size="sm" variant="outline" onClick={() => setMode("edit")}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("dismiss")}>Dismiss…</Button>
        </div>
      )}
    </li>
  );
}

/** Provenance chip + "Review — ASAM changed" on an accepted goal. Part 2: only rendered for roles that see the goal at all. */
export function AsamGoalChips({ patientId, goal, canEdit }: { patientId: string; goal: StructuredGoal; canEdit: boolean }) {
  const { role, me } = useMe();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const prov = asamProvenanceLabel(goal);
  if (!prov || !roleSeesAsamSection(role, patient)) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="text-[10px]" title={goal.source?.dimensionName} data-testid="asam-provenance-chip">{prov}</Badge>
      {goal.reviewFlag && (
        <>
          <Badge variant="destructive" className="text-[10px]" data-testid="asam-review-flag">
            {goal.reviewFlag.label} (rating {goal.reviewFlag.fromRating} → {goal.reviewFlag.toRating})
          </Badge>
          {canEdit && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => run(() => actFor("asam_plan_suggestion", "markAsamGoalReviewed", patientId, patientId, goal.id, me), "Marked reviewed")}>
              Mark reviewed
            </Button>
          )}
        </>
      )}
      {goal.problemStatement && <span className="text-[11px] text-muted-foreground">Problem: {goal.problemStatement}</span>}
    </div>
  );
}
