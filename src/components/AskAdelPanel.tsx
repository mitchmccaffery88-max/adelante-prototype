// §Dashboard Standardization Phase 5e — the "Ask Adel" prototype panel.
//
// Read-only by construction: this component renders text and links. There is
// no control here that writes to a record, sends a message, or calls a model.
// The honesty chrome is the SAME chrome the /agentic/* prototypes use, so a
// reviewer sees one consistent label, not a second invented one.
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrototypeBanner } from "@/components/agentic/PrototypeChrome";
import { StaffPatientSearch } from "@/components/StaffPatientSearch";
import { useActingStaff } from "@/lib/roles";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { CohortGuardNoticeInline } from "@/components/CohortGuardNoticeInline";
import {
  ASK_ADEL_FREE_TEXT_NOTE,
  ASK_ADEL_GROUP_LABEL,
  ASK_ADEL_PROTOTYPE_NOTE,
  answerAskAdel,
  askAdelQuestionsFor,
  askAdelShortcutsFor,
  canUseAskAdel,
  roleGroupFor,
} from "@/lib/askAdel";

/** The patient the current route is already about, when there is one. */
function patientIdFromPath(pathname: string): string | undefined {
  const m = pathname.match(/^\/(?:record|agentic\/[a-z-]+)\/([^/]+)/);
  return m?.[1];
}

export function AskAdelPanel() {
  const { role, staffId, staffName, clinicianId } = useActingStaff();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState<string | undefined>();
  const [picked, setPicked] = useState<string | undefined>();

  const routePatientId = patientIdFromPath(pathname);
  const patientId = routePatientId ?? picked;

  const questions = askAdelQuestionsFor(role);
  const shortcuts = askAdelShortcutsFor(role);

  const patient = useEhr(() => (patientId ? AdelanteEHR.getPatient(patientId) : undefined));
  const answer = useEhr(() =>
    asked
      ? answerAskAdel(asked, {
          role,
          staffId,
          staffName,
          ...(clinicianId ? { clinicianId } : {}),
          ...(patientId ? { patientId } : {}),
        })
      : undefined,
  );

  if (!canUseAskAdel(role)) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          data-testid="ask-adel-button"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary"
        >
          <Sparkles className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
          Ask Adel
          <Badge variant="outline" className="border-amber-warm text-[10px] text-amber-warm-foreground">
            Prototype
          </Badge>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
        data-testid="ask-adel-panel"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-navy">Ask Adel</SheetTitle>
          <SheetDescription>{ASK_ADEL_PROTOTYPE_NOTE}</SheetDescription>
        </SheetHeader>

        <PrototypeBanner detail="Answers are read from this demo's own records. Nothing here writes to the chart, sends a message, or calls a model." />

        {/* Sample questions ------------------------------------------------ */}
        {questions.length > 0 && (
          <section className="mt-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {ASK_ADEL_GROUP_LABEL[roleGroupFor(role)]}
            </h3>
            <ul className="space-y-1.5">
              {questions.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    data-testid={`ask-adel-q-${q.id}`}
                    onClick={() => setAsked(q.id)}
                    className={
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors " +
                      (asked === q.id ? "border-teal bg-teal/10" : "hover:bg-secondary")
                    }
                  >
                    {q.prompt}
                    {q.needsPatient && !patientId && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        · needs a patient
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {/* The deliberate non-capability. */}
            <p
              data-testid="ask-adel-free-text-note"
              className="mt-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
            >
              <Info className="mr-1 inline h-3 w-3" aria-hidden="true" />
              {ASK_ADEL_FREE_TEXT_NOTE}
            </p>
          </section>
        )}

        {/* Answer ----------------------------------------------------------- */}
        {answer && (
          <section
            data-testid="ask-adel-answer"
            className="mt-4 rounded-xl border bg-card p-3"
            aria-live="polite"
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {answer.backing === "real" ? "From this demo's records" : "Illustrative example"}
              </Badge>
            </div>
            <ul className="space-y-1 text-sm text-foreground">
              {answer.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
            {answer.guard?.belowMinimumCohort && (
              <div className="mt-2">
                <CohortGuardNoticeInline guard={answer.guard} />
              </div>
            )}
            {answer.notes?.map((n, i) => (
              <p key={i} className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {n}
              </p>
            ))}
            {answer.link && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to={answer.link.to}>
                  {answer.link.label}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </section>
        )}

        {/* Encounter shortcuts --------------------------------------------- */}
        {shortcuts.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Encounter tools (prototype)
            </h3>
            {patientId && patient ? (
              <p className="mb-2 text-xs text-muted-foreground">
                For {patient.firstName} {patient.lastName}
                {routePatientId ? " — the patient on this page." : " — the patient you picked."}
              </p>
            ) : (
              <div className="mb-2 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Pick a patient to open one of these.
                </p>
                <StaffPatientSearch variant="inline" onSelect={(id) => setPicked(id)} />
              </div>
            )}
            <ul className="space-y-1.5">
              {shortcuts.map((s) => (
                <li key={s.id}>
                  {patientId ? (
                    <Link
                      to={s.path(patientId)}
                      onClick={() => setOpen(false)}
                      data-testid={`ask-adel-shortcut-${s.id}`}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-secondary"
                    >
                      <span>
                        <span className="block font-medium">{s.label}</span>
                        <span className="block text-xs text-muted-foreground">{s.desc}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-teal" aria-hidden="true" />
                    </Link>
                  ) : (
                    <div
                      data-testid={`ask-adel-shortcut-${s.id}`}
                      className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"
                    >
                      <span className="block font-medium">{s.label}</span>
                      <span className="block text-xs">{s.desc}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}
