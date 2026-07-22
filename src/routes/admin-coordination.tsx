import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/admin-coordination")({
  head: () => ({
    meta: [
      { title: "Clinical Coordination — Adelante" },
      { name: "description", content: "Route intakes, resolve booking conflicts, and cover deactivated providers." },
    ],
  }),
  component: CoordinationPage,
});

function CoordinationPage() {
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const profiles = useEhrExt(() => AdelanteEHRExt.listClinicianProfiles());
  const appts = useEhr(() => AdelanteEHR.listAppointments());

  const frozen = profiles.filter((p) => !p.active);
  const frozenIds = new Set(frozen.map((p) => p.clinicianId));
  const affectedAppts = appts.filter(
    (a) => frozenIds.has(a.clinicianId) && a.status === "scheduled" && +new Date(a.start) > Date.now(),
  );
  const patientsWithoutPrimary = patients.filter((p) => !p.primaryClinicianId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Clinical coordination center</h1>
          <p className="text-sm text-muted-foreground">
            Cover deactivated providers, route unassigned patients, and confirm bookings.
          </p>
        </div>
        <Link to="/admin" className="text-sm underline">← Admin</Link>
      </header>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Frozen clinicians · appointments needing coverage ({affectedAppts.length})</h2>
        {affectedAppts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No future appointments on frozen clinicians.</p>
        ) : (
          <ul className="divide-y">
            {affectedAppts.map((a) => {
              const cl = clinicians.find((c) => c.id === a.clinicianId);
              const pt = patients.find((p) => p.id === a.patientId);
              return (
                <li key={a.id} className="py-2 text-sm flex items-center justify-between">
                  <span>
                    <b>{pt?.firstName} {pt?.lastName}</b> · <ClientDate value={a.start} /> with {cl?.name}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { AdelanteEHR.updateAppointmentStatus(a.id, "cancelled"); toast.success("Cancelled — notify patient to rebook."); }}>
                      Cancel
                    </Button>
                    <Link to="/schedule" className="text-xs underline self-center">Reassign</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Unassigned primary clinician ({patientsWithoutPrimary.length})</h2>
        {patientsWithoutPrimary.length === 0 ? (
          <p className="text-sm text-muted-foreground">All active patients have a primary clinician.</p>
        ) : (
          <ul className="divide-y">
            {patientsWithoutPrimary.map((p) => (
              <li key={p.id} className="py-2 text-sm flex items-center justify-between">
                <span>{p.firstName} {p.lastName}</span>
                <Link to="/case-manager" className="text-xs underline">Assign in caseload</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Clinician status</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {profiles.map((p) => {
            const cl = clinicians.find((c) => c.id === p.clinicianId);
            return (
              <li key={p.clinicianId} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <div className="font-medium">{cl?.name}</div>
                  <div className="text-xs text-muted-foreground">{p.specialty || "—"}</div>
                </div>
                <Badge className={p.active ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}>
                  {p.active ? "Active" : "Frozen"}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}