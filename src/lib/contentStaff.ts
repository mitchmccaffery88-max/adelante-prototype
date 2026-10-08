import { canAccess, type StaffRole } from "./roles";
import { roleSeesAsamSection } from "./asamReporting";
import { isPart2Content, metaOf } from "./contentGovernance";
import { contentType, CONTENT_TYPES } from "./contentTypes";
import { listContent, getContentEntry, type ContentBody, type ContentEntry, type ContentTypeId } from "./contentPublishing";
import { AdelanteEHR } from "./ehr";
import { getStructuredPlan } from "./structuredCarePlan";
export function canBrowseContent(role: StaffRole) { return ["content_authoring", "care_plan"].some((record) => canAccess(role, record as Parameters<typeof canAccess>[1]).level !== "none" && !canAccess(role, record as Parameters<typeof canAccess>[1]).locked) || role === "clinical_coordinator"; }
export function contentVisibleToStaff(role: StaffRole, type: ContentTypeId, body: ContentBody) { return canBrowseContent(role) && (!isPart2Content(type, body) || roleSeesAsamSection(role)); }
export function staffContentInventory(role: StaffRole): ContentEntry[] {
  const entries = listContent();
  for (const descriptor of CONTENT_TYPES) for (const id of descriptor.baselineIds()) {
    if (entries.some((e) => e.typeId === descriptor.typeId && e.id === id)) continue;
    const body = descriptor.baselineBody(id); if (!body) continue;
    entries.push({ typeId: descriptor.typeId, id, body, status: "published", publishedBody: body, overridesBaseline: true, revisions: [] });
  }
  return entries.filter((e) => contentVisibleToStaff(role, e.typeId, e.body));
}
export function contentPlanUsage(id: string) { return AdelanteEHR.listPatients().filter((p) => getStructuredPlan(p.id).assignments.some((a) => a.activityId === id)).length; }
export function generatedContentId(type: ContentTypeId, title: string) {
  const slug = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "content";
  let id = slug; let n = 2; while (getContentEntry(type, id) || contentType(type).baselineIds().includes(id)) id = `${slug}-${n++}`;
  return id;
}
export interface RevisionDifference { field: string; before: unknown; after: unknown }
export function contentRevisionDiff(before: ContentBody, after: ContentBody): RevisionDifference[] {
  const flatten = (body: ContentBody, prefix = ""): Record<string, unknown> => Object.fromEntries(Object.entries(body).flatMap(([key, value]) => { const path = prefix ? `${prefix}.${key}` : key; return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(flatten(value as ContentBody, path)) : [[path, value]]; }));
  const a = flatten(before), b = flatten(after); return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map((field) => ({ field, before: a[field], after: b[field] }));
}
export function staleContentFor(staffId: string, staffName: string, role: StaffRole, now = new Date()) {
  return staffContentInventory(role).filter((e) => { const m = metaOf(e.body); return (m.owner === staffId || m.owner === staffName) && m.nextReview && m.nextReview < now.toISOString().slice(0, 10); });
}
export function inventoryCsv(role: StaffRole) {
  const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [["title", "type", "status", "tags", "ES status", "owner", "last reviewed", "next review"], ...staffContentInventory(role).map((e) => { const m = metaOf(e.body); return [contentType(e.typeId).titleOf(e.body), e.typeId, e.status, [...(m.sdoh ?? []), ...(m.stages ?? []), ...(m.asam ?? [])].join(";"), m.esStatus, m.owner, m.lastReviewed, m.nextReview]; })].map((r) => r.map(quote).join(",")).join("\r\n");
}

/**
 * §F8 Which mode the center opens in. sys_admin → Audit; clinical reviewers
 * (PMHNP, physician, coordinator) → Review when items wait, else Browse;
 * content authors without a clinical role → Manage; clinicians → Browse.
 */
export type ContentMode = "browse" | "manage" | "review" | "audit";
export function defaultContentMode(role: StaffRole, waiting: number, canAuthor: boolean): ContentMode {
  if (role === "sys_admin") return "audit";
  if (["pmhnp", "physician", "clinical_coordinator"].includes(role)) return waiting > 0 ? "review" : "browse";
  const clinical = canAccess(role, "care_plan").level !== "none" && !canAccess(role, "care_plan").locked;
  if (canAuthor && !clinical) return "manage";
  return "browse";
}
