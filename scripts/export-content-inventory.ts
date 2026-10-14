// Read-only content inventory for Cathy's audit template.
// Run: bun scripts/export-content-inventory.ts
// Reads the REAL descriptors, store and governance helpers; writes only
// docs/content-inventory.csv, docs/resource-inventory.csv and
// docs/content-vocabulary.json. Changes no app state that persists and reads
// no patient data.
import { writeFileSync } from "node:fs";
import { CONTENT_TYPES, ACTIVITY_KINDS, contentType, liveLibraryCategoryList } from "../src/lib/contentTypes";
import { getContentEntry, listContent, type ContentBody, type ContentEntry, type ContentTypeId } from "../src/lib/contentPublishing";
import {
  CLINICAL_REVIEWER_ROLES,
  SCREENER_BANDS,
  isPart2Content,
  metaOf,
  part2Suggested,
  readingLevelOf,
  spanishStatusOf,
  type ContentMeta,
} from "../src/lib/contentGovernance";
import { taggedCatalog } from "../src/lib/contentTags";
import { liveAdvocateLibraryCategories, liveRecoveryModules } from "../src/lib/contentCatalog";
import { RESOURCE_CATEGORIES } from "../src/lib/communityResources";
import { CONTENT_AUDIENCES, audiencesOf } from "../src/lib/contentAudience";
import { COVERAGE_STAGES } from "../src/lib/contentTags";

// Same wording as ContentInventoryTable.inventoryStatus (kept identical; that
// module is a React component file, so it is mirrored here, not imported).
function inventoryStatus(e: ContentEntry): string {
  if (!getContentEntry(e.typeId, e.id)) return "Live (shipped)";
  if (e.revisions.at(-1)?.action === "retired") return "Retired";
  return e.status === "published" ? "Live" : e.status === "pending_review" ? "In review" : "Draft";
}

function inventory(types: ContentTypeId[]): ContentEntry[] {
  const managed = listContent().filter((e) => types.includes(e.typeId));
  const out = [...managed];
  for (const d of CONTENT_TYPES) {
    if (!types.includes(d.typeId)) continue;
    for (const id of d.baselineIds()) {
      if (out.some((e) => e.typeId === d.typeId && e.id === id)) continue;
      const body = d.baselineBody(id);
      if (body) out.push({ typeId: d.typeId, id, body, status: "published", publishedBody: body, overridesBaseline: true, revisions: [] });
    }
  }
  return out.sort((a, b) => a.typeId.localeCompare(b.typeId) || a.id.localeCompare(b.id));
}

const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => "\uFEFF" + rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
const txt = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 300) : "");
const pipe = (v: unknown) => (Array.isArray(v) ? v.join("|") : "");
const str = (b: ContentBody, ...keys: string[]) => { for (const k of keys) if (b[k] !== undefined && b[k] !== null && b[k] !== "") return b[k]; return ""; };

// ---- names ---------------------------------------------------------------
const libCats = liveLibraryCategoryList();
const advCats = liveAdvocateLibraryCategories();
const advCatIds = new Set(advCats.map((c) => c.id));
const catName = new Map<string, string>([...libCats, ...advCats].map((c) => [c.id, (c as { name?: string; title?: string }).name ?? (c as { title?: string }).title ?? c.id]));
const modules = liveRecoveryModules();
const modName = new Map(modules.map((m) => [m.id, m.name]));
const tagged = new Map(taggedCatalog().map((t) => [`${t.typeId}::${t.id}`, t.meta]));

