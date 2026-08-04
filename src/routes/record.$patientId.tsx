// §Clinical record — full-page chart. Primary surface for deep clinical work.
// Path is /record/$patientId so it can never collide with the patient-facing
// self-service view at /patient.
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AssignClinicianButton } from "@/components/AssignClinicianButton";
import { ReferralStatusTimeline } from "@/components/ReferralStatusTimeline";
import { RecordSafetyBadges } from "@/components/clinical/RecordSafetyBadges";
import {
  GROUP_LABELS,
  useRecordSections,
  type RecordSection,
  type RecordSectionGroup,
} from "@/components/clinical/recordSections";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, PanelLeft } from "lucide-react";

interface ChartSearch {
  section?: string;
  /** Pre-selects a note template by key when landing on the Notes section. */
  template?: string;
}

export const Route = createFileRoute("/record/$patientId")({
  validateSearch: (s: Record<string, unknown>): ChartSearch => ({
    section: typeof s.section === "string" ? s.section : undefined,
    template: typeof s.template === "string" ? s.template : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Client chart — Adelante staff" },
      {
        name: "description",
        content:
          "Full-page clinical chart: problems, allergies, alerts, orders, care plan, and case coordination.",
      },
      { property: "og:title", content: "Client chart — Adelante staff" },
      {
        property: "og:description",
        content: "Staff-facing full clinical chart with role-gated sections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordChartPage,
});

const GROUP_ORDER: RecordSectionGroup[] = ["chart", "case", "coordination"];

function RecordChartPage() {
  const { patientId } = Route.useParams();
  const { section, template } = Route.useSearch();
  const navigate = useNavigate();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [navOpen, setNavOpen] = useState(false);

  if (!patient) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Client not found" description="This record is not available." />
      </div>
    );
  }
  return (
    <ChartBody
      patientId={patient.id}
      section={section}
      templateKey={template}
      navOpen={navOpen}
      setNavOpen={setNavOpen}
      onSelect={(id) =>
        navigate({ to: "/record/$patientId", params: { patientId }, search: { section: id } })
      }
    />
  );
}

function ChartBody({
  patientId,
  section,
  templateKey,
  navOpen,
  setNavOpen,
  onSelect,
}: {
  patientId: string;
  section?: string;
  templateKey?: string;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { role, staffName } = useActingStaff();
  const sections = useRecordSections(patient!, { initialNoteTemplateKey: templateKey });
  if (!patient) return null;
  const active = sections.find((s) => s.id === section) ?? sections[0];

  const nav = (
    <ChartNav
      sections={sections}
      activeId={active?.id}
      onSelect={(id) => {
        onSelect(id);
        setNavOpen(false);
      }}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link
                to="/case-manager"
                className="text-xs text-teal inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back to caseload
              </Link>
              <h1 className="truncate font-display text-2xl text-navy sm:text-3xl">
                {patient.firstName} {patient.lastName}
              </h1>
              <p className="font-mono text-xs text-muted-foreground">
                {patient.programId}
                {patient.cin ? ` · CIN ••••${patient.cin.slice(-4)}` : ""}
                {patient.dob ? ` · DOB ${patient.dob}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="text-xs text-muted-foreground">
                Acting as: <span className="text-navy">{staffName}</span> ·{" "}
                <span className="capitalize">{role.replace("_", " ")}</span>
              </span>
              <AssignClinicianButton patientId={patient.id} size="sm" variant="outline" />
              <Button size="sm" variant="outline" asChild>
                <Link
                  to="/print/patient-records/$patientId"
                  params={{ patientId: patient.id }}
                  search={{
                    meds: true,
                    mar: true,
                    notes: true,
                    notesScope: "current" as const,
                    autoprint: true,
                  }}
                >
                  Print record
                </Link>
              </Button>
            </div>
          </div>

          <ReferralStatusTimeline patient={patient} />
          <RecordSafetyBadges patient={patient} />

          {/* Off-canvas section nav below tablet width. */}
          <div className="lg:hidden">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline">
                  <PanelLeft className="h-4 w-4" /> Sections
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto">
                <SheetTitle className="text-base text-navy">Chart sections</SheetTitle>
                <div className="mt-4">{nav}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6">{nav}</div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            {active?.icon && <active.icon className="h-4 w-4 text-teal" />}
            <h2 className="font-display text-lg text-navy">{active?.label}</h2>
          </div>
          {/* Full width: wide sections (Orders' dose axes, off-catalog panel)
              lay out as multi-column forms instead of a squeezed stack. */}
          <Card className="chart-pane p-4">{active?.render()}</Card>
        </main>
      </div>
    </div>
  );
}

function ChartNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: RecordSection[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="space-y-4" aria-label="Chart sections">
      {GROUP_ORDER.map((group) => {
        const items = sections.filter((s) => s.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {GROUP_LABELS[group]}
            </p>
            <ul className="mt-1 space-y-0.5">
              {items.map((s) => {
                const Icon = s.icon;
                const isActive = s.id === activeId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        isActive ? "bg-teal/10 text-teal font-medium" : "text-navy hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{s.label}</span>
                      {s.count ? (
                        <Badge
                          variant={s.urgent ? "destructive" : "secondary"}
                          className="shrink-0 px-1.5 text-[10px]"
                        >
                          {s.count}
                        </Badge>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
