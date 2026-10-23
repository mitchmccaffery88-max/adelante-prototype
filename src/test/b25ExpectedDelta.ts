// §B2-5 expected-delta adapter. Applies ONLY transforms i–iv (Mitch, Oct 23)
// from src/lib/__tests__/fixtures/b25-expected-delta.json to the IMMUTABLE
// rollback baselines (0089ca4f / 5c335b7e). Every entry is validated before
// it is applied: a widening, an unexpected patient, a stale `before` value or
// an unlisted transform throws. Everything not listed is compared in full.
type Path = (string | number)[];
export interface DeltaEntry {
  transform: "i" | "ii" | "iii" | "iv";
  patient: string;
  path: Path;
  op: "set" | "delete" | "remove";
  before: unknown;
  after: unknown;
  events?: string[];
}

/** Mitch's decision 1 + unproven-record decision: these narrow. */
export const NARROWED = ["Daniel M.", "Alicia Serrano", "Alicia R.", "Marcus Whitfield", "Lucía Moreno"];
/** Same access, now cited from a signed typed record. */
export const RECAPTURED = ["Marcus L.", "Luis Camacho", "Jasmine Holt", "Fictional QA billing patient #7"];
/** consentParityB2-1.json identifiers for the seven flag-only patients. That
 * fixture keys generated seed ids by listPatients index: #10 = Luis Camacho,
 * #11 = Jasmine Holt. In that isolated store test the action registry is
 * never loaded, so the B2-5 re-captures do not run and all seven narrow. */
export const NARROWED_B21 = ["p3", "p4", "p-demo-refusal", "p-demo-mar-seed", "p-demo-mar-seed-es", "#10", "#11"];

const LEVEL = { none: 0, read: 1, write: 2 } as Record<string, number>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function bitsNarrow(b: string, a: string) {
  return b.length === a.length && b !== a && [...a].every((c, i) => c === "0" || b[i] === "1");
}
function roleNarrow(b: string, a: string) {
  const [rb, lb, bb] = b.split(":"), [ra, la, ba] = a.split(":");
  if (rb !== ra) return false;
  const lev = (l: string) => LEVEL[l.replace(/L$/, "")];
  if (lev(la) > lev(lb)) return false;
  if (lb.endsWith("L") && !la.endsWith("L")) return false;
  return bb === ba ? b !== a : bitsNarrow(bb, ba);
}

export function validateEntry(e: DeltaEntry): void {
  const bad = (why: string) => { throw new Error(`B2-5 delta STOP (${why}): ${e.patient} ${e.path.join(".")}`); };
  const b = e.before, a = e.after;
  switch (e.transform) {
    case "i":
      if (!NARROWED.includes(e.patient)) bad("narrowing for an unlisted patient");
      if (e.op !== "set") bad("i is a value change");
      if (b === true && a === false) return;
      if (typeof b === "string" && typeof a === "string" && (/^[01]+$/.test(b) ? bitsNarrow(b, a) : roleNarrow(b, a))) return;
      return bad("not true→false");
    case "ii":
      if (!NARROWED.includes(e.patient)) bad("denial for an unlisted patient");
      if (e.op === "remove") { if (!isRec(b)) bad("remove needs the entry"); return; }
      if (e.op === "delete") { if (e.path[e.path.length - 1] !== "consentRecordId") bad("only dependent links are removed"); return; }
      if (typeof b === "string" && typeof a === "string" && !b.startsWith("no:") && a.startsWith("no:")) return;
      if (isRec(b) && isRec(a) && b.ok === true && a.ok === false && typeof a.reason === "string") return;
      if (isRec(b) && isRec(a) && b.action === "part2_disclosure" && a.action === "part2_disclosure_blocked") return;
      if (e.path[e.path.length - 1] === "active" && typeof b === "string" && a === null) return;
      return bad("not a denial-derived consequence");
    case "iii":
      if (!RECAPTURED.includes(e.patient)) bad("provenance for an unlisted patient");
      if (e.op !== "set" || b !== "Consent on file (legacy flag)" || typeof a !== "string" || !/^Consent record b25new\d\d$/.test(a)) bad("not a truthful provenance replacement");
      return;
    case "iv":
      if (e.path.join(".") !== "consentAuditCount" || typeof b !== "number" || typeof a !== "number" || !e.events || a - b !== e.events.length) bad("audit count must equal the itemized events");
      return;
    default:
      bad("unlisted transform");
  }
}

function parentOf(root: unknown, path: Path): [Record<string | number, unknown>, string | number] {
  let cur = root as Record<string | number, unknown>;
  for (const k of path.slice(0, -1)) cur = cur[k] as Record<string | number, unknown>;
  return [cur, path[path.length - 1]];
}

export function applyDelta<T>(baseline: T, entries: DeltaEntry[]): T {
  const out = JSON.parse(JSON.stringify(baseline)) as T;
  for (const e of entries) {
    validateEntry(e);
    const [p, k] = parentOf(out, e.path);
    if (!same(p[k], e.before)) throw new Error(`B2-5 delta STOP (baseline mismatch): ${e.path.join(".")}`);
  }
  for (const e of entries.filter((x) => x.op !== "remove")) {
    const [p, k] = parentOf(out, e.path);
    if (e.op === "delete") delete p[k]; else p[k] = e.after;
  }
  const removes = entries.filter((x) => x.op === "remove").sort((x, y) => (y.path[y.path.length - 1] as number) - (x.path[x.path.length - 1] as number));
  for (const e of removes) {
    const [p, k] = parentOf(out, e.path);
    (p as unknown as unknown[]).splice(k as number, 1);
  }
  return out;
}
