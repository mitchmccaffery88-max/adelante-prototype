// §Chart turn 4 finish — Consents, Audit trail and Weekly review as chart
// sub-sections. Each reuses an existing component / reader and its own gate.
import { Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { canAccess, useActingStaff, type StaffRole } from "@/lib/roles";
import { redactAuditEvents } from "@/lib/auditRedaction";
import { ConsentRecordsPanel } from "@/components/consent/ConsentRecordsPanel";
import { accountingOfDisclosures, CHANNEL_LABEL } from "@/lib/part2Disclosure";
import { accessEventsFor, ACCESS_LOG_LABEL, ACCESS_LOG_ROLES } from "@/lib/accessLog";
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
      <DisclosureAccounting patientId={patient.id} />
    </div>
  );
}

/** §Batch C1 — per-patient accounting of Part 2 disclosures (staff). Class names only. */
export function DisclosureAccounting({ patientId }: { patientId: string }) {
  const rows = JSON.parse(useEhr(() => JSON.stringify(accountingOfDisclosures(patientId)))) as ReturnType<typeof accountingOfDisclosures>;
  return (
    <section className="mt-3 rounded-md border border-border p-3" data-testid="disclosure-accounting">
      <h3 className="text-sm font-semibold text-navy">Accounting of disclosures</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No substance-use records have been shared for this person.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2">
              <span className="text-muted-foreground">{new Date(r.at).toLocaleString()}</span>
              <span className="font-medium">{r.recipient.name}{r.recipient.organization ? ` (${r.recipient.organization})` : ""}</span>
              <span>· {r.purpose}</span>
              <span className="text-muted-foreground">· {CHANNEL_LABEL[r.channel]} · {r.recordClasses.join(", ")} · by {r.actorName} ({r.actingRole.replace(/_/g, " ")})</span>
              {r.emergency && <span className="font-medium text-destructive">· Emergency — {r.complianceReview === "reviewed" ? "reviewed" : "compliance review pending"}</span>}
              {r.simulated && <span className="text-muted-foreground">· Simulated</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** §Batch C2 — who accessed this record (sys_admin + compliance stand-in only). */
export function WhoAccessed({ patientId }: { patientId: string }) {
  const { role } = useActingStaff();
  const rows = JSON.parse(useEhr(() => JSON.stringify(accessEventsFor(patientId).slice(0, 100)))) as ReturnType<typeof accessEventsFor>;
  if (!ACCESS_LOG_ROLES.includes(role)) return null;
  return (
    <section className="space-y-1" data-testid="who-accessed">
      <p className="text-xs text-muted-foreground">{ACCESS_LOG_LABEL}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No record views logged yet.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2">
              <span className="w-36 shrink-0 text-muted-foreground">{new Date(r.at).toLocaleString()}</span>
              <span className="font-medium">{r.actorName}</span>
              <span className="text-muted-foreground">{(r.role ?? "").replace(/_/g, " ")} · {r.kind} · {r.sectionId}{r.viewedAs ? ` · viewed as ${r.viewedAs}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
