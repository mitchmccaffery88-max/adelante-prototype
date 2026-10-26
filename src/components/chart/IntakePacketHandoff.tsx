import { useActingStaff } from "@/lib/roles";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { careTeamPacket, packetDocumentContent } from "@/lib/intakePacket";
export function IntakePacketHandoff({ patientId }: { patientId: string }) {
  const actor = useActingStaff();
  const [document, setDocument] = useState<ReturnType<typeof packetDocumentContent>>();
  const rows = JSON.parse(useEhr(() => JSON.stringify(careTeamPacket(actor, patientId)))) as ReturnType<typeof careTeamPacket>;
  if (!rows.length) return null;
  return <section className="w-full space-y-2" aria-label="Intake packet handoff"><h3 className="font-bold">Intake packet handoff</h3>{rows.map(r => <div key={r.referralId}><span>Referral {r.referralId}</span>{r.needs.map((n, i) => <p key={i}>{n.kind} · {n.source.replaceAll("_", " ")} · {n.state.replaceAll("_", " ")}</p>)}{r.documents.map(d => <div key={d.id} className="flex flex-wrap items-center gap-2"><span>{d.type.replaceAll("_", " ")} · {d.fileName}</span><Button variant="outline" onClick={() => { try { setDocument(packetDocumentContent(actor, r.referralId, d.id)); } catch (e) { toast.error(e instanceof Error ? e.message : "Document unavailable."); } }}>View packet document</Button></div>)}</div>)}<Dialog open={!!document} onOpenChange={v => { if (!v) setDocument(undefined); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{document?.fileName}</DialogTitle><DialogDescription>Simulated — preview-memory document</DialogDescription></DialogHeader>{document?.dataUrl ? <iframe title="Packet document" sandbox="" src={document.dataUrl} className="w-full h-[60vh] border border-line" /> : <p>Paper copy reference only — no file content stored.</p>}</DialogContent></Dialog></section>;
}