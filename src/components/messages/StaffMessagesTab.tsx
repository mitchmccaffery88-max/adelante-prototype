// §Messaging Phase 2 — staff side of the patient's care-team thread.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type CareMessage } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { isMessageBodyMasked } from "@/lib/careMessageMasking";
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
  const { staffName, role } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const messages = useEhr(() => AdelanteEHR.listCareMessages(patientId));
  const unread = useEhr(() => AdelanteEHR.unreadCountForStaff(patientId));
  const [draft, setDraft] = useState("");
  const canFlag = canAccess(role, "patient_messaging").level === "write";

  const toggleFlag = (m: CareMessage) => {
    const ok = m.sudFlagged
      ? AdelanteEHR.unflagMessageAsSud(patientId, m.id, staffName, role)
      : AdelanteEHR.flagMessageAsSud(patientId, m.id, staffName, role);
    if (!ok) toast.error("Your role cannot change Part 2 flags");
    else toast.success(m.sudFlagged ? "Part 2/SUD flag removed" : "Flagged as Part 2/SUD");
  };

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
        translated or edited. Bodies are <strong>not</strong> screened automatically for 42 CFR
        Part 2 content; a reviewer who reads Part 2 content here can flag that message, which masks
        it from staff without SUD consent access.
        {" "}
        A patient can also ask for a message to be handled carefully when they send it — but an
        unflagged message is <strong>not</strong> a clearance; this never replaces your own review.
      </p>
      <CareMessageThread
        messages={messages}
        side="staff"
        emptyLabel="No messages in this thread yet."
        youLabel="Care team"
        themLabel="Patient"
        maskBody={(m) => isMessageBodyMasked(m, role, patient)}
        canFlag={canFlag}
        onToggleFlag={toggleFlag}
        showFlagProvenance
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
