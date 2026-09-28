// Patient "My plan" — plain language, no codes. EN/ES (Spanish pending
// bilingual review). Reads the same structured plan the staff editor writes.
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import {
  NEED_LADDER,
  NEED_LADDER_ES,
  acknowledgePlan,
  activityById,
  assignmentWeek,
  completeAssignment,
  getStructuredPlan,
  goalProgress,
  planNeeds,
} from "@/lib/structuredCarePlan";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ClientDate } from "@/components/ClientDate";
import { CheckCircle2, Circle } from "lucide-react";

const COPY = {
  en: {
    title: "My plan",
    goals: "My goals",
    noGoals: "Your care team will add goals with you.",
    week: "This week",
    noWeek: "Nothing assigned this week.",
    done: "done",
    of: "of",
    mark: "Mark done today",
    didIt: "Done today",
    open: "Open",
    needs: "Where my needs stand",
    visits: "Upcoming visits",
    noVisits: "No visits booked yet.",
    ack: "Review and acknowledge my plan",
    acked: "You acknowledged this plan",
    notSigned: "Your care team is still finishing this plan.",
    daily: "daily",
    weekly: "weekly",
    once: "once",
    marked: "Nice work — marked done.",
    thanks: "Thanks — your care team will see that you reviewed your plan.",
  },
  es: {
    title: "Mi plan",
    goals: "Mis metas",
    noGoals: "Su equipo de cuidado agregará metas con usted.",
    week: "Esta semana",
    noWeek: "No hay nada asignado esta semana.",
    done: "hecho",
    of: "de",
    mark: "Marcar como hecho hoy",
    didIt: "Hecho hoy",
    open: "Abrir",
    needs: "Cómo van mis necesidades",
    visits: "Próximas citas",
    noVisits: "Todavía no hay citas.",
    ack: "Revisar y aceptar mi plan",
    acked: "Usted aceptó este plan",
    notSigned: "Su equipo de cuidado todavía está terminando este plan.",
    daily: "diario",
    weekly: "semanal",
    once: "una vez",
    marked: "¡Buen trabajo! Marcado como hecho.",
    thanks: "Gracias. Su equipo verá que revisó su plan.",
  },
} as const;

export function MyPlan({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const L = lang === "es" ? "es" : "en";
  const c = COPY[L];
  const plan = useEhr(() => getStructuredPlan(patientId));
  const needs = useEhr(() => planNeeds(patientId).filter((n) => n.visibleToPatient));
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const visits = useEhr(() =>
    AdelanteEHR.appointmentsForPatient(patientId)
      .filter((a) => a.status === "scheduled" && +new Date(a.start) > Date.now())
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 3),
  );
  const goals = plan.goals.filter((g) => g.status === "active");
  const week = plan.assignments.filter((a) => a.active && a.kind === "activity");
  const r = plan.review;
  const acked = r.acknowledgedAt && r.acknowledgedVersion === r.version;
  const who = { name: patient ? `${patient.firstName} ${patient.lastName}` : "Patient", role: "patient" };

  return (
    <div className="space-y-5" data-testid="my-plan">
      <section>
        <h3 className="font-display text-base text-navy">{c.goals}</h3>
        {goals.length === 0 && <p className="text-sm text-muted-foreground">{c.noGoals}</p>}
        <ul className="mt-2 space-y-2">
          {goals.map((g) => {
            const pct = goalProgress(patientId, g.id);
            return (
              <li key={g.id} className="rounded-lg border p-3 text-sm">
                <p>{g.patientText[L]}</p>
                <Progress value={pct} className="mt-2 h-1.5" aria-label={`${pct}%`} />
              </li>
            );
          })}
        </ul>
      </section>

      <section data-testid="my-plan-week">
        <h3 className="font-display text-base text-navy">{c.week}</h3>
        {week.length === 0 && <p className="text-sm text-muted-foreground">{c.noWeek}</p>}
        <ul className="mt-2 space-y-2">
          {week.map((a) => {
            const w = assignmentWeek(a);
            const act = activityById(a.activityId);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm" data-testid={`my-plan-activity-${a.activityId}`}>
                {w.today ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <Circle className="h-5 w-5 text-muted-foreground" aria-hidden />}
                <span className="min-w-0 flex-1">
                  {a.label[L]} — {c[a.frequency]}, {w.done} {c.of} {w.target} {c.done}
                </span>
                {act && (
                  <Button asChild size="sm" variant="outline">
                    {act.to === "/library" ? (
                      <Link to="/library" search={act.exercise ? { exercise: act.exercise } : {}}>{c.open}</Link>
                    ) : (
                      <Link to="/recovery-journey">{c.open}</Link>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={w.today || (a.frequency !== "daily" && w.done >= w.target)}
                  data-testid={`my-plan-done-${a.activityId}`}
                  onClick={() => {
                    try {
                      completeAssignment(patientId, a.id, who);
                      toast.success(c.marked);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Error");
                    }
                  }}
                >
                  {w.today ? c.didIt : c.mark}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      {needs.length > 0 && (
        <section data-testid="my-plan-needs">
          <h3 className="font-display text-base text-navy">{c.needs}</h3>
          <ul className="mt-2 space-y-2">
            {needs.map((n) => (
              <li key={n.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{n.need}</p>
                <ol className="mt-1 flex flex-wrap gap-1 text-xs">
                  {NEED_LADDER.map((s, i) => {
                    const reached = i <= NEED_LADDER.indexOf(n.step);
                    return (
                      <li key={s} className={`rounded-full border px-2 py-0.5 ${reached ? "border-teal bg-secondary text-navy" : "text-muted-foreground"}`}>
                        {L === "es" ? NEED_LADDER_ES[s] : s}
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-display text-base text-navy">{c.visits}</h3>
        {visits.length === 0 && <p className="text-sm text-muted-foreground">{c.noVisits}</p>}
        <ul className="mt-2 space-y-1 text-sm">
          {visits.map((v) => (
            <li key={v.id}>
              <ClientDate value={v.start} />{" "}
              {new Date(v.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </li>
          ))}
        </ul>
      </section>

      <section>
        {!r.signedAt ? (
          <p className="text-sm text-muted-foreground">{c.notSigned}</p>
        ) : acked ? (
          <p className="text-sm text-muted-foreground" data-testid="my-plan-acked">
            {c.acked} · <ClientDate value={r.acknowledgedAt!} />
          </p>
        ) : (
          <Button
            data-testid="my-plan-ack"
            onClick={() => {
              try {
                acknowledgePlan(patientId, who);
                toast.success(c.thanks);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            }}
          >
            {c.ack}
          </Button>
        )}
      </section>
    </div>
  );
}
