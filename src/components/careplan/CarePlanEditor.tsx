// Staff structured care plan editor. Same access as the chart's care plan
// section; SUD-linked goals/assignments/problems filtered by staffPlanView.
import { useState } from "react";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  PLAN_ACTIVITIES,
  PLAN_DRAFT_LABEL,
  NEED_LADDER,
  acceptSuggestion,
  addStructuredGoal,
  assignToGoal,
  assignmentWeek,
  canEditPlan,
  canSignPlan,
  closeStructuredGoal,
  dismissSuggestion,
  goalProgress,
  planNeeds,
  planReviewDue,
  planSuggestions,
  signPlan,
  staffPlanView,
  type Frequency,
  type GoalOwner,
} from "@/lib/structuredCarePlan";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ClientDate } from "@/components/ClientDate";
import { Sparkles, Target } from "lucide-react";

const OWNER_LABEL: Record<GoalOwner, string> = { patient: "Patient", clinician: "Clinician", case_manager: "Case manager" };
const selectCls = "h-9 rounded-md border bg-background px-2 text-sm";

function run(fn: () => void, ok: string) {
  try {
    fn();
    toast.success(ok);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Could not save.");
  }
}

export function CarePlanEditor({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const actor = useActingStaff();
  const role = actor.role;
  const me = { name: actor.staffName, role };
  const view = useEhr(() => staffPlanView(patientId, role));
  const suggestions = useEhr(() => planSuggestions(patientId));
  const needs = useEhr(() => planNeeds(patientId));
  const due = useEhr(() => planReviewDue(patientId));
  const edit = !readOnly && canEditPlan(role);
  const activeGoals = view.goals.filter((g) => g.status === "active");
  const r = view.plan.review;

  const [form, setForm] = useState({ clinical: "", en: "", es: "", owner: "patient" as GoalOwner, measure: "", target: "", problems: [] as string[] });
  const [assign, setAssign] = useState<Record<string, { activity: string; freq: Frequency }>>({});
  const [suggGoal, setSuggGoal] = useState<Record<string, string>>({});
  const [cadence, setCadence] = useState(String(r.cadenceDays));

  // Current rules are all non-SUD, so every role that can edit may see them.
  const visibleSuggestions = suggestions;

  return (
    <Card className="space-y-5 p-4" data-testid="care-plan-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-display text-base text-navy">
            <Target className="h-4 w-4 text-teal" /> Structured care plan
          </h4>
          <p className="text-[11px] text-muted-foreground">
            {r.signedAt ? (
              <>
                Version {r.version} signed by {r.signedBy} · <ClientDate value={r.signedAt} />
                {r.changedSinceSigned && <span className="text-destructive"> · Changed since signing</span>}
              </>
            ) : (
              "Not signed yet"
            )}
            {r.acknowledgedAt && (
              <>
                {" "}· Patient acknowledged v{r.acknowledgedVersion} on <ClientDate value={r.acknowledgedAt} />
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {r.reviewDueAt && (
            <Badge variant={due ? "destructive" : "outline"} data-testid="plan-review-due">
              {due ? "Plan review due" : "Review due"} · <ClientDate value={r.reviewDueAt} options={{ dateStyle: "medium" }} />
            </Badge>
          )}
          {edit && canSignPlan(role) && (
            <>
              <select aria-label="Review cadence" className={selectCls} value={cadence} onChange={(e) => setCadence(e.target.value)}>
                <option value="30">Review every 30 days</option>
                <option value="60">Every 60 days</option>
                <option value="90">Every 90 days</option>
              </select>
              <Button size="sm" data-testid="plan-sign" onClick={() => run(() => signPlan(patientId, me, { cadenceDays: Number(cadence) }), "Plan signed")}>
                Sign plan
              </Button>
            </>
          )}
        </div>
      </div>
      {view.hiddenCount > 0 && <p className="text-xs text-muted-foreground">Some plan items are not shown for your role.</p>}

      <section>
        <h5 className="text-xs font-medium uppercase tracking-wider text-navy">Problems</h5>
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="plan-problems">
          {view.problems.map((p) => (
            <li key={p.id} className="rounded-md border px-2 py-1 text-xs">
              {p.code && <span className="font-mono">{p.code} </span>}
              {p.label}
              {p.codeDraft && p.code && <span className="text-muted-foreground"> (draft code)</span>}
            </li>
          ))}
          {view.problems.length === 0 && <li className="text-xs text-muted-foreground">No problems recorded.</li>}
        </ul>
      </section>

      {edit && visibleSuggestions.length > 0 && (
        <section className="rounded-lg border border-teal/40 bg-secondary/40 p-3" data-testid="plan-suggestions">
          <h5 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-navy">
            <Sparkles className="h-3.5 w-3.5" /> Adel suggestions
          </h5>
          <p className="text-[11px] text-muted-foreground">Rule-based. You decide. Thresholds: {PLAN_DRAFT_LABEL}.</p>
          <ul className="mt-2 space-y-2">
            {visibleSuggestions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 text-sm" data-testid={`plan-suggestion-${s.id}`}>
                <span className="flex-1">
                  {s.label}
                  <span className="block text-[11px] text-muted-foreground">
                    {s.rule} · {s.why}
                  </span>
                </span>
                <select aria-label="Link to goal" className={selectCls} value={suggGoal[s.id] ?? activeGoals[0]?.id ?? ""} onChange={(e) => setSuggGoal({ ...suggGoal, [s.id]: e.target.value })}>
                  {activeGoals.map((g) => (
                    <option key={g.id} value={g.id}>{g.clinicalText.slice(0, 40)}</option>
                  ))}
                </select>
                <Button size="sm" data-testid={`plan-suggestion-accept-${s.id}`} disabled={!activeGoals.length} onClick={() => run(() => acceptSuggestion(patientId, s.id, suggGoal[s.id] ?? activeGoals[0]!.id, me), "Suggestion accepted")}>
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = window.prompt("Why dismiss this suggestion? (required)") ?? "";
                    run(() => dismissSuggestion(patientId, s.id, reason, me), "Suggestion dismissed");
                  }}
                >
                  Dismiss
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h5 className="text-xs font-medium uppercase tracking-wider text-navy">Goals</h5>
        {view.goals.length === 0 && <p className="text-xs text-muted-foreground">No goals yet.</p>}
        {view.goals.map((g) => {
          const pct = goalProgress(patientId, g.id);
          const as = view.assignments.filter((a) => a.goalId === g.id && a.active);
          const pick = assign[g.id] ?? { activity: PLAN_ACTIVITIES[0].id, freq: "daily" as Frequency };
          return (
            <div key={g.id} className="rounded-lg border p-3 text-sm" data-testid={`plan-goal-${g.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy">{g.clinicalText}</p>
                  <p className="text-xs text-muted-foreground">Patient sees: “{g.patientText.en}”</p>
                  <p className="text-[11px] text-muted-foreground">
                    Owner: {OWNER_LABEL[g.owner]}
                    {g.measure && ` · Measure: ${g.measure}`}
                    {g.targetDate && (
                      <>
                        {" "}· Target <ClientDate value={g.targetDate} options={{ dateStyle: "medium" }} />
                      </>
                    )}
                    {g.problemIds.length > 0 && ` · Linked: ${g.problemIds.map((id) => view.problems.find((p) => p.id === id)?.code ?? view.problems.find((p) => p.id === id)?.label ?? "").filter(Boolean).join(", ")}`}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">{g.status}</Badge>
              </div>
              <Progress value={pct} className="mt-2 h-1.5" />
              <p className="mt-1 text-[11px] text-muted-foreground">{pct}% progress</p>
              <ul className="mt-2 space-y-1">
                {as.map((a) => {
                  const w = assignmentWeek(a);
                  return (
                    <li key={a.id} className="text-xs">
                      • {a.label.en} — {a.frequency}
                      {a.kind !== "sdoh_referral" && `, ${w.done} of ${w.target} this week`}
                      <span className="text-muted-foreground"> · {a.reason === "rule" ? "Adel suggestion, accepted" : "Ad hoc"} by {a.assignedBy}</span>
                    </li>
                  );
                })}
              </ul>
              {edit && g.status === "active" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select aria-label="Activity" className={selectCls} value={pick.activity} onChange={(e) => setAssign({ ...assign, [g.id]: { ...pick, activity: e.target.value } })}>
                    {PLAN_ACTIVITIES.map((a) => (
                      <option key={a.id} value={a.id}>{a.label.en}</option>
                    ))}
                  </select>
                  <select aria-label="Frequency" className={selectCls} value={pick.freq} onChange={(e) => setAssign({ ...assign, [g.id]: { ...pick, freq: e.target.value as Frequency } })}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="once">Once</option>
                  </select>
                  <Button size="sm" variant="outline" data-testid={`plan-assign-${g.id}`} onClick={() => run(() => assignToGoal({ patientId, goalId: g.id, kind: "activity", activityId: pick.activity, frequency: pick.freq, actor: me }), "Activity assigned")}>
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const reason = window.prompt("Reason for closing this goal (required)") ?? "";
                      const met = window.confirm("Was the goal met? OK = met, Cancel = closed without meeting it.");
                      run(() => closeStructuredGoal(patientId, g.id, met ? "met" : "closed", reason, me), "Goal closed");
                    }}
                  >
                    Close goal
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {edit && (
        <section className="space-y-2 rounded-lg border p-3" data-testid="plan-add-goal">
          <h5 className="text-xs font-medium uppercase tracking-wider text-navy">Add a goal</h5>
          <Input placeholder="Clinical wording" maxLength={300} value={form.clinical} onChange={(e) => setForm({ ...form, clinical: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Patient wording (English)" maxLength={300} value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} />
            <Input placeholder="Patient wording (Spanish)" maxLength={300} value={form.es} onChange={(e) => setForm({ ...form, es: e.target.value })} />
            <Input placeholder='Measure, e.g. "PHQ-9 below 10"' maxLength={200} value={form.measure} onChange={(e) => setForm({ ...form, measure: e.target.value })} />
            <Input type="date" aria-label="Target date" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
          </div>
          <select aria-label="Owner" className={selectCls} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value as GoalOwner })}>
            {Object.entries(OWNER_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 text-xs">
            {view.problems.map((p) => (
              <label key={p.id} className="flex items-center gap-1 rounded border px-2 py-1">
                <input
                  type="checkbox"
                  checked={form.problems.includes(p.id)}
                  onChange={(e) => setForm({ ...form, problems: e.target.checked ? [...form.problems, p.id] : form.problems.filter((x) => x !== p.id) })}
                />
                {p.label}
              </label>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() =>
              run(() => {
                addStructuredGoal({
                  patientId,
                  problemIds: form.problems,
                  needIds: form.problems.map((id) => view.problems.find((p) => p.id === id)?.needId).filter((x): x is string => !!x),
                  owner: form.owner,
                  measure: form.measure,
                  targetDate: form.target || undefined,
                  clinicalText: form.clinical,
                  patientText: { en: form.en, es: form.es },
                  actor: me,
                });
                setForm({ clinical: "", en: "", es: "", owner: "patient", measure: "", target: "", problems: [] });
              }, "Goal added")
            }
          >
            Add goal
          </Button>
        </section>
      )}

      <section>
        <h5 className="text-xs font-medium uppercase tracking-wider text-navy">Social needs</h5>
        <ul className="mt-2 space-y-1 text-xs">
          {needs.map((n) => (
            <li key={n.id}>
              {n.need}: {NEED_LADDER.map((s) => (s === n.step ? `[${s}]` : s)).join(" → ")}
              {n.goalIds.length > 0 && <span className="text-muted-foreground"> · supports {n.goalIds.length} goal{n.goalIds.length === 1 ? "" : "s"}</span>}
            </li>
          ))}
          {needs.length === 0 && <li className="text-muted-foreground">No social needs recorded.</li>}
        </ul>
      </section>

      {r.history.length > 0 && (
        <section>
          <h5 className="text-xs font-medium uppercase tracking-wider text-navy">Version history</h5>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {[...r.history].reverse().map((h) => (
              <li key={h.version}>
                v{h.version} · signed by {h.by} · <ClientDate value={h.at} /> · {h.goals} goals, {h.assignments} assignments
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[11px] text-muted-foreground">Suggestion thresholds, draft ICD-10 Z-codes and patient wording: {PLAN_DRAFT_LABEL}.</p>
    </Card>
  );
}
