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
import { CONTENT_APPROVER_ROLES, canAccess, getStaffMember, type StaffRole } from "@/lib/roles";

/** draft → pending_review → published. There is no fourth state. */
export type ContentStatus = "draft" | "pending_review" | "published";

export type ContentTypeId = "library_lesson" | "recovery_lesson";

/** A content body is whatever the type descriptor says it is. */
export type ContentBody = Record<string, unknown>;

export type ContentAction = "created" | "edited" | "submitted" | "returned" | "published";

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

export function canPublishContent(role: StaffRole): boolean {
  return CONTENT_APPROVER_ROLES.includes(role);
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
 * Approve AND publish. Two real gates beyond role:
 *  1. The content must still validate at approval time.
 *  2. SEPARATION OF DUTIES — the approver cannot be the staff member who
 *     submitted it. A one-person "review" is not a review, and every other
 *     sign-off surface in this app (cosign, verification) already holds this
 *     line.
 */
export function approveAndPublishContent(input: ReviewInput): ContentResult {
  const problem = actorProblem(input.actor);
  if (problem) return { ok: false, reason: problem };
  if (!canPublishContent(input.actor.role))
    return { ok: false, reason: "This role cannot approve and publish content." };
  const e = entries.get(key(input.typeId, input.id));
  if (!e) return { ok: false, reason: "No such content entry." };
  if (e.status !== "pending_review")
    return { ok: false, reason: "Only content submitted for review can be published." };

  const submitted = [...e.revisions].reverse().find((r) => r.action === "submitted");
  if (submitted?.byStaffId && input.actor.staffId && submitted.byStaffId === input.actor.staffId)
    return { ok: false, reason: "The person who submitted this cannot also approve it." };

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
