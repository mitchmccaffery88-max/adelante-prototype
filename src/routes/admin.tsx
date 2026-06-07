import { createFileRoute } from "@tanstack/react-router";
import { HealthieService, useHealthie, type ReferralStatus } from "@/lib/healthie";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, Users, ClipboardCheck, Timer, DollarSign, ShieldCheck } from "lucide-react";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Adelante" },
      { name: "description", content: "Enrollment, completion rate, intake velocity, and billing status." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const stats = useHealthie(() => HealthieService.stats());
  const patients = useHealthie(() => HealthieService.listPatients());
  const referrals = useHealthie(() => HealthieService.listReferrals());
  const verifiedPct = Math.round(
    (patients.filter((p) => p.coverage?.verified === "verified").length /
      Math.max(patients.length, 1)) *
      100,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">Administrator</div>
        <h1 className="font-display text-3xl text-navy mt-1">Pilot dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
          Kings County · 90-day reentry episode
          <Badge variant="outline" className="text-[10px] inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-teal" /> De-identified · minimum-necessary
          </Badge>
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Kpi icon={Users} label="Enrolled patients" value={stats.enrolled.toString()} accent="navy" />
        <Kpi icon={ClipboardCheck} label="Session completion" value={`${stats.completionRate}%`} accent="teal" />
        <Kpi icon={Timer} label="Intake velocity" value={`${stats.intakeVelocityDays}d`} sub="referral → 1st session" accent="gold" />
        <Kpi icon={TrendingUp} label="Active referrals" value={referrals.filter((r) => r.status !== "enrolled").length.toString()} accent="teal" />
        <Kpi icon={ShieldCheck} label="Medi-Cal verified" value={`${verifiedPct}%`} accent="navy" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-navy">Caseload</h2>
            <Badge variant="outline">{patients.length} patients</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Episode day</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Next appt</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>SMS fallback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs text-navy">{p.programId}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-border">
                        <div className="h-1.5 rounded-full bg-teal" style={{ width: `${(p.episodeDay / 90) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.episodeDay}/90</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <CoverageBadge status={p.coverage?.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(() => {
                      const upcoming = HealthieService.appointmentsForPatient(p.id)
                        .filter((a) => new Date(a.start).getTime() > Date.now())
                        .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
                      return upcoming ? <ClientDate value={upcoming.start} /> : "—";
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
                    {p.smsFallback ? (
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
            No names, diagnoses, or care-plan narrative shown here. Clinical
            detail lives only in Case Manager and Clinician workspaces.
          </p>
        </Card>

        <div className="space-y-4">
          <ReferralTrackerCard referrals={referrals} />
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
                <li key={label as string} className="flex items-center justify-between border-b last:border-0 py-2">
                  <span>{label}</span>
                  <Badge className={`${cls as string} border-0`}>{n as number}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Status display only. Claim filing flows through Healthie; deeper EDI/clearinghouse integration is in Build 2.
            </p>
          </Card>
        </div>
      </div>
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
  referrals: ReturnType<typeof HealthieService.listReferrals>;
}) {
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
                <div className="text-xs text-muted-foreground capitalize">
                  {r.referralSource.replace("_", " ")} ·{" "}
                  <ClientDate value={r.createdAt} />
                </div>
              </div>
              <Badge className={`${trackerStyles[r.status]} capitalize border-0`}>
                {r.status}
              </Badge>
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
            {r.smsSentAt && (
              <div className="mt-1.5 text-[10px] text-success">
                ✓ Welcome SMS sent
              </div>
            )}
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
    <Badge className={`${styles[status] ?? ""} border-0 text-xs`}>
      {labels[status] ?? status}
    </Badge>
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