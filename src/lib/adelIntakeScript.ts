// §Adel-guided intake (prototype, demo slice) — the scripted question list.
//
// NO model call. Every question, and every allowed answer, mirrors the intake
// form's "About you" and benefits steps. Typed answers are matched to those
// allowed answers deterministically; anything unclear is re-asked. Nothing is
// applied to the draft until the patient confirms it (the component enforces
// that; this module only parses and applies).
//
// Spanish is a first pass, pending bilingual review.
import { CIN_RE, normalizeCinValue } from "@/lib/ehr";
import { blankIntakeProfile, type IntakeProfile } from "@/lib/intakeProfile";
import { BENEFITS_CHOICES, isMediCalChoice, type BenefitsFormState } from "@/lib/intakeBenefits";
import { benefitsEn, benefitsEs } from "@/lib/i18n.benefits";

export type AdelLang = "en" | "es";
export interface AdelIntakeState {
  profile: IntakeProfile;
  benefits: BenefitsFormState;
}
export interface AdelChoice {
  value: string;
  label: string;
  /** Extra words a typed answer may use. Lower-case. */
  words?: string[];
}
export interface AdelQuestion {
  id: string;
  group: "profile" | "benefits";
  kind: "choice" | "text";
  optional?: boolean;
  prompt: Record<AdelLang, string>;
  choices?: (lang: AdelLang, plans: { id: string; name: string; kind: string }[]) => AdelChoice[];
  show?: (s: AdelIntakeState) => boolean;
  get: (s: AdelIntakeState) => string;
  /** Value on file counts as "what we have" only when it differs from blank. */
  blank?: string;
  set: (s: AdelIntakeState, v: string) => AdelIntakeState;
  validate?: (v: string) => keyof typeof ADEL_COPY.en | undefined;
}

export const ADEL_COPY = {
  en: {
    banner: "Prototype · guided questions, not AI-generated",
    bannerDetail:
      "Adel follows a fixed script with the same questions as the form. Nothing is saved until you confirm it.",
    pending: "",
    intro:
      "Hi, I'm Adel. I'll ask a few questions about you and how your care gets paid for, one at a time. You can tap an answer or type it.",
    weHave: "Here's what we have: {v}. Is that still right?",
    youSaid: "You said: {v}. Is that right?",
    yes: "Yes, that's right",
    change: "No, change it",
    skip: "Skip this",
    skipped: "Okay, we'll skip that one.",
    didntCatch: "I didn't quite catch that. You can tap one of these:",
    saved: "Saved.",
    cinInvalid: "A Medi-Cal ID is 9 letters or numbers. Try again, or skip it.",
    handoff:
      "Thanks — I've saved those answers. The next part is your consent. That's your decision to make yourself, so it's on the regular form, not with me. Tap below to go there.",
    handoffNoConsent:
      "Thanks — I've saved those answers. Your consent is already on file, so you'll continue on the regular form from here.",
    toForm: "Continue on the form",
    backToForm: "Use the form instead",
    placeholder: "Type your answer…",
    send: "Send",
    getHelp: "I need help now",
  },
  es: {
    banner: "Prototipo · preguntas guiadas, no generadas por IA",
    bannerDetail:
      "Adel sigue un guion fijo con las mismas preguntas del formulario. Nada se guarda hasta que usted lo confirme.",
    pending: "Traducción pendiente de revisión bilingüe",
    intro:
      "Hola, soy Adel. Le haré algunas preguntas sobre usted y cómo se paga su atención, una a la vez. Puede tocar una respuesta o escribirla.",
    weHave: "Esto es lo que tenemos: {v}. ¿Sigue siendo correcto?",
    youSaid: "Usted dijo: {v}. ¿Es correcto?",
    yes: "Sí, es correcto",
    change: "No, cambiarlo",
    skip: "Omitir",
    skipped: "Está bien, omitimos esa.",
    didntCatch: "No entendí bien. Puede tocar una de estas opciones:",
    saved: "Guardado.",
    cinInvalid: "El número de Medi-Cal tiene 9 letras o números. Intente de nuevo u omítalo.",
    handoff:
      "Gracias, guardé esas respuestas. Lo siguiente es su consentimiento. Esa decisión es solo suya, así que se hace en el formulario normal, no conmigo. Toque abajo para ir allí.",
    handoffNoConsent:
      "Gracias, guardé esas respuestas. Su consentimiento ya está registrado, así que continuará en el formulario normal.",
    toForm: "Continuar en el formulario",
    backToForm: "Usar el formulario",
    placeholder: "Escriba su respuesta…",
    send: "Enviar",
    getHelp: "Necesito ayuda ahora",
  },
} as const;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const P = (s: AdelIntakeState, patch: Partial<IntakeProfile>): AdelIntakeState => ({
  ...s,
  profile: { ...s.profile, ...patch },
});
const B = (s: AdelIntakeState, patch: Partial<BenefitsFormState>): AdelIntakeState => ({
  ...s,
  benefits: { ...s.benefits, ...patch },
});
const blank = blankIntakeProfile();

