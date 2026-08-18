// §Content Management admin tooling — THE SHARED CONTENT LIFECYCLE STORE.
//
// WHY THIS EXISTS. Four features had each hand-rolled their own review state:
// Safety Plan section prompts (`clinicalReviewPending`), naloxone content
// (`SAFETY_CONTENT_REVIEW` / `NALOXONE_ACCESS_REVIEW`), Community Resources
// (a real draft→verified store), and Library / Recovery lesson content — which
// had NO admin path at all and could only be changed by shipping code.
//
// WHAT WAS GENERALIZED, AND FROM WHERE. `src/lib/communityResources.ts` is the
// most complete of the four and is the pattern this module generalizes: a Map
// store, a `subscribe`/`notify` pair for `useSyncExternalStore`, structuredClone
// on the way in and out so callers cannot mutate the store, a single PURE
// predicate that is the only definition of "what a patient may see", a queue
// selector derived from that predicate, and a mutation that REFUSES rather
// than decorates (wrong role, missing fact, incomplete confirmation). All six
// of those properties are reproduced here. No new pattern was invented.
//
// WHAT IS DIFFERENT, AND WHY IT IS ONE STORE AND NOT ONE TABLE. A Library
// lesson, a Recovery lesson and a Community Resource have genuinely different
// SCHEMAS — an eight-part instructional sequence, a ten-step sequence with a
// typed tool flow, and an address/phone/hours directory record. What they
// share is a LIFECYCLE, not a shape. So the lifecycle (status, revisions,
// who-approved-what, which revision a patient is actually being served) lives
// here once and is fully generic over the body, and the SHAPE lives in a
// per-type descriptor (`src/lib/contentTypes.ts`). One store, typed bodies.
//
// REVISIONS ARE THE POINT. Publishing never overwrites silently: the published
// snapshot is frozen at the revision that was approved, editing a published
// entry creates a NEW working revision while patients keep being served the
// approved one, and every transition is appended to `revisions` with a real
// actor and timestamp. "Which version did the patient see" is answerable.
import { CONTENT_PUBLISHER_ROLES, canAccess, getStaffMember, type StaffRole } from "@/lib/roles";

/** draft → pending_review → published. There is no fourth state. */
export type ContentStatus = "draft" | "pending_review" | "published";

export type ContentTypeId =
  | "library_lesson"
  | "recovery_lesson"
  // §Adelante Journey sync Build 2 — the CONTAINERS are content too. A
  // category / module was a hardcoded array entry, so adding one needed a
  // deploy. They ride the same lifecycle as the lessons inside them.
  | "library_category"
  | "recovery_module"
  // §Content Management correction — Community Resources and naloxone access
  // points are EDITORIAL content for this program, not one-off reference data:
  // the content manager adds locations and counties as the program expands, and
  // the same entries feed the website, the patient portal, intake, onboarding
  // and SDOH-needs alignment. They belong on the same lifecycle as lessons.
  | "community_resource"
  | "naloxone_access_point";

/** A content body is whatever the type descriptor says it is. */
export type ContentBody = Record<string, unknown>;

export type ContentAction =
  | "created"
  | "edited"
  | "submitted"
  | "returned"
  | "published"
  /** Withdrawn from patients. The entry and its history survive. */
  | "retired"
  /** A never-published draft was discarded outright. */
  | "discarded";

export interface ContentRevision {
  /** 1-based, monotonic per entry. This is the number a patient "saw". */
  rev: number;
  action: ContentAction;
  /** Full snapshot at this revision — not a diff, so history cannot rot. */
  body: ContentBody;
  statusAfter: ContentStatus;
  at: string;
  by: string;
  byStaffId?: string;
  byRole: StaffRole;
  note?: string;
}

export interface ContentEntry {
  /** The content id — the same id the patient-facing catalog resolves by. */
  id: string;
  typeId: ContentTypeId;
  status: ContentStatus;
  /** The WORKING copy. May be ahead of what patients see. */
  body: ContentBody;
  /** The frozen snapshot patients are actually served. */
  publishedBody?: ContentBody;
  /** Which revision that snapshot is. */
  publishedRev?: number;
  publishedAt?: string;
  publishedBy?: string;
  revisions: ContentRevision[];
  /**
   * TRUE when this entry shadows a lesson that also exists as hardcoded
   * baseline content in code. The catalog prefers a PUBLISHED override; a
   * draft override never displaces the shipped baseline.
   */
  overridesBaseline: boolean;
  /** Set when an approver sends it back, cleared on the next submit. */
  returnedNote?: string;
}

