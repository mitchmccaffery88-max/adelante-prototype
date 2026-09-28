// §Chart redesign turn 4 — tab bar + collapsible sub-section cards. Sections
// come from useRecordSections (unchanged gates: hidden, never locked); this
// only arranges them. A collapsed card shows a one-line summary.
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { useActingStaff, type StaffRole } from "@/lib/roles";
import { CHART_TABS, IN_FACILITY_SECTIONS, orderSectionsForRole, type ChartTabId } from "@/lib/chartTabs";
import { inFacilityEnabled } from "@/lib/inFacility";
import { filterSudMedsForRole } from "@/lib/asamReporting";
import { staffPlanView, planNeeds } from "@/lib/structuredCarePlan";
import { measureSeries } from "@/lib/chartBrief";
import { listLabOrders } from "@/lib/chartOrders";
import { listContacts } from "@/lib/caseloadReview";
import { visibleChartDocuments } from "@/components/chart/ChartDocumentsList";
import { hieChartView, listHieMeds } from "@/lib/hie";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { getSafetyPlan } from "@/lib/safetyPlan";
import { episodeHeaderLabel, visibleHlocReferrals } from "@/lib/outpatientCare";
import { reentryDay } from "@/lib/chartBrief";
import type { RecordSection } from "@/components/clinical/recordSections";
import { Card } from "@/components/ui/card";

export function tabsWithSections(sections: RecordSection[], role?: StaffRole) {
  return CHART_TABS.map((t) => ({ ...t, subs: (role ? (x: RecordSection[]) => orderSectionsForRole(t.id, x, role) : (x: RecordSection[]) => x)(t.sections.filter((id) => inFacilityEnabled() || !IN_FACILITY_SECTIONS.includes(id)).map((id) => sections.find((s) => s.id === id)).filter(Boolean) as RecordSection[]) })).filter(
    (t) => t.subs.length > 0,
  );
}

