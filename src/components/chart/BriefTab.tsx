// §Chart redesign turn 3 — "Brief" landing tab. Cards in a role-default
// order (chartBrief.roleCardOrder); empty cards collapse to one line; every
// card has "See all" to its full section. Same Part 2 filters as the chart.
import { useState, type ReactNode } from "react";
import { AdelanteEHR, isVisitCancelled, useEhr } from "@/lib/ehr";
import { canAccess, isPrescriberRole, useActingStaff, type StaffRole } from "@/lib/roles";
import {
  BANDS_DRAFT_LABEL, bucketOf, dueNow, measureSeries, openReferrals, roleCardOrder, roleDiscipline, scoreBand,
  visibleMeds, type Band, type Bucket, type BriefCard,
} from "@/lib/chartBrief";
import { latestFromHistory } from "@/lib/trackingTimeline";
import { CSSRS_KEY } from "@/lib/cssrs";
import { listLabOrders, listMetabolic, labTest, metabolicFlags } from "@/lib/chartOrders";
import { staffPlanView, goalProgress, planNeeds, NEED_LADDER } from "@/lib/structuredCarePlan";
import { hieChartView, HIE_LABEL } from "@/lib/hie";
import { openChartAction } from "@/lib/chartActionBus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const BAND_CLS: Record<Band, string> = {
  red: "border-destructive/50 bg-destructive/10 text-destructive",
  amber: "border-gold/60 bg-gold/20 text-navy",
  green: "border-teal/40 bg-teal/10 text-teal",
};

