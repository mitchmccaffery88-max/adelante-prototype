// §Adel-guided intake (prototype, demo slice) — profile + benefits only.
//
// Rules this component enforces:
//  - crisis first: every TYPED message goes through the real Phase 1
//    detectCrisisLanguage / scanTextForCrisis (same as Patient Adel chat)
//    before anything else; a tripped message is never used as an answer;
//  - nothing is applied to the intake draft until the patient confirms it;
//  - saves only through the existing writes (profilePatch → updateProfile,
//    recordIntakeBenefits as patient_reported), tagged via adel_guided_intake;
//  - never takes consent and never marks intake complete: it hands back to the
//    form's consent step.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FlaskConical, LifeBuoy, Send } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { detectCrisisLanguage, scanTextForCrisis, crisisMatchLanguage } from "@/lib/crisisTextDetection";
import { crisisCopy } from "@/lib/crisisCopy";
import { useI18n } from "@/lib/i18n";
import { listManagedCarePlans } from "@/lib/managedCarePlans";
import { profilePatch, type IntakeProfile } from "@/lib/intakeProfile";
import { benefitsAnswers, recordIntakeBenefits, type BenefitsFormState } from "@/lib/intakeBenefits";
import { selectedPlanSnapshot } from "@/components/intake/BenefitsStep";
import {
  ADEL_COPY,
  ADEL_QUESTIONS,
  displayValue,
  hasKnownValue,
  matchChoice,
  nextQuestionIndex,
  type AdelIntakeState,
  type AdelLang,
} from "@/lib/adelIntakeScript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { from: "adel" | "me"; text: string; crisis?: boolean };
type Phase =
  | { kind: "prefill"; idx: number }
  | { kind: "ask"; idx: number }
  | { kind: "confirm"; idx: number; value: string }
  | { kind: "done" };

