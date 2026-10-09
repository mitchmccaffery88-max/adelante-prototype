// §Group 2 P2 — the patient's derived pathway. Without Part 2 access the SUD
// half is hidden (never stubbed): "Re-entry" or nothing.
import { useEhr, AdelanteEHR } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { patientPathway, pathwayChipLabel } from "@/lib/flagJourneys";
import { Badge } from "@/components/ui/badge";

export function PathwayChip({ patientId }: { patientId: string }) {
  const { role } = useActingStaff();
  const label = useEhr(() => pathwayChipLabel(patientPathway(patientId), roleSeesAsamSection(role, AdelanteEHR.getPatient(patientId))));
  if (!label) return null;
  return (
    <Badge variant="outline" className="text-[10px]" data-testid="pathway-chip" title="Pathway (Draft)">
      {label}
    </Badge>
  );
}
