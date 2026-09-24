import { Card } from "@/components/ui/card";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { ClientDate } from "@/components/ClientDate";
import { Check } from "lucide-react";
import { latestOutreachAttempt, outreachAttemptSummary } from "@/lib/referralOutreach";
import {
  firstAttendedAppointment,
  nextScheduledAppointment,
  POST_ENROLLMENT_STALENESS_LABEL,
  POST_ENROLLMENT_STALENESS_NOTE,
  postEnrollmentStaleness,
  postEnrollmentStalenessLabel,
} from "@/lib/postEnrollment";

interface Step {
  key: string;
  label: string;
  reachedAt?: string;
  note?: string;
}

function findAssignmentAt(patientId: string, actionMatch: RegExp): string | undefined {
  const events = AdelanteEHR.listAuditEvents({ patientId, category: "assignment" });
  // events are newest-first; take the earliest matching entry
  const matches = events.filter((e) => actionMatch.test(e.action));
  return matches.length ? matches[matches.length - 1].at : undefined;
}

export function ReferralStatusTimeline({ patient }: { patient: Patient }) {
  // Subscribe to store updates so timeline advances live.
  useEhr(() => AdelanteEHR.getPatient(patient.id));

  const referral = AdelanteEHR.listReferrals().find(
    (r) => r.enrolledPatientId === patient.id || r.id === patient.referralId,
  );
  // §Phase 4f — "First session" is an ATTENDANCE milestone. A booked, cancelled
  // or no-showed appointment does not mean the person was seen, so only an
  // appointment marked attended can mark this step reached. A future booking is
  // shown as in progress with its date instead.
  const firstAttended = firstAttendedAppointment(patient.id);
  const nextBooked = firstAttended ? undefined : nextScheduledAppointment(patient.id);
  const staleness = postEnrollmentStaleness(patient);

  // B4 — a logged manual attempt counts as outreach on the journey.
  const lastAttempt = referral ? latestOutreachAttempt(referral) : undefined;
  const outreachAt =
    lastAttempt?.at ??
    referral?.smsSentAt ??
    (referral?.outreachTask === "manual_call" ? referral.createdAt : undefined);
  const enrolledAt =
    referral?.status === "enrolled"
      ? patient.enrolledAt ?? referral.createdAt
      : referral
        ? undefined
        : patient.enrolledAt;

  const cmAssignedAt = patient.caseManagerId
    ? findAssignmentAt(patient.id, /case[_ ]?manager|caseManager|assign_case/i) ?? patient.enrolledAt
    : undefined;
  const clinicianAssignedAt = patient.primaryClinicianId
    ? findAssignmentAt(patient.id, /clinician|provider|primary/i) ?? patient.enrolledAt
    : undefined;

  const steps: Step[] = [
    {
      key: "submitted",
      label: "Referral submitted",
      reachedAt: referral?.createdAt,
      note: referral?.referringAgency,
    },
    {
      key: "outreach",
      label: lastAttempt
        ? lastAttempt.outcome === "reached"
          ? "Contacted"
          : "Outreach attempted"
        : referral?.outreachTask === "manual_call"
          ? "Manual outreach queued"
          : "Welcome outreach",
      reachedAt: outreachAt,
      ...(lastAttempt ? { note: outreachAttemptSummary(lastAttempt) } : {}),
    },
    {
      key: "enrolled",
      label: "Enrolled",
      reachedAt: enrolledAt,
      note: patient.programId,
    },
    {
      key: "ecm_provider",
      label: "Case manager assigned",
      reachedAt: cmAssignedAt,
      note: patient.caseManagerId
        ? AdelanteEHR.getCaseManager(patient.caseManagerId)?.name
        : undefined,
    },
    {
      key: "clinician",
      label: "Clinician assigned",
      reachedAt: clinicianAssignedAt,
      note: patient.primaryClinicianId
        ? AdelanteEHR.listClinicians().find((c) => c.id === patient.primaryClinicianId)?.name
        : undefined,
    },
    {
      key: "intake",
      label: "Intake completed",
      reachedAt: patient.intakeCompletedAt,
    },
    {
      key: "first_session",
      label: "First session attended",
      reachedAt: firstAttended?.start,
      note: nextBooked ? "Booked, not yet attended" : undefined,
    },
  ];

  // If there's no referral row, hide the outreach step entirely.
  const visible = referral ? steps : steps.filter((s) => s.key !== "outreach");

  const firstPendingIdx = visible.findIndex((s) => !s.reachedAt);
  const currentIdx = firstPendingIdx === -1 ? visible.length - 1 : firstPendingIdx;

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-display text-sm text-navy">Client journey</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Live status
        </span>
      </div>

      {/* Desktop: horizontal bar */}
      <div className="hidden sm:block">
        <div className="flex items-center">
          {visible.map((s, i) => {
            const reached = !!s.reachedAt;
            const isCurrent = i === currentIdx && !reached;
            return (
              <div key={s.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center min-w-0 flex-1">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                      reached
                        ? "bg-teal text-white"
                        : isCurrent
                          ? "bg-gold text-navy ring-2 ring-gold/40 animate-pulse"
                          : "bg-border text-muted-foreground"
                    }`}
                  >
                    {reached ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <div className="mt-1.5 text-[10px] text-center leading-tight text-navy max-w-[9rem]">
                    {s.label}
                  </div>
                  <div className="text-[9px] text-muted-foreground text-center mt-0.5 min-h-[0.9rem]">
                    {s.reachedAt ? (
                      <ClientDate value={s.reachedAt} />
                    ) : isCurrent ? (
                      "In progress"
                    ) : (
                      "Pending"
                    )}
                  </div>
                </div>
                {i < visible.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 -mt-8 ${
                      visible[i + 1].reachedAt || reached ? "bg-teal" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked list */}
      <ol className="sm:hidden space-y-2">
        {visible.map((s, i) => {
          const reached = !!s.reachedAt;
          const isCurrent = i === currentIdx && !reached;
          return (
            <li key={s.key} className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px] ${
                  reached
                    ? "bg-teal text-white"
                    : isCurrent
                      ? "bg-gold text-navy ring-2 ring-gold/40"
                      : "bg-border text-muted-foreground"
                }`}
              >
                {reached ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="text-navy font-medium">{s.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {s.reachedAt ? (
                    <ClientDate value={s.reachedAt} />
                  ) : isCurrent ? (
                    "In progress"
                  ) : (
                    "Pending"
                  )}
                  {s.note ? ` · ${s.note}` : ""}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {staleness && staleness.state !== "fresh" && (
        <div
          className={`mt-3 rounded border p-2 text-[11px] ${
            staleness.state === "overdue"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-gold/50 bg-gold/10 text-navy"
          }`}
          title={POST_ENROLLMENT_STALENESS_NOTE}
        >
          <div className="font-medium">{postEnrollmentStalenessLabel(staleness)}</div>
          <div className="text-[10px] opacity-80">{POST_ENROLLMENT_STALENESS_LABEL}</div>
        </div>
      )}
    </Card>
  );
}