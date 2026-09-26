// §ASAM visit + reason — the ASAM task is the single work item for the
// substance-use path. Rendered ONLY for roles passing the ASAM Part 2 check
// (ASAM task roles + screeners_sud). Everything here is structured data;
// nothing is ever written into the task's title/detail text.
import { useNavigate } from "@tanstack/react-router";
import {
  AdelanteEHR,
  ASAM_REASON_LABEL,
  useEhr,
  type AsamReason,
  type CaseTask,
  type Patient,
} from "@/lib/ehr";
import { ASAM_TASK_ROLES } from "@/lib/asam";
import { roleSeesAsam } from "@/lib/asamReporting";
import { useActingStaff, type StaffRole } from "@/lib/roles";
import { ClientDate } from "@/components/ClientDate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const LEGAL_REASON_NOTICE =
  "Sharing results with a court, attorney, or DMV requires a specific 42 CFR Part 2 consent for that disclosure.";
export const LEGAL_REASON_DRAFT = "Draft — pending compliance review";

export function roleWorksAsamTask(role: StaffRole, patient: Patient | undefined): boolean {
  return ASAM_TASK_ROLES.includes(role) && roleSeesAsam(role, patient);
}

const DATE = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } as const;

export function AsamTaskWorkItem({ patient, task }: { patient: Patient; task: CaseTask }) {
  const acting = useActingStaff();
  const navigate = useNavigate();
  const visit = useEhr(() => AdelanteEHR.asamVisitState(task.id));
  const consent = useEhr(() => AdelanteEHR.hasLegalDisclosureConsent(patient.id));
  if (!roleWorksAsamTask(acting.role, patient)) return null;

  const setReason = (r: AsamReason) => {
    try {
      AdelanteEHR.setAsamReason(task.id, r, { name: acting.staffName, role: acting.role, id: acting.staffId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2" data-testid="asam-task-work-item">
      <p data-testid="asam-visit-state">
        <span className="font-medium">Assessment visit: </span>
        {visit.state === "scheduled" ? (
          <>scheduled <ClientDate value={visit.start} options={DATE} /></>
        ) : (
          <>
            not yet scheduled
            {visit.missedOn && (
              <> · missed <ClientDate value={visit.missedOn} options={{ month: "short", day: "numeric" }} /></>
            )}
          </>
        )}
      </p>
      {visit.state !== "scheduled" && (
        <Button
          size="sm"
          variant="outline"
          data-testid="asam-schedule-visit"
          onClick={() => navigate({ to: "/clinician", search: { asamTask: task.id } })}
        >
          Schedule assessment visit
        </Button>
      )}
      <label className="block">
        <span className="font-medium">Reason for assessment</span>
        <select
          className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
          value={task.asamReason ?? ""}
          onChange={(e) => e.target.value && setReason(e.target.value as AsamReason)}
          data-testid="asam-reason"
        >
          <option value="">Not set</option>
          {(Object.keys(ASAM_REASON_LABEL) as AsamReason[]).map((k) => (
            <option key={k} value={k}>
              {ASAM_REASON_LABEL[k]}
            </option>
          ))}
        </select>
        {task.asamReasonSetBy && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            Set by {task.asamReasonSetBy.name}
          </span>
        )}
      </label>
      {task.asamReason === "legal" && (
        <div className="rounded-md border border-dashed border-gold/70 bg-gold/10 p-2" data-testid="asam-legal-notice">
          <p>{LEGAL_REASON_NOTICE}</p>
          <p className="mt-1 font-medium" data-testid="asam-legal-consent">
            {consent ? "Consent on file" : "Consent needed before sharing"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{LEGAL_REASON_DRAFT}</p>
        </div>
      )}
    </div>
  );
}
