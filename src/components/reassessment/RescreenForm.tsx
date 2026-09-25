// §Phase 9b — targeted re-screen: ONE questionnaire, not the whole intake.
// Uses the same instrument definitions (`SCREENERS`) and the same question/
// option markup as intake's screener step; saving goes through
// `AdelanteEHR.completeRescreen` → `scoreScreener` + `recordScreener`.
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { activeScreenerByKey, rescreenRule, screenerComplete } from "@/lib/screeners";
import { ScreenerItems } from "@/components/screeners/ScreenerItems";
import { useI18n } from "@/lib/i18n";
import { REASSESS_COPY, rescreenName } from "@/lib/reassessmentCopy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { Slim988Bar } from "@/components/patient/Slim988Bar";

export function RescreenForm({ screenerKey }: { screenerKey: string }) {
  const { lang } = useI18n();
  const L = lang === "es" ? "es" : "en";
  const c = REASSESS_COPY[L];
  const navigate = useNavigate();
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const allowed = useEhr(() =>
    AdelanteEHR.patientReassessmentDue(patientId).some((d) => d.key === screenerKey) ||
    // A patient may also re-take a non-SUD instrument voluntarily.
    (!!rescreenRule(screenerKey) && !!activeScreenerByKey(screenerKey) &&
      (!activeScreenerByKey(screenerKey)!.isSud ||
        AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment"))),
  );
  const def = rescreenRule(screenerKey) ? activeScreenerByKey(screenerKey) : undefined;
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [choices, setChoices] = useState<Record<number, number>>({});

  if (!def || !allowed) {
    return (
      <PatientPage>
        <Card className="p-6 text-sm" data-testid="rescreen-unavailable">
          {c.notAvailable}{" "}
          <Link to="/home" className="underline">{c.back}</Link>
        </Card>
      </PatientPage>
    );
  }

  const submit = () => {
    if (!screenerComplete(def, answers)) {
      toast.error(c.answerAll);
      return;
    }
    try {
      AdelanteEHR.completeRescreen(patientId, def.key, answers as number[], {
        actorId: patientId,
        actorRole: "patient",
      });
      toast.success(c.done);
      void navigate({ to: "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  };

  return (
    <PatientPage data-testid="rescreen-form">
      <PatientPageHeader icon={ClipboardList} title={rescreenName(def.key, L)} lede={c.pageLede} />
      <Slim988Bar className="mb-4" />
      <Card className="space-y-5 p-5">
        <div>
          <Badge variant="outline" className="border-teal/40 text-teal">{def.name}</Badge>
          {def.isSud && <Badge className="ml-2 border-0 bg-teal/15 text-teal">{c.part2}</Badge>}
          <p className="mt-2 text-sm text-muted-foreground">{def.description}</p>
        </div>
        <ScreenerItems
          def={def}
          answers={answers}
          choices={choices}
          testIdPrefix="rescreen-q"
          onChange={(next, ch) => {
            setAnswers(next);
            setChoices(ch);
          }}
        />
        <Button size="patient" className="w-full" onClick={submit} data-testid="rescreen-submit">
          {c.submit}
        </Button>
      </Card>
    </PatientPage>
  );
}
