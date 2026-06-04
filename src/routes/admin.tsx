import { createFileRoute } from "@tanstack/react-router";
import { HealthieService, useHealthie } from "@/lib/healthie";
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
import { TrendingUp, Users, ClipboardCheck, Timer, DollarSign } from "lucide-react";

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
  const clinicians = useHealthie(() => HealthieService.listClinicians());
  const referrals = useHealthie(() => HealthieService.listReferrals());

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">Administrator</div>
        <h1 className="font-display text-3xl text-navy mt-1">Pilot dashboard</h1>
        <p className="text-muted-foreground mt-1">Kings County · 90-day reentry episode</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Users} label="Enrolled patients" value={stats.enrolled.toString()} accent="navy" />
        <Kpi icon={ClipboardCheck} label="Session completion" value={`${stats.completionRate}%`} accent="teal" />
        <Kpi icon={Timer} label="Intake velocity" value={`${stats.intakeVelocityDays}d`} sub="referral → 1st session" accent="gold" />
        <Kpi icon={TrendingUp} label="Active referrals" value={referrals.filter((r) => r.status !== "enrolled").length.toString()} accent="teal" />
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
                <TableHead>Patient</TableHead>
                <TableHead>Episode day</TableHead>
                <TableHead>SUD consent</TableHead>
                <TableHead>SMS fallback</TableHead>
                <TableHead>Care plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-navy">{p.firstName} {p.lastName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-border">
                        <div className="h-1.5 rounded-full bg-teal" style={{ width: `${(p.episodeDay / 90) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.episodeDay}/90</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.consents.part2Sud ? (
                      <Badge className="bg-success/20 text-success border-0">Yes</Badge>
                    ) : (
                      <Badge variant="outline">Withheld</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.smsFallback ? (
                      <Badge className="bg-gold/30 text-navy border-0">On</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Off</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[260px]">
                    {p.carePlanSummary}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-4">
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
              Claim filing flows through Healthie; deeper EDI/clearinghouse integration is in Build 2.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="font-display text-lg text-navy mb-3">Medi-Cal credentialing</h3>
            <ul className="space-y-2 text-sm">
              {clinicians.map((c) => (
                <li key={c.id} className="flex items-center justify-between border-b last:border-0 py-2">
                  <div>
                    <div className="font-medium text-navy">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.credential}</div>
                  </div>
                  <Badge
                    className={
                      c.mediCalStatus === "active"
                        ? "bg-success/20 text-success border-0 capitalize"
                        : c.mediCalStatus === "pending"
                          ? "bg-gold/30 text-navy border-0 capitalize"
                          : "bg-destructive/15 text-destructive border-0 capitalize"
                    }
                  >
                    {c.mediCalStatus}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
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