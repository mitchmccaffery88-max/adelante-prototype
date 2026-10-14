// §Content backup — "Download my changes" / "Load my changes" for the Patient
// Content & Resources Center while the content store is in-memory only.
//
// Rules (see src/lib/AGENTS.md):
//  - Content only: managed content entries (all 8 types) + community resource
//    verification facts. Never patient records, audit log or care plans.
//  - Part 2: export and load filter through `contentVisibleToStaff`.
//  - Conflict: replace only when the file's latest revision is newer.
//  - Published state needs `canPublishContent`; drafts need `canAuthorContent`.
//  - History is restored verbatim; no revision is ever invented.
import type { StaffRole } from "./roles";
import {
  canAuthorContent,
  canPublishContent,
  getContentEntry,
  listContent,
  writeRestoredContentEntries,
  type ContentActor,
  type ContentEntry,
  type ContentRevision,
  type ContentTypeId,
} from "./contentPublishing";
import { CONTENT_TYPES } from "./contentTypes";
import { contentVisibleToStaff } from "./contentStaff";
import { isPart2Content } from "./contentGovernance";
import {
  exportResourceVerifications,
  getResource,
  restoreResourceVerifications,
  type ResourceVerificationExport,
} from "./communityResources";

export const CONTENT_BACKUP_KIND = "adelante-content";
export const CONTENT_BACKUP_SCHEMA_VERSION = 1;
const KNOWN_TYPES = new Set<string>([...CONTENT_TYPES.map((d) => d.typeId), "exercise", "journey"]);

export interface ContentBackupFile {
  schemaVersion: number;
  kind: typeof CONTENT_BACKUP_KIND;
  exportedAt: string;
  exportedBy: { staffId?: string; name: string; role: StaffRole };
  appCommit: string | null;
  partTwoIncluded: boolean;
  entries: ContentEntry[];
  resourceVerifications: ResourceVerificationExport[];
}

