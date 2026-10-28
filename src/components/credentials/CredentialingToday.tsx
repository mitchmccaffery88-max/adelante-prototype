// 27 Oct (Mitch) — the Credentialing Coordinator's Today work: five tiles
// (Expiring soon, Exclusion checks due, Re-credentialing due, Payer enrollment
// pending, Blocked clinicians), each linking to its action home on this page.
// Draft — pending the go-live permissions audit and compliance review.
//
// Privacy boundaries:
//  • Exclusion-hit notices are urgent items for the clinical coordinator and
//    sys_admin only — neutral text, ids only, acknowledged through the
//    registry (one audit row).
//  • The coordinator sees HOW MANY claims a credential problem affects,
//    never claim details.
//  • Non-manual monitor channels are disabled and labelled Simulated.

import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";
import {
  CREDENTIALING_DRAFT,
  CREDENTIALING_REASON_LABEL,
  MONITOR_CHANNELS,
  affectedClaimCount,
  blockedClinicians,
  clinicianCredentialNotices,
  credentialingTiles,
  enrollmentStatusLabel,
  exclusionChecksDue,
  expiringItems,
  listCredentialingNotices,
  recredentialingDue,
  enrollmentsPending,
  useCredentialing,
  EXCLUSION_LISTS,
} from "@/lib/credentialing";
import { getStaffMember, type StaffRole } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { SimulatedBadge } from "@/components/SimulatedBadge";
import { StatusChip } from "@/components/ui/status-chip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  ShieldAlert,
  UserX,
} from "lucide-react";

const TILE_ICONS = {
  expiring: CalendarClock,
  exclusions: ShieldAlert,
  recredentialing: ClipboardCheck,
  enrollment: BadgeCheck,
  blocked: UserX,
} as const;

function nameOf(staffId: string): string {
  return getStaffMember(staffId)?.name ?? staffId;
}

const payerForPatient = (pid: string) => AdelanteEHR.activeCoveragePlan(pid)?.payer;

