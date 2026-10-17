import { StaffTable, RestrictedCell } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
// Void requests for approvers (clinical coordinator / sys_admin / author's
// supervisor). Shows METADATA + the author's void reason only — never the
// note body, so SUD-protected notes stay protected.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientDate } from "@/components/ClientDate";
import { FileX2 } from "lucide-react";

export function VoidRequestQueue() {
  const { role, staffId, staffName, clinicianId } = useActingStaff();
  const actor = { staffId, clinicianId, name: staffName, role };
  const rows = useEhr(() => AdelanteEHR.listPendingNoteVoids(actor));
  const [reason, setReason] = useState<Record<string, string>>({});
  if (rows.length === 0) return null;

  const decide = (patientId: string, noteId: string, approve: boolean) => {
    try {
      AdelanteEHR.decideNoteVoid(patientId, noteId, { approve, ...actor, comment: reason[noteId] });
      toast.success(approve ? "Void approved" : "Void request rejected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="p-4 space-y-3" aria-label="Void requests">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
        <FileX2 className="h-4 w-4 text-teal" /> Void requests ({rows.length})
      </h2>
      <StaffTable rows={rows} rowKey={(r)=>r.noteId} label="Void requests" testId="void-requests-table"
        views={[{id:"needs",label:"Needs you",matches:()=>true}]} defaultView="needs"
        columns={[
          {id:"title",label:"Note",sortValue:(r)=>r.title,cell:(r)=>r.title},
          {id:"date",label:"Visit",sortValue:(r)=>r.noteDate,cell:(r)=><><ClientDate value={r.noteDate} /> · {r.sessionType ?? "session"}</>},
          {id:"author",label:"Requested by",sortValue:(r)=>r.authorName,cell:(r)=><>{r.authorName} on <ClientDate value={r.requestedAt} /></>},
          {id:"reason",label:"Author's reason",cell:(r)=>r.reason},
          {id:"content",label:"Content",cell:()=> <RestrictedCell label="Note content is not shown here." />},
          {id:"status",label:"Status",cell:()=> <StatusChip lang="en" state="yourturn" label="Pending void approval" />},
          {id:"response",label:"Your reason",cell:(r)=><><Label htmlFor={`vr-${r.noteId}`}>Your reason (required to reject)</Label><Input id={`vr-${r.noteId}`} value={reason[r.noteId] ?? ""} onChange={(e)=>setReason((m)=>({...m,[r.noteId]:e.target.value}))} /></>},
        ]}
        primaryAction={(r)=><Button size="sm" variant="outline" onClick={()=>decide(r.patientId,r.noteId,true)}>Approve void</Button>}
        moreContent={(r)=><Button size="sm" variant="outline" onClick={()=>decide(r.patientId,r.noteId,false)}>Reject</Button>}
      />
    </Card>
  );
}
