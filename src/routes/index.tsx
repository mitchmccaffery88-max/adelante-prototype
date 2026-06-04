import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileInput,
  ClipboardList,
  Calendar,
  LayoutDashboard,
  HeartHandshake,
  ShieldCheck,
  Smartphone,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adelante — Care that meets you where you are" },
      {
        name: "description",
        content:
          "Adelante delivers behavioral health and reentry support during the first 90 days after release. HIPAA + 42 CFR Part 2 compliant.",
      },
      { property: "og:title", content: "Adelante — Behavioral health for reentry" },
      {
        property: "og:description",
        content:
          "Teletherapy, screeners, and care coordination for justice-involved individuals.",
      },
    ],
  }),
  component: Home,
});

const roles = [
  {
    to: "/referral" as const,
    title: "Referral Partner",
    desc: "Probation, drug court, parole, correctional health — refer in under 2 minutes.",
    icon: FileInput,
    color: "bg-teal text-teal-foreground",
  },
  {
    to: "/intake" as const,
    title: "Patient Intake",
    desc: "Welcome, consent, and standardized screeners (PHQ-9, GAD-7, AUDIT, DAST-10, PCL-5).",
    icon: ClipboardList,
    color: "bg-gold text-gold-foreground",
  },
  {
    to: "/clinician" as const,
    title: "Clinician",
    desc: "Caseload, scheduler, video sessions, and Medi-Cal billing status.",
    icon: Calendar,
    color: "bg-navy text-navy-foreground",
  },
  {
    to: "/admin" as const,
    title: "Administrator",
    desc: "Enrollment, completion rate, intake velocity, billing summary.",
    icon: LayoutDashboard,
    color: "bg-secondary text-secondary-foreground",
  },
];

function Home() {
  const { t } = useI18n();
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 60% at 80% 0%, oklch(0.62 0.11 185 / 0.18), transparent 60%), radial-gradient(50% 50% at 0% 100%, oklch(0.82 0.12 85 / 0.22), transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-12 sm:pt-20 pb-12">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-navy mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                Kings County Pilot · M3 Launch
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-navy leading-[1.05]">
                {t("tagline")}
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-xl">
                {t("subtagline")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-navy text-navy-foreground hover:bg-navy/90">
                  <Link to="/referral">
                    Start a Referral <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/patient">I'm a patient</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-teal" />
                  HIPAA + 42 CFR Part 2
                </span>
                <span className="flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-teal" />
                  SMS fallback for loaner devices
                </span>
                <span className="flex items-center gap-1.5">
                  <HeartHandshake className="h-4 w-4 text-teal" />
                  Medi-Cal credentialed clinicians
                </span>
              </div>
            </div>

            <Card className="lg:col-span-5 p-6 border-2">
              <div className="text-sm font-medium text-muted-foreground">90-day episode</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl text-navy">90</span>
                <span className="text-muted-foreground">days of wraparound care</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <Stat label="Referral" value="< 2 min" />
                <Stat label="Welcome SMS" value="< 5 min" />
                <Stat label="First session" value="≈ 2.4 d" />
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Prototype data. Healthie is the system of record for scheduling,
                charting, and Medi-Cal claims; this app owns referral, intake,
                and the pilot dashboard.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">
        <h2 className="font-display text-2xl text-navy mb-5">Choose your view</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.to}
                to={r.to}
                className="group rounded-2xl border bg-card p-5 hover:border-teal hover:shadow-md transition-all"
              >
                <div className={`h-10 w-10 rounded-xl grid place-items-center ${r.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-display text-lg text-navy">{r.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{r.desc}</div>
                <div className="mt-4 text-sm text-teal font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 py-3">
      <div className="font-display text-lg text-navy">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
