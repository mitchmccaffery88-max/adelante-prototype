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
      {rows.map((r) => (
        <div key={r.noteId} className="rounded-md border p-3 space-y-2 text-sm">
          <div className="font-medium text-navy">{r.title}</div>
          <div className="text-xs text-muted-foreground">
            Visit <ClientDate iso={r.noteDate} /> · {r.sessionType ?? "session"} · requested by {r.authorName}{" "}
            on <ClientDate iso={r.requestedAt} />
          </div>
          <div className="text-xs">
            <span className="font-medium">Author&apos;s reason:</span> {r.reason}
          </div>
          <p className="text-[11px] text-muted-foreground">Note content is not shown here.</p>
          <div className="space-y-1">
            <Label htmlFor={`vr-${r.noteId}`} className="text-xs">
              Your reason (required to reject)
            </Label>
            <Input
              id={`vr-${r.noteId}`}
              value={reason[r.noteId] ?? ""}
              onChange={(e) => setReason((m) => ({ ...m, [r.noteId]: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide(r.patientId, r.noteId, true)}>
              Approve void
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide(r.patientId, r.noteId, false)}>
              Reject
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
