import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useEMR } from "@/lib/emr";

export const Route = createFileRoute("/population")({
  head: () => ({ meta: [{ title: "Population health — Adelante wireframe" }] }),
  component: PopHealth,
});

function PopHealth() {
  const people = useEMR((s) => s.people);
  const enrolled = people.length;
  const inTreatment = people.filter((p) => p.episodes.some((e) => e.status === "in_treatment")).length;
  const completionPct = Math.round((inTreatment / Math.max(1, enrolled)) * 100);
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Population health</h1>
      <p className="text-sm text-muted-foreground">Read-only analytics over the demo cohort. Trending requires structured, item-level score capture — see intake.</p>

      <div className="grid md:grid-cols-4 gap-3">
        <Stat label="Enrolled" value={enrolled} />
        <Stat label="Session completion" value={`${completionPct}%`} threshold={completionPct >= 70} />
        <Stat label="Avg PHQ-9 change (demo)" value="−4.2" />
        <Stat label="No-show rate" value="14%" />
      </div>

      <Card className="p-4">
        <b>Completion vs 70% threshold</b>
        <div className="mt-3 h-6 relative bg-secondary rounded overflow-hidden">
          <div className="h-full bg-teal" style={{ width: `${completionPct}%` }} />
          <div className="absolute top-0 bottom-0 border-l-2 border-warning" style={{ left: "70%" }} title="70% threshold" />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Demo values. Real analytics require Build 2 data pipeline.</p>
      </Card>

      <Card className="p-4">
        <b>No-show reasons (demo)</b>
        <ul className="text-sm mt-2 space-y-1">
          <li>Transportation — 32%</li>
          <li>Re-arrest — 18%</li>
          <li>Communication loss — 22%</li>
          <li>Hospitalization — 8%</li>
          <li>Other — 20%</li>
        </ul>
      </Card>

      <Card className="p-4">
        <b>Equity breakdown (stub)</b>
        <p className="text-xs text-muted-foreground mt-1">Race / ethnicity / language slices, once cohort size supports.</p>
      </Card>
    </div>
  );
}

function Stat({ label, value, threshold }: { label: string; value: number | string; threshold?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`text-3xl font-semibold ${threshold ? "text-success" : ""}`}>{value}</div>
    </Card>
  );
}
