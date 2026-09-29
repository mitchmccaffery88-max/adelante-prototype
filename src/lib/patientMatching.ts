// §Batch E — one patient matching engine. Every patient-creation path goes
// through `AdelanteEHR.createPatient`, which calls `matchBeforeCreate` /
// `afterCreate` here; the HIE matching queue scores with `scoreIdentity` too.
//
// TDZ note: ehr.ts imports this module and calls it while ehr.ts itself is
// still evaluating (module-load seeds). So module state here lives in `var`
// slots that are lazily initialised, and everything else is a hoisted
// function declaration. Do not add top-level `const` data used by these calls.
import { AdelanteEHR, type Patient } from "./ehr";
import type { StaffRole } from "./roles";

// ------------------------------------------------------------------ types
export type MatchBand = "exact" | "probable" | "possible" | "none";
export type MatchSource =
  | "self_signup"
  | "assisted_signup"
  | "staff_create"
  | "caseload_upload"
  | "referral"
  | "intake"
  | "advocate_self"
  | "hie"
  | "seed";
export type MatchFieldName = "cin" | "name" | "first_name" | "last_name" | "dob" | "phone" | "email" | "address";
export interface MatchField {
  field: MatchFieldName;
  how: "exact" | "nickname" | "fuzzy" | "surname_part" | "transposed" | "near" | "conflict";
}
export interface IdentityInput {
  firstName: string;
  lastName: string;
  dob?: string;
  cin?: string;
  phone?: string;
  email?: string;
  address?: string;
}
export interface PatientMatch {
  patientId: string;
  band: MatchBand;
  score: number;
  fields: MatchField[];
}
export interface MatchActor {
  staffId: string;
  name: string;
  role: StaffRole | string;
}

/** Draft thresholds — pending review by the clinical/data governance owner. */
export function matchThresholdsDraft() {
  return { label: "Draft thresholds — pending review", probable: 70, possible: 45 };
}

export const MATCH_SOURCE_LABEL: Record<MatchSource, string> = {
  self_signup: "Patient sign-up",
  assisted_signup: "Assisted sign-up",
  staff_create: "Staff create",
  caseload_upload: "Caseload upload",
  referral: "Referral",
  intake: "Intake",
  advocate_self: "Advocate's own record",
  hie: "Outside records (HIE)",
  seed: "Demo setup",
};

/** Patient-side sources: never reveal an existing record to an unverified person. */
export function isSelfSource(s: MatchSource): boolean {
  return s === "self_signup" || s === "advocate_self";
}
function isStaffSource(s: MatchSource): boolean {
  return s === "assisted_signup" || s === "staff_create" || s === "caseload_upload" || s === "referral" || s === "intake";
}

/** Staff path, exact match, no "Create anyway" yet. Staff may see the matches. */
export class PossibleExistingPatientError extends Error {
  matches: PatientMatch[];
  constructor(matches: PatientMatch[]) {
    super("This person may already exist.");
    this.name = "PossibleExistingPatientError";
    this.matches = matches;
  }
}
/**
 * Patient self sign-up, exact match. Carries NO details of the other record —
 * the message is identical whether or not a record exists, so nothing is
 * confirmed to an unverified person.
 */
export class SignupNeedsVerificationError extends Error {
  constructor() {
    super("It looks like you may already have an account.");
    this.name = "SignupNeedsVerificationError";
  }
}

