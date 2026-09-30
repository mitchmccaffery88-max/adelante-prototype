// §Clinical record — full-page chart. Primary surface for deep clinical work.
// Path is /record/$patientId so it can never collide with the patient-facing
// self-service view at /patient.
import { useState } from "react";
import { ChartHeader } from "@/components/chart/ChartHeader";
import { BriefTab } from "@/components/chart/BriefTab";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AssignClinicianButton } from "@/components/AssignClinicianButton";
import { IssueSignInCodeButton } from "@/components/clinical/IssueSignInCodeButton";
import { SupervisionBanner } from "@/components/clinical/SupervisionBanner";
import { resolveSectionId, useRecordSections, type RecordSection } from "@/components/clinical/recordSections";
import { ChartTabBar, ChartTabPanel, tabsWithSections } from "@/components/chart/ChartTabView";
import { resolveChartLocation, tabBadges } from "@/lib/chartTabs";
import { canAccess } from "@/lib/roles";
import { canOrderLabs } from "@/lib/chartOrders";
import { canOpenCaseloadReview } from "@/lib/caseloadRoles";
import { listContacts, canSeeContactNote, CONTACT_TYPE_LABEL } from "@/lib/caseloadReview";
import { LabsAndMeasuresTracking } from "@/components/chart/LabsAndMeasures";
import { ChartConsents, ChartAuditTrail, ChartWeeklyReview, canSeeChartConsents, canSeeChartAudit, canSeeWeeklyReview } from "@/components/chart/ChartExtraSections";
import { EmptyState } from "@/components/EmptyState";
import { ChartActionLauncher } from "@/components/chart/ChartActionLauncher";
import { ArrowLeft, CalendarCheck, FileSignature, FlaskConical, History, MoreHorizontal, PhoneCall, Zap } from "lucide-react";

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
  // §Batch E — a merged-away record is read-only and points to the survivor.
  if (patient.mergedInto) {
    const survivorId = AdelanteEHR.resolvePatientId(patient.id);
    const s = AdelanteEHR.getPatient(survivorId);
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="space-y-3 p-6" data-testid="merged-record-banner">
          <p className="font-display text-lg text-navy">
            Merged into {s ? `${s.firstName} ${s.lastName}` : "another record"}
          </p>
          <p className="text-sm text-muted-foreground">
            This record is read-only. Everything on it now lives on the surviving record
            {patient.mergedAt ? ` (merged ${new Date(patient.mergedAt).toLocaleDateString()})` : ""}.
          </p>
          <Button asChild>
            <Link to="/record/$patientId" params={{ patientId: survivorId }} search={{}}>Open surviving record</Link>
          </Button>
        </Card>
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
  onSelect,
}: {
  patientId: string;
  section?: string;
  templateKey?: string;
  navOpen?: boolean;
  setNavOpen?: (v: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { role, staffId, staffName } = useActingStaff();
  const sections = useRecordSections(patient!, { initialNoteTemplateKey: templateKey });
  const badgesJson = useEhr(() => {
    const p = AdelanteEHR.getPatient(patientId);
    return p ? JSON.stringify(tabBadges(p, role)) : "{}";
  });
  if (!patient) return null;
  // §Chart redesign turn 4 — sections arranged into 8 tabs. Extra
  // sub-sections (labs, contact log) reuse existing components and gates.
  const extra: RecordSection[] = [];
  if (canAccess(role, "meds_erx", patient).level !== "none" || canOrderLabs(role))
    extra.push({ id: "labs", label: "Lab orders & results", icon: FlaskConical, group: "chart", render: () => <LabsAndMeasuresTracking patientId={patient.id} role={role} /> });
  if (canOpenCaseloadReview(role))
    extra.push({ id: "contacts", label: "Contact log", icon: PhoneCall, group: "case", render: () => <PatientContactLog patientId={patient.id} /> });
  if (canSeeWeeklyReview(role))
    extra.push({ id: "weekly-review", label: "Weekly review", icon: CalendarCheck, group: "case", render: () => <ChartWeeklyReview patientId={patient.id} /> });
  if (canSeeChartConsents(role, patient))
    extra.push({ id: "consents", label: "Consents & Part 2 disclosures", icon: FileSignature, group: "case", render: () => <ChartConsents patient={patient} /> });
  if (ACCESS_LOG_ROLES.includes(role))
    extra.push({ id: "access-log", label: "Who accessed this record", icon: History, group: "case", render: () => <WhoAccessed patientId={patient.id} /> });
  if (canSeeChartAudit(role))
    extra.push({ id: "audit-trail", label: "Audit trail", icon: History, group: "case", render: () => <ChartAuditTrail patientId={patient.id} /> });
  const allSections: RecordSection[] = [
    {
      id: "brief",
      label: "Brief",
      icon: Zap,
      group: "chart",
      render: () => (
        <BriefTab patientId={patient.id} visibleSections={["brief", ...sections.map((x) => x.id), ...extra.map((x) => x.id)]} onSelectSection={onSelect} />
      ),
    },
    ...sections,
    ...extra,
  ];
  const tabs = tabsWithSections(allSections, role);
  const loc = resolveChartLocation(resolveSectionId(section));
  const activeTab = tabs.find((t) => t.id === loc.tab) ?? tabs[0]!;
  const badges = JSON.parse(badgesJson) as ReturnType<typeof tabBadges>;
  // §Batch C2 — record.viewed on chart open and on every tab / section switch.
  const viewedSection = loc.sub ?? activeTab.id;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    recordView({ actorId: staffId, actorName: staffName, role, patientId: patient.id, sectionId: "chart", kind: "open" });
  }, [patient.id, staffId, role, staffName]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    recordView({ actorId: staffId, actorName: staffName, role, patientId: patient.id, sectionId: viewedSection, kind: "section" });
  }, [patient.id, staffId, role, staffName, viewedSection]);
  const searchable = allSections
    .filter((x) => tabs.some((t) => t.subs.includes(x)))
    .map((x) => {
      const t = tabs.find((tt) => tt.subs.includes(x))!;
      return t.id === "brief" || t.subs.length === 1 ? { ...x, label: t.label } : { ...x, label: `${t.label} › ${x.label}` };
    });

  return (
    <div className="min-h-screen bg-background">
      <ChartHeader
        patientId={patient.id}
        visibleSections={allSections.map((x) => x.id)}
        onSelectSection={onSelect}
        more={<ChartMoreMenu patientId={patient.id} />}
        tabBar={<ChartTabBar tabs={tabs} active={activeTab.id} badges={badges} onSelect={(id) => onSelect(id)} />}
      />

      <main className="mx-auto min-w-0 max-w-[1600px] px-4 py-5 pb-24">
        {/* §Quality pass Group A — live supervision status for supervised roles. */}
        <SupervisionBanner />
        <ChartTabPanel key={activeTab.id} tab={activeTab} patientId={patient.id} focus={loc.sub} />
      </main>
      <ChartActionLauncher patientId={patient.id} sections={searchable} onSelectSection={onSelect} />
    </div>
  );
}

