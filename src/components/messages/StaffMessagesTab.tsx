// §Messaging Phase 2 — staff side of the patient's care-team thread.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CrisisNotice } from "@/components/CrisisNotice";
import { CareMessageThread } from "@/components/messages/CareMessageThread";

export function StaffMessagesTab({
  patientId,
  readOnly,
}: {
  patientId: string;
  readOnly?: boolean;
}) {
  const { staffName } = useActingStaff();
  const messages = useEhr(() => AdelanteEHR.listCareMessages(patientId));
  const unread = useEhr(() => AdelanteEHR.unreadCountForStaff(patientId));
  const [draft, setDraft] = useState("");

  // Opening the thread clears the STAFF unread side only.
  useEffect(() => {
    if (unread > 0) AdelanteEHR.markMessagesReadByStaff(patientId, staffName);
  }, [patientId, staffName, unread]);

  const send = () => {
    const sent = AdelanteEHR.sendStaffMessage(patientId, staffName, draft);
    if (sent) {
      setDraft("");
      toast.success("Reply sent");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        One ongoing thread with this patient. Patient messages are shown verbatim — never
        translated or edited. Message bodies are free text and are <strong>not</strong> screened or
        masked for 42 CFR Part 2 content.
      </p>
      <CareMessageThread
        messages={messages}
        side="staff"
        emptyLabel="No messages in this thread yet."
        youLabel="Care team"
        themLabel="Patient"
      />
      {!readOnly && (
        <div className="space-y-2 border-t pt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply to this patient…"
            className="min-h-[70px] text-sm"
          />
          {/* Same persistent crisis notice the patient composer carries. */}
          <CrisisNotice />
          <div className="flex justify-end">
            <Button size="sm" disabled={!draft.trim()} onClick={send}>
              Send reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