// ------------------------------------------------------------- normalizing
function nicknameGroups(): string[][] {
  return [
    ["luis", "lucho", "wicho"],
    ["jose", "pepe", "chepe", "joe"],
    ["francisco", "pancho", "paco", "frank", "cisco"],
    ["guillermo", "memo", "william", "bill", "will", "billy"],
    ["roberto", "beto", "robert", "bob", "rob", "bobby"],
    ["jesus", "chuy", "chucho"],
    ["alejandro", "alex", "alexander", "alejo"],
    ["maria", "mari", "mary"],
    ["guadalupe", "lupe", "lupita"],
    ["rosa", "rosita", "rose"],
    ["daniel", "dani", "dan", "danny"],
    ["antonio", "tony", "tono", "anthony"],
    ["ignacio", "nacho"],
    ["eduardo", "lalo", "eddie", "ed"],
    ["enrique", "kike", "henry"],
    ["margarita", "margie", "marga"],
    ["elizabeth", "liz", "beth", "eliza", "isabel", "chabela"],
    ["michael", "mike", "miguel"],
    ["christopher", "chris", "cristobal"],
    ["james", "jim", "jimmy", "santiago"],
    ["richard", "rick", "ricardo", "ricky"],
    ["thomas", "tom", "tomas", "tommy"],
    ["katherine", "kate", "kathy", "catalina", "cathy"],
    ["manuel", "manny", "manolo"],
    ["dolores", "lola", "lolita"],
    ["concepcion", "concha", "conchita"],
    ["refugio", "cuca", "cuco"],
    ["marcus", "marco", "marcos", "mark"],
    ["carmen", "carmelita"],
    ["jordan", "jordy"],
  ];
}
var NICK: Map<string, number> | undefined;
function nickIndex(): Map<string, number> {
  if (!NICK) {
    NICK = new Map();
    nicknameGroups().forEach((g, i) => g.forEach((n) => NICK!.set(n, i)));
  }
  return NICK;
}

/** Lowercase, strip accents (José → jose, Peña → pena), keep letters, spaces and hyphens. */
export function normalizeName(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** Surname parts: "García-López" / "García López" / "de la Cruz" → significant tokens. */
function surnameParts(s: string): string[] {
  return normalizeName(s)
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !["de", "la", "del", "los", "las", "y"].includes(t));
}
function digits(s: string | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}
function normCin(s: string | undefined): string {
  const v = (s ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return v.length >= 6 ? v : "";
}
function normEmail(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}
function normAddress(s: string | undefined): string {
  return normalizeName((s ?? "").replace(/\d+/g, (d) => ` ${d} `)).replace(/\b(street|st|avenue|ave|road|rd|apt|unit)\b/g, "").replace(/\s+/g, " ").trim();
}
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}

function firstNameHow(a: string, b: string): MatchField["how"] | null {
  const x = normalizeName(a).split(" ")[0] ?? "", y = normalizeName(b).split(" ")[0] ?? "";
  if (!x || !y) return null;
  if (x === y) return "exact";
  const nx = nickIndex().get(x), ny = nickIndex().get(y);
  if (nx !== undefined && nx === ny) return "nickname";
  if (Math.max(x.length, y.length) >= 4 && lev(x, y) <= 1) return "fuzzy";
  return null;
}
function lastNameHow(a: string, b: string): MatchField["how"] | null {
  const x = normalizeName(a), y = normalizeName(b);
  if (!x || !y) return null;
  if (x === y) return "exact";
  const px = surnameParts(a), py = surnameParts(b);
  if (px.some((t) => py.includes(t))) return "surname_part";
  if (Math.max(x.length, y.length) >= 4 && lev(x, y) <= 1) return "fuzzy";
  return null;
}
/** Exact, month/day swapped, adjacent-digit transposition, or ±1 day. */
function dobHow(a: string | undefined, b: string | undefined): MatchField["how"] | null {
  if (!a || !b) return null;
  if (a === b) return "exact";
  const [ya, ma, da] = a.split("-"), [yb, mb, db] = b.split("-");
  if (ya === yb && ma === db && da === mb) return "transposed";
  const sa = digits(a), sb = digits(b);
  if (sa.length === sb.length && sa.length === 8) {
    const diff = [...sa].map((c, i) => (c !== sb[i] ? i : -1)).filter((i) => i >= 0);
    if (diff.length === 2 && diff[1] === diff[0]! + 1 && sa[diff[0]!] === sb[diff[1]!] && sa[diff[1]!] === sb[diff[0]!]) return "transposed";
  }
  const ta = Date.parse(`${a}T12:00:00Z`), tb = Date.parse(`${b}T12:00:00Z`);
  if (Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) <= 86400000) return "near";
  return null;
}

