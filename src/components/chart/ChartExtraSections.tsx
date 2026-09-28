// §Chart turn 4 finish — Consents, Audit trail and Weekly review as chart
// sub-sections. Each reuses an existing component / reader and its own gate.
import { Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { canAccess, useActingStaff, type StaffRole } from "@/lib/roles";
import { redactAuditEvents } from "@/lib/auditRedaction";
import { ConsentRecordsPanel } from "@/components/consent/ConsentRecordsPanel";
import { canUseCaseloadReview } from "@/lib/caseloadRoles";
import { patientStatus, STATUS_LABEL, isWeekReviewed } from "@/lib/caseloadReview";

export const canSeeChartConsents = (role: StaffRole, p: Patient) => canAccess(role, "consent_ledger", p).level !== "none";
export const canSeeChartAudit = (role: StaffRole) => canAccess(role, "platform_administration").level !== "none";
export const canSeeWeeklyReview = (role: StaffRole) => canUseCaseloadReview(role);

export function ChartConsents({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-2">
      <ConsentRecordsPanel patient={patient} />
      <Link to="/consent" className="text-xs text-teal hover:underline">Part 2 disclosures — view or revoke on the consent screen</Link>
    </div>
  );
}

export function ChartAuditTrail({ patientId }: { patientId: string }) {
  const { role } = useActingStaff();
  const json = useEhr(() => JSON.stringify(redactAuditEvents(AdelanteEHR.listAuditEvents({ patientId, limit: 50 }), role).map((r) => ({ id: r.event.id, at: r.event.at, action: r.event.action, actor: r.event.actorRole ?? "", redacted: r.redacted }))));
  const rows = JSON.parse(json) as { id: string; at: string; action: string; actor: string; redacted: boolean }[];
  if (!rows.length) return <p className="text-sm text-muted-foreground">No audit entries for this patient.</p>;
  return (
    <ul className="space-y-1 text-xs" data-testid="chart-audit-trail">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-2">
          <span className="w-36 shrink-0 text-muted-foreground">{new Date(r.at).toLocaleString()}</span>
          <span className="font-medium text-navy">{r.action.replace(/_/g, " ")}</span>
          <span className="text-muted-foreground">{r.actor.replace(/_/g, " ")}{r.redacted ? " · details withheld" : ""}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChartWeeklyReview({ patientId }: { patientId: string }) {
  const { staffId } = useActingStaff();
  const json = useEhr(() => {
    const p = AdelanteEHR.getPatient(patientId);
    if (!p) return "null";
    const r = patientStatus(p, staffId);
    return JSON.stringify({ status: r.status, last: r.lastContact, week: r.contactsThisWeek, tries: r.attemptsThisWeek, every: r.intervalDays, done: isWeekReviewed(staffId) });
  });
  const r = JSON.parse(json) as null | { status: keyof typeof STATUS_LABEL; last?: string; week: number; tries: number; every: number; done: boolean };
  if (!r) return null;
  return (
    <div className="space-y-1 text-sm" data-testid="chart-weekly-review">
      <p><span className="font-medium">{STATUS_LABEL[r.status]}</span> · contact every {r.every} days</p>
      <p className="text-muted-foreground">Last contact {r.last ?? "none"} · {r.week} this week · {r.tries} attempts</p>
      <p className="text-xs text-muted-foreground">Your week is {r.done ? "signed off" : "not signed off yet"}.</p>
      <Link to="/caseload-review" className="text-xs text-teal hover:underline">Open weekly caseload review</Link>
    </div>
  );
}