function PatientContactLog({ patientId }: { patientId: string }) {
  const { role, staffId } = useActingStaff();
  const rows = useEhr(() => listContacts(patientId));
  return (
    <div className="space-y-2 text-sm">
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No contacts logged for this patient.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className="w-24 shrink-0 text-muted-foreground">{c.date}</span>
              <span className="font-medium">{CONTACT_TYPE_LABEL[c.type]}</span>
              {c.note && canSeeContactNote(c, { id: staffId, role }) && <span className="text-muted-foreground">— {c.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <Link to="/caseload-review" className="text-xs text-teal hover:underline">Open weekly caseload review</Link>
    </div>
  );
}

/**
 * §Chart redesign — "More" menu. Print record, Issue sign-in code and Assign
 * clinician keep their own permission checks (each component gates itself).
 * An inline toggle rather than a popover so their dialogs stay mounted.
 */
function ChartMoreMenu({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-controls="chart-more-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" /> More
      </Button>
      {open && (
        <div
          id="chart-more-menu"
          role="group"
          aria-label="More chart actions"
          className="flex flex-wrap justify-end gap-2 rounded-md border border-border bg-card p-2 shadow-sm"
        >
          <AssignClinicianButton patientId={patientId} size="sm" variant="outline" />
          <IssueSignInCodeButton patientId={patientId} />
          <Button size="sm" variant="outline" asChild>
            <Link
              to="/print/patient-records/$patientId"
              params={{ patientId }}
              search={{ meds: true, mar: true, notes: true, notesScope: "current" as const, autoprint: true }}
            >
              Print record
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild className="text-xs">
            <Link to="/agentic" search={{ patientId }}>
              <FlaskConical className="h-3.5 w-3.5" /> Agentic guide (demo)
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
