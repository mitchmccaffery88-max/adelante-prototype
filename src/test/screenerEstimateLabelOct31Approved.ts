import { createHash } from "node:crypto";
// Mitch approved 31 Oct, 14:40 CT: presentation-only EN/ES estimate pluralization.
// Spanish Draft — pending translation/clinical sign-off. No scoring/access changes.
const PATH = "src/lib/screenerCompleteness.ts";
const APPROVED = {
  "prior": "fb9b986215fb588c26fc50690bfc5759c29555a65313bafff281edf230207e46",
  "updated": "0098cd47498d205ed90c54c5ebdffd8055365626d5ea69d9919bccddef163a59",
  "anchor": "export function estimateLabel(r: { estimated?: boolean; missingItems?: number[] }): string {\n  return r.estimated ? `Estimated (${r.missingItems?.length ?? 0} items missing)` : \"\";\n}",
  "replacement": "/** Presentation only; Spanish is Draft — pending translation/clinical sign-off. */\nexport function estimateLabel(r: { estimated?: boolean; missingItems?: number[] }, language: \"en\" | \"es\" = \"en\"): string {\n  if (!r.estimated) return \"\";\n  const missing = r.missingItems?.length ?? 0;\n  if (language === \"es\") return `Estimado (${missing} ${missing === 1 ? \"ítem faltante\" : \"ítems faltantes\"})`;\n  return `Estimated (${missing} ${missing === 1 ? \"item\" : \"items\"} missing)`;\n}"
};
export function withApprovedScreenerEstimateLabelOct31(path: string, source: string): string {
  if (path !== PATH) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== APPROVED.prior) throw new Error(`Estimate label prior source changed: ${path}`);
  if (source.split(APPROVED.anchor).length !== 2) throw new Error(`Estimate label anchor not exactly once: ${path}`);
  const updated = source.replace(APPROVED.anchor, () => APPROVED.replacement);
  if (hash(updated) !== APPROVED.updated) throw new Error(`Estimate label replacement changed: ${path}`);
  return updated;
}
