import { createFileRoute } from "@tanstack/react-router";
import { useEMR } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";

export const Route = createFileRoute("/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Adelante wireframe" }] }),
  component: SchedulePage,
});

function SchedulePage() {
  const people = useEMR((s) => s.people);
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Schedule</h1>

      <div className="grid md:grid-cols-3 gap-3">
        <SLACard title="Urgent SUD appt" clock="48h" note="No prior auth · 96h with prior auth" />
        <SLACard title="Non-urgent outpatient" clock="10 biz days" note="First-offered appointment" />
        <SLACard title="Progress note due" clock="3 biz days" note="Crisis note within 1 calendar day" />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-teal" /><b>Today (demo)</b></div>
        <ul className="text-sm divide-y mt-2">
          {people.slice(0, 4).map((p, i) => (
            <li key={p.id} className="py-2 flex items-center justify-between">
              <span>{p.firstName} {p.lastName}</span>
              <span className="text-xs text-muted-foreground">{9 + i}:00 · Telehealth</span>
              <Button size="sm" variant="outline">Join (stub)</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SLACard({ title, clock, note }: { title: string; clock: string; note: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-teal"><Clock className="h-4 w-4" /><b className="text-sm">{title}</b></div>
      <div className="text-2xl font-semibold mt-1">{clock}</div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}
