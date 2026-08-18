// §Build A item 5 — "tell my care team I need help", from /crisis.
//
// This is NOT a new escalation path. It calls the SAME
// `AdelanteEHR.flagCrisis` the clinician chart button, the PHQ-9 screener
// trigger and the automated free-text scan call, which is what raises the
// critical alert, files the CrisisEscalation row into /crisis-queue, notifies
// the clinical coordinator and pushes the out-of-band staff SMS. The only new
// thing is the attribution: `triggerSource: "patient_request"`.
//
// It never replaces 988 — the lifeline buttons stay above this on the page.
import { useState } from "react";
import { BellRing, Check } from "lucide-react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ACTOR = "Patient (asked for their care team)";

export function NotifyCareTeamCard() {
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  if (!patient) return null;

  const send = () => {
    try {
      AdelanteEHR.flagCrisis(
        patient.id,
        ACTOR,
        note.trim() || "Patient asked for their care team from the crisis page.",
        { triggerSource: "patient_request" },
      );
      setSent(true);
      setNote("");
      toast.success("Your care team has been told. Someone will reach out.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send that.");
    }
  };

  return (
    <Card className="soft-shadow p-5" data-testid="notify-care-team-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
        <BellRing className="h-4 w-4" aria-hidden="true" /> Tell my care team
      </div>
      {sent ? (
        <p className="mt-2 flex items-start gap-2 text-base" data-testid="notify-care-team-sent">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          Your care team has been told you need help right now. If you can&apos;t wait, call or
          text 988.
        </p>
      ) : (
        <>
          <p className="mt-2 text-base">
            This tells your Adelante care team, right now, that you need help. Not probation, not
            parole — your care team.
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="notify-care-team-note"
            placeholder="Anything you want them to know (optional)"
            className="mt-3 min-h-[70px] text-sm"
          />
          <Button
            type="button"
            data-testid="notify-care-team-send"
            className="mt-3 min-h-11 w-full rounded-2xl"
            onClick={send}
          >
            Alert my care team
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            This is not an emergency service. For an emergency, call 911; to talk to someone right
            now, call or text 988.
          </p>
        </>
      )}
    </Card>
  );
}
