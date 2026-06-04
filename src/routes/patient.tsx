import { createFileRoute, Link } from "@tanstack/react-router";
import { HealthieService, useHealthie } from "@/lib/healthie";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Video, Smartphone, Calendar as CalIcon, HeartPulse, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/patient")({
  head: () => ({
    meta: [
      { title: "My care — Adelante" },
      { name: "description", content: "Your care plan, appointments, and intake." },
    ],
  }),
  component: PatientPage,
});

function PatientPage() {
  // For the demo, use the first patient as the "logged in" user.
  const patient = useHealthie(() => HealthieService.getPatient("p1"));
  const appts = useHealthie(() => HealthieService.appointmentsForPatient("p1"));

  if (!patient) return null;

  const upcoming = appts.filter((a) => a.status === "scheduled");
  const next = upcoming[0];
  const remaining = Math.max(0, 90 - patient.episodeDay);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      {/* Welcome */}
      <Card className="p-6 border-2 bg-gradient-to-br from-card to-secondary/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-teal">Welcome back</div>
            <h1 className="font-display text-3xl text-navy mt-1">
              Hi, {patient.firstName}.
            </h1>
            <p className="text-muted-foreground mt-1 max-w-md">
              You're on day {patient.episodeDay} of your 90-day care plan. {remaining} days remain — we're walking with you.
            </p>
          </div>
          {patient.smsFallback && (
            <Badge className="bg-gold/30 text-navy border-0 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> SMS fallback active
            </Badge>
          )}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Day {patient.episodeDay}</span>
            <span>Day 90</span>
          </div>
          <Progress value={(patient.episodeDay / 90) * 100} className="h-2" />
        </div>
      </Card>

      {/* Next appointment */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <CalIcon className="h-4 w-4" /> Next session
          </div>
          {next ? (
            <>
              <div className="mt-2 font-display text-xl text-navy">
                {new Date(next.start).toLocaleString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-sm text-muted-foreground">
                {HealthieService.getClinician(next.clinicianId)?.name} · {next.durationMin} min · video
              </div>
              <Button
                className="mt-4 w-full bg-teal text-teal-foreground hover:bg-teal/90"
                onClick={() =>
                  toast.success("Joining video session", { description: "Healthie telehealth (mock)" })
                }
              >
                <Video className="h-4 w-4 mr-2" /> Join session
              </Button>
            </>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">No upcoming sessions yet.</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <HeartPulse className="h-4 w-4" /> Care plan
          </div>
          <p className="mt-2 text-foreground">{patient.carePlanSummary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(patient.needs)
              .filter(([, v]) => v)
              .map(([k]) => (
                <Badge key={k} variant="outline" className="capitalize">
                  <MapPin className="h-3 w-3 mr-1" />
                  {k}
                </Badge>
              ))}
          </div>
        </Card>
      </div>

      {/* Intake CTA */}
      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-navy">Finish your intake</div>
          <div className="text-sm text-muted-foreground">
            A few short questions help your care team plan your next session.
          </div>
        </div>
        <Button asChild className="bg-navy text-navy-foreground hover:bg-navy/90">
          <Link to="/intake">Continue intake</Link>
        </Button>
      </Card>

      {/* All appointments */}
      <div>
        <h2 className="font-display text-lg text-navy mb-3">All sessions</h2>
        <div className="space-y-2">
          {appts.map((a) => (
            <Card key={a.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <div className="text-navy font-medium">
                  {new Date(a.start).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {HealthieService.getClinician(a.clinicianId)?.name}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {a.status.replace("_", " ")}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}