export function CredentialingToday({ role, staffId }: { role: StaffRole; staffId: string }) {
  const tiles = useCredentialing(() => credentialingTiles());
  const expiring = useCredentialing(() => expiringItems());
  const exclusions = useCredentialing(() => exclusionChecksDue());
  const recred = useCredentialing(() => recredentialingDue());
  const pending = useCredentialing(() => enrollmentsPending());
  const blocked = useCredentialing(() => blockedClinicians());
  const notices = useCredentialing(() => listCredentialingNotices());
  const claims = useEhrExt(() => AdelanteEHRExt.listClaims());

  const openNotices = notices.filter((n) => !n.acknowledgedAt);
  const mayAcknowledge = role === "clinical_coordinator" || role === "sys_admin";

  const ack = (noticeId: string) => {
    const r = runAction("credential_notice_ack", { role, staffId }, undefined, { args: [{ role, staffId }, noticeId] });
    if (r.ok) toast.success("Notice acknowledged");
    else toast.error(r.reason);
  };

  return (
    <section className="space-y-4" aria-labelledby="cred-today-heading">
      <div className="space-y-1">
        <h2 id="cred-today-heading" className="font-display text-lg text-navy">
          Today — credentialing work
        </h2>
        <p className="text-xs text-muted-foreground">
          {CREDENTIALING_DRAFT.label}. Exclusion checks run every {CREDENTIALING_DRAFT.exclusionCadenceDays} days;
          re-credentialing at least every {CREDENTIALING_DRAFT.recredentialingYears} years.
        </p>
      </div>

      {mayAcknowledge && openNotices.length > 0 && (
        <Card className="border-urgent/40 bg-surface-sunk p-4" data-testid="cred-exclusion-notices">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-urgent">
            <ShieldAlert className="h-4 w-4" aria-hidden /> Urgent — exclusion-list match ({openNotices.length})
          </h3>
          <ul className="space-y-2 text-sm">
            {openNotices.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  An exclusion-list check for <b>{nameOf(n.staffId)}</b> returned a match on {n.at.slice(0, 10)}.
                  Billing review is flagged; new billable bookings are blocked.
                </span>
                <Button size="sm" variant="outline" data-testid={`cred-notice-ack-${n.id}`} onClick={() => ack(n.id)}>
                  Acknowledge
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="cred-today-tiles">
        {tiles.map((t) => {
          const Icon = TILE_ICONS[t.key];
          return (
            <a
              key={t.key}
              href={`#cred-${t.key}`}
              className="rounded-md border border-line-strong bg-surface p-3 transition-colors hover:bg-path-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`cred-tile-${t.key}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-path" aria-hidden />
                <span className="font-display text-xl text-ink">{t.count}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-ink">{t.label}</p>
            </a>
          );
        })}
      </div>

      <Card className="space-y-2 p-4" id="cred-expiring">
        <h3 className="font-semibold">Expiring soon</h3>
        <p className="text-xs text-muted-foreground">
          Tasks at 90 / 60 / 30 days before expiry. The clinician gets a neutral heads-up at 30 days.
        </p>
        {expiring.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing expiring in the next 90 days.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {expiring.map((i, idx) => (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{nameOf(i.staffId)}</b> — {i.item} expires {i.expiresAt.slice(0, 10)}
                </span>
                <StatusChip lang="en" state="yourturn" label={`${i.daysLeft} days left`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" id="cred-exclusions">
        <h3 className="font-semibold">Exclusion checks due</h3>
        <p className="text-xs text-muted-foreground">
          {EXCLUSION_LISTS.map((l) => l.label).join(" · ")}. Cadence is a Draft setting, to be confirmed against the
          Tulare and Kings county contracts.
        </p>
        {exclusions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every exclusion check is current.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {exclusions.map((r, idx) => (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{nameOf(r.staffId)}</b> — {EXCLUSION_LISTS.find((l) => l.key === r.list)?.label}
                </span>
                <StatusChip
                  lang="en"
                  state="yourturn"
                  label={r.state === "never" ? "Never checked" : r.state === "overdue" ? "Check overdue" : "Due this week"}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" id="cred-recredentialing">
        <h3 className="font-semibold">Re-credentialing due</h3>
        {recred.length === 0 ? (
          <p className="text-sm text-muted-foreground">No re-credentialing due in the next 90 days.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recred.map((r) => (
              <li key={r.staffId} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{nameOf(r.staffId)}</b> — due {r.dueAt.slice(0, 10)}
                </span>
                <StatusChip lang="en" state="yourturn" label={`${r.daysLeft} days left`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" id="cred-enrollment">
        <h3 className="font-semibold">Payer enrollment pending</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrollments waiting.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {pending.map((e, idx) => (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{nameOf(e.staffId)}</b> — {e.payer} · {e.serviceType === "*" ? "all services" : e.serviceType}
                </span>
                <StatusChip lang="en" state="team" label={enrollmentStatusLabel(e.status)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" id="cred-blocked">
        <h3 className="font-semibold">Blocked clinicians</h3>
        <p className="text-xs text-muted-foreground">
          Clinicians who fail the credentialing rule right now. New billable bookings are blocked for the affected
          payer and service; existing appointments and claims are flagged for Billing review, never cancelled.
        </p>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clinician is blocked.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {[...new Set(blocked.map((b) => b.staffId))].map((sid) => {
              const rows = blocked.filter((b) => b.staffId === sid);
              const reasons = [...new Set(rows.flatMap((r) => r.reasons))];
              const claimCount = affectedClaimCount(sid, claims, payerForPatient);
              return (
                <li key={sid} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{nameOf(sid)}</b>
                    <StatusChip lang="en" state="yourturn" label="Booking blocked" />
                    {claimCount > 0 && (
                      <Badge className="border-0 bg-muted text-muted-foreground" data-testid={`cred-claims-affected-${sid}`}>
                        {claimCount} claim{claimCount === 1 ? "" : "s"} flagged for Billing review
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {reasons.map((r) => CREDENTIALING_REASON_LABEL[r]).join("; ")} — affects{" "}
                    {[...new Set(rows.map((r) => r.payer))].join(", ")}.
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" data-testid="cred-monitor-channels">
        <h3 className="font-semibold">Monitoring channels</h3>
        <ul className="space-y-1 text-sm">
          {MONITOR_CHANNELS.map((c) => (
            <li key={c.channel} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.label}</span>
              {c.simulated ? (
                <>
                  <SimulatedBadge />
                  <span className="text-xs text-muted-foreground">{c.note} Disabled — switchable by configuration only.</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{c.note}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/** Neutral 30-day heads-up for the clinician's own credentials page. */
export function ClinicianCredentialHeadsUp({ staffId }: { staffId: string }) {
  const notices = useCredentialing(() => clinicianCredentialNotices(staffId));
  if (notices.length === 0) return null;
  return (
    <Card className="border-gold bg-gold/20 p-4" data-testid="cred-heads-up">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-on-gold">
        <CircleAlert className="h-4 w-4" aria-hidden /> Your turn
      </h3>
      <ul className="space-y-1 text-sm text-on-gold">
        {notices.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </Card>
  );
}
