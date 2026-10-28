import { useEffect, useState } from "react";
import { Lock, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useEhr } from "@/lib/ehr";
import { type IntakeActor } from "@/lib/intakePhaseA";
import { INTAKE_PHASE_B_DRAFT } from "@/lib/intakePhaseB";
import { canReadIntakePacket, openIntakeFollowupChecklist, readIntakeFollowupChecklist } from "@/lib/intakeFollowup";
import { intakePacketChecklist, packetDocumentContent } from "@/lib/intakePacket";
const checklistLabel: Record<string, string> = { identity_link_checked: "Confirmed record link checked", contact_checked: "Contact details checked", packet_received: "Referral packet received", handoff_ready: "Administrative handoff ready" };

export function IntakeFollowupPanel({ actor, referralId }: { actor: IntakeActor; referralId: string }) {
  const [opened, setOpened] = useState(false);
  const [clock, setClock] = useState<Date>();
  const [document, setDocument] = useState<ReturnType<typeof packetDocumentContent>>();
  useEffect(() => {
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const allowed = useEhr(() => !!clock && canReadIntakePacket(actor, referralId, clock));
  const json = useEhr(() => opened && allowed ? JSON.stringify(intakePacketChecklist(actor, referralId)) : "null");
  const packet = JSON.parse(json) as ReturnType<typeof intakePacketChecklist> | null;
  if (!clock) return null;
  if (!allowed) return <section aria-label="Intake follow-up" className="w-full border-t border-line py-3"><p className="flex items-center gap-2"><Lock className="size-5" />This person's intake window has closed</p><p className="text-sm text-ink-muted">{INTAKE_PHASE_B_DRAFT}</p></section>;
  return <section aria-label="Intake follow-up" className="w-full space-y-3 border-t border-line py-3">
    <h4 className="flex items-center gap-2 font-bold"><FileCheck2 className="size-5" />Intake follow-up</h4>
    <p className="text-sm text-ink-muted">Read-only · 60 days after handoff · {INTAKE_PHASE_B_DRAFT}</p>
    <p className="text-sm text-ink-muted">Simulated — preview-memory packet</p>
    <Button variant="outline" onClick={() => {
      try { openIntakeFollowupChecklist(actor, referralId); setOpened(true); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Packet unavailable."); }
    }}>Open intake checklist</Button>
    {packet && <>
      <h5 className="font-bold">Handoff checklist</h5>
      {Object.entries(readIntakeFollowupChecklist(actor, referralId).checklist).map(([key, value]) => <p key={key}>{checklistLabel[key]} · {value ? "Confirmed" : "Not confirmed"}</p>)}
      <h5 className="font-bold">Forms checklist</h5>
      {packet.forms.map(form => <p key={form.key}>{form.label} · {form.status}{form.date ? ` · ${form.date}` : ""}</p>)}
      <h5 className="font-bold">Packet needs</h5>
      {packet.needs.map(need => <p key={need.id}>{need.kind} · {need.state.replaceAll("_", " ")}</p>)}
      <h5 className="font-bold">Packet documents</h5>
      {packet.documents.map(row => <div key={row.id} className="flex flex-wrap items-center gap-2">
        {row.restricted ? <p className="flex items-center gap-2"><Lock className="size-4" />{row.reason}</p> : <><span>{row.type.replaceAll("_", " ")} · {row.fileName}</span><Button variant="outline" onClick={() => {
          try { setDocument(packetDocumentContent(actor, referralId, row.id)); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Document unavailable."); }
        }}>View packet document</Button></>}
      </div>)}
      <Button variant="ghost" onClick={() => { setOpened(false); setDocument(undefined); }}>Close intake checklist</Button>
    </>}
    <Dialog open={!!document && allowed} onOpenChange={value => { if (!value) setDocument(undefined); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{document?.fileName}</DialogTitle><DialogDescription>Simulated — preview-memory document</DialogDescription></DialogHeader>{document?.dataUrl ? <iframe sandbox="" title="Intake follow-up document" src={document.dataUrl} className="h-[60vh] w-full border border-line" /> : <p>Paper copy reference only — no file content stored.</p>}</DialogContent></Dialog>
  </section>;
}
