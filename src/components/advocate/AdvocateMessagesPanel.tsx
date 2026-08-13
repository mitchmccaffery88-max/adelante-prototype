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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, ShieldAlert, Lock } from "lucide-react";

export function AdvocateMessagesPanel({ linkId }: { linkId: string }) {
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
          <MessageSquare className="h-4 w-4 text-teal" /> Messages with the care team
        </p>
        <Badge variant={reviewPending ? "secondary" : view.allowed ? "default" : "outline"}>
          {reviewPending ? "Pending clinical review" : view.allowed ? "Open" : "Not available"}
        </Badge>
      </div>

      {reviewPending && (
        <div
          data-testid="advocate-messaging-review-gate"
          className="flex gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            {ADVOCATE_MESSAGING_REVIEW.notice}{" "}
            <span className="opacity-80">{ADVOCATE_MESSAGING_REVIEW.scope}</span>
          </p>
        </div>
      )}

      {reviewPending ? (
        <p className="text-xs text-muted-foreground">
          Nothing from this person's thread is shown here while the review is open — the feature is
          built and tested, but it is switched off, not merely read-only.
        </p>
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
                placeholder="Write to the care team…"
                rows={3}
              />
              <Button size="sm" disabled={!draft.trim()} onClick={send}>
                Send
              </Button>
          </div>
        </>
      )}
    </Card>
  );
}
