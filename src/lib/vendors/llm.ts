// §Faster Adel Brief A4 — SIMULATED LLM adapter. No model is called.
// Template-based: each sentence is built ONLY from the Brief bullets passed in
// (fixed connectors + the bullets' own text), so it can never invent a fact.
// Every sentence lists the bullet ids it came from (scribe provenance pattern).
// Production swaps this adapter for a real vendor under a BAA with Part 2 terms —
// see docs/sculptsoft-adel-handoff.md.
export interface LlmBulletIn {
  id: string;
  text: string;
  sectionTitle: string;
}
export interface LlmSentence {
  text: string;
  sourceIds: string[];
}
export interface LlmAdapter {
  simulated: true;
  summarizeBrief(bullets: LlmBulletIn[]): LlmSentence[];
}
const strip = (t: string) => t.replace(/[.\s]+$/, "");

export const SimulatedLlmAdapter: LlmAdapter = {
  simulated: true,
  summarizeBrief(bullets) {
    const groups: { lead: string; titles: string[] }[] = [
      { lead: "On adherence and engagement", titles: ["Adherence", "Engagement"] },
      { lead: "For this visit", titles: ["Visit focus"] },
      { lead: "Open gaps", titles: ["Care gaps"] },
    ];
    const out: LlmSentence[] = [];
    for (const g of groups) {
      const bs = bullets.filter((b) => g.titles.includes(b.sectionTitle)).slice(0, 2);
      if (!bs.length) continue;
      out.push({ text: `${g.lead}: ${bs.map((b) => strip(b.text)).join("; ")}.`, sourceIds: bs.map((b) => b.id) });
    }
    return out.slice(0, 3);
  },
};