function ben(lang: AdelLang, k: keyof typeof benefitsEn): string {
  const es = benefitsEs as Record<string, string>;
  return lang === "es" ? (es[k] ?? benefitsEn[k]) : benefitsEn[k];
}

export const ADEL_QUESTIONS: AdelQuestion[] = [
  {
    id: "preferredLanguage",
    group: "profile",
    kind: "choice",
    prompt: {
      en: "What language should we use with you?",
      es: "¿En qué idioma debemos hablarle?",
    },
    choices: () => [
      { value: "en", label: "English", words: ["ingles", "english"] },
      { value: "es", label: "Español", words: ["spanish", "espanol"] },
    ],
    get: (s) => s.profile.preferredLanguage,
    blank: "__always_ask__",
    set: (s, v) => P(s, { preferredLanguage: v as IntakeProfile["preferredLanguage"] }),
  },
  {
    id: "preferredName",
    group: "profile",
    kind: "text",
    optional: true,
    prompt: { en: "What should we call you?", es: "¿Cómo le gustaría que le llamemos?" },
    get: (s) => s.profile.preferredName,
    set: (s, v) => P(s, { preferredName: v }),
  },
  {
    id: "pronouns",
    group: "profile",
    kind: "text",
    optional: true,
    prompt: {
      en: "What pronouns do you use? (she/her, he/him, they/them…) You can skip this.",
      es: "¿Qué pronombres usa? (ella, él, elle…) Puede omitir esta pregunta.",
    },
    get: (s) => s.profile.pronouns,
    set: (s, v) => P(s, { pronouns: v }),
  },
  {
    id: "phone",
    group: "profile",
    kind: "text",
    optional: true,
    prompt: { en: "What's the best phone number for you?", es: "¿Cuál es el mejor número de teléfono para usted?" },
    get: (s) => s.profile.phone,
    set: (s, v) => P(s, { phone: v }),
  },
  {
    id: "contactChannel",
    group: "profile",
    kind: "choice",
    prompt: { en: "What's the best way to reach you?", es: "¿Cuál es la mejor manera de comunicarnos con usted?" },
    choices: (lang) => [
      { value: "text", label: lang === "es" ? "Mensaje de texto" : "Text", words: ["text", "texto", "sms", "mensaje"] },
      { value: "call", label: lang === "es" ? "Llamada" : "Phone call", words: ["call", "phone", "llamada", "llamar"] },
      { value: "video", label: "Video", words: ["video"] },
    ],
    get: (s) => s.profile.contactChannel,
    blank: blank.contactChannel,
    set: (s, v) => P(s, { contactChannel: v as IntakeProfile["contactChannel"] }),
  },
  {
    id: "bestTime",
    group: "profile",
    kind: "choice",
    prompt: { en: "What time of day is best?", es: "¿Qué hora del día es mejor?" },
    choices: (lang) => [
      { value: "morning", label: lang === "es" ? "Mañana" : "Morning", words: ["morning", "manana", "am"] },
      { value: "afternoon", label: lang === "es" ? "Tarde" : "Afternoon", words: ["afternoon", "tarde"] },
      { value: "evening", label: lang === "es" ? "Noche" : "Evening", words: ["evening", "night", "noche"] },
    ],
    get: (s) => s.profile.bestTime,
    blank: blank.bestTime,
    set: (s, v) => P(s, { bestTime: v as IntakeProfile["bestTime"] }),
  },
  {
    id: "address",
    group: "profile",
    kind: "text",
    optional: true,
    prompt: {
      en: "What's a mailing or temporary address for you? You can skip this.",
      es: "¿Cuál es su dirección postal o temporal? Puede omitir esta pregunta.",
    },
    get: (s) => s.profile.address,
    set: (s, v) => P(s, { address: v }),
  },
  {
    id: "ecName",
    group: "profile",
    kind: "text",
    optional: true,
    prompt: {
      en: "Who should we contact in an emergency? Just their name for now.",
      es: "¿A quién debemos llamar en una emergencia? Por ahora, solo el nombre.",
    },
    get: (s) => s.profile.emergencyContacts[0]?.name ?? "",
    set: (s, v) =>
      P(s, {
        emergencyContacts: s.profile.emergencyContacts.map((c, i) => (i === 0 ? { ...c, name: v } : c)),
      }),
  },
  {
    id: "ecPhone",
    group: "profile",
    kind: "text",
    optional: true,
    show: (s) => Boolean(s.profile.emergencyContacts[0]?.name?.trim()),
    prompt: { en: "What's their phone number?", es: "¿Cuál es su número de teléfono?" },
    get: (s) => s.profile.emergencyContacts[0]?.phone ?? "",
    set: (s, v) =>
      P(s, {
        emergencyContacts: s.profile.emergencyContacts.map((c, i) => (i === 0 ? { ...c, phone: v } : c)),
      }),
  },
  {
    id: "benefitsChoice",
    group: "benefits",
    kind: "choice",
    optional: true,
    prompt: {
      en: "Now, how your care gets paid for. What kind of coverage do you have?",
      es: "Ahora, cómo se paga su atención. ¿Qué tipo de cobertura tiene?",
    },
    choices: (lang) =>
      BENEFITS_CHOICES.map((c) => ({
        value: c,
        label: ben(lang, `benChoice_${c}` as keyof typeof benefitsEn),
        words: (
          {
            medi_cal: ["medi cal", "medical", "medicaid"],
            dual: ["both", "ambos", "medi cal and medicare", "medical and medicare"],
            medicare: ["medicare"],
            private_insurance: ["private", "privado", "work", "trabajo", "insurance through"],
            no_insurance: ["no insurance", "none", "sin seguro", "ninguno", "nothing"],
            prefer_self_pay: ["self pay", "pay myself", "pagar yo"],
            other: ["other", "something else", "otro"],
            unknown: ["dont know", "not sure", "no se", "unsure"],
          } as Record<string, string[]>
        )[c],
      })),
    get: (s) => s.benefits.choice,
    set: (s, v) => B(s, { choice: v as BenefitsFormState["choice"] }),
  },
  {
    id: "cin",
    group: "benefits",
    kind: "text",
    optional: true,
    show: (s) => isMediCalChoice(s.benefits.choice),
    prompt: {
      en: "Do you have your Medi-Cal ID (CIN)? It's 9 letters or numbers on the card. You can skip this.",
      es: "¿Tiene su número de Medi-Cal (CIN)? Son 9 letras o números en la tarjeta. Puede omitir esta pregunta.",
    },
    get: (s) => s.benefits.cin,
    set: (s, v) => B(s, { cin: normalizeCinValue(v) }),
    validate: (v) => (CIN_RE.test(normalizeCinValue(v)) ? undefined : "cinInvalid"),
  },
  {
    id: "planId",
    group: "benefits",
    kind: "choice",
    optional: true,
    show: (s) => isMediCalChoice(s.benefits.choice),
    prompt: { en: "Which Medi-Cal plan are you in?", es: "¿En qué plan de Medi-Cal está?" },
    choices: (lang, plans) =>
      plans.map((p) => ({
        value: p.id,
        label: p.kind === "unknown" ? ben(lang, "benChoice_unknown") : p.name,
        words: p.kind === "unknown" ? ["dont know", "not sure", "no se"] : p.kind === "ffs" ? ["no plan", "ffs"] : [],
      })),
    get: (s) => s.benefits.planId,
    set: (s, v) => B(s, { planId: v }),
  },
  {
    id: "mediCalStatus",
    group: "benefits",
    kind: "choice",
    show: (s) => isMediCalChoice(s.benefits.choice),
    prompt: { en: "Is your Medi-Cal active right now?", es: "¿Su Medi-Cal está activo ahora?" },
    choices: (lang) => [
      { value: "active", label: ben(lang, "benStatus_active"), words: ["yes", "si", "active", "activo"] },
      { value: "suspended", label: ben(lang, "benStatus_suspended"), words: ["paused", "suspended", "pausado", "suspendido"] },
      { value: "none_unsure", label: ben(lang, "benStatus_none_unsure"), words: ["no", "not sure", "no se"] },
    ],
    get: (s) => s.benefits.mediCalStatus,
    blank: "__always_ask__",
    set: (s, v) => B(s, { mediCalStatus: v as BenefitsFormState["mediCalStatus"] }),
  },
  {
    id: "planName",
    group: "benefits",
    kind: "text",
    optional: true,
    show: (s) => s.benefits.choice === "private_insurance" || s.benefits.choice === "medicare",
    prompt: {
      en: "What's the insurance company or plan name? You can skip this.",
      es: "¿Cuál es el nombre de la aseguradora o del plan? Puede omitir esta pregunta.",
    },
    get: (s) => s.benefits.planName,
    set: (s, v) => B(s, { planName: v }),
  },
];