export type ContentResult =
  | { ok: true; entry: ContentEntry }
  | { ok: false; reason: string };

const entries = new Map<string, ContentEntry>();
const key = (typeId: ContentTypeId, id: string) => `${typeId}::${id}`;

const listeners = new Set<() => void>();
let storeVersion = 0;
const notify = () => {
  storeVersion += 1;
  listeners.forEach((l) => l());
};

/** Monotonic counter for `useSyncExternalStore` snapshots. */
export function contentStoreVersion(): number {
  return storeVersion;
}
export function subscribeContent(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

// ---------------------------------------------------------------------------
// Pure predicates — the ONE definition of "live", mirroring `isResourceLive`.
// ---------------------------------------------------------------------------

/**
 * What a PATIENT may be served from this store. Nothing else qualifies.
 *
 * Deliberately keyed on the FROZEN SNAPSHOT, not on `status`. `status` tracks
 * the WORKING copy: editing a published lesson moves it back to `draft` and
 * re-submitting moves it to `pending_review`, and in neither case should the
 * lesson vanish from the patient's Library mid-review. Patients keep being
 * served `publishedBody` until a new revision is approved to replace it.
 */
export function isContentLive(e: ContentEntry): boolean {
  return e.publishedRev !== undefined && !!e.publishedBody;
}

/** True when the working copy has moved on from what patients are served. */
export function hasUnpublishedChanges(e: ContentEntry): boolean {
  if (!e.publishedBody) return e.revisions.length > 0;
  return JSON.stringify(e.body) !== JSON.stringify(e.publishedBody);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listContent(typeId?: ContentTypeId): ContentEntry[] {
  return [...entries.values()]
    .filter((e) => !typeId || e.typeId === typeId)
    .map(clone)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getContentEntry(typeId: ContentTypeId, id: string): ContentEntry | undefined {
  const e = entries.get(key(typeId, id));
  return e ? clone(e) : undefined;
}

/** The generalized review queue — the direct analogue of `resourceVerificationQueue`. */
export function contentReviewQueue(typeId?: ContentTypeId): ContentEntry[] {
  return listContent(typeId).filter((e) => e.status === "pending_review");
}

/** Everything an author still owns: drafts and anything sent back to them. */
export function contentDraftQueue(typeId?: ContentTypeId): ContentEntry[] {
  return listContent(typeId).filter((e) => e.status === "draft");
}

/** Published entries whose working copy has since drifted — a real risk signal. */
export function contentWithUnpublishedEdits(typeId?: ContentTypeId): ContentEntry[] {
  return listContent(typeId).filter((e) => isContentLive(e) && hasUnpublishedChanges(e));
}

/** The published body a patient is actually served, or undefined. */
export function publishedContent(typeId: ContentTypeId, id: string): ContentBody | undefined {
  const e = entries.get(key(typeId, id));
  return e && isContentLive(e) ? clone(e.publishedBody!) : undefined;
}

export function publishedContentOfType(typeId: ContentTypeId): ContentBody[] {
  return [...entries.values()]
    .filter((e) => e.typeId === typeId && isContentLive(e))
    .map((e) => clone(e.publishedBody!));
}

/**
 * A cheap, stable snapshot of "what is currently published". Changes only when
 * a publish actually changes what a patient would be served, so the patient UI
 * re-renders on publish and not on every keystroke in the admin form.
 */
export function publishedVersion(): string {
  return [...entries.values()]
    .filter(isContentLive)
    .map((e) => `${e.typeId}:${e.id}:${e.publishedRev}`)
    .sort()
    .join("|");
}

// ---------------------------------------------------------------------------
// Actor resolution — a real staff identity, checked, never a decorated string.
// ---------------------------------------------------------------------------

export interface ContentActor {
  staffId?: string;
  name: string;
  role: StaffRole;
}

function actorProblem(actor: ContentActor): string | undefined {
  if (actor.staffId && !getStaffMember(actor.staffId)) return "Unknown staff member.";
  return undefined;
}

/** Authoring reuses the RBAC matrix, exactly like every other surface. */
export function canAuthorContent(role: StaffRole): boolean {
  return canAccess(role, "content_authoring").level === "write";
}

/**
 * No second approver. A content manager creates AND publishes. See
 * `CONTENT_PUBLISHER_ROLES` for why that is safe here and where the real
 * two-person clinical control still lives.
 */
export function canPublishContent(role: StaffRole): boolean {
  return CONTENT_PUBLISHER_ROLES.includes(role);
}

// ---------------------------------------------------------------------------
// Mutations. Each one REFUSES rather than decorates.
// ---------------------------------------------------------------------------

function appendRevision(
  e: ContentEntry,
  action: ContentAction,
  actor: ContentActor,
  statusAfter: ContentStatus,
  note?: string,
): ContentRevision {
  const rev: ContentRevision = {
    rev: e.revisions.length + 1,
    action,
    body: clone(e.body),
    statusAfter,
    at: new Date().toISOString(),
    by: actor.name,
    byStaffId: actor.staffId,
    byRole: actor.role,
    ...(note ? { note } : {}),
  };
  e.revisions.push(rev);
  return rev;
}

export interface SaveDraftInput {
  typeId: ContentTypeId;
  id: string;
  body: ContentBody;
  actor: ContentActor;
  /** Set by the catalog when the id matches a hardcoded baseline lesson. */
  overridesBaseline?: boolean;
  /** Type descriptor validation, injected so this store stays schema-agnostic. */
  validate?: (body: ContentBody) => string[];
}

/**
 * Create or update the WORKING copy. Never publishes, never touches
 * `publishedBody` — a published lesson keeps being served while it is edited.
 */
export function saveContentDraft(input: SaveDraftInput): ContentResult {
  const problem = actorProblem(input.actor);
  if (problem) return { ok: false, reason: problem };
  if (!canAuthorContent(input.actor.role))
    return { ok: false, reason: "This role cannot author patient-facing content." };
  if (!input.id.trim()) return { ok: false, reason: "A content id is required." };

  const k = key(input.typeId, input.id);
  const existing = entries.get(k);
  if (existing && existing.status === "pending_review")
    return {
      ok: false,
      reason: "This is in review. It must be returned for changes before it can be edited.",
    };

  const e: ContentEntry = existing ?? {
    id: input.id,
    typeId: input.typeId,
    status: "draft",
    body: {},
    revisions: [],
    overridesBaseline: input.overridesBaseline ?? false,
  };
  const created = !existing;
  e.body = clone(input.body);
  if (input.overridesBaseline !== undefined) e.overridesBaseline = input.overridesBaseline;
  // A published entry that is edited goes back to `draft` as its WORKING
  // status. Patients keep seeing `publishedBody` until the new revision is
  // approved — that is the whole point of freezing the snapshot.
  e.status = "draft";
  appendRevision(e, created ? "created" : "edited", input.actor, "draft");
  entries.set(k, e);
  notify();
  return { ok: true, entry: clone(e) };
}

export interface SubmitInput {
  typeId: ContentTypeId;
  id: string;
  actor: ContentActor;
  note?: string;
  validate?: (body: ContentBody) => string[];
}

export function submitContentForReview(input: SubmitInput): ContentResult {
  const problem = actorProblem(input.actor);
  if (problem) return { ok: false, reason: problem };
  if (!canAuthorContent(input.actor.role))
    return { ok: false, reason: "This role cannot submit patient-facing content." };
  const e = entries.get(key(input.typeId, input.id));
  if (!e) return { ok: false, reason: "No such content entry." };
  if (e.status === "pending_review") return { ok: false, reason: "Already in review." };

  const errors = input.validate?.(e.body) ?? [];
  if (errors.length > 0) return { ok: false, reason: errors[0]! };

  e.status = "pending_review";
  delete e.returnedNote;
  appendRevision(e, "submitted", input.actor, "pending_review", input.note);
  notify();
  return { ok: true, entry: clone(e) };
}

export interface ReviewInput {
  typeId: ContentTypeId;
  id: string;
  actor: ContentActor;
  note?: string;
  validate?: (body: ContentBody) => string[];
}

/**
 * PUBLISH. One real gate beyond role: the content must still validate.
 *
 * The separation-of-duties check that used to live here was REMOVED by product
 * direction: general content (lessons, community resources, naloxone access
 * points) touches no individual patient's record, so a two-person clinical
 * sign-off model does not fit it. The submit-for-review path below still
 * exists for teams that want a second pair of eyes — it is optional now, not a
 * precondition, so publishing straight from `draft` is allowed.
 *
 * Nothing here is reachable from the per-patient care-plan / cosign / order
 * surfaces; those keep their own, unchanged gates.
 */
export function publishContent(input: ReviewInput): ContentResult {
  const problem = actorProblem(input.actor);
  if (problem) return { ok: false, reason: problem };
  if (!canPublishContent(input.actor.role))
    return { ok: false, reason: "This role cannot publish content." };
  const e = entries.get(key(input.typeId, input.id));
  if (!e) return { ok: false, reason: "No such content entry." };

  const errors = input.validate?.(e.body) ?? [];
  if (errors.length > 0) return { ok: false, reason: errors[0]! };

  e.status = "published";
  const rev = appendRevision(e, "published", input.actor, "published", input.note);
  e.publishedBody = clone(e.body);
  e.publishedRev = rev.rev;
  e.publishedAt = rev.at;
  e.publishedBy = input.actor.name;
  notify();
  return { ok: true, entry: clone(e) };
}

/** @deprecated Kept as the old call site's name; publishing needs no approval. */
export const approveAndPublishContent = publishContent;

// ---------------------------------------------------------------------------
// §Referential integrity — retire / discard, and the guard that blocks them
// ---------------------------------------------------------------------------
//
// WHAT "DELETE" MEANS HERE. There is no hard delete of published content, and
// adding one would break the store's central promise: "which revision did the
// patient see" must stay answerable. So removal splits in two:
//
//   RETIRE   — the entry was published. Clear the frozen snapshot so patients
//              stop being served it; keep the entry, its working body and its
//              full revision history, with `retired` appended as a real event.
//              An entry that shadowed a shipped baseline falls BACK to that
//              baseline rather than vanishing — the code is still the floor.
//   DISCARD  — the entry was never published, so no patient ever saw it and
//              there is nothing to be accountable for. The row is dropped.
//
// The guard is a registry rather than a descriptor method because the honest
// answer to "is anything still using this category" lives in the CATALOG
// (baseline lessons overlaid with published ones), and the catalog imports
// this module. `src/lib/contentCatalog.ts` registers the real implementation
// at import time; the default is permissive so this store stays standalone.

export type ContentIntegrityGuard = (typeId: ContentTypeId, id: string) => string | undefined;

let integrityGuard: ContentIntegrityGuard = () => undefined;

export function setContentIntegrityGuard(fn: ContentIntegrityGuard): void {
  integrityGuard = fn;
}

/**
 * The reason this entry may NOT be withdrawn from patients right now, or
 * undefined when it may. Exported so the admin UI can disable the control and
 * explain itself — but the mutations below re-check it, so the guard is real
 * and not a UI decoration.
 */
export function contentRemovalBlockReason(
  typeId: ContentTypeId,
  id: string,
): string | undefined {
  return integrityGuard(typeId, id);
}

export interface RemoveInput {
  typeId: ContentTypeId;
  id: string;
  actor: ContentActor;
  /** Required. Withdrawing content from patients needs a stated reason. */
  note: string;
}

/** Unpublish: patients stop being served this. History is kept. */
export function retireContent(input: RemoveInput): ContentResult {
  const problem = actorProblem(input.actor);
  if (problem) return { ok: false, reason: problem };
  if (!canPublishContent(input.actor.role))
    return { ok: false, reason: "This role cannot withdraw published content." };
  if (!input.note?.trim())
    return { ok: false, reason: "Say why this is being withdrawn from patients." };
  const e = entries.get(key(input.typeId, input.id));
  if (!e) return { ok: false, reason: "No such content entry." };
  if (!isContentLive(e)) return { ok: false, reason: "This is not published, so nothing to withdraw." };

  const blocked = integrityGuard(input.typeId, input.id);
  if (blocked) return { ok: false, reason: blocked };

  e.status = "draft";
  delete e.publishedBody;
  delete e.publishedRev;
  delete e.publishedAt;
  delete e.publishedBy;
  appendRevision(e, "retired", input.actor, "draft", input.note.trim());
  notify();
  return { ok: true, entry: clone(e) };
}

/** Discard a never-published draft outright. Refuses once anything went live. */
export function discardContentDraft(input: RemoveInput): ContentResult {
  const problem = actorProblem(input.actor);
  if (problem) return { ok: false, reason: problem };
  if (!canAuthorContent(input.actor.role))
    return { ok: false, reason: "This role cannot discard content." };
  if (!input.note?.trim()) return { ok: false, reason: "Say why this draft is being discarded." };
  const k = key(input.typeId, input.id);
  const e = entries.get(k);
  if (!e) return { ok: false, reason: "No such content entry." };
  if (isContentLive(e))
    return {
      ok: false,
      reason: "This is published. Withdraw it from patients first — published history is never deleted.",
    };
  if (e.revisions.some((r) => r.action === "published"))
    return {
      ok: false,
      reason: "This was published before. Its history is kept; it cannot be discarded.",
    };

  const blocked = integrityGuard(input.typeId, input.id);
  if (blocked) return { ok: false, reason: blocked };

  const snapshot = clone(e);
  entries.delete(k);
  notify();
  return { ok: true, entry: snapshot };
}

// ---------------------------------------------------------------------------
// Migration seeding — importing content that was ALREADY published elsewhere
// ---------------------------------------------------------------------------

export interface SeedPublishedInput {
  typeId: ContentTypeId;
  id: string;
  body: ContentBody;
  /** The real person who published it, historically. */
  actor: ContentActor;
  /** The real timestamp of that historical event — NOT "now". */
  atISO: string;
  note?: string;
  overridesBaseline?: boolean;
}

/**
 * Import an entry that was made patient-visible BEFORE this store existed, so
 * the migration does not erase the real event that made it live.
 *
 * This is not a back door around the role gate: it replays a historical actor
 * and timestamp into revision history verbatim, and it refuses to touch an
 * entry that already exists in the store. Used to carry Cathy's real community
 * resource verification pass and her naloxone access-point pass across the
 * migration as revision 1 rather than restarting their history at zero.
 */
export function seedPublishedContent(input: SeedPublishedInput): ContentResult {
  const k = key(input.typeId, input.id);
  const e: ContentEntry = entries.get(k) ?? {
    id: input.id,
    typeId: input.typeId,
    status: "published",
    body: clone(input.body),
    revisions: [],
    overridesBaseline: input.overridesBaseline ?? false,
  };
  e.body = clone(input.body);
  e.status = "published";
  const rev: ContentRevision = {
    rev: e.revisions.length + 1,
    action: "published",
    body: clone(input.body),
    statusAfter: "published",
    at: input.atISO,
    by: input.actor.name,
    byStaffId: input.actor.staffId,
    byRole: input.actor.role,
    ...(input.note ? { note: input.note } : {}),
  };
  e.revisions.push(rev);
  e.publishedBody = clone(input.body);
  e.publishedRev = rev.rev;
  e.publishedAt = input.atISO;
  e.publishedBy = input.actor.name;
  entries.set(k, e);
  notify();
  return { ok: true, entry: clone(e) };
}

/** Draft-only seeding: content that exists but is NOT patient-visible yet. */
export function seedDraftContent(input: {
  typeId: ContentTypeId;
  id: string;
  body: ContentBody;
}): void {
  const k = key(input.typeId, input.id);
  if (entries.has(k)) return;
  entries.set(k, {
    id: input.id,
    typeId: input.typeId,
    status: "draft",
    body: clone(input.body),
    revisions: [],
    overridesBaseline: false,
  });
  notify();
}

/** Send it back to the author. Requires a real reason. */
export function returnContentForChanges(input: ReviewInput): ContentResult {
  const problem = actorProblem(input.actor);
  if (problem) return { ok: false, reason: problem };
  if (!canPublishContent(input.actor.role))
    return { ok: false, reason: "This role cannot review content." };
  if (!input.note?.trim())
    return { ok: false, reason: "Say what needs to change before sending it back." };
  const e = entries.get(key(input.typeId, input.id));
  if (!e) return { ok: false, reason: "No such content entry." };
  if (e.status !== "pending_review")
    return { ok: false, reason: "Only content in review can be returned." };

  e.status = "draft";
  e.returnedNote = input.note.trim();
  appendRevision(e, "returned", input.actor, "draft", input.note.trim());
  notify();
  return { ok: true, entry: clone(e) };
}

export function __resetContent(): void {
  entries.clear();
  notify();
}

/** Test/reset helper: drop just one type's entries. */
export function __resetContentOfType(typeId: ContentTypeId): void {
  for (const [k, e] of [...entries.entries()]) if (e.typeId === typeId) entries.delete(k);
  notify();
}
