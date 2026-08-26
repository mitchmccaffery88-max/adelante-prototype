// §Standalone route items — `/peer`.
//
// This is a FOCUSED VIEW of the one real care-team thread, not a second
// channel. Every message shown here is a `CareMessage` on the patient's single
// `threadPatientId` thread, and the composer calls the same
// `AdelanteEHR.sendPatientMessage` + `scanTextForCrisis` pair that My Care's
// MessagesCard uses. Nothing written here is peer-only, nothing is hidden from
// the staff message queue, and there is no separate store.
//
// The only thing this route does differently is FILTER: it shows the
// peer-authored replies plus the patient's own messages, so a member who came
// looking for Andre can read that strand without scrolling the whole thread.
// A permanent banner + a link to the full thread keep that honest.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, HeartHandshake, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type CareMessage } from "@/lib/ehr";
import { STAFF_ROSTER } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { CareMessageThread } from "@/components/messages/CareMessageThread";
import { CrisisNotice } from "@/components/CrisisNotice";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The one real peer identity — never invent another. */
const PEER = STAFF_ROSTER.find((s) => s.role === "peer_specialist");

/** Peer-authored staff replies + the member's own messages, in thread order. */
export function peerStrand(messages: CareMessage[]): CareMessage[] {
  return messages.filter(
    (m) => m.authorType === "patient" || m.authorRole === "peer_specialist",
  );
}

export function PeerChatPage() {
  const { t } = useI18n();
  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const messages = useEhr(() => (patientId ? AdelanteEHR.listCareMessages(patientId) : []));
  const [draft, setDraft] = useState("");

  const strand = useMemo(() => peerStrand(messages), [messages]);
  const peerReplies = strand.filter((m) => m.authorType === "staff").length;

  if (!patientId) return null;

  const send = () => {
    // Same single write path as My Care — verbatim body, same crisis scan
    // AFTER commit, same unread/queue behaviour.
    const sent = AdelanteEHR.sendPatientMessage(patientId, draft);
    if (!sent) return;
    scanTextForCrisis(patientId, sent.body, { surface: "a care-team message" });
    setDraft("");
    toast.success(t("msgSent"));
  };

  return (
    <PatientPage data-testid="peer-chat-page">
      <PatientPageHeader
        icon={HeartHandshake}
        eyebrow="Peer support"
        title={PEER ? `Talk with ${PEER.name}` : "Talk with a peer specialist"}
        lede={
          <>
            {PEER ? `${PEER.name}, ${PEER.credential} — someone` : "Someone"} with lived recovery
            experience. Write whenever you want; replies are not instant.
          </>
        }
      />

      <Card className="border-primary/30 bg-secondary/40 p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            This is the same conversation as your care-team messages — just the peer part of it.
            Anything you send here goes to your care team too.{" "}
            <Link to="/home" hash="care-messages" className="font-medium text-primary underline">
              See the whole conversation
            </Link>
            .
          </span>
        </p>
      </Card>

      <Card className="p-5" data-testid="peer-thread">
        <CareMessageThread
          messages={strand}
          side="patient"
          emptyLabel={
            peerReplies === 0 && strand.length === 0
              ? "Nothing here yet. Send the first message below."
              : "Nothing here yet."
          }
          youLabel={t("msgYou")}
          themLabel={(m) => m.authorName}
        />
        <div className="mt-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("msgPlaceholder")}
            className="min-h-[70px] text-sm"
            aria-label={t("msgPlaceholder")}
          />
          <CrisisNotice />
          <div className="flex justify-end">
            <Button
              className="min-h-11 rounded-2xl"
              disabled={!draft.trim()}
              onClick={send}
              data-testid="peer-send"
            >
              {t("msgSend")}
            </Button>
          </div>
        </div>
      </Card>

      <Button asChild variant="ghost" className="min-h-11 rounded-2xl">
        <Link to="/home">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Back to My care
        </Link>
      </Button>
    </PatientPage>
  );
}