export function AdelGuidedIntake({
  patientId,
  profile,
  benefits,
  onProfile,
  onBenefits,
  consentOnFile,
  onHandoff,
  onExit,
}: {
  patientId: string;
  profile: IntakeProfile;
  benefits: BenefitsFormState;
  onProfile: (p: IntakeProfile) => void;
  onBenefits: (b: BenefitsFormState) => void;
  consentOnFile: boolean;
  onHandoff: () => void;
  onExit: () => void;
}) {
  const { lang: appLang } = useI18n();
  const lang: AdelLang = appLang === "es" ? "es" : "en";
  const c = ADEL_COPY[lang];
  const plans = useEhr(() => listManagedCarePlans());
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const state: AdelIntakeState = { profile, benefits };
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "ask", idx: -1 });
  const [draft, setDraft] = useState("");
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const say = (text: string, extra: Partial<Msg> = {}) =>
    setMsgs((m) => [...m, { from: "adel", text, ...extra }]);
  const me = (text: string) => setMsgs((m) => [...m, { from: "me", text }]);

  function ask(idx: number, s: AdelIntakeState) {
    const i = nextQuestionIndex(s, idx);
    if (i < 0) return finish(s);
    const q = ADEL_QUESTIONS[i];
    if (hasKnownValue(q, s)) {
      say(c.weHave.replace("{v}", displayValue(q, q.get(s), lang, plans)));
      setPhase({ kind: "prefill", idx: i });
    } else {
      say(q.prompt[lang]);
      setPhase({ kind: "ask", idx: i });
    }
  }

  // Opening line + first question, once.
  useEffect(() => {
    say(c.intro);
    ask(0, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  function apply(idx: number, value: string): AdelIntakeState {
    const q = ADEL_QUESTIONS[idx];
    const next = q.set(state, value);
    if (q.group === "profile") onProfile(next.profile);
    else onBenefits(next.benefits);
    setConfirmed((f) => (f.includes(q.id) ? f : [...f, q.id]));
    return next;
  }

  function finish(s: AdelIntakeState) {
    setPhase({ kind: "done" });
    // Commit ONLY what was confirmed, through the existing writes.
    const fields = confirmedRef.current;
    if (fields.some((f) => ADEL_QUESTIONS.find((q) => q.id === f)?.group === "profile")) {
      AdelanteEHR.saveIntakeProfileViaAdel(patientId, profilePatch(s.profile), fields.filter((f) => ADEL_QUESTIONS.find((q) => q.id === f)?.group === "profile"));
    }
    if (fields.includes("benefitsChoice") || fields.includes("cin")) {
      const answers = benefitsAnswers(s.benefits, selectedPlanSnapshot(s.benefits.planId));
      if (answers) {
        recordIntakeBenefits(patientId, answers, {
          source: "patient_reported",
          via: "adel_guided_intake",
          actorId: patientId,
          actorName: patient ? `${patient.firstName} ${patient.lastName}` : "Patient",
          actorRole: "patient",
        });
      }
    }
    say(consentOnFile ? c.handoffNoConsent : c.handoff);
  }
  const confirmedRef = useRef<string[]>([]);
  confirmedRef.current = confirmed;

  function handleAnswer(raw: string, typed: boolean) {
    const text = raw.trim();
    if (!text) return;
    // ── Crisis first, on every typed message, before anything else ────────
    if (typed) {
      const hit = detectCrisisLanguage(text);
      if (hit.matched) {
        me(text);
        scanTextForCrisis(patientId, text, { surface: "a message to Adel" });
        say(crisisCopy(crisisMatchLanguage(hit.patternIds)).adelReply, { crisis: true });
        return; // not treated as an answer; the question stays open
      }
    }
    if (phase.kind === "done") return;
    if (phase.kind === "ask" && phase.idx < 0) return;
    const idx = phase.idx;
    const q = ADEL_QUESTIONS[idx];

    if (phase.kind === "prefill" || phase.kind === "confirm") {
      // Only the two confirmation answers are accepted here.
      const yn = matchChoice(text, [
        { value: "yes", label: c.yes, words: ["yes", "si", "yeah", "correct", "right", "correcto"] },
        { value: "no", label: c.change, words: ["no", "change", "cambiar", "wrong"] },
      ]);
      me(text);
      if (yn === "yes") {
        let s = state;
        if (phase.kind === "confirm") s = apply(idx, phase.value);
        else setConfirmed((f) => (f.includes(q.id) ? f : [...f, q.id]));
        confirmedRef.current = Array.from(new Set([...confirmedRef.current, q.id]));
        say(c.saved);
        ask(idx + 1, s);
      } else if (yn === "no") {
        say(q.prompt[lang]);
        setPhase({ kind: "ask", idx });
      } else {
        say(c.didntCatch);
      }
      return;
    }

    // phase: ask
    me(text);
    let value: string | undefined = text;
    if (q.kind === "choice") {
      value = matchChoice(text, q.choices?.(lang, plans) ?? []);
      if (!value) return say(c.didntCatch);
    } else if (q.validate) {
      const err = q.validate(text);
      if (err) return say(c[err]);
    }
    say(c.youSaid.replace("{v}", displayValue(q, value, lang, plans)));
    setPhase({ kind: "confirm", idx, value });
  }

  function skip() {
    if (phase.kind !== "ask" || phase.idx < 0) return;
    me(c.skip);
    say(c.skipped);
    ask(phase.idx + 1, state);
  }

  const chips = useMemo(() => {
    if (phase.kind === "prefill" || phase.kind === "confirm") return [c.yes, c.change];
    if (phase.kind === "ask" && phase.idx >= 0) {
      const q = ADEL_QUESTIONS[phase.idx];
      return q.kind === "choice" ? (q.choices?.(lang, plans) ?? []).map((ch) => ch.label) : [];
    }
    return [];
  }, [phase, lang, plans, c]);
  const canSkip = phase.kind === "ask" && phase.idx >= 0 && ADEL_QUESTIONS[phase.idx].optional;

  return (
    <div className="space-y-3" data-testid="adel-guided-intake">
      <div
        role="note"
        data-testid="adel-intake-prototype-banner"
        className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-[13px] leading-snug text-amber-900 dark:text-amber-100"
      >
        <div className="flex items-start gap-2">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">{c.banner}</span> {c.bannerDetail}
            {c.pending && <span className="block text-xs italic">{c.pending}</span>}
          </div>
        </div>
      </div>

      <div className="max-h-[50vh] min-h-[200px] space-y-2 overflow-y-auto rounded-lg border bg-secondary/30 p-3">
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                m.from === "me" ? "bg-navy text-navy-foreground" : "bg-card border",
                m.crisis && "border-destructive/60 bg-destructive/10",
              )}
              data-testid={m.crisis ? "adel-intake-crisis-reply" : undefined}
            >
              {m.text}
              {m.crisis && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="destructive">
                    <a href="tel:988">Call 988</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="sms:988">Text 988</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/crisis">
                      <LifeBuoy className="mr-1 h-3.5 w-3.5" /> {c.getHelp}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {phase.kind === "done" ? (
        <Button className="min-h-11 w-full" onClick={onHandoff} data-testid="adel-intake-handoff">
          {c.toForm}
        </Button>
      ) : (
        <>
          {(chips.length > 0 || canSkip) && (
            <div className="flex flex-wrap gap-2">
              {chips.map((label) => (
                <Button key={label} size="sm" variant="outline" className="min-h-9" onClick={() => handleAnswer(label, false)}>
                  {label}
                </Button>
              ))}
              {canSkip && (
                <Button size="sm" variant="ghost" className="min-h-9" onClick={skip}>
                  {c.skip}
                </Button>
              )}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft;
              setDraft("");
              handleAnswer(t, true);
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={c.placeholder}
              aria-label={c.placeholder}
              data-testid="adel-intake-input"
            />
            <Button type="submit" size="icon" aria-label={c.send}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </>
      )}
      <button type="button" className="text-xs text-muted-foreground underline" onClick={onExit}>
        {c.backToForm}
      </button>
    </div>
  );
}
