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
import { ArrowLeft, HeartHandshake } from "lucide-react";
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

  // §B8 — merged: the whole care-team thread, peer replies included.
  const strand = useMemo(() => messages, [messages]);

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
        eyebrow="Messages"
        title={t("msgTitle")}
        lede={
          <>
            One conversation with everyone on your care team
            {PEER ? `, including ${PEER.name}, your peer specialist` : ""}. Each reply shows who
            sent it and their role.
          </>
        }
      />


      <Card className="p-5" data-testid="peer-thread">
        <CareMessageThread
          messages={strand}
          side="patient"
          emptyLabel={
t("msgNoneYet")
          }
          youLabel={t("msgYou")}
          themLabel={t("msgCareTeam")}
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