/** Does the draft already hold a real value for this question? */
export function hasKnownValue(q: AdelQuestion, s: AdelIntakeState): boolean {
  if (q.blank === "__always_ask__") return false;
  const v = q.get(s);
  return Boolean(v && v.trim()) && v !== (q.blank ?? "");
}

/** Next question index at or after `from` that applies. -1 when done. */
export function nextQuestionIndex(s: AdelIntakeState, from: number): number {
  for (let i = from; i < ADEL_QUESTIONS.length; i++) {
    const q = ADEL_QUESTIONS[i];
    if (!q.show || q.show(s)) return i;
  }
  return -1;
}

/**
 * Deterministic match of typed text to an allowed choice. Returns undefined
 * when there is no single clear match — the caller re-asks.
 */
export function matchChoice(text: string, choices: AdelChoice[]): string | undefined {
  const t = norm(text);
  if (!t) return undefined;
  const exact = choices.find((c) => norm(c.label) === t || norm(c.value) === t);
  if (exact) return exact.value;
  const hits = choices.filter((c) =>
    [c.label, ...(c.words ?? [])].some((w) => {
      const n = norm(w);
      return n.length > 1 && (` ${t} `.includes(` ${n} `) || t === n);
    }),
  );
  if (hits.length === 1) return hits[0].value;
  // "medi-cal and medicare" contains both "medi cal" and "medicare" — prefer
  // the choice whose own words matched the longest phrase.
  if (hits.length > 1) {
    const score = (c: AdelChoice) =>
      Math.max(...[c.label, ...(c.words ?? [])].map(norm).filter((n) => ` ${t} `.includes(` ${n} `)).map((n) => n.length), 0);
    const sorted = [...hits].sort((a, b) => score(b) - score(a));
    if (score(sorted[0]) > score(sorted[1])) return sorted[0].value;
  }
  return undefined;
}

export function displayValue(
  q: AdelQuestion,
  v: string,
  lang: AdelLang,
  plans: { id: string; name: string; kind: string }[],
): string {
  if (q.kind === "choice") return q.choices?.(lang, plans).find((c) => c.value === v)?.label ?? v;
  return v;
}