/** Score one identity against another. Pure — no store access. */
export function scoreIdentity(a: IdentityInput, b: IdentityInput): Omit<PatientMatch, "patientId"> {
  const fields: MatchField[] = [];
  const t = matchThresholdsDraft();
  const ca = normCin(a.cin), cb = normCin(b.cin);
  const cinConflict = Boolean(ca && cb && ca !== cb);
  const fn = firstNameHow(a.firstName, b.firstName);
  const ln = lastNameHow(a.lastName, b.lastName);
  const dob = dobHow(a.dob, b.dob);
  // Exact rules.
  if (ca && ca === cb) {
    fields.push({ field: "cin", how: "exact" });
    if (fn) fields.push({ field: "first_name", how: fn });
    if (ln) fields.push({ field: "last_name", how: ln });
    if (dob) fields.push({ field: "dob", how: dob });
    return { band: "exact", score: 100, fields };
  }
  if (!cinConflict && fn === "exact" && ln === "exact" && dob === "exact") {
    return { band: "exact", score: 100, fields: [{ field: "name", how: "exact" }, { field: "dob", how: "exact" }] };
  }
  let score = 0;
  if (fn) { score += fn === "exact" ? 25 : 15; fields.push({ field: "first_name", how: fn }); }
  if (ln) { score += ln === "exact" ? 25 : ln === "surname_part" ? 18 : 15; fields.push({ field: "last_name", how: ln }); }
  if (dob) { score += dob === "exact" ? 30 : 20; fields.push({ field: "dob", how: dob }); }
  const pa = digits(a.phone).slice(-10), pb = digits(b.phone).slice(-10);
  if (pa.length === 10 && pa === pb) { score += 15; fields.push({ field: "phone", how: "exact" }); }
  const ea = normEmail(a.email), eb = normEmail(b.email);
  if (ea && ea === eb) { score += 15; fields.push({ field: "email", how: "exact" }); }
  const aa = normAddress(a.address), ab = normAddress(b.address);
  if (aa.length > 5 && aa === ab) { score += 10; fields.push({ field: "address", how: "exact" }); }
  // Name alone never flags: require at least one non-name signal or a strong name.
  if (!fn && !ln && score < t.possible) return { band: "none", score, fields };
  if (cinConflict) { score -= 40; fields.push({ field: "cin", how: "conflict" }); }
  const band: MatchBand = score >= t.probable ? "probable" : score >= t.possible ? "possible" : "none";
  return { band, score, fields };
}

function identityOf(p: Patient): IdentityInput {
  return { firstName: p.firstName, lastName: p.lastName, dob: p.dob, cin: p.cin, phone: p.phone, email: p.email, address: p.address };
}
const BAND_RANK: Record<MatchBand, number> = { exact: 3, probable: 2, possible: 1, none: 0 };

// ------------------------------------------------------------------ state
export type ReviewKind = "pair" | "signup_attempt";
export type ReviewStatus = "open" | "merged" | "not_same" | "related" | "dismissed";
export interface MatchReview {
  id: string;
  kind: ReviewKind;
  source: MatchSource;
  /** The newly created (flagged) record. Absent for a blocked self sign-up. */
  newPatientId?: string;
  existingPatientId: string;
  /** Blocked self sign-up only: what the person typed (staff-visible only). */
  attempted?: IdentityInput;
  band: MatchBand;
  score: number;
  fields: MatchField[];
  createdAt: string;
  status: ReviewStatus;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
  relationship?: string;
  mergeId?: string;
}
export interface RelatedLink {
  id: string;
  patientIds: [string, string];
  relationship: string;
  by: string;
  at: string;
}
interface MatchState {
  reviews: MatchReview[];
  notSame: Map<string, { reason: string; by: string; at: string }>;
  related: RelatedLink[];
  seq: number;
}
var STATE: MatchState | undefined;
function S(): MatchState {
  if (!STATE) STATE = { reviews: [], notSame: new Map(), related: [], seq: 0 };
  return STATE;
}
function nextId(prefix: string): string {
  return `${prefix}-${++S().seq}-${Math.random().toString(36).slice(2, 6)}`;
}
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
export function isNotSamePair(a: string, b: string): boolean {
  return S().notSame.has(pairKey(a, b));
}

