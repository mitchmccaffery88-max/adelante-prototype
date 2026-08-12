// §v3.0 Phase 2 — the ECM Provider's D0 intake read of the reentry hand-off.
//
// This is a QUERY against the structured `ReentryCarePlan` record, not a PDF
// or a note: every field below comes out of the store as data.
//
// AB 133 note: everything rendered here is enrollment-coordination data and is
// read through the AB 133 path (`ab133CoordinationAccess`) — no consent check,
// by design. Any Part 2 / third-party content would go through
// `disclosureAccess` instead; that split is in src/lib/ab133.ts.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ab133CoordinationAccess, disclosureAccess } from "@/lib/ab133";
import { isMatOrder } from "@/lib/medAdherence";
import { useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { KeyRound, Pill, Route as RouteIcon } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  mental_health: "Mental health",
  med_management: "Medication management",
  sud: "SUD",
};

export function ReentryHandoffTab({ patientId }: { patientId: string }) {
  const { role } = useActingStaff();
  const plan = useEhr(() => AdelanteEHR.reentryCarePlanForPatient(patientId));
  const episode = useEhr(() => AdelanteEHR.activePreReleaseEpisode(patientId));
  // §Pre-release build 3 — both new data points come out of the REAL systems:
  // appointments are resolved live from the scheduling store by `apptId`, and
  // MAT is read off the ordinary order list. Nothing is duplicated onto the
  // care plan for the hand-off.
  const appointments = useEhr(() => AdelanteEHR.listAppointments());
  const orders = useEhr(() => AdelanteEHR.listOrders(patientId));
  // MAT is 42 CFR Part 2 content — it is NOT an AB 133 coordination dataset,
  // so it goes through the consent path, not the exemption path.
  const matDecision = disclosureAccess({ patientId, kind: "part2_sud", actorRole: role });
  const matOrders = orders.filter(
    (o) => isMatOrder(o) && o.status !== "draft" && o.status !== "discontinued",
  );

  const decision = ab133CoordinationAccess({
    dataset: "reentry_care_plan",
    actorRole: role,
    recipientRole: "ecm_provider",
  });

  if (!decision.allowed) {
    return (
      <EmptyState
        icon={RouteIcon}
        title="Not a coordination party"
        description={decision.reason}
      />
    );
  }

  if (!plan) {
    return (
      <EmptyState
        icon={RouteIcon}
        title="No reentry care plan"
        description={
          episode
            ? "A pre-release episode is open but the Person-Centered Reentry Care Plan has not been started."
            : "This member has no pre-release episode."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={plan.status === "completed" ? "default" : "outline"}>
          {plan.status === "completed" ? "Member-signed" : "Draft"}
        </Badge>
        <span className="text-xs text-muted-foreground">{decision.reason}</span>
      </div>

      {plan.enrollmentCode && (
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" /> Enrollment code
          </div>
          <p className="font-mono text-lg">{plan.enrollmentCode}</p>
          <p className="text-xs text-muted-foreground">
            Single-use, 90-day validity. Verify against the code the member presents at intake.
          </p>
        </Card>
      )}

      <Card className="p-3">
        <div className="text-sm font-medium">Post-release housing</div>
        <p className="text-sm">{plan.housing.arrangement || "—"}</p>
        {plan.housing.address && (
          <p className="text-xs text-muted-foreground">{plan.housing.address}</p>
        )}
        {(plan.housing.contactName || plan.housing.contactPhone) && (
          <p className="text-xs text-muted-foreground">
            {plan.housing.contactName} {plan.housing.contactPhone}
          </p>
        )}
      </Card>

      <Card className="p-3">
        <div className="mb-2 text-sm font-medium">Scheduled first appointments</div>
        {plan.appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <ul className="space-y-2">
            {plan.appointments.map((a) => {
              const live = a.apptId ? appointments.find((x) => x.id === a.apptId) : undefined;
              return (
                <li key={a.id} className="rounded-md border p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {KIND_LABEL[a.kind] ?? a.kind}
                    {live ? (
                      <Badge variant="outline" data-testid="handoff-booked-appt">
                        Booked in Adelante · {live.status}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">External / recorded</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(live?.start ?? a.start)
                      ? new Date(live?.start ?? a.start).toLocaleString()
                      : "unscheduled"}{" "}
                    · {a.providerName} · {a.location} · {live?.modality ?? a.modality}
                    {a.phone ? ` · ${a.phone}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Pill className="h-4 w-4" /> Medication-assisted treatment
        </div>
        {!matDecision.allowed ? (
          <p className="text-xs text-muted-foreground" data-testid="handoff-mat-restricted">
            {matDecision.reason}
          </p>
        ) : matOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No MAT orders on the chart.</p>
        ) : (
          <ul className="space-y-2">
            {matOrders.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                data-testid="handoff-mat-order"
              >
                <span>
                  {o.drugName}
                  {o.sigOverride || o.sig ? (
                    <span className="block text-xs text-muted-foreground">
                      {o.sigOverride ?? o.sig}
                    </span>
                  ) : null}
                </span>
                <Badge variant="outline">{o.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-3">
        <div className="text-sm font-medium">Pharmacy & DME</div>
        <p className="text-sm">{plan.pharmacy?.name ?? "No pharmacy recorded"}</p>
        <p className="text-xs text-muted-foreground">
          {plan.dmeNeeds.length ? plan.dmeNeeds.join(", ") : "No DME needs recorded"}
        </p>
      </Card>

      {plan.notesToEcm && (
        <Card className="p-3">
          <div className="text-sm font-medium">Notes for the ECM Provider</div>
          <p className="whitespace-pre-wrap text-sm">{plan.notesToEcm}</p>
        </Card>
      )}

      {plan.memberSignature && (
        <p className="text-xs text-muted-foreground">
          Signed by {plan.memberSignature.name} ({plan.memberSignature.relationship}) on{" "}
          {new Date(plan.memberSignature.signedAt).toLocaleString()} · attestation:{" "}
          {plan.memberSignature.attestationMethod}
        </p>
      )}
    </div>
  );
}