export function appCommit(): string | null {
  const v = (import.meta.env as Record<string, unknown>)["VITE_APP_COMMIT"];
  return typeof v === "string" && v ? v : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** adelante-content-YYYY-MM-DD-HHmm.json in the viewer's local time. */
export function contentBackupFileName(now = new Date()): string {
  return `adelante-content-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** Store function behind `content_export`. */
export function exportContentEntries(input: { actor: ContentActor; now?: Date; commit?: string | null }): ContentBackupFile {
  const { actor } = input;
  if (!canAuthorContent(actor.role)) throw new Error("This role cannot download content.");
  const all = listContent();
  const visible = all.filter((e) => contentVisibleToStaff(actor.role, e.typeId, e.body));
  const hiddenIds = new Set(all.filter((e) => !visible.includes(e) && e.typeId === "community_resource").map((e) => e.id));
  return {
    schemaVersion: CONTENT_BACKUP_SCHEMA_VERSION,
    kind: CONTENT_BACKUP_KIND,
    exportedAt: (input.now ?? new Date()).toISOString(),
    exportedBy: { staffId: actor.staffId, name: actor.name, role: actor.role },
    appCommit: input.commit !== undefined ? input.commit : appCommit(),
    partTwoIncluded: visible.length === all.length,
    entries: visible,
    resourceVerifications: exportResourceVerifications().filter((v) => !hiddenIds.has(v.resourceId)),
  };
}

export type RestoreOutcome = "new" | "updated" | "unchanged" | "skipped";
export interface RestoreItem { typeId: string; id: string; outcome: RestoreOutcome; reason?: string }
export type RestorePlan =
  | { ok: false; error: string }
  | { ok: true; items: RestoreItem[]; counts: Record<RestoreOutcome, number>; verifications: number };

function parse(file: unknown): { ok: true; f: ContentBackupFile } | { ok: false; error: string } {
  let f: unknown = file;
  if (typeof f === "string") {
    try { f = JSON.parse(f); } catch { return { ok: false, error: "This file is not valid JSON." }; }
  }
  if (!f || typeof f !== "object") return { ok: false, error: "This file is not a content download." };
  const o = f as Record<string, unknown>;
  if (o["kind"] !== CONTENT_BACKUP_KIND) return { ok: false, error: "This file is not an Adelante content download." };
  if (o["schemaVersion"] !== CONTENT_BACKUP_SCHEMA_VERSION) return { ok: false, error: `Unsupported file version (${String(o["schemaVersion"])}).` };
  if (!Array.isArray(o["entries"])) return { ok: false, error: "The file has no content entries list." };
  if (o["resourceVerifications"] !== undefined && !Array.isArray(o["resourceVerifications"])) return { ok: false, error: "The resource verification list is malformed." };
  return { ok: true, f: { ...(o as unknown as ContentBackupFile), resourceVerifications: (o["resourceVerifications"] as ResourceVerificationExport[]) ?? [] } };
}

function shapeProblem(e: Record<string, unknown>): string | undefined {
  if (typeof e["id"] !== "string" || !e["id"]) return "Missing id";
  if (!KNOWN_TYPES.has(String(e["typeId"]))) return `Unknown content type "${String(e["typeId"])}"`;
  if (!e["body"] || typeof e["body"] !== "object") return "Missing body";
  const revs = e["revisions"];
  if (!Array.isArray(revs) || revs.length === 0) return "Missing revision history";
  for (let i = 0; i < revs.length; i++) {
    const r = revs[i] as Partial<ContentRevision> | null;
    if (!r || r.rev !== i + 1) return "Revisions are not numbered 1 to n";
    if (!r.body || typeof r.body !== "object" || typeof r.at !== "string" || typeof r.by !== "string" || typeof r.byRole !== "string" || typeof r.action !== "string")
      return `Revision ${i + 1} is incomplete`;
  }
  if (!["draft", "pending_review", "published"].includes(String(e["status"]))) return "Unknown status";
  return undefined;
}

const latest = (e: ContentEntry) => e.revisions[e.revisions.length - 1]!;

function classify(f: ContentBackupFile, actor: ContentActor): { items: RestoreItem[]; writes: ContentEntry[] } {
  const items: RestoreItem[] = [];
  const writes: ContentEntry[] = [];
  for (const raw of f.entries) {
    const o = (raw ?? {}) as unknown as Record<string, unknown>;
    const typeId = String(o["typeId"] ?? "");
    const id = String(o["id"] ?? "");
    const problem = shapeProblem(o);
    if (problem) { items.push({ typeId, id, outcome: "skipped", reason: problem }); continue; }
    const e = raw as ContentEntry;
    if (isPart2Content(e.typeId, e.body) && !contentVisibleToStaff(actor.role, e.typeId, e.body)) {
      items.push({ typeId, id, outcome: "skipped", reason: "Restricted content" }); continue;
    }
    const carriesPublished = e.status === "published" || e.publishedRev !== undefined;
    if (carriesPublished && !canPublishContent(actor.role)) {
      items.push({ typeId, id, outcome: "skipped", reason: "Published content needs a publisher role to load" }); continue;
    }
    const cur = getContentEntry(e.typeId as ContentTypeId, e.id);
    if (!cur) { items.push({ typeId, id, outcome: "new" }); writes.push(e); continue; }
    const a = latest(e), b = latest(cur);
    if (a.rev === b.rev && a.at === b.at) {
      if (JSON.stringify(e) === JSON.stringify(cur)) items.push({ typeId, id, outcome: "unchanged" });
      else items.push({ typeId, id, outcome: "skipped", reason: "Edited in two places; not replaced" });
      continue;
    }
    if (a.rev > b.rev || (a.rev === b.rev && a.at > b.at)) {
      if (a.rev > b.rev && JSON.stringify(e.revisions[b.rev - 1]) !== JSON.stringify(b)) {
        items.push({ typeId, id, outcome: "skipped", reason: "Edited in two places; not replaced" }); continue;
      }
      items.push({ typeId, id, outcome: "updated" }); writes.push(e); continue;
    }
    items.push({ typeId, id, outcome: "skipped", reason: `Your app has a newer version (rev ${b.rev}, ${b.at.slice(0, 10)}) than the file (rev ${a.rev})` });
  }
  return { items, writes };
}

function pendingVerifications(f: ContentBackupFile): ResourceVerificationExport[] {
  return f.resourceVerifications.filter((v) => {
    const r = v && typeof v === "object" ? getResource(v.resourceId) : undefined;
    return !!r && !!v.verification?.verifiedAt && (!r.verification || r.verification.verifiedAt < v.verification.verifiedAt);
  });
}

/** Preview only: no writes, no audit. */
export function planContentRestore(file: unknown, actor: ContentActor): RestorePlan {
  if (!canAuthorContent(actor.role)) return { ok: false, error: "This role cannot load content." };
  const p = parse(file);
  if (!p.ok) return p;
  const { items } = classify(p.f, actor);
  const counts = { new: 0, updated: 0, unchanged: 0, skipped: 0 } as Record<RestoreOutcome, number>;
  for (const i of items) counts[i.outcome] += 1;
  const verifications = canPublishContent(actor.role) ? pendingVerifications(p.f).length : 0;
  return { ok: true, items, counts, verifications };
}

export type RestoreResult = { ok: true; plan: Extract<RestorePlan, { ok: true }> } | { ok: false; reason: string };

/** Store function behind `content_restore`. Restores history verbatim. */
export function restoreContentEntries(input: { file: unknown; actor: ContentActor }): RestoreResult {
  const plan = planContentRestore(input.file, input.actor);
  if (!plan.ok) return { ok: false, reason: plan.error };
  const p = parse(input.file);
  if (!p.ok) return { ok: false, reason: p.error };
  const { writes } = classify(p.f, input.actor);
  writeRestoredContentEntries(writes);
  // Verification facts make a resource live, so they follow the publish gate.
  if (canPublishContent(input.actor.role)) restoreResourceVerifications(pendingVerifications(p.f));
  return { ok: true, plan };
}

/** Neutral audit text: counts only, never titles. */
export function restoreSummary(plan: Extract<RestorePlan, { ok: true }>): string {
  const c = plan.counts;
  return `Loaded content file: ${c.new} new, ${c.updated} updated, ${c.unchanged} unchanged, ${c.skipped} skipped.`;
}
