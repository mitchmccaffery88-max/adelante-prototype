// §Needs assessment step 1 — "What would help you".
//
// Section A: the existing "looking for" question (+ "Not sure yet").
// Section B: AHC-HRSN core questions (verbatim, scored + saved via
// recordScreener) and ONE optional-topics screen for the directory
// categories the core questions do not cover.
//
// Directory (RESOURCE_CATEGORIES, 14) vs the AHC-HRSN core:
//   covered by core: housing, emergency_shelter (housing), food,
//     transportation, financial (utilities only).
//   safety domain routes to legal + healthcare category-only (staff-worked).
//   recovery_meetings / support_groups: substance use lives in Section A
//     (Part 2 handling), never on the optional-topics screen.
//   NOT covered — offered as optional topics: employment, education,
//     parenting, family_reunification, legal, financial (benefits sign-up),
//     healthcare, life_skills (ID/documents, phone/internet, clothing).
// Wording is DRAFT — pending clinical review. Spanish pending bilingual review.
import type { Patient, SdohItemSource, SdohPlanItem } from "@/lib/ehr";
import { RESOURCE_CATEGORIES } from "@/lib/communityResources";

export const WHAT_HELPS_DRAFT_NOTE = "Draft — pending clinical review.";
export const HRSN_RECENT_WINDOW_DAYS = 30; // Draft — pending clinical sign-off.

export type NeedUrgency = "today" | "this_week" | "later";
export const URGENCIES: NeedUrgency[] = ["today", "this_week", "later"];

export type OptionalTopicKey =
  | "work"
  | "school"
  | "childcare"
  | "family"
  | "legal"
  | "benefits"
  | "id_docs"
  | "phone"
  | "clothing"
  | "health";

export interface OptionalTopic {
  key: OptionalTopicKey;
  categoryId: string;
  /** Need label written to the plan (English — staff-facing record). */
  need: string;
  en: string;
  es: string;
}

export const OPTIONAL_TOPICS: OptionalTopic[] = [
  { key: "work", categoryId: "employment", need: "Work or job training", en: "Work or job training", es: "Trabajo o capacitación laboral" },
  { key: "school", categoryId: "education", need: "School or education", en: "School or education", es: "Escuela o educación" },
  { key: "childcare", categoryId: "parenting", need: "Childcare or parenting help", en: "Childcare or parenting help", es: "Cuidado de niños o apoyo para padres" },
  { key: "family", categoryId: "family_reunification", need: "Family and social support", en: "Family and social support", es: "Apoyo familiar y social" },
  { key: "legal", categoryId: "legal", need: "Legal help", en: "Legal help", es: "Ayuda legal" },
  { key: "benefits", categoryId: "financial", need: "Signing up for benefits", en: "Signing up for benefits or money help", es: "Inscribirse en beneficios o ayuda con dinero" },
  { key: "id_docs", categoryId: "life_skills", need: "ID and documents", en: "ID and documents", es: "Identificación y documentos" },
  { key: "phone", categoryId: "life_skills", need: "Phone or internet", en: "Phone or internet", es: "Teléfono o internet" },
  { key: "clothing", categoryId: "life_skills", need: "Clothing and hygiene", en: "Clothing and hygiene", es: "Ropa e higiene" },
  { key: "health", categoryId: "healthcare", need: "Doctor, dental or other health care", en: "Doctor, dental or other health care", es: "Médico, dentista u otra atención de salud" },
];

/** AHC-HRSN domain → directory category. */
export const HRSN_DOMAIN_CATEGORY: Record<string, string> = {
  housing: "housing",
  food: "food",
  transportation: "transportation",
  utilities: "financial",
  safety: "legal",
};

export function categoryName(id?: string): string | undefined {
  return id ? RESOURCE_CATEGORIES.find((c) => c.id === id)?.name : undefined;
}