function audit(action: string, patientId: string | undefined, actor: MatchActor | undefined, detail: Record<string, unknown>) {
  AdelanteEHR._appendIdentityAudit({
    action,
    patientId,
    actorId: actor?.staffId ?? "system",
    actorRole: actor?.role ?? "system",
    detail,
  });
}

// ---------------------------------------------------------------- matching
/** Every active (not merged) record that matches, best first. */
export function findPatientMatches(input: IdentityInput, opts: { excludeIds?: string[] } = {}): PatientMatch[] {
  const skip = new Set(opts.excludeIds ?? []);
  const out: PatientMatch[] = [];
  for (const p of AdelanteEHR.listPatients()) {
    if (skip.has(p.id) || p.mergedInto) continue;
    if (opts.excludeIds?.some((x) => isNotSamePair(x, p.id))) continue;
    const r = scoreIdentity(input, identityOf(p));
    if (r.band !== "none") out.push({ patientId: p.id, ...r });
  }
  return out.sort((a, b) => BAND_RANK[b.band] - BAND_RANK[a.band] || b.score - a.score);
}

export interface PreCreateMatch {
  source: MatchSource;
  matches: PatientMatch[];
  best?: PatientMatch;
}

/**
 * Called by `createPatient` BEFORE the record is added. Throws for the two
 * "exact" stops; otherwise returns the matches for `afterCreate`.
 */
export function matchBeforeCreate(
  input: IdentityInput,
  source: MatchSource,
  createAnyway?: { reason: string; actorId?: string; actorRole?: string },
): PreCreateMatch {
  const matches = findPatientMatches(input);
  const best = matches[0];
  if (best?.band === "exact") {
    if (isSelfSource(source)) {
      // Staff review item only; the person sees a neutral message.
      S().reviews.unshift({
        id: nextId("mr"),
        kind: "signup_attempt",
        source,
        existingPatientId: best.patientId,
        attempted: { firstName: input.firstName, lastName: input.lastName, dob: input.dob, phone: input.phone, email: input.email },
        band: best.band,
        score: best.score,
        fields: best.fields,
        createdAt: new Date().toISOString(),
        status: "open",
      });
      audit("patient_signup_matched_existing", best.patientId, undefined, { source, band: best.band, fields: best.fields.map((f) => f.field) });
      AdelanteEHR._emit();
      throw new SignupNeedsVerificationError();
    }
    if (isStaffSource(source)) {
      if (!createAnyway) throw new PossibleExistingPatientError(matches.filter((m) => m.band === "exact"));
      if (!createAnyway.reason?.trim()) throw new Error("A reason is required to create a new record anyway.");
    }
  }
  return { source, matches, best };
}

/** Called by `createPatient` AFTER the record exists: flag + queue Probable/Possible/overridden Exact. */
export function afterCreate(
  p: Patient,
  pre: PreCreateMatch,
  createAnyway?: { reason: string; actorId?: string; actorRole?: string },
): MatchReview | undefined {
  if (createAnyway && pre.best?.band === "exact")
    audit("patient_created_despite_match", p.id, createAnyway.actorId ? { staffId: createAnyway.actorId, name: createAnyway.actorId, role: createAnyway.actorRole ?? "staff" } : undefined, {
      source: pre.source,
      matchedPatientId: pre.best.patientId,
      reason: createAnyway.reason.trim(),
    });
  const best = pre.best;
  if (!best || best.band === "none") return undefined;
  const review: MatchReview = {
    id: nextId("mr"),
    kind: "pair",
    source: pre.source,
    newPatientId: p.id,
    existingPatientId: best.patientId,
    band: best.band,
    score: best.score,
    fields: best.fields,
    createdAt: new Date().toISOString(),
    status: "open",
  };
  S().reviews.unshift(review);
  p.possibleDuplicate = { band: best.band, reviewId: review.id, otherPatientId: best.patientId };
  audit("patient_possible_duplicate_flagged", p.id, undefined, { source: pre.source, band: best.band, reviewId: review.id, fields: best.fields.map((f) => f.field) });
  return review;
}

