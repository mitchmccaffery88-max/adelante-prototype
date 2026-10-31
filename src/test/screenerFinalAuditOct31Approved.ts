import { createHash } from "node:crypto";
// R5 round 3, Mitch approved 30 Oct. Draft — pending clinical sign-off.
const APPROVED = {
  "src/routes/clinician.tsx": {
    "prior": "f7b04f574178b1cb07388023a9de3c76a7ad7bd92f5eb3d1062a1370f73b0653",
    "updated": "502af6d266dab0851c935f36785e1f77e95ea96130da857809ad0e8d23e5f32b",
    "pairs": [
      [
        "          const latest = hist[hist.length - 1];\n          const prev = hist[hist.length - 2];",
        "          // Draft \u2014 pending clinical sign-off: newest incomplete submission is not an older score.\n          const incomplete = [...(fullPatient?.incompleteScreeners ?? [])]\n            .filter((h) => h.key === r.key).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];\n          const scoredLatest = hist[hist.length - 1];\n          const currentIncomplete = incomplete && (!scoredLatest || incomplete.completedAt >= scoredLatest.completedAt) ? incomplete : undefined;\n          const latest = currentIncomplete ? undefined : scoredLatest;\n          const prev = currentIncomplete ? undefined : hist[hist.length - 2];"
      ],
      [
        "                \u00b7 {r.key.toUpperCase()}\n                {latest && (",
        "                \u00b7 {r.key.toUpperCase()}\n                {currentIncomplete && <span className=\"text-xs text-muted-foreground\">\u00b7 Incomplete \u00b7 {currentIncomplete.answeredCount} of {currentIncomplete.shownCount} answered</span>}\n                {latest && ("
      ]
    ]
  },
  "src/components/clinical/RecordTabs.tsx": {
    "prior": "1522bab9526b42048e29b51fb711142a3fd1ff053e74641704aeaa3865e98ffe",
    "updated": "592544385ad93657a24f26557704849a750815929ee4961fa36b53d152e43716",
    "pairs": [
      [
        "(!screenerByKey(h.key)?.isSud || seesSud)",
        "(!screenerByKey(h.key)?.isSud || (seesSud && !sudGate.locked))"
      ],
      [
        "incomplete.filter((h) => !screenerByKey(h.key)?.isSud || seesSud)",
        "incomplete.filter((h) => !screenerByKey(h.key)?.isSud || (seesSud && !sudGate.locked))"
      ]
    ]
  }
} as Record<string, { prior: string; updated: string; pairs: [string, string][] }>;
export function withApprovedScreenerFinalAuditOct31(path: string, source: string): string {
  const entry = APPROVED[path]; if (!entry) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== entry.prior) throw new Error(`R5 final audit prior source changed: ${path}`);
  let updated = source;
  for (const [from, to] of entry.pairs) {
    if (updated.split(from).length !== 2) throw new Error(`R5 final audit anchor not exactly once: ${path}`);
    updated = updated.replace(from, () => to);
  }
  if (hash(updated) !== entry.updated) throw new Error(`R5 final audit replacement changed: ${path}`);
  return updated;
}
