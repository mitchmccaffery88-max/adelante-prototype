import { createHash } from "node:crypto";
import { withApprovedBrowserTriagePart4Oct31 } from "./browserTriagePart4Oct31Approved";
import fixture from "./browserTriagePart5Oct31.fixture.json";

// Mitch approved 31 Oct 18:25 CT: #20 test-only host navigation return, settings mount wait and
// rendered-ID projection check; original progress_note / consent_form_author assertions unchanged.
const PRIOR_HASH = "d921148ad9d67ae0ea27f17d081a3f39ff225aa8eaab756859de80ba4c726cfc";
const REPLACEMENT_HASH = "4301c3171d582d264631d1082b7dc9681f5995ee7d7fe718481ca244fdd51d64";
export function withApprovedBrowserTriagePart5Oct31(path: string, priorSource: string): string {
  const source = withApprovedBrowserTriagePart4Oct31(path, priorSource);
  if (path !== fixture.path) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== PRIOR_HASH) throw new Error(`Browser triage Part 5 prior source changed: ${path}`);
  if (fixture.prior !== source) throw new Error(`Browser triage Part 5 prior source changed: ${path}`);
  const updated = fixture.replacement;
  if (hash(updated) !== REPLACEMENT_HASH) throw new Error(`Browser triage Part 5 replacement changed: ${path}`);
  return updated;
}
