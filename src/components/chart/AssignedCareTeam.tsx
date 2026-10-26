import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { STAFF_ROSTER } from "@/lib/roles";
import { IntakePacketHandoff } from "./IntakePacketHandoff";
export function AssignedCareTeam({ patientId }: { patientId: string }) {
  const json = useEhr(() => {
    const p = AdelanteEHR.getPatient(patientId);
    return JSON.stringify({ manager: STAFF_ROSTER.find(s => s.caseManagerId && s.caseManagerId === p?.caseManagerId)?.name ?? "Not assigned", clinician: STAFF_ROSTER.find(s => s.clinicianId && s.clinicianId === p?.primaryClinicianId)?.name ?? "Not assigned" });
  });
  const team = JSON.parse(json) as { manager: string; clinician: string };
  return <section aria-label="Care team" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted"><h2 className="font-bold text-ink">Care team</h2><span>Care manager: {team.manager}</span><span>Primary clinician: {team.clinician}</span><IntakePacketHandoff patientId={patientId} /></section>;
}