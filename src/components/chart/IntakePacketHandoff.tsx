import { useActingStaff } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { careTeamPacket } from "@/lib/intakePacket";
export function IntakePacketHandoff({ patientId }: { patientId: string }) {
  const actor = useActingStaff();
  const rows = JSON.parse(useEhr(() => JSON.stringify(careTeamPacket(actor, patientId)))) as ReturnType<typeof careTeamPacket>;
  if (!rows.length) return null;
  return <section className="w-full space-y-2" aria-label="Intake packet handoff"><h3 className="font-bold">Intake packet handoff</h3>{rows.map(r => <div key={r.referralId}><span>Referral {r.referralId}</span>{r.needs.map((n, i) => <p key={i}>{n.kind} · {n.source.replaceAll("_", " ")} · {n.state.replaceAll("_", " ")}</p>)}{r.documents.map(d => <p key={d.id}>{d.type.replaceAll("_", " ")} · {d.fileName}</p>)}</div>)}</section>;
}