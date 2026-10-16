// Quick-actions batch 3 — "+ New" on pages without a patient in view (My work,
// Worklist, Case manager, Inbox). It IS the clinician workspace launcher
// (shared NewActionMenu, same registry filter, same runAction forms); only
// navigation differs: opening a chart goes to the patient's record page.
// Patient-scoped actions ask for a patient first (the launcher's own picker).
import { useNavigate } from "@tanstack/react-router";
import { DashboardActionLauncher } from "@/components/clinician/DashboardActionLauncher";
import { openBookVisit } from "@/lib/bookingFlow";

export function PageNewLauncher() {
  const navigate = useNavigate();
  return (
    <DashboardActionLauncher
      shortcuts={false}
      onBook={(patientId) => openBookVisit({ patientId })}
      onOpenChart={(patientId) => navigate({ to: "/record/$patientId", params: { patientId } })}
    />
  );
}
