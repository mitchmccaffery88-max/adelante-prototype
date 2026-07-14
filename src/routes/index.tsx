import { createFileRoute, Link } from "@tanstack/react-router";
import { EMR, useEMR, tMinusDays, EPISODE_LABEL, LANE_LABEL } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Calendar, HandHeart, AlertTriangle, FileCheck, Receipt,
  Activity, ShieldAlert, Info, Heart,
} from "lucide-react";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Adelante wireframe" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const role = useEMR((s) => s.role);
  const people = useEMR((s) => s.people);
  const currentId = useEMR((s) => s.currentPersonId);
  const person = people.find((p) => p.id === currentId);

  if (role === "patient") return <PatientDashboard />;
  if (role === "referral_submitter") return <ReferralSubmitterHome />;
  if (role === "sys_admin") return <AdminDashboardHome />;
  if (role === "billing") return <BillingDashboard />;

  // Clinical + subclinical
  const overdue = people.filter((p) => p.lastContactAt && daysSince(p.lastContactAt) > 7);
  const highRisk = people.filter((p) => p.riskTier === "high");
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Role-filtered view. Person, episodes and consent status drive everything downstream.</p>
      </header>

      <div className="grid md:grid-cols-4 gap-4">
        <Stat label="Active people" value={people.length} icon={Users} />
        <Stat label="High-risk" value={highRisk.length} icon={AlertTriangle} tone="destructive" />
        <Stat label="Overdue contact >7d" value={overdue.length} icon={Activity} tone="warning" />
        <Stat label="Docs to verify" value={2} icon={FileCheck} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent people</h2>
            <Link to="/patients" className="text-xs text-teal hover:underline">Open patients →</Link>
          </div>
          <div className="space-y-1">
            {people.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                to="/patients/$id"
                params={{ id: p.id }}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary text-sm"
              >
                <span className="h-8 w-8 rounded-full bg-teal/10 text-teal grid place-items-center text-xs font-medium">
                  {p.firstName[0]}{p.lastName[0]}
                </span>
                <span className="flex-1 truncate">
                  <span className="font-medium">{p.firstName} {p.lastName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.episodes.map((e) => EPISODE_LABEL[e.type]).join(" · ")}
                  </span>
                </span>
                {p.releaseDate && <Badge variant="outline" className="text-[10px]">{tMinusDays(p.releaseDate.expected)}</Badge>}
                <RiskBadge tier={p.riskTier} />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Wireframe orientation</h2>
          <p className="text-xs text-muted-foreground">
            Use the <b>View as</b> menu in the top bar to change role. The left nav and
            chart sections react to permissions in real time.
          </p>
          <ul className="text-xs space-y-1 list-disc pl-5 text-foreground/80">
            <li>Person → Episodes → Events (each event carries a funding lane)</li>
            <li>Consent ledger drives Part-2 lock/unlock live</li>
            <li>Release date is an object with confidence + change history</li>
            <li>Billing captures ISL non-Medi-Cal reportable encounters</li>
          </ul>
          {person && (
            <Link to="/patients/$id" params={{ id: person.id }}>
              <Button size="sm" className="w-full">Open sample chart · {person.firstName} {person.lastName}</Button>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}

function PatientDashboard() {
  const person = useEMR((s) => s.people.find((p) => p.id === s.currentPersonId))!;
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Welcome, {person.firstName}</h1>
        <p className="text-sm text-muted-foreground">Your care dashboard. Deliberately thin for MVP — a richer patient PWA is post-MVP.</p>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-teal" /><h2 className="font-semibold">Next appointment</h2></div>
        {person.nextAppointmentAt ? (
          <div className="mt-2 text-sm">
            <ClientDate value={person.nextAppointmentAt} />
            <Button size="sm" className="mt-3">Join video (stub)</Button>
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled.</p>}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-teal" /><h2 className="font-semibold">Self-help modules</h2></div>
        {person.selfHelp.length === 0 && <p className="text-sm text-muted-foreground mt-2">Your care team hasn't assigned any yet.</p>}
        {person.selfHelp.map((m) => (
          <label key={m.id} className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked={m.completedDates.length > 0} /> {m.module} · {m.cadence}
          </label>
        ))}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold">Care plan summary (plain language)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your team is working with you on: {person.problems.join(", ") || "your care goals."}
        </p>
      </Card>

      <Card className="p-4 border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /><h2 className="font-semibold">In crisis?</h2></div>
        <p className="text-sm mt-1">Call or text <a className="underline font-semibold" href="tel:988">988</a> anytime.</p>
      </Card>
    </div>
  );
}

function ReferralSubmitterHome() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">External referral portal</h1>
      <p className="text-sm text-muted-foreground">Use this portal to refer a person to Adelante. Minimal fields, plain language.</p>
      <Link to="/referral-portal"><Button>Open referral form</Button></Link>
      <p className="text-xs text-muted-foreground">You will not receive clinical results without documented consent.</p>
    </div>
  );
}

function AdminDashboardHome() {
  const audit = useEMR((s) => s.audit);
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <Card className="p-4">
        <p className="text-sm">
          <b>Segregation of duties:</b> admin provisions access but cannot read charts.
          DevOps and privacy officer are separate designations. Chart access requires break-glass and is logged.
        </p>
      </Card>
      <div className="grid md:grid-cols-3 gap-3">
        <Link to="/admin"><Card className="p-4 hover:bg-secondary cursor-pointer"><b>Users & roles</b><p className="text-xs text-muted-foreground mt-1">Provision access</p></Card></Link>
        <Link to="/billing"><Card className="p-4 hover:bg-secondary cursor-pointer"><b>Code & rate tables</b><p className="text-xs text-muted-foreground mt-1">Versioned; date-of-service adjudication</p></Card></Link>
        <Link to="/admin"><Card className="p-4 hover:bg-secondary cursor-pointer"><b>Audit log</b><p className="text-xs text-muted-foreground mt-1">Break-glass entry required</p></Card></Link>
      </div>
      <Card className="p-4">
        <h2 className="font-semibold text-sm">Recent audit entries</h2>
        <ul className="mt-2 text-xs space-y-1">
          {audit.slice(0, 6).map((a) => (
            <li key={a.id}><ClientDate value={a.at} /> · <b>{a.actor}</b> ({a.actorRole}) — {a.action}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function BillingDashboard() {
  const claims = useEMR((s) => s.claims);
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Billing overview</h1>
      <Card className="p-4">
        <p className="text-sm">
          <Info className="h-3.5 w-3.5 inline mr-1 text-info" />
          Principle: capture every medically necessary, delivered, documented service accurately — never maximize codes.
          The clinical event is created first, then classified for billing.
        </p>
      </Card>
      <div className="grid md:grid-cols-4 gap-3">
        <Stat label="Claims total" value={claims.length} icon={Receipt} />
        <Stat label="Ready" value={claims.filter((c) => c.status === "ready").length} icon={Receipt} tone="success" />
        <Stat label="ISL encounters" value={claims.filter((c) => c.lane === "isl").length} icon={Receipt} tone="info" />
        <Stat label="Denied" value={claims.filter((c) => c.status === "denied").length} icon={Receipt} tone="destructive" />
      </div>
      <Card className="p-4">
        <div className="flex justify-between mb-2"><b>Recent by lane</b><Link to="/billing" className="text-xs text-teal hover:underline">Open billing →</Link></div>
        <ul className="text-sm">
          {claims.map((c) => (
            <li key={c.id} className="flex justify-between border-b py-1.5 last:border-0">
              <span>{LANE_LABEL[c.lane]} · {c.code}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{c.status.replace(/_/g, " ")}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: "destructive" | "warning" | "success" | "info" }) {
  const toneClass = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "info" ? "text-info" : "text-teal";
  return (
    <Card className="p-4">
      <div className={`flex items-center gap-2 ${toneClass}`}><Icon className="h-4 w-4" /><span className="text-xs uppercase tracking-wider">{label}</span></div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function RiskBadge({ tier }: { tier: "low" | "moderate" | "high" }) {
  const cls = tier === "high" ? "bg-destructive/15 text-destructive" : tier === "moderate" ? "bg-warning/25 text-warning" : "bg-success/15 text-success";
  return <span className={`text-[10px] rounded-full px-2 py-0.5 ${cls} capitalize`}>{tier}</span>;
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