export function ChartTabBar({
  tabs, active, badges, onSelect,
}: {
  tabs: ReturnType<typeof tabsWithSections>;
  active: ChartTabId;
  badges: Partial<Record<ChartTabId, string>>;
  onSelect: (id: ChartTabId) => void;
}) {
  return (
    <nav aria-label="Chart tabs" className="-mb-px flex gap-1 overflow-x-auto" data-testid="chart-tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          data-testid={`chart-tab-${t.id}`}
          onClick={() => onSelect(t.id)}
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
            active === t.id ? "border-teal font-medium text-teal" : "border-transparent text-navy hover:bg-muted"
          }`}
        >
          {t.label}
          {badges[t.id] && (
            <span className="rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">{badges[t.id]}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const dateShort = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString();

export function subSummary(s: RecordSection, p: Patient, role: StaffRole): string {
  switch (s.id) {
    case "orders": {
      const meds = filterSudMedsForRole((p.orders ?? []).filter((o) => o.status === "signed"), role, p).visible.length;
      const refills = AdelanteEHR.listRefillRequests({ patientId: p.id, status: "pending" }).length;
      return `${meds} active med${meds === 1 ? "" : "s"}${refills ? ` · ${refills} refill pending` : ""}`;
    }
    case "labs": {
      const labs = listLabOrders(p.id, role);
      const pending = labs.filter((l) => l.status === "pending").length;
      return `${labs.length} lab order${labs.length === 1 ? "" : "s"}${pending ? ` · ${pending} result pending` : ""}`;
    }
    case "notes": {
      const notes = (p.progressNotes ?? []).filter((n) => !n.voidedAt);
      const unsigned = notes.filter((n) => n.status === "draft" || n.status === "cosign_pending").length;
      return `${notes.length} note${notes.length === 1 ? "" : "s"}${unsigned ? ` · ${unsigned} unsigned` : ""}`;
    }
    case "tracking": {
      const phq = measureSeries(p, role, "phq-9").at(-1);
      const gad = measureSeries(p, role, "gad-7").at(-1);
      return [phq && `PHQ-9 ${phq.score} (${dateShort(phq.date)})`, gad && `GAD-7 ${gad.score}`].filter(Boolean).join(" · ") || "No scores yet";
    }
    case "care-plan": {
      const g = staffPlanView(p.id, role).goals.filter((x) => x.status === "active").length;
      return `${g} active goal${g === 1 ? "" : "s"}`;
    }
    case "sdoh": {
      const n = planNeeds(p.id).filter((x) => x.step !== "Completed").length;
      return `${n} open need${n === 1 ? "" : "s"}`;
    }
    case "appointments": {
      const next = AdelanteEHR.listAppointments().find((a) => a.patientId === p.id && a.status === "scheduled" && +new Date(a.start) >= Date.now());
      return next ? `Next visit ${new Date(next.start).toLocaleDateString()}` : "No upcoming visit";
    }
    case "allergies": {
      const a = AdelanteEHR.listAllergies(p.id);
      return a.length ? a.map((x) => x.substance).join(", ") : "None recorded";
    }
    case "contacts": {
      const c = listContacts(p.id);
      return c.length ? `${c.length} contact${c.length === 1 ? "" : "s"} · last ${dateShort(c[0]!.date)}` : "No contacts logged";
    }
    case "documents": {
      const { visible } = visibleChartDocuments(p.id, role);
      const pending = visible.filter((d) => d.verification === "unverified").length;
      return visible.length ? `${plural(visible.length, "document")}${pending ? ` · ${pending} pending review` : ""}` : "No documents uploaded";
    }
    case "outside-records": {
      const e = hieChartView(p.id, role).encounters;
      return e.length ? `${plural(e.length, "outside event")} · last ${dateShort(e.map((x) => x.at).sort().at(-1)!)}` : "No outside records";
    }
    case "problems": {
      const sees = roleSeesAsamSection(role, p);
      const act = (p.problems ?? []).filter((x) => x.status === "active" && (sees || x.category !== "sud"));
      return act.length ? `${plural(act.length, "active problem")} · ${act[0]!.description}` : "No active problems";
    }
    case "alerts": {
      const a = (p.alerts ?? []).filter((x) => !x.removedAt && x.active !== false).length;
      return a ? plural(a, "active alert") : "No active alerts";
    }
    case "safety-plan": {
      const sp = getSafetyPlan(p.id);
      return sp ? (sp.lastReviewedAt ? `Last reviewed ${dateShort(sp.lastReviewedAt)}` : "Started — not yet reviewed") : "No safety plan yet";
    }
    case "episodes": {
      const ep = episodeHeaderLabel(p.id, role);
      const refs = visibleHlocReferrals(role, p.id).filter((r) => !["closed", "declined", "admitted"].includes(r.status)).length;
      return `${ep ?? "No open episode"}${refs ? ` · ${plural(refs, "open referral")}` : ""}`;
    }
    case "reentry-handoff": {
      const rd = reentryDay(p);
      return rd ? `Reentry day ${rd}` : "Outside the 90-day reentry window";
    }
    case "med-recon": {
      const n = listHieMeds(p.id).filter((m) => m.status === "review").length;
      return n ? `${plural(n, "outside medication")} to review (HIE)` : "Nothing to reconcile";
    }
    case "asam": {
      const a = (p.asamAssessments ?? []).slice().sort((x, y) => (y.authoredAt ?? "").localeCompare(x.authoredAt ?? ""))[0];
      return a ? `${a.actualLevel ? `Level ${a.actualLevel}` : "Level not set"} · ${a.status.replace(/_/g, " ")}` : "No ASAM on file";
    }
    case "caloms":
      return p.calomsProfile ? "Profile on file" : "No profile yet";
    case "overview":
      return [p.dob && `DOB ${p.dob}`, p.preferredLanguage === "es" ? "Spanish" : "English"].filter(Boolean).join(" · ");
    case "contact":
      return p.phone ? `Phone on file${(p.emergencyContacts ?? []).length ? ` · ${plural(p.emergencyContacts!.length, "emergency contact")}` : ""}` : "No phone on file";
    case "checkins": {
      const c = (p.checkIns ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
      return c.length ? `${plural(c.length, "check-in")} · last ${dateShort(c[0]!.date)}` : "No check-ins yet";
    }
    case "eligibility": {
      const c = p.coverage;
      return c ? `${String(c.status).replace(/_/g, " ")} · ${c.verified === "verified" ? "verified" : c.verified.replace(/_/g, " ")}` : "No coverage on file";
    }
    case "advocates": {
      const n = AdelanteEHR.listAdvocateLinks(p.id).length;
      return n ? plural(n, "advocate") : "No advocates linked";
    }
    case "tasks": {
      const sees = roleSeesAsamSection(role, p);
      const open = AdelanteEHR.listCaseTasks().filter((t) => t.patientId === p.id && !t.completedAt && t.status !== "done" && (sees || t.origin !== "asam_needed")).length;
      return open ? plural(open, "open task") : "No open tasks";
    }
    case "peer": {
      const n = (p.peerNotes ?? []).length;
      return n ? plural(n, "peer note") : "No peer notes yet";
    }
    case "chw": {
      const n = (p.progressNotes ?? []).filter((x) => x.templateKey === "chw_service" && !x.voidedAt).length;
      return n ? plural(n, "CHW note") : "No CHW notes yet";
    }
    case "coord": {
      const n = (p.externalContacts ?? []).length;
      return n ? plural(n, "outside contact") : "No outside providers listed";
    }
    case "messages": {
      const m = p.careMessages ?? [];
      const unread = m.filter((x) => x.authorType === "patient" && !x.readByStaffAt).length;
      return m.length ? `${plural(m.length, "message")}${unread ? ` · ${unread} unread` : ""}` : "No messages yet";
    }
    case "consents": {
      const n = AdelanteEHR.listConsentRecords(p.id).length;
      return n ? plural(n, "consent record") : "No consent records";
    }
    case "audit-trail": {
      const n = AdelanteEHR.listAuditEvents({ patientId: p.id }).length;
      return n ? plural(n, "audit entry").replace("entrys", "entries") : "No audit entries";
    }
    case "weekly-review": {
      const c = listContacts(p.id).filter((x) => x.type !== "attempt");
      return c.length ? `Last contact ${dateShort(c[0]!.date)}` : "No contact logged yet";
    }
    case "mar":
    case "protocols":
    case "bookings":
    case "housing-moves":
      return "In-facility record";
    default:
      return s.count ? plural(s.count, "item") : "Nothing recorded yet";
  }
}

export function ChartTabPanel({ tab, patientId, focus }: { tab: ReturnType<typeof tabsWithSections>[number]; patientId: string; focus?: string }) {
  const { role } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId))!;
  const initial = focus && tab.subs.some((s) => s.id === focus) ? focus : tab.subs[0]?.id;
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial ? [initial] : []));
  useEffect(() => {
    if (!initial) return;
    setOpen((o) => new Set([...o, initial]));
    if (focus) requestAnimationFrame(() => document.getElementById(`sub-${focus}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, [initial, focus]);
  const single = tab.subs.length === 1;
  return (
    <div className="space-y-3" data-testid={`chart-panel-${tab.id}`}>
      {!single && (
        <nav aria-label={`${tab.label} sections`} data-testid="chart-subnav" className="sticky top-[var(--chart-sticky-offset,9rem)] z-10 -mx-1 flex gap-1 overflow-x-auto bg-background/95 px-1 py-1.5 backdrop-blur">
          {tab.subs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setOpen((o) => new Set([...o, s.id])); requestAnimationFrame(() => document.getElementById(`sub-${s.id}`)?.scrollIntoView({ block: "start", behavior: "smooth" })); }}
              className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-navy hover:bg-secondary"
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}
      {tab.subs.map((s) => {
        const isOpen = single || open.has(s.id);
        const Icon = s.icon;
        return (
          <Card key={s.id} id={`sub-${s.id}`} data-testid={`sub-${s.id}`} data-open={isOpen ? "true" : "false"} className="scroll-mt-56">
            {!single && (
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                <Icon className="h-4 w-4 shrink-0 text-teal" />
                <span className="font-medium text-navy">{s.label}</span>
                {!isOpen && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{subSummary(s, patient, role)}</span>}
                {isOpen && <span className="flex-1" />}
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
            )}
            {isOpen && <div className={`chart-pane px-4 pb-4 ${single ? "pt-4" : ""}`}>{s.render()}</div>}
          </Card>
        );
      })}
    </div>
  );
}
