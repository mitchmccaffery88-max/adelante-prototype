import { createFileRoute, Link } from "@tanstack/react-router";
import { useEMR, EPISODE_LABEL } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/referrals")({
  head: () => ({ meta: [{ title: "Referrals & intake — Adelante wireframe" }] }),
  component: ReferralsQueue,
});

function ReferralsQueue() {
  const pending = useEMR((s) => s.people.filter((p) => p.episodes.some((e) => e.status === "pending_eligibility")));
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Referrals & intake queue</h1>
          <p className="text-sm text-muted-foreground">External referrals land here as pending-eligibility JI pre-release episodes.</p>
        </div>
        <Link to="/referral-portal"><Button variant="outline">Open external portal ↗</Button></Link>
      </header>

      <Card className="p-4">
        <div className="text-sm">
          <b>Welcome SMS behavior:</b> when a referral arrives, the welcome SMS is queued but not sent until communication consent is confirmed
          <span className="text-muted-foreground"> (Part 2 / consent-before-messaging requirement)</span>.
        </div>
      </Card>

      <div className="space-y-2">
        {pending.map((p) => (
          <Card key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link to="/patients/$id" params={{ id: p.id }} className="font-medium text-teal hover:underline">{p.firstName} {p.lastName}</Link>
              <div className="text-xs text-muted-foreground">DOB {p.dob} · CIN {p.cin ? `••••${p.cin.slice(-4)}` : "—"} · {p.episodes.map((e) => EPISODE_LABEL[e.type]).join(", ")}</div>
              {p.releaseDate && <div className="text-xs mt-1">Release: {p.releaseDate.expected} ({p.releaseDate.confidence})</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-warning">Pending eligibility</Badge>
              <Link to="/patients/$id" params={{ id: p.id }}><Button size="sm">Start intake</Button></Link>
            </div>
          </Card>
        ))}
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Queue is empty. Submit a referral from the external portal.</p>}
      </div>
    </div>
  );
}
