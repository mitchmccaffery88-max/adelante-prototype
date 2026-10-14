// "Who it's for" — dependency-free so content modules can import it without
// pulling the patient store. The person side (`personAudiences`) is in population.ts.
import type { PopulationResolution } from "./population";

// "Who it's for" — ONE content audience field, any-match.
// Everyone on this platform has already been released: no patient content
// branches on before vs. after release. Draft — pending clinical sign-off.
// ---------------------------------------------------------------------------
export type ContentAudience = "justice_involved" | "sud" | "advocate";
export const CONTENT_AUDIENCES: { id: ContentAudience; label: string }[] = [
  { id: "justice_involved", label: "Justice-involved" },
  { id: "sud", label: "Substance use" },
  { id: "advocate", label: "Advocate" },
];
const AUDIENCE_IDS = new Set<string>(CONTENT_AUDIENCES.map((a) => a.id));

/**
 * An item's audiences. Reads `audiences`; an older stored body that still
 * carries the retired `populations` (pre/post-release tracks) or the journey
 * `justiceInvolved` switch is converted here, on read. `meta.populations` is a
 * retired label and is never a gate.
 */
export function audiencesOf(item: unknown): ContentAudience[] {
  const b = (item ?? {}) as { audiences?: unknown; populations?: unknown; justiceInvolved?: unknown };
  if (Array.isArray(b.audiences)) return b.audiences.filter((a): a is ContentAudience => AUDIENCE_IDS.has(String(a)));
  const legacy = Array.isArray(b.populations) ? (b.populations as string[]) : [];
  return legacy.includes("pre_release_ji") || legacy.includes("post_release_ji") || b.justiceInvolved === true
    ? ["justice_involved"]
    : [];
}

/** Any-match: no audiences means everyone; otherwise one shared audience is enough. */
export function audienceVisible(item: unknown, person: readonly ContentAudience[]): boolean {
  const want = audiencesOf(item);
  return want.length === 0 || want.some((a) => person.includes(a));
}


/** Audiences implied by a resolution alone (justice only; no SUD without a record). */
export function audiencesForResolution(r: PopulationResolution): ContentAudience[] {
  if (r.audiences) return r.audiences;
  if (r.track === "advocate") return ["advocate"];
  return (r.track === "pre_release_ji" || r.track === "post_release_ji") && !r.provisional ? ["justice_involved"] : [];
}