// ------------------------------------------------------------------ queue
export const MATCH_REVIEW_ROLES: readonly string[] = ["clinical_coordinator", "sys_admin"];
export function canReviewMatches(role: string): boolean {
  return MATCH_REVIEW_ROLES.includes(role);
}
export function listMatchReviews(status: ReviewStatus | "all" = "open"): MatchReview[] {
  return S().reviews.filter((r) => status === "all" || r.status === status);
}
export function getMatchReview(id: string): MatchReview | undefined {
  return S().reviews.find((r) => r.id === id);
}
export function listRelatedLinks(patientId?: string): RelatedLink[] {
  return S().related.filter((l) => !patientId || l.patientIds.includes(patientId));
}
function openReview(id: string): MatchReview {
  const r = getMatchReview(id);
  if (!r || r.status !== "open") throw new Error("Already decided.");
  return r;
}
function clearFlag(r: MatchReview) {
  for (const id of [r.newPatientId, r.existingPatientId]) {
    const p = id ? AdelanteEHR.getPatient(id) : undefined;
    if (p?.possibleDuplicate?.reviewId === r.id) delete p.possibleDuplicate;
  }
}
function requireReviewer(actor: MatchActor) {
  if (!canReviewMatches(actor.role)) throw new Error("Only a clinical coordinator or system admin can decide matches.");
}

/** Not the same person — reason required; the pair is remembered and never flagged again. */
export function markNotSamePerson(reviewId: string, reason: string, actor: MatchActor): MatchReview {
  requireReviewer(actor);
  const r = openReview(reviewId);
  if (!reason.trim()) throw new Error("Please give a reason.");
  if (r.newPatientId) S().notSame.set(pairKey(r.newPatientId, r.existingPatientId), { reason: reason.trim(), by: actor.name, at: new Date().toISOString() });
  r.status = r.kind === "signup_attempt" ? "dismissed" : "not_same";
  r.reason = reason.trim();
  r.decidedAt = new Date().toISOString();
  r.decidedBy = actor.name;
  clearFlag(r);
  audit("patient_match_not_same", r.existingPatientId, actor, { reviewId, otherPatientId: r.newPatientId, reason: r.reason });
  AdelanteEHR._emit();
  return r;
}

/** Link as related (e.g. family). Not a merge; records stay separate. */
export function linkAsRelated(reviewId: string, relationship: string, actor: MatchActor): RelatedLink {
  requireReviewer(actor);
  const r = openReview(reviewId);
  if (!r.newPatientId) throw new Error("A sign-up attempt has no second record to link.");
  if (!relationship.trim()) throw new Error("Say how they are related (for example, family).");
  const link: RelatedLink = { id: nextId("rel"), patientIds: [r.newPatientId, r.existingPatientId], relationship: relationship.trim(), by: actor.name, at: new Date().toISOString() };
  S().related.push(link);
  S().notSame.set(pairKey(r.newPatientId, r.existingPatientId), { reason: `Related: ${link.relationship}`, by: actor.name, at: link.at });
  r.status = "related";
  r.relationship = link.relationship;
  r.decidedAt = link.at;
  r.decidedBy = actor.name;
  clearFlag(r);
  audit("patient_match_linked_related", r.existingPatientId, actor, { reviewId, otherPatientId: r.newPatientId, relationship: link.relationship });
  AdelanteEHR._emit();
  return link;
}

/** Called by the merge code when a review pair is merged. */
export function _closeReviewsForMerge(survivorId: string, otherId: string, mergeId: string, actor: MatchActor) {
  for (const r of S().reviews) {
    if (r.status !== "open") continue;
    const ids = [r.newPatientId, r.existingPatientId];
    if (ids.includes(survivorId) && ids.includes(otherId)) {
      r.status = "merged";
      r.mergeId = mergeId;
      r.decidedAt = new Date().toISOString();
      r.decidedBy = actor.name;
      clearFlag(r);
    }
  }
}
/** Unmerge re-opens the pair as a review so someone decides again. */
export function _reopenReviewAfterUnmerge(mergeId: string) {
  for (const r of S().reviews) if (r.mergeId === mergeId) { r.status = "open"; delete r.mergeId; }
}

export function _resetPatientMatchingForTests() {
  STATE = undefined;
}
