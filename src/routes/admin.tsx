import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type ReferralStatus } from "@/lib/ehr";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  Users,
  ClipboardCheck,
  Timer,
  DollarSign,
  ShieldCheck,
  Download,
  ScrollText,
  HandHeart,
  AlertTriangle,
  BellOff,
  RotateCw,
  Lock,
  UsersRound,
} from "lucide-react";
import { ClientDate } from "@/components/ClientDate";
import { useI18n } from "@/lib/i18n";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";
import { EmptyState } from "@/components/EmptyState";
import { PopulationCarePlanStrip } from "@/components/CarePlanCard";
import { toast } from "sonner";
import { canAccess, useActingStaff } from "@/lib/roles";
import { staffNavGroupForRole } from "@/lib/navSections";
import {
  activeGroupSessions,
  enrolledPatientCount,
  nextGroupOccurrenceForPatient,
  weeklyGroupSeats,
} from "@/lib/groupMetrics";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Adelante" },
      {
        name: "description",
        content: "Enrollment, completion rate, intake velocity, and billing status.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const { role } = useActingStaff();
  // Same gate the "Pilot dashboard" nav entry promises, so the sidebar never
  // advertises a surface that then refuses to render.
  const access = canAccess(role, "population_health");
  // Quick links ARE the sidebar's Administration group — one computation, no
  // second hand-maintained list to drift. `/admin` itself is dropped: this is
  // the page you're on.
  const adminLinks = useMemo(
    () => staffNavGroupForRole(role, "administration").filter((e) => e.to !== "/admin"),
    [role],
  );
  const stats = useEhr(() => AdelanteEHR.stats());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const referrals = useEhr(() => AdelanteEHR.listReferrals());
  const consentEvents = useEhr(() => AdelanteEHR.listAllConsentEvents());
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  const verifiedPct = Math.round(
    (patients.filter((p) => p.coverage?.verified === "verified").length /
      Math.max(patients.length, 1)) *
      100,
  );
  const ecmCount = patients.filter((p) => p.coverage?.ecmEligible).length;
  const ecmPct = Math.round((ecmCount / Math.max(patients.length, 1)) * 100);

  // Cohort filters
  const [coverageFilter, setCoverageFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  // §Group sessions — "Next contact" can be a group occurrence or a 1:1
  // appointment; this filter uses the SAME resolver the cell renders with.
  const [contactFilter, setContactFilter] = useState<string>("all");
  const filteredPatients = useMemo(
    () =>
      patients.filter((p) => {
        if (coverageFilter !== "all" && p.coverage?.status !== coverageFilter) return false;
        if (bucketFilter !== "all") {
          const d = p.episodeDay;
          if (bucketFilter === "0-30" && !(d <= 30)) return false;
          if (bucketFilter === "31-60" && !(d > 30 && d <= 60)) return false;
          if (bucketFilter === "61-90" && !(d > 60)) return false;
        }
        if (contactFilter !== "all" && nextContactKind(p.id) !== contactFilter) return false;
        return true;
      }),
    [patients, coverageFilter, bucketFilter, contactFilter],
  );

  const downloadCsv = () => {
    const headers = [
      "Program ID",
      "CIN (last 4)",
      "Episode day (of 90)",
      "Coverage status",
      "Coverage verified",
      "JI Reentry flag",
      "ECM eligible",
      "SMS reminders",
    ];
    const rows = filteredPatients.map((p) => [
      p.programId,
      p.cin ? `••••${p.cin.slice(-4)}` : "",
      p.episodeDay,
      p.coverage?.status ?? "",
      p.coverage?.verified ?? "",
      p.coverage?.jiReentryFlag ? "Yes" : "No",
      p.coverage?.ecmEligible ? "Yes" : "No",
      AdelanteEHR.isSmsOn(p.id) ? "On" : "Off",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adelante-caseload-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="The pilot dashboard is restricted"
          description={
            access.reason ?? "Your role can't view cross-patient program administration."
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">Administrator</div>
        <h1 className="font-display text-3xl text-navy mt-1">{t("adminTitle")}</h1>
        <div className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
          {t("adminSubtitle")}
          <Badge variant="outline" className="text-[10px] inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-teal" /> De-identified · minimum-necessary
          </Badge>
        </div>
      </header>

      <nav aria-label="Administration" className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Administration
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {adminLinks.map((entry) => (
            <Link
              key={entry.id}
              to={entry.to}
              data-admin-link-id={entry.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-secondary/50"
            >
              {entry.icon ? <entry.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal" /> : null}
              <span className="min-w-0">
                <span className="block text-xs font-medium uppercase tracking-wider text-teal">
                  {entry.label}
                </span>
                <span className="mt-1 block text-sm text-foreground">{entry.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Kpi
          icon={Users}
          label="Enrolled patients"
          value={stats.enrolled.toString()}
          accent="navy"
        />
        <Kpi
          icon={ClipboardCheck}
          label="Session completion"
          value={`${stats.completionRate}%`}
          accent="teal"
        />
        <Kpi
          icon={Timer}
          label="Intake velocity"
          value={`${stats.intakeVelocityDays}d`}
          sub="referral → 1st session"
          accent="gold"
        />
        <Kpi
          icon={TrendingUp}
          label="Active referrals"
          value={referrals.filter((r) => r.status !== "enrolled").length.toString()}
          accent="teal"
        />
        <Kpi icon={ShieldCheck} label="Medi-Cal verified" value={`${verifiedPct}%`} accent="navy" />
        <Kpi
          icon={HandHeart}
          label="ECM caseload"
          value={`${ecmPct}%`}
          sub={`${ecmCount} of ${patients.length}`}
          accent="gold"
        />
      </div>

      <div className="mb-6">
        <GroupActivityKpi />
      </div>

      <PopulationCarePlanStrip className="mb-6" />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-lg text-navy">Caseload</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={bucketFilter} onValueChange={setBucketFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Episode day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  <SelectItem value="0-30">Day 0–30</SelectItem>
                  <SelectItem value="31-60">Day 31–60</SelectItem>
                  <SelectItem value="61-90">Day 61–90</SelectItem>
                </SelectContent>
              </Select>
              <Select value={coverageFilter} onValueChange={setCoverageFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Coverage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All coverage</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="none_unsure">None / unsure</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={contactFilter} onValueChange={setContactFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Next contact type">
                  <SelectValue placeholder="Next contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any next contact</SelectItem>
                  <SelectItem value="group">Group occurrence</SelectItem>
                  <SelectItem value="one_to_one">1:1 appointment</SelectItem>
                  <SelectItem value="none">No next contact</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={downloadCsv}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> {t("adminExportCsv")}
              </Button>
              <Badge variant="outline">
                {filteredPatients.length}/{patients.length}
              </Badge>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>CIN</TableHead>
                <TableHead>Episode day</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Next contact</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>SMS reminders</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-secondary/40"
                  onClick={() => setOpenPatientId(p.id)}
                >
                  <TableCell className="font-mono text-xs text-navy">{p.programId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.cin ? `••••${p.cin.slice(-4)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-border">
                        <div
                          className="h-1.5 rounded-full bg-teal"
                          style={{ width: `${(p.episodeDay / 90) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.episodeDay}/90</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CoverageBadge status={p.coverage?.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(() => {
                      const contact = nextContact(p.id);
                      if (contact.kind === "none") return "—";
                      if (contact.kind === "group") {
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            <ClientDate value={contact.start} />
                            <Badge variant="outline" className="text-[10px]">
                              Group
                            </Badge>
                          </span>
                        );
                      }
                      return <ClientDate value={contact.start} />;
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={p.episodeDay > 30 ? "" : "border-teal/40 text-teal"}
                    >
                      {p.episodeDay > 30 ? "Steady" : "New"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {AdelanteEHR.isSmsOn(p.id) ? (
                      <Badge className="bg-gold/30 text-navy border-0">On</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Off</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Click a row to open the patient profile. No names, diagnoses, or care-plan narrative
            shown in the table — clinical detail lives only in Case Manager and Clinician
            workspaces.
          </p>
        </Card>

        <div className="space-y-4">
          <ReferralTrackerCard referrals={referrals} />
          <CredentialingCard />
          <NotificationHealthCard />
          <VendorStatusCard />
          <AuditLogCard events={consentEvents} />
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg text-navy">Billing status</h3>
              <DollarSign className="h-5 w-5 text-teal" />
            </div>
            <ul className="space-y-2 text-sm">
              {[
                ["Draft", stats.billing.draft, "bg-muted text-muted-foreground"],
                ["Submitted", stats.billing.submitted, "bg-teal/15 text-teal"],
                ["Paid", stats.billing.paid, "bg-success/20 text-success"],
                ["Denied", stats.billing.denied, "bg-destructive/15 text-destructive"],
              ].map(([label, n, cls]) => (
                <li
                  key={label as string}
                  className="flex items-center justify-between border-b last:border-0 py-2"
                >
                  <span>{label}</span>
                  <Badge className={`${cls as string} border-0`}>{n as number}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Status display only. Claim filing is tracked here; deeper EDI/clearinghouse
              integration is in Build 2.
            </p>
          </Card>
        </div>
      </div>
      <PatientProfileDialog
        patientId={openPatientId}
        open={openPatientId !== null}
        onOpenChange={(o) => !o && setOpenPatientId(null)}
        showAdminMeta
      />
    </div>
  );
}

const trackerStyles: Record<ReferralStatus, string> = {
  submitted: "bg-gold/30 text-navy",
  contacted: "bg-teal/20 text-teal",
  enrolled: "bg-success/20 text-success",
};
const trackerOrder: ReferralStatus[] = ["submitted", "contacted", "enrolled"];

function ReferralTrackerCard({
  referrals,
}: {
  referrals: ReturnType<typeof AdelanteEHR.listReferrals>;
}) {
  const sourceLabels: Record<string, string> = {
    probation: "Probation",
    parole: "Parole",
    drug_court: "Drug court",
    correctional: "Correctional",
    self: "Self-referred",
    other: "Other",
  };
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy mb-3">Referral status</h3>
      <div className="space-y-3">
        {referrals.slice(0, 5).map((r) => (
          <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                <div className="font-medium text-navy">
                  {r.firstName} {r.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {sourceLabels[r.referralSource] ?? r.referralSource}
                  {r.referringAgency ? ` · ${r.referringAgency}` : ""} ·{" "}
                  <ClientDate value={r.createdAt} />
                </div>
                {r.cin && (
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    CIN ••••{r.cin.slice(-4)}
                  </div>
                )}
              </div>
              <Badge className={`${trackerStyles[r.status]} capitalize border-0`}>{r.status}</Badge>
            </div>
            <div className="mt-2 flex gap-1">
              {trackerOrder.map((s, i) => {
                const reached = trackerOrder.indexOf(r.status) >= i;
                return (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full ${reached ? "bg-teal" : "bg-border"}`}
                  />
                );
              })}
            </div>
            {r.smsSentAt ? (
              <div className="mt-1.5 text-[10px] text-success">✓ Welcome SMS sent</div>
            ) : r.outreachTask === "manual_call" ? (
              <div className="mt-1.5 text-[10px] text-gold-foreground">
                ⚑ Manual outreach queued (no SMS)
              </div>
            ) : null}
            {r.enrolledPatientId &&
              (() => {
                const enrolled = AdelanteEHR.getPatient(r.enrolledPatientId);
                return enrolled ? (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Enrolled as <span className="font-mono text-navy">{enrolled.programId}</span>
                  </div>
                ) : null;
              })()}
          </div>
        ))}
      </div>
    </Card>
  );
}

function CoverageBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const styles: Record<string, string> = {
    active: "bg-success/20 text-success",
    suspended: "bg-gold/30 text-navy",
    none_unsure: "bg-destructive/15 text-destructive",
    other: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    active: "Active",
    suspended: "Suspended",
    none_unsure: "Assistance",
    other: "Other",
  };
  return (
    <Badge className={`${styles[status] ?? ""} border-0 text-xs`}>{labels[status] ?? status}</Badge>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: "navy" | "teal" | "gold";
}) {
  const colors = {
    navy: "bg-navy/10 text-navy",
    teal: "bg-teal/15 text-teal",
    gold: "bg-gold/30 text-navy",
  } as const;
  return (
    <Card className="p-5">
      <div className={`h-10 w-10 rounded-lg grid place-items-center ${colors[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl text-navy">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function AuditLogCard({ events }: { events: ReturnType<typeof AdelanteEHR.listAllConsentEvents> }) {
  const purposeLabels: Record<string, string> = {
    part2Sud: "Part 2 SUD",
    ecmShare: "ECM data share",
    sms: "SMS reminders",
    hipaa: "HIPAA",
  };
  const actionLabels: Record<string, string> = {
    granted: "Granted",
    revoked: "Revoked",
  };
  const actorLabels: Record<string, string> = {
    patient: "Patient",
    staff: "Staff",
  };
  const [purpose, setPurpose] = useState<string>("all");
  const filtered = events.filter((e) => purpose === "all" || e.purpose === purpose).slice(0, 12);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg text-navy flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-teal" /> Consent audit log
        </h3>
        <div className="flex items-center gap-2">
          <Link to="/admin-audit" className="text-[11px] text-teal underline underline-offset-2">
            Full log
          </Link>
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All purposes</SelectItem>
              <SelectItem value="part2Sud">Part 2 SUD</SelectItem>
              <SelectItem value="ecmShare">ECM share</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="hipaa">HIPAA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No consent changes recorded.</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 border-b last:border-0 py-1.5"
            >
              <span className="font-mono text-navy">{e.programId}</span>
              <span className="text-muted-foreground">
                {purposeLabels[e.purpose] ?? e.purpose}
                <span className="text-[10px]"> · by {actorLabels[e.actor] ?? e.actor}</span>
              </span>
              <Badge
                className={
                  (e.action === "granted"
                    ? "bg-success/20 text-success"
                    : "bg-destructive/15 text-destructive") + " border-0"
                }
              >
                {actionLabels[e.action] ?? e.action}
              </Badge>
              <span className="text-muted-foreground text-[10px]">
                <ClientDate value={e.at} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Append-only. Patient identifiers are de-identified programIds only.
      </p>
    </Card>
  );
}

function CredentialingCard() {
  const rows = useEhr(() => AdelanteEHR.expiringClinicianLicenses(30));
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-navy flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal" /> Credentialing
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {rows.length}
        </Badge>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          All clinician licenses valid for at least 30 days.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li
              key={r.clinician.id}
              className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0"
            >
              <div>
                <div className="font-medium text-navy">{r.clinician.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  License expires {r.clinician.licenseExpiresOn?.slice(0, 10)}
                </div>
              </div>
              {r.expired ? (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Expired — booking blocked
                </Badge>
              ) : (
                <Badge className="bg-gold/30 text-navy border-0 text-[10px]">{r.daysUntil}d</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Expired licenses hard-stop new bookings on the clinician workspace.
      </p>
    </Card>
  );
}

function NotificationHealthCard() {
  const failed = useEhr(() => AdelanteEHR.recentFailedNotifications(24));
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-navy flex items-center gap-2">
          <BellOff className="h-4 w-4 text-teal" /> Delivery health (24h)
        </h3>
        <Badge
          className={
            (failed.length === 0
              ? "bg-success/20 text-success"
              : "bg-destructive/15 text-destructive") + " border-0 text-[10px]"
          }
        >
          {failed.length} failed
        </Badge>
      </div>
      {failed.length === 0 ? (
        <EmptyState
          compact
          icon={BellOff}
          title="No delivery failures"
          description="Notifications reached patients in the last 24 hours."
        />
      ) : (
        <ul className="space-y-2 text-sm">
          {failed.slice(0, 6).map(({ patient, notification }) => (
            <li
              key={notification.id}
              className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0"
            >
              <div>
                <div className="font-mono text-xs text-navy">{patient.programId}</div>
                <div className="text-[11px] text-muted-foreground capitalize">
                  {notification.channel} · {notification.kind} ·{" "}
                  <ClientDate value={notification.at} />
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => {
                  AdelanteEHR.resendNotification(patient.id, notification.id);
                  toast.success("Retrying delivery");
                }}
                aria-label="Retry delivery"
              >
                <RotateCw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Failed SMS/email deliveries auto-create a CM outreach task.
      </p>
    </Card>
  );
}

function VendorStatusCard() {
  const status = useEhr(() => AdelanteEHR.vendorStatus());
  const [pingedAt, setPingedAt] = useState<string | null>(null);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-navy flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal" /> Integrated vendors
        </h3>
        <div className="flex items-center gap-2">
          <Link to="/admin-vendors" className="text-[11px] text-teal underline underline-offset-2">
            Details
          </Link>
          <Badge variant="outline" className="text-[10px]">
            mock
          </Badge>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center justify-between border-b pb-2">
          <div>
            <div className="font-medium text-navy">Telehealth video</div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {status.telehealth.name}
            </div>
          </div>
          <Badge className="bg-gold/30 text-navy border-0 text-[10px]">
            {status.telehealth.mode}
          </Badge>
        </li>
        <li className="flex items-center justify-between">
          <div>
            <div className="font-medium text-navy">Medication management (eScribe)</div>
            <div className="text-[11px] text-muted-foreground font-mono">{status.erx.name}</div>
          </div>
          <Badge className="bg-gold/30 text-navy border-0 text-[10px]">{status.erx.mode}</Badge>
        </li>
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Adelante is the EHR of record. Vendors are swappable.
          {pingedAt ? ` · Last test ${new Date(pingedAt).toLocaleTimeString()}` : ""}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          onClick={() => {
            setPingedAt(new Date().toISOString());
            toast.success("Vendor connections OK (mock)");
          }}
        >
          Test connections
        </Button>
      </div>
    </Card>
  );
}

// §Group sessions — pilot dashboard activity strip.

// Single resolver for the "Next contact" column so the filter and the cell
// can never disagree. Group occurrences are invisible to the Appointment model.
function nextContact(patientId: string) {
  const upcoming = AdelanteEHR.appointmentsForPatient(patientId)
    .filter((a) => new Date(a.start).getTime() > Date.now())
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  const group = nextGroupOccurrenceForPatient(patientId);
  if (group && (!upcoming || group.start < upcoming.start))
    return { kind: "group" as const, start: group.start };
  if (upcoming) return { kind: "one_to_one" as const, start: upcoming.start };
  return { kind: "none" as const, start: undefined };
}

function nextContactKind(patientId: string) {
  return nextContact(patientId).kind;
}
//
// Group care is invisible to every Appointment-derived KPI above, so it gets
// its own row. Counts only; no billing or curriculum content is inferred here.
function GroupActivityKpi() {
  const active = useEhr(() => activeGroupSessions().length);
  const enrolled = useEhr(() => enrolledPatientCount());
  const seats = useEhr(() => weeklyGroupSeats().length);
  return (
    <Card className="p-4" data-testid="admin-group-activity">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-teal" />
          <h2 className="font-display text-lg text-navy">Group activity</h2>
        </div>
        <Link to="/group-sessions" className="text-xs text-teal underline-offset-2 hover:underline">
          Manage groups →
        </Link>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Active groups</div>
          <div className="font-display text-2xl text-navy" data-testid="admin-group-active">
            {active}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Patients enrolled</div>
          <div className="font-display text-2xl text-navy" data-testid="admin-group-enrolled">
            {enrolled}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Scheduled seats (next 7 days)</div>
          <div className="font-display text-2xl text-navy" data-testid="admin-group-seats">
            {seats}
          </div>
        </div>
      </div>
    </Card>
  );
}
