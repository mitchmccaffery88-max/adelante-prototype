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

// §Adel chat persistence — SIMULATED memory adapter. No model is called.
// Topic → neutral title / recall line / share summary, from fixed templates
// over the patient's OWN words. Summaries carry topics only, never quotes.
interface AdelTopic { id: string; re: RegExp; en: string; es: string; recallEn: string; recallEs: string }
const ADEL_TOPICS: AdelTopic[] = [
  { id: "bus_pass", re: /\bbus pass|pase de autob[uú]s|bus\b/i, en: "Getting to appointments", es: "Cómo llegar a las citas", recallEn: "the bus pass", recallEs: "el pase de autobús" },
  { id: "ride", re: /\bride|transport|car\b|rait|transporte/i, en: "Getting to appointments", es: "Cómo llegar a las citas", recallEn: "getting a ride", recallEs: "conseguir transporte" },
  { id: "housing", re: /\bhous|rent|shelter|place to stay|vivienda|renta|albergue/i, en: "Finding a place to stay", es: "Encontrar dónde quedarse", recallEn: "finding housing", recallEs: "encontrar vivienda" },
  { id: "work", re: /\bjob|work|interview|trabajo|empleo/i, en: "Work and jobs", es: "Trabajo", recallEn: "the job search", recallEs: "buscar trabajo" },
  { id: "appointment", re: /\bappointment|visit|doctor|cita|consulta/i, en: "Upcoming appointments", es: "Próximas citas", recallEn: "your appointment", recallEs: "tu cita" },
  { id: "meds", re: /\bmedication|meds|refill|pharmacy|medicina|farmacia/i, en: "Medications", es: "Medicamentos", recallEn: "your medication", recallEs: "tu medicamento" },
  { id: "sleep", re: /\bsleep|insomnia|tired|dormir|sueño|cansad/i, en: "Sleep", es: "Dormir", recallEn: "your sleep", recallEs: "cómo duermes" },
  { id: "stress", re: /\bstress|anxious|worried|overwhelm|estr[eé]s|ansios|preocupad/i, en: "Handling stress", es: "Manejar el estrés", recallEn: "feeling stressed", recallEs: "sentirte estresado" },
  { id: "family", re: /\bfamily|kids|mom|dad|familia|hijos|mam[aá]|pap[aá]/i, en: "Family", es: "Familia", recallEn: "your family", recallEs: "tu familia" },
  { id: "recovery", re: /\brecovery|sober|drink|using|meeting|craving|recuperaci[oó]n|sobrio|antojo/i, en: "Recovery support", es: "Apoyo en la recuperación", recallEn: "your recovery", recallEs: "tu recuperación" },
  { id: "food", re: /\bfood|groceries|calfresh|hungry|comida|hambre/i, en: "Food and groceries", es: "Comida", recallEn: "getting food", recallEs: "conseguir comida" },
];
const topicById = (id: string) => ADEL_TOPICS.find((t) => t.id === id);

export const SimulatedAdelMemoryAdapter = {
  simulated: true as const,
  topics(userTexts: string[]): string[] {
    const out: string[] = [];
    for (const text of userTexts) for (const t of ADEL_TOPICS) if (t.re.test(text) && !out.includes(t.id)) out.push(t.id);
    return out;
  },
  title(topics: string[]): { en: string; es: string } {
    const t = topics[0] ? topicById(topics[0]) : undefined;
    return t ? { en: t.en, es: t.es } : { en: "Checking in", es: "Conversación general" };
  },
  recall(topicId: string, when: string, now: Date, lang: "en" | "es"): string | undefined {
    const t = topicById(topicId);
    if (!t) return undefined;
    const days = Math.max(0, Math.round((now.getTime() - new Date(when).getTime()) / 86_400_000));
    if (lang === "es") {
      const ago = days >= 6 ? "La semana pasada" : days >= 1 ? "La última vez" : "Hace un rato";
      return `Hola de nuevo. ${ago} mencionaste ${t.recallEs} — ¿cómo te fue?`;
    }
    const ago = days >= 6 ? "Last week" : days >= 1 ? "Last time" : "Earlier";
    return `Welcome back. ${ago} you mentioned ${t.recallEn} — did that work out?`;
  },
  /** Staff-facing share summary: topics only, no quotes, Simulated label. */
  summary(topics: string[], startedAt: string): string {
    const names = [...new Set(topics.map((id) => topicById(id)?.en).filter(Boolean))] as string[];
    const date = startedAt.slice(0, 10);
    return `Shared from Adel (summary, Simulated) — chat on ${date}. Topics: ${names.length ? names.join("; ") : "general check-in"}. The patient chose to share this summary; the chat itself stays private.`;
  },
};
