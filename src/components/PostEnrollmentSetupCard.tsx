// §Referrals Rework Phase 4f — the cross-patient "needs setup" view.
//
// The four post-enrollment steps used to appear together only inside one
// person's own drawer. This is the same four steps across everyone, with the
// honest draft-labelled staleness clock and the assign actions already built.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingRole, getActingStaff } from "@/lib/roles";
import { AssignClinicianButton } from "@/components/AssignClinicianButton";
import {
  POST_ENROLLMENT_STALENESS_LABEL,
  POST_ENROLLMENT_STALENESS_NOTE,
  POST_ENROLLMENT_STEP_LABEL,
  postEnrollmentGaps,
  postEnrollmentStaleness,
  postEnrollmentStalenessLabel,
  patientsNeedingSetup,
} from "@/lib/postEnrollment";

const CM_ASSIGN_ROLES = new Set([
  "ecm_provider",
  "cf_care_manager",
  "clinical_coordinator",
  "sys_admin",
]);

function AssignCaseManagerControl({ patientId }: { patientId: string }) {
  const [role] = useActingRole();
  const managers = useEhr(() => AdelanteEHR.listCaseManagers());
  const [pick, setPick] = useState("");
  if (!CM_ASSIGN_ROLES.has(role)) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Select value={pick} onValueChange={setPick}>
        <SelectTrigger className="h-8 w-[10.5rem] text-xs">
          <SelectValue placeholder="Assign case manager" />
        </SelectTrigger>
        <SelectContent>
          {managers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={!pick}
        onClick={() => {
          AdelanteEHR.assignCaseManager({
            patientId,
            caseManagerId: pick,
            actorId: getActingStaff().id,
          });
          toast.success("Case manager assigned.");
          setPick("");
        }}
      >
        Save
      </Button>
    </div>
  );
}

export function PostEnrollmentSetupCard({ limit }: { limit?: number }) {
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const rows = patientsNeedingSetup(patients)
    .map((p) => ({ p, gaps: postEnrollmentGaps(p), stale: postEnrollmentStaleness(p) }))
    .sort((a, b) => (b.stale?.days ?? -1) - (a.stale?.days ?? -1));
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Needs setup after enrollment ({rows.length})</h2>
        <span
          className="text-[10px] uppercase tracking-wider text-muted-foreground"
          title={POST_ENROLLMENT_STALENESS_NOTE}
        >
          {POST_ENROLLMENT_STALENESS_LABEL}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Everyone enrolled has a care team, a completed intake and an attended session.
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map(({ p, gaps, stale }) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <Link
                  to="/record/$patientId"
                  params={{ patientId: p.id }}
                  className="text-sm font-medium text-navy underline"
                >
                  {p.firstName} {p.lastName}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  {gaps.map((g) => (
                    <Badge key={g} variant="outline" className="text-[10px]">
                      {POST_ENROLLMENT_STEP_LABEL[g]}
                    </Badge>
                  ))}
                </div>
                {stale && stale.state !== "fresh" && (
                  <div
                    className={`mt-1 text-[11px] ${
                      stale.state === "overdue" ? "text-destructive" : "text-navy"
                    }`}
                    title={POST_ENROLLMENT_STALENESS_NOTE}
                  >
                    {postEnrollmentStalenessLabel(stale)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!p.caseManagerId && <AssignCaseManagerControl patientId={p.id} />}
                {!p.primaryClinicianId && <AssignClinicianButton patientId={p.id} size="sm" />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {limit && rows.length > shown.length && (
        <div className="pt-2 text-xs">
          <Link to="/admin-coordination" className="underline">
            See all {rows.length} in clinical coordination →
          </Link>
        </div>
      )}
    </Card>
  );
}
