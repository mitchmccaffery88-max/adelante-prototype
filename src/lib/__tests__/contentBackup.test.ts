// §Content backup — Download / Load my changes.
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetContent,
  getContentEntry,
  listContent,
  seedPublishedContent,
  saveContentDraft,
} from "@/lib/contentPublishing";
import { LIBRARY_LESSON_TYPE } from "@/lib/contentTypes";
import {
  contentBackupFileName,
  exportContentEntries,
  planContentRestore,
  restoreContentEntries,
  restoreSummary,
  type ContentBackupFile,
} from "@/lib/contentBackup";
import { __resetResources, exportResourceVerifications, listResources, verifyResource } from "@/lib/communityResources";
import { runAction } from "@/lib/actions/runAction";
import { AdelanteEHR } from "@/lib/ehr";

const AUTHOR = { staffId: "s-peer1", name: "Peer", role: "peer_specialist" as const };
const CATHY = { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" as const };
const PMHNP = { name: "Prescriber", role: "pmhnp" as const };

const body = (id: string, extra: Record<string, unknown> = {}) => ({ ...LIBRARY_LESSON_TYPE.emptyBody(), id, title: `T ${id}`, ...extra });

function seedStore() {
  saveContentDraft({ typeId: "library_lesson", id: "lib_a", body: body("lib_a"), actor: AUTHOR });
  seedPublishedContent({ typeId: "library_lesson", id: "lib_b", body: body("lib_b"), actor: CATHY, atISO: "2026-10-01T10:00:00.000Z" });
  saveContentDraft({ typeId: "library_lesson", id: "lib_p2", body: body("lib_p2", { part2Sensitive: true }), actor: PMHNP });
}

const file = (actor: { name: string; role: never } | typeof CATHY | typeof PMHNP | typeof AUTHOR) =>
  JSON.parse(JSON.stringify(exportContentEntries({ actor, commit: null }))) as ContentBackupFile;

describe("content backup", () => {
  beforeEach(() => { __resetContent(); __resetResources(); });

  it("round trip: export, reset, load restores the store verbatim", () => {
    seedStore();
    const r = listResources().find((x) => x.address.trim() && x.phone.trim() && x.hours.trim())!;
    expect(verifyResource({ resourceId: r.id, actorName: "Cathy", actorStaffId: "s-cc2", actorRole: "clinical_coordinator", confirmedAddress: true, confirmedPhone: true, confirmedHours: true, atISO: "2030-01-01T00:00:00.000Z" }).ok).toBe(true);
    const before = listContent();
    const verBefore = exportResourceVerifications();
    const f = file(PMHNP);
    expect(f.partTwoIncluded).toBe(true);
    __resetContent(); __resetResources();
    const res = restoreContentEntries({ file: JSON.stringify(f), actor: PMHNP });
    expect(res.ok).toBe(true);
    expect(listContent()).toEqual(before);
    expect(exportResourceVerifications()).toEqual(verBefore);
  });

  it("conflict rule: newer replaces, same is unchanged, older is skipped", () => {
    saveContentDraft({ typeId: "library_lesson", id: "lib_a", body: body("lib_a"), actor: CATHY });
    const old = file(CATHY);
    saveContentDraft({ typeId: "library_lesson", id: "lib_a", body: body("lib_a", { title: "v2" }), actor: CATHY });
    const newer = file(CATHY);
    const only = (f: ContentBackupFile) => ({ ...f, entries: f.entries.filter((e) => e.id === "lib_a") });
    const p1 = planContentRestore(newer, CATHY);
    expect(p1.ok && p1.items.find((i) => i.id === "lib_a")!.outcome).toBe("unchanged");
    const p2 = planContentRestore(old, CATHY);
    const a2 = p2.ok ? p2.items.find((i) => i.id === "lib_a")! : undefined;
    expect(a2!.outcome).toBe("skipped");
    expect(a2!.reason).toMatch(/newer version/);
    __resetContent();
    saveContentDraft({ typeId: "library_lesson", id: "lib_a", body: body("lib_a"), actor: CATHY });
    // Store is at rev 1 matching `old`; `newer` is rev 2 → updated.
    const store = getContentEntry("library_lesson", "lib_a")!;
    const forkedNewer = { ...only(newer), entries: only(newer).entries.map((e) => ({ ...e, revisions: [store.revisions[0]!, { ...e.revisions[1]!, rev: 2 }] })) };
    const p3 = planContentRestore(forkedNewer, CATHY);
    expect(p3.ok && p3.items.find((i) => i.id === "lib_a")!.outcome).toBe("updated");
    // A fork: same rev, different content.
    const fork = { ...old, entries: [{ ...store, body: { ...store.body, title: "fork" } }] };
    const p4 = planContentRestore(fork, CATHY);
    expect(p4.ok && p4.items.find((i) => i.id === "lib_a")!.reason).toBe("Edited in two places; not replaced");
  });

  it("role gates: billing blocked, authors cannot load published state, Part 2 filtered", () => {
    seedStore();
    const b = runAction("content_export", { role: "billing" }, undefined, { args: [{ actor: { name: "B", role: "billing" } }] });
    expect(b.ok).toBe(false);
    expect(b.event.action).toBe("action.blocked");
    const cathyFile = file(CATHY);
    expect(cathyFile.entries.map((e) => e.id)).toContain("lib_p2");
    expect(cathyFile.partTwoIncluded).toBe(true);
    const full = file(PMHNP);
    __resetContent();
    const pa = planContentRestore(full, AUTHOR);
    expect(pa.ok).toBe(true);
    if (!pa.ok) return;
    const reasonOf = (id: string) => pa.items.find((i) => i.id === id);
    expect(reasonOf("lib_a")!.outcome).toBe("new");
    expect(reasonOf("lib_b")!.reason).toBe("Published content needs a publisher role to load");
    expect(reasonOf("lib_p2")!.reason).toBe("Restricted content");
    const pc = planContentRestore(full, CATHY);
    expect(pc.ok && pc.items.find((i) => i.id === "lib_b")!.outcome).toBe("new");
  });

  it("refuses bad files and skips bad entries", () => {
    expect(planContentRestore("{nope", CATHY)).toEqual({ ok: false, error: "This file is not valid JSON." });
    expect(planContentRestore({ kind: "other" }, CATHY).ok).toBe(false);
    expect(planContentRestore({ kind: "adelante-content", schemaVersion: 9, entries: [] }, CATHY).ok).toBe(false);
    expect(planContentRestore({ kind: "adelante-content", schemaVersion: 1 }, CATHY).ok).toBe(false);
    saveContentDraft({ typeId: "library_lesson", id: "lib_a", body: body("lib_a"), actor: CATHY });
    const f = file(CATHY);
    __resetContent();
    const good = f.entries[0]!;
    const bad = { ...f, entries: [{ ...good, typeId: "mystery" }, { ...good, id: "lib_x", revisions: [{ ...good.revisions[0]!, rev: 3 }] }] };
    const p = planContentRestore(bad, CATHY);
    expect(p.ok && p.items.map((i) => i.outcome)).toEqual(["skipped", "skipped"]);
    expect(p.ok && p.items[0]!.reason).toMatch(/Unknown content type/);
    expect(restoreContentEntries({ file: bad, actor: CATHY }).ok).toBe(true);
    expect(listContent()).toEqual([]);
  });

  it("one audit event per load, none for a preview, no titles in audit text", () => {
    saveContentDraft({ typeId: "library_lesson", id: "lib_a", body: body("lib_a", { title: "Secret title" }), actor: CATHY });
    const f = file(CATHY);
    __resetContent();
    const n0 = AdelanteEHR.listAuditEvents?.().length ?? 0;
    const p = planContentRestore(f, CATHY);
    expect(AdelanteEHR.listAuditEvents?.().length ?? 0).toBe(n0);
    const r = runAction("content_restore", { role: CATHY.role, staffId: CATHY.staffId }, undefined, { args: [{ file: f, actor: CATHY }] });
    expect(r.ok).toBe(true);
    expect(r.event.action).toBe("action.succeeded");
    expect(JSON.stringify(r.event)).not.toContain("Secret title");
    if (p.ok) expect(restoreSummary(p)).not.toContain("Secret title");
  });

  it("file name and commit fallback", () => {
    expect(contentBackupFileName(new Date(2026, 9, 15, 14, 5))).toBe("adelante-content-2026-10-15-1405.json");
    expect(exportContentEntries({ actor: CATHY, commit: null }).appCommit).toBeNull();
  });
});