// ---- content inventory ---------------------------------------------------
const CONTENT = ["library_lesson", "recovery_lesson", "library_category", "recovery_module", "exercise", "journey"] as ContentTypeId[];
const header = [
  "typeId", "id", "title", "title_es", "status", "container_id", "container_name", "audience", "order", "minutes", "activity_kind",
  "es_status", "reading_grade", "above_target",
  "part2_current", "part2_suggested", "clinical_current",
  "sdoh", "bands", "asam", "stages", "audiences", "flags",
  "tags_backfilled", "owner", "last_reviewed", "next_review",
  "problem", "learn_title", "insight", "clinical_target", "description", "placeholder_or_pending",
];
const rows: unknown[][] = [header];
const counts: Record<string, number> = {};
for (const e of inventory(CONTENT)) {
  const b = e.body;
  const authored = metaOf(b);
  const tagMeta: ContentMeta | undefined = tagged.get(`${e.typeId}::${e.id}`);
  const meta: ContentMeta = Object.keys(authored).filter((k) => k !== "esStatus").length ? authored : (tagMeta ?? authored);
  const backfilled = meta.backfilled === true && authored.backfilled !== false && meta === tagMeta;
  const container = String(str(b, "categoryId", "moduleId"));
  const containerName = catName.get(container) ?? modName.get(container) ?? "";
  const advocate = advCatIds.has(container) || advCatIds.has(e.id) || (b["audience"] === "advocate");
  const es = (b["es"] ?? {}) as Record<string, unknown>;
  const activity = (b["activity"] ?? {}) as Record<string, unknown>;
  const rl = readingLevelOf(e.typeId, b);
  const pending = [b["placeholder"] ? "placeholder" : "", b["contentPending"] ? "contentPending" : "", /pending (clinical )?authoring/i.test(String(str(b, "desc", "description", "clinicalTarget"))) ? "authoring pending" : ""].filter(Boolean).join("|");
  rows.push([
    e.typeId, e.id, contentType(e.typeId).titleOf(b), es["title"] ?? es["name"] ?? "", inventoryStatus(e), container, containerName,
    advocate ? "advocate" : String(b["audience"] ?? "patient"), str(b, "order"), str(b, "minutes", "estimatedMinutes"), activity["kind"] ?? "",
    spanishStatusOf(b), rl.grade, rl.aboveTarget,
    isPart2Content(e.typeId, b), part2Suggested(e.typeId, b), meta.clinical === true,
    pipe(meta.sdoh), pipe(meta.bands), pipe(meta.asam), pipe(meta.stages), audiencesOf(b).join("|"), pipe(meta.flags),
    backfilled, meta.owner ?? "", meta.lastReviewed ?? "", meta.nextReview ?? "",
    txt(b["problem"]), txt(b["learnTitle"]), txt(b["insight"]), txt(b["clinicalTarget"]), txt(str(b, "desc", "description", "subtitle", "mission")), pending,
  ]);
  counts[e.typeId] = (counts[e.typeId] ?? 0) + 1;
}
writeFileSync("docs/content-inventory.csv", csv(rows));

// ---- resource inventory --------------------------------------------------
const resCat = new Map(RESOURCE_CATEGORIES.map((c) => [c.id, (c as { name?: string; label?: string }).name ?? (c as { label?: string }).label ?? c.id]));
const rrows: unknown[][] = [["typeId", "id", "name", "category_id", "category_name", "status", "verified", "verification_status", "verified_at", "verified_by", "address", "city", "phone", "hours", "website", "description_or_what", "source", "placeholder"]];
for (const e of inventory(["community_resource", "naloxone_access_point"])) {
  const b = (e.publishedBody ?? e.body) as Record<string, unknown>;
  const v = (b["verification"] ?? {}) as Record<string, unknown>;
  const cat = String(str(b, "categoryId", "category"));
  rrows.push([
    e.typeId, e.id, str(b, "name", "title"), cat, resCat.get(cat) ?? "", inventoryStatus(e),
    e.typeId === "community_resource" ? b["verified"] === true : e.publishedRev !== undefined || !getContentEntry(e.typeId, e.id),
    str(b, "status"), v["verifiedAt"] ?? e.publishedAt ?? "", v["verifiedBy"] ?? e.publishedBy ?? "",
    str(b, "address"), str(b, "city"), str(b, "phone"), str(b, "hours"), str(b, "website", "url"),
    txt(str(b, "description", "what")), str(b, "source", "sourceUrl"), b["placeholder"] === true,
  ]);
  counts[e.typeId] = (counts[e.typeId] ?? 0) + 1;
}
writeFileSync("docs/resource-inventory.csv", csv(rrows));

// ---- vocabulary ----------------------------------------------------------
const STAGE_LABELS: Record<string, string> = { first_30: "First 30 days", days_30_90: "Days 30–90", after_90: "After 90 days" };
const vocab = {
  generatedBy: "scripts/export-content-inventory.ts",
  libraryCategories: libCats.map((c) => ({ id: c.id, label: catName.get(c.id), audience: "patient" })).concat(advCats.map((c) => ({ id: c.id, label: catName.get(c.id), audience: "advocate" }))),
  recoveryModules: modules.map((m) => ({ id: m.id, label: m.name, contentPending: m.contentPending === true })),
  resourceCategories: RESOURCE_CATEGORIES.map((c) => ({ id: c.id, label: resCat.get(c.id) })),
  screenerBands: SCREENER_BANDS.map((id) => ({ id, label: id })),
  asamDimensions: [1, 2, 3, 4, 5, 6].map((id) => ({ id, label: `ASAM dimension ${id}` })),
  reentryStages: COVERAGE_STAGES.map((id) => ({ id, label: STAGE_LABELS[id] ?? id })),
  audiences: CONTENT_AUDIENCES.map((a) => ({ id: a.id, label: a.label })),
  activityKinds: ACTIVITY_KINDS.map((k) => ({ id: k.value, label: k.label })),
  metaFlags: [{ id: "justice_involved", label: "Justice-involved" }, { id: "sud", label: "Substance use (Part 2)" }],
  clinicalReviewerRoles: CLINICAL_REVIEWER_ROLES.map((id) => ({ id, label: id })),
};
writeFileSync("docs/content-vocabulary.json", JSON.stringify(vocab, null, 2) + "\n");
console.log(JSON.stringify(counts));
