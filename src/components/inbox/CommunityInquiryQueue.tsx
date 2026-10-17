import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
// §Front door — staff queue for NON-clinical community inquiries.
//
// These are not patients and this is not a chart. The queue exists so the
// page's promise ("someone will point you in the right direction") is real:
// every row carries a required contact detail and a two-step disposition
// (contacted → resolved). Crisis-flagged rows sort to the top and also raised
// a real anonymous crisis alert on the crisis queue at capture time.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type CommunityInquiry } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { MessageSquare, Phone, Mail, Siren } from "lucide-react";

export function CommunityInquiryQueue() {
  const { role, staffName } = useActingStaff();
  const canWrite = canAccess(role, "community_inquiries").level === "write";
  const rows = useEhr(() => AdelanteEHR.listCommunityInquiries({ includeResolved: true }));
  const [showResolved, setShowResolved] = useState(false);

  const visible = useMemo(() => {
    const list = rows.filter((r) => showResolved || r.status !== "resolved");
    return [...list].sort((a, b) => {
      if (a.crisisFlagged !== b.crisisFlagged) return a.crisisFlagged ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [rows, showResolved]);

  const disposition = (r: CommunityInquiry, status: "contacted" | "resolved") => {
    const ok = AdelanteEHR.dispositionCommunityInquiry(r.id, status, staffName);
    toast[ok ? "success" : "error"](ok ? `Marked ${status}.` : "Already in that state.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Front-door notes from people who are not patients. Nothing here is a chart entry — do not
          copy this text into a record.
        </p>
        <Button size="sm" variant="ghost" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Button>
      </div>

      <StaffTable rows={visible} rowKey={(r)=>r.id} label="Community inquiries" testId="community-inquiries-table" rowTestId={()=>"community-inquiry-row"}
        views={[{id:"current",label:"Current view",matches:()=>true},{id:"needs",label:"Needs you",matches:(r)=>canWrite && r.status === "new"}]} defaultView="current"
        emptyState={<EmptyState icon={MessageSquare} title="No open inquiries" />}
        columns={[
          {id:"body",label:"Inquiry",cell:(r)=><p className="whitespace-pre-wrap">{r.body}</p>},
          {id:"contact",label:"Contact",sortValue:(r)=>r.contact,cell:(r)=><a className="font-medium underline" href={r.contactKind === "email" ? `mailto:${r.contact}` : `tel:${r.contact}`}>{r.contactKind === "email" ? <Mail className="inline size-4" /> : <Phone className="inline size-4" />} {r.contact}</a>},
          {id:"date",label:"Received",sortValue:(r)=>r.createdAt,cell:(r)=><ClientDate value={r.createdAt} options={{dateStyle:"medium",timeStyle:"short"}} />},
          {id:"status",label:"Status",sortValue:(r)=>r.status,cell:(r)=><>{r.crisisFlagged && <StatusChip lang="en" state="urgent" label="Crisis language" />}<StatusChip lang="en" state={r.status === "resolved" ? "done" : r.status === "new" && canWrite ? "yourturn" : "team"} label={r.status} /></>},
          {id:"owner",label:"Disposition",sortValue:(r)=>r.dispositionBy ?? "",cell:(r)=>r.dispositionBy ? <>{r.status} by {r.dispositionBy}{r.dispositionAt && <> · <ClientDate value={r.dispositionAt} options={{dateStyle:"medium",timeStyle:"short"}} /></>}</> : "—"},
        ]}
        primaryAction={canWrite ? (r)=><Button size="sm" variant="outline" disabled={r.status !== "new"} onClick={()=>disposition(r,"contacted")}>Mark contacted</Button> : undefined}
        moreContent={canWrite ? (r)=><Button size="sm" variant="outline" disabled={r.status === "resolved"} onClick={()=>disposition(r,"resolved")}>Mark resolved</Button> : undefined}
      />
    </div>
  );
}
