// §Chart redesign turn 4 — the chart's sections grouped into 8 tabs. Sections
// keep their ids (every ?section= deep link, My work link, notification,
// "See all" and toast still points at a section id); this file only says
// which tab each one lives in. In-facility sections map to no tab.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { canAccess, isPrescriberRole, type StaffRole } from "@/lib/roles";
import { SECTION_ALIASES } from "@/lib/chartSectionAliases";
import { inFacilityEnabled } from "@/lib/inFacility";
import { roleSeesAsamSection } from "@/lib/asamReporting";

export type ChartTabId = "brief" | "notes-docs" | "care-needs" | "medications" | "measures" | "schedule" | "tasks-contacts" | "record";

export const CHART_TABS: { id: ChartTabId; label: string; sections: string[] }[] = [
  { id: "brief", label: "Brief", sections: ["brief"] },
  { id: "notes-docs", label: "Notes & Documents", sections: ["notes", "peer", "chw", "documents", "safety-plan"] },
  { id: "care-needs", label: "Care plan & Needs", sections: ["care-plan", "problems", "sdoh", "alerts", "episodes", "reentry-handoff"] },
  { id: "medications", label: "Medications", sections: ["orders", "labs", "med-recon", "allergies", "mar", "protocols"] },
  { id: "measures", label: "Measures", sections: ["tracking", "asam", "caloms"] },
  { id: "schedule", label: "Schedule & Messages", sections: ["appointments", "messages", "coord"] },
  { id: "tasks-contacts", label: "Tasks & Contacts", sections: ["tasks", "contacts", "weekly-review", "checkins"] },
  { id: "record", label: "Record & Admin", sections: ["overview", "contact", "eligibility", "advocates", "outside-records", "consents", "audit-trail", "access-log"] },
];

/**
 * Role default: which sub-section leads each tab. Anything not listed keeps
 * the CHART_TABS order. Arrangement only — gates are untouched.
 */
export function roleFirstSections(tab: ChartTabId, role: StaffRole): string[] {
  const cm = role === "cf_care_manager" || role === "ecm_provider";
  if (tab === "medications") return isPrescriberRole(role) ? ["orders", "labs"] : ["med-recon", "allergies"];
  if (tab === "tasks-contacts") return cm ? ["contacts", "weekly-review"] : ["tasks"];
  if (tab === "care-needs") return cm || role === "peer_specialist" ? ["sdoh", "care-plan"] : ["care-plan", "problems"];
  if (tab === "record") return role === "billing" || role === "billing_coordinator" ? ["eligibility", "overview"] : [];
  if (tab === "schedule") return cm ? ["coord", "appointments"] : [];
  return [];
}

export function orderSectionsForRole<T extends { id: string }>(tab: ChartTabId, subs: T[], role: StaffRole): T[] {
  const lead = roleFirstSections(tab, role);
  const rank = (id: string) => (lead.includes(id) ? lead.indexOf(id) : lead.length + 1);
  return subs.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s.id) - rank(b.s.id) || a.i - b.i).map((x) => x.s);
}

/** In-facility sections: never a tab while the flag is off. */
export const IN_FACILITY_SECTIONS = ["mar", "protocols", "bookings", "housing-moves"];

export const SECTION_TO_TAB: Record<string, ChartTabId> = Object.fromEntries(
  CHART_TABS.flatMap((t) => t.sections.map((s) => [s, t.id])),
);

/**
 * Resolve any ?section= value (tab id, current section id, or an old merged
 * id) to { tab, sub }. Unknown values land on Brief.
 */
export function resolveChartLocation(value?: string): { tab: ChartTabId; sub?: string } {
  if (!value) return { tab: "brief" };
  if (CHART_TABS.some((t) => t.id === value)) return { tab: value as ChartTabId };
  const id = SECTION_ALIASES[value] ?? value;
  if (IN_FACILITY_SECTIONS.includes(id) && !inFacilityEnabled() && !SECTION_TO_TAB[id]) return { tab: "brief" };
  const tab = SECTION_TO_TAB[id] ?? (IN_FACILITY_SECTIONS.includes(id) ? "medications" : undefined);
  return tab ? { tab, sub: id === "brief" ? undefined : id } : { tab: "brief" };
}

/** Actionable counts only. */
export function tabBadges(p: Patient, role: StaffRole, now = new Date()): Partial<Record<ChartTabId, string>> {
  const out: Partial<Record<ChartTabId, string>> = {};
  if (canAccess(role, "case_notes", p).level !== "none") {
    const unsigned = (p.progressNotes ?? []).filter((n) => !n.voidedAt && (n.status === "draft" || n.status === "cosign_pending" || !n.status && !n.signedAt)).length;
    if (unsigned) out["notes-docs"] = `${unsigned} unsigned`;
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const seesSud = roleSeesAsamSection(role, p);
    const due = AdelanteEHR.listCaseTasks().filter(
      (t) => t.patientId === p.id && !t.completedAt && t.status !== "done" && (seesSud || t.origin !== "asam_needed") && +new Date(t.dueDate.length === 10 ? `${t.dueDate}T12:00:00` : t.dueDate) <= +end,
    ).length;
    if (due) out["tasks-contacts"] = `${due} due`;
  }
  if (isPrescriberRole(role)) {
    const refills = AdelanteEHR.listRefillRequests({ patientId: p.id, status: "pending" }).length;
    if (refills) out.medications = `${refills} refill${refills === 1 ? "" : "s"}`;
  }
  return out;
}
