import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { episodeHeaderLabel } from "@/lib/outpatientCare";
import { Badge } from "@/components/ui/badge";

/** §B3 — current outpatient episode in the chart header (SUD masked for restricted roles). */
export function EpisodeHeaderBadge({ patientId }: { patientId: string }) {
  const { role } = useActingStaff();
  const label = useEhr(() => episodeHeaderLabel(patientId, role));
  if (!label) return null;
  return (
    <Badge variant="outline" className="mt-1" aria-label="Episode of care">
      Episode: {label}
    </Badge>
  );
}