export const URGENCY_LABEL: Record<"en" | "es", Record<NeedUrgency, string>> = {
  en: { today: "Today", this_week: "This week", later: "Later" },
  es: { today: "Hoy", this_week: "Esta semana", later: "Más adelante" },
};

/** Staff/patient-facing provenance wording. */
export function provenanceFor(source: SdohItemSource): string {
  return {
    pre_release_hrsn: "pre-release screening",
    intake_self_report: "you, at intake",
    staff_assessed: "your care team",
    advocate_reported: "your advocate",
    partner_import: "a partner organization",
    referral: "your referral",
  }[source];
}

/** An AHC-HRSN result inside the draft 30-day window: don't re-ask. */
export function recentHrsn(patient: Patient | undefined, now = new Date()): boolean {
  const r = patient?.screeners?.["ahc-hrsn"] as { completedAt?: string } | undefined;
  if (!r?.completedAt) return false;
  return now.getTime() - new Date(r.completedAt).getTime() <= HRSN_RECENT_WINDOW_DAYS * 86400000;
}

const OUTSIDE_SOURCES: SdohItemSource[] = ["pre_release_hrsn", "partner_import", "referral"];

/** Open needs from pre-release, a partner import or a referral. */
export function outsideKnownNeeds(items: SdohPlanItem[] | undefined): SdohPlanItem[] {
  return (items ?? []).filter(
    (i) => OUTSIDE_SOURCES.includes(i.source) && i.status !== "completed" && i.status !== "not_completed",
  );
}

/** Skip the core questions when the record already has a recent/outside answer. */
export function shouldSkipCoreQuestions(patient: Patient | undefined, now = new Date()): boolean {
  return recentHrsn(patient, now) || outsideKnownNeeds(patient?.sdohPlan?.items).length > 0;
}

/** Safe wording for a need the patient may see (never names safety). */
export function patientSafeNeedLabel(item: SdohPlanItem): string | null {
  if (item.safetySensitive && item.visibleToPatient !== true) return null;
  return item.need;
}

export const WHAT_HELPS_COPY = {
  en: {
    title: "What would help you",
    sectionA: "Care you're looking for",
    notSure: "Not sure yet",
    sectionB: "Everyday needs",
    coreIntro: "These questions come from a standard screening used across health care.",
    alreadyKnows: "Your care team already knows about…",
    alreadyKnowsNote: "You don't need to answer these again. Confirm, or tell us something changed.",
    confirm: "Still right",
    update: "Something changed",
    updateNote: "Thanks — answer the questions below so your team has the latest.",
    otherPrivate: "Plus one more item your care team will talk with you about in person.",
    topicsQ: "Anything else we can help with? Choose any that apply.",
    howSoon: "How soon do you need help?",
    draft: "Draft — pending clinical review.",
    esPending: "",
  },
  es: {
    title: "Qué le ayudaría",
    sectionA: "La atención que busca",
    notSure: "Todavía no estoy seguro/a",
    sectionB: "Necesidades del día a día",
    coreIntro: "Estas preguntas vienen de una evaluación estándar usada en la atención de salud.",
    alreadyKnows: "Su equipo de atención ya sabe sobre…",
    alreadyKnowsNote: "No necesita contestar de nuevo. Confirme, o díganos si algo cambió.",
    confirm: "Sigue igual",
    update: "Algo cambió",
    updateNote: "Gracias — conteste las preguntas de abajo para que su equipo tenga lo más reciente.",
    otherPrivate: "Además, otro tema que su equipo hablará con usted en persona.",
    topicsQ: "¿Algo más en lo que podamos ayudar? Elija lo que corresponda.",
    howSoon: "¿Qué tan pronto necesita ayuda?",
    draft: "Borrador — pendiente de revisión clínica.",
    esPending:
      "Traducción pendiente de revisión bilingüe. Las preguntas de la evaluación se muestran en inglés hasta tener el texto oficial en español.",
  },
} as const;
