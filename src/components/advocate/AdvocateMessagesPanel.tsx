import { StatusChip } from "@/components/ui/status-chip";
// §Advocate build 3 Part B — advocate ↔ care-team messaging, GATED.
//
// The feature is complete: it reads the real patient thread through
// `advocateCareMessages` (same store rows as the patient and staff surfaces),
// renders it with the shared `CareMessageThread`, and composes through
// `advocateSendMessage`. What it does NOT do today is send: while
// `ADVOCATE_MESSAGING_REVIEW.pending` is true the compose box is replaced by
// the pending-review notice, and the store refuses the write anyway.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ADVOCATE_MESSAGING_REVIEW } from "@/lib/advocateMessaging";
import { CareMessageThread } from "@/components/messages/CareMessageThread";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, ShieldAlert, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.2c305038f6a7": {
    "en": "Messages with the care team",
    "es": "Mensajes con el equipo de atención"
  },
  "ui.c2e51bb253dd": {
    "en": "Nothing from this person's thread is shown here while the review is open — the feature is built and tested, but it is switched off, not merely read-only.",
    "es": "No se muestra nada de los mensajes de esta persona mientras la revisión esté abierta. La función está lista y probada, pero está desactivada, no solo en modo de lectura."
  },
  "ui.f98217d5d962": {
    "en": "Write to the care team…",
    "es": "Escribe al equipo de atención…"
  },
  "ui.9bc2575c3930": {
    "en": "Send",
    "es": "Enviar"
  }
} as const;


export function AdvocateMessagesPanel({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const view = useEhr(() => AdelanteEHR.advocateCareMessages(linkId));
  const [draft, setDraft] = useState("");
  const reviewPending = ADVOCATE_MESSAGING_REVIEW.pending;

  function send() {
    const r = AdelanteEHR.advocateSendMessage(linkId, draft);
    if (r.sent) {
      setDraft("");
      toast.success("Sent.");
    } else {
      toast.error(r.reason);
    }
  }

  return (
    <Card className="space-y-3 p-4" data-testid="advocate-messages">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-navy">
          <MessageSquare className="h-4 w-4 text-teal" /> {SCREEN_COPY["ui.2c305038f6a7"][screenLang]} </p>
        <StatusChip state={reviewPending ? "team" : view.allowed ? "done" : "restricted"} label={reviewPending ? "Pending clinical review" : view.allowed ? "Open" : "Not available"} />
      </div>

      {reviewPending && (
        <div
          data-testid="advocate-messaging-review-gate"
          className="flex gap-3 rounded-md border border-attention bg-attention-soft p-3 text-xs"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
          <p className="text-muted-foreground">
            {ADVOCATE_MESSAGING_REVIEW.notice}{" "}
            <span className="opacity-80">{ADVOCATE_MESSAGING_REVIEW.scope}</span>
          </p>
        </div>
      )}

      {reviewPending ? (
        <p className="text-xs text-muted-foreground">
          {SCREEN_COPY["ui.c2e51bb253dd"][screenLang]} </p>
      ) : !view.allowed ? (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          {view.reason}
        </p>
      ) : (
        <>
          <CareMessageThread
            messages={view.messages}
            side="advocate"
            emptyLabel="No messages in this thread yet."
            youLabel="You"
            themLabel={(m) => (m.authorType === "patient" ? "Them" : "Care team")}
            maskBody={(m) =>
              Boolean(view.messages.find((x) => x.id === m.id)?.bodyMasked)
            }
          />
          <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={SCREEN_COPY["ui.f98217d5d962"][screenLang]}
                rows={3}
              />
              <Button size="sm" disabled={!draft.trim()} onClick={send}>
                {SCREEN_COPY["ui.9bc2575c3930"][screenLang]} </Button>
          </div>
        </>
      )}
    </Card>
  );
}
