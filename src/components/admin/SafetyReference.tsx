import { DAY_ZERO_STEPS } from "@/lib/reentryDayZero";
import { COUNTY_CRISIS_LINES } from "@/lib/outsideCrisisResources";
import { SAFETY_PLAN_SECTIONS } from "@/lib/safetyPlan";
import { NALOXONE_STEPS } from "@/lib/safetyContent";
import { useActingStaff } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
export function SafetyReference() {
  const { role } = useActingStaff(); const sud = roleSeesAsamSection(role);
  return <section className="space-y-4"><h3 className="font-semibold">Safety text · View-only · Draft</h3><p className="text-sm text-muted-foreground">Validated crisis and safety text remains code-held; clinical and Spanish review before launch.</p><div className="grid gap-3 md:grid-cols-2">{Object.entries(COUNTY_CRISIS_LINES).flatMap(([county, lines]) => lines.filter((l) => sud || !l.label.en.includes("SUD")).map((l) => <article key={l.number} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{county} · Crisis line · EN/ES Draft</p><h4 className="font-semibold">{l.label.en}</h4><p>{l.display}</p><p>{l.label.es}</p></article>))}{sud && DAY_ZERO_STEPS.map((s) => <article key={s.id} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Day-zero step · Code-held · View-only</p><h4 className="font-semibold">{s.title}</h4><p>{s.subtitle}</p></article>)}{SAFETY_PLAN_SECTIONS.map((s) => <article key={s.id} className="rounded-lg border border-border bg-card p-4"><h4 className="font-semibold">{s.title}</h4><p className="text-sm">{s.prompt}</p></article>)}{sud && NALOXONE_STEPS.map((s) => <article key={s.step} className="rounded-lg border border-border bg-card p-4"><p className="text-xs">Naloxone · Part 2 · View-only</p><h4 className="font-semibold">{s.title}</h4><p className="text-sm">{s.body}</p></article>)}</div></section>;
}