function BriefCardShell({
  id, title, empty, emptyText, sectionId, onSelect, children, visible,
}: {
  id: BriefCard;
  title: string;
  empty: boolean;
  emptyText: string;
  sectionId: string;
  onSelect: (id: string) => void;
  children?: ReactNode;
  visible: string[];
}) {
  const seeAll = visible.includes(sectionId) ? (
    <button type="button" onClick={() => onSelect(sectionId)} className="text-xs text-teal hover:underline">See all</button>
  ) : null;
  if (empty)
    return (
      <Card data-testid={`brief-card-${id}`} data-empty="true" className="flex items-center gap-2 px-3 py-2 text-sm">
        <span className="font-medium text-navy">{title}</span>
        <span className="flex-1 truncate text-xs text-muted-foreground">{emptyText}</span>
        {seeAll}
      </Card>
    );
  return (
    <Card data-testid={`brief-card-${id}`} className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold text-navy">{title}</h3>
        {seeAll}
      </div>
      {children}
    </Card>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60},${20 - (v / max) * 18}`).join(" ");
  return (
    <svg width="60" height="22" aria-hidden className="text-navy">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function BriefTab({ patientId, visibleSections, onSelectSection }: { patientId: string; visibleSections: string[]; onSelectSection: (id: string) => void }) {
  const { role } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [mineOnly, setMineOnly] = useState(false);
  const [bucket, setBucket] = useState<Bucket | undefined>();
  useEhr(() => AdelanteEHR.listAuditEvents({ patientId }).length);
  if (!patient) return null;
  const order = roleCardOrder(role);
  const common = { onSelect: onSelectSection, visible: visibleSections };

  const due = dueNow(patient, role).filter((r) => !mineOnly || r.discipline === roleDiscipline(role));
  const buckets: Record<Bucket, typeof due> = { past: [], today: [], week: [] };
  for (const r of due) {
    const b = bucketOf(r.due);
    if (b) buckets[b].push(r);
  }
  const firstNonEmpty = (["past", "today", "week"] as Bucket[]).find((b) => buckets[b].length) ?? "today";
  const activeBucket = bucket && buckets[bucket].length ? bucket : firstNonEmpty;
  const dueTotal = buckets.past.length + buckets.today.length + buckets.week.length;

  const cards: Record<BriefCard, () => ReactNode> = {
    due: () => (
      <BriefCardShell id="due" title="Due now" empty={false} emptyText="" sectionId="tasks" {...common}>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["past", "today", "week"] as Bucket[]).map((b) => (
            <button
              key={b}
              type="button"
              data-testid={`due-bucket-${b}`}
              aria-pressed={activeBucket === b}
              onClick={() => setBucket(b)}
              className={`rounded-full border px-2 py-0.5 text-xs ${activeBucket === b ? "bg-navy text-primary-foreground" : ""} ${b === "past" && buckets.past.length ? "border-destructive/50" : ""}`}
            >
              {b === "past" ? "Past due" : b === "today" ? "Due today" : "Next 7 days"} ({buckets[b].length})
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch checked={mineOnly} onCheckedChange={setMineOnly} aria-label="My discipline only" /> My discipline only
          </label>
        </div>
        {dueTotal === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="space-y-1">
            {buckets[activeBucket].map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => (r.actionId ? openChartAction(r.actionId) : r.sectionId && onSelectSection(r.sectionId))}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
                >
                  <span className="flex-1">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.due.length === 10 ? `${r.due}T12:00:00` : r.due).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BriefCardShell>
    ),
    measures: () => {
      const series = (["phq-9", "gad-7"] as const).map((k) => ({ k, s: measureSeries(patient, role, k) }));
      const cs = latestFromHistory(patient, CSSRS_KEY);
      const presc = isPrescriberRole(role);
      const met = presc ? listMetabolic(patientId).at(-1) : undefined;
      const level = presc
        ? listLabOrders(patientId, role).find((o) => o.result && ["lithium", "valproate", "cbc_anc"].includes(o.testId))
        : undefined;
      const empty = series.every((x) => !x.s.length) && !cs && !met && !level;
      return (
        <BriefCardShell id="measures" title="Measures" empty={empty} emptyText="No scores yet." sectionId="tracking" {...common}>
          <div className="flex flex-wrap gap-2" data-testid="measures-ribbon">
            {series.filter((x) => x.s.length).map(({ k, s }) => {
              const last = s[s.length - 1]!;
              return (
                <div key={k} className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${BAND_CLS[scoreBand(k, last.score)]}`}>
                  <span className="font-semibold">{k.toUpperCase()} {last.score}</span>
                  <Spark values={s.map((x) => x.score)} />
                  <span className="text-muted-foreground">{new Date(last.date).toLocaleDateString()}</span>
                </div>
              );
            })}
            {cs && (
              <div className={`rounded-md border px-2 py-1 text-xs ${BAND_CLS[/high/i.test(cs.severity) ? "red" : /moderate/i.test(cs.severity) ? "amber" : "green"]}`}>
                <span className="font-semibold">C-SSRS</span> {cs.severity} · {new Date(cs.completedAt).toLocaleDateString()}
              </div>
            )}
            {met && (
              <div className={`rounded-md border px-2 py-1 text-xs ${BAND_CLS[metabolicFlags(met).bp === "high" || metabolicFlags(met).bmi !== "normal" ? "amber" : "green"]}`} data-testid="measures-metabolic">
                BP {met.bpSystolic}/{met.bpDiastolic} · {met.weightKg} kg · BMI {met.bmi} · {new Date(met.at).toLocaleDateString()}
              </div>
            )}
            {level?.result && (
              <div className={`rounded-md border px-2 py-1 text-xs ${BAND_CLS[level.result.flag === "normal" ? "green" : "red"]}`} data-testid="measures-drug-level">
                {labTest(level.testId)?.label} {level.result.value} {level.result.unit} · {new Date(level.result.date).toLocaleDateString()}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{BANDS_DRAFT_LABEL}</p>
        </BriefCardShell>
      );
    },
    problems: () => {
      const probs = staffPlanView(patientId, role).problems.filter((x) => x.source === "problem_list").slice(0, 5);
      return (
        <BriefCardShell id="problems" title="Problems" empty={!probs.length} emptyText="No active problems." sectionId="problems" {...common}>
          <ul className="space-y-0.5 text-sm">
            {probs.map((x) => (
              <li key={x.id}><span className="font-mono text-xs text-muted-foreground">{x.code}</span> {x.label}</li>
            ))}
          </ul>
        </BriefCardShell>
      );
    },
    meds: () => {
      const { visible, hidden } = visibleMeds(patient, role as StaffRole);
      const canSee = canAccess(role, "meds_erx", patient).level !== "none";
      if (!canSee) return null;
      return (
        <BriefCardShell id="meds" title="Medications" empty={!visible.length && !hidden} emptyText="No active medications." sectionId="orders" {...common}>
          <ul className="space-y-0.5 text-sm">
            {visible.map((o) => (
              <li key={o.id}>{o.productName ?? o.drugName} {o.dose ? <span className="text-xs text-muted-foreground">{o.dose} {o.frequency ?? ""}</span> : null}</li>
            ))}
          </ul>
          {hidden > 0 && <p className="text-xs text-muted-foreground">Some medications are not shown.</p>}
        </BriefCardShell>
      );
    },
    careplan: () => {
      if (canAccess(role, "care_plan", patient).level === "none") return null;
      const v = staffPlanView(patientId, role);
      const goals = v.goals.filter((g) => g.status === "active");
      const acts = v.assignments.filter((a) => a.active && a.kind === "activity");
      return (
        <BriefCardShell id="careplan" title="This week's care plan" empty={!goals.length} emptyText="No active goals." sectionId="care-plan" {...common}>
          <ul className="space-y-1 text-sm">
            {goals.slice(0, 4).map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">{g.clinicalText}</span>
                <span className="h-1.5 w-16 overflow-hidden rounded bg-muted"><span className="block h-full bg-teal" style={{ width: `${goalProgress(patientId, g.id)}%` }} /></span>
              </li>
            ))}
          </ul>
          {acts.length > 0 && <p className="text-xs text-muted-foreground">{acts.length} activit{acts.length === 1 ? "y" : "ies"} assigned this week.</p>}
        </BriefCardShell>
      );
    },
    visits: () => {
      if (!visibleSections.includes("appointments")) return null;
      const appts = AdelanteEHR.listAppointments().filter((a) => a.patientId === patientId);
      const now = Date.now();
      const next = appts.find((a) => a.status === "scheduled" && +new Date(a.start) >= now);
      const last = [...appts].reverse().find((a) => +new Date(a.start) < now && !isVisitCancelled(a.status));
      return (
        <BriefCardShell id="visits" title="Upcoming and last visits" empty={!next && !last} emptyText="No visits on file." sectionId="appointments" {...common}>
          <ul className="space-y-0.5 text-sm">
            {next && <li>Next: {new Date(next.start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</li>}
            {last && <li>Last: {new Date(last.start).toLocaleDateString()} · {last.status === "no_show" ? "missed" : last.status}</li>}
          </ul>
        </BriefCardShell>
      );
    },
    needs: () => {
      if (canAccess(role, "sdoh", patient).level === "none") return null;
      const needs = planNeeds(patientId);
      return (
        <BriefCardShell id="needs" title="Needs" empty={!needs.length} emptyText="No open needs." sectionId="sdoh" {...common}>
          <ul className="space-y-1 text-sm">
            {needs.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1">{n.need}</span>
                <span className="flex gap-0.5">
                  {NEED_LADDER.map((s) => (
                    <span key={s} className={`rounded px-1 text-[10px] ${NEED_LADDER.indexOf(s) <= NEED_LADDER.indexOf(n.step) ? "bg-teal/20 text-teal" : "bg-muted text-muted-foreground"}`}>{s}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </BriefCardShell>
      );
    },
    outside: () => {
      const enc = hieChartView(patientId, role).encounters.slice(0, 3);
      return (
        <BriefCardShell id="outside" title="Outside events (HIE)" empty={!enc.length} emptyText="No outside events." sectionId="outside-records" {...common}>
          <ul className="space-y-0.5 text-sm">
            {enc.map((e) => (
              <li key={e.id}>{new Date(e.at).toLocaleDateString()} — {e.kind.replace("_", " ")} · {e.facility}</li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground">{HIE_LABEL}</p>
        </BriefCardShell>
      );
    },
    referrals: () => {
      const refs = openReferrals(patient, role);
      return (
        <BriefCardShell id="referrals" title="Open referrals" empty={!refs.length} emptyText="No open referrals." sectionId="episodes" {...common}>
          <ul className="space-y-0.5 text-sm">
            {refs.map((r) => (
              <li key={r.id} className="flex gap-2"><span className="flex-1 capitalize">{r.label}</span><Badge variant="outline" className="text-[10px]">{r.status}</Badge></li>
            ))}
          </ul>
        </BriefCardShell>
      );
    },
  };

  return (
    <div className="space-y-2" data-testid="brief-tab" data-card-order={order.join(",")}>
      {order.map((c) => <div key={c}>{cards[c]()}</div>)}
    </div>
  );
}
