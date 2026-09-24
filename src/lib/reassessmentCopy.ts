// §Phase 9b — patient-facing re-screen wording.
// OPEN — Spanish strings pending bilingual review.
export type RLang = "en" | "es";

const NAMES: Record<string, { en: string; es: string }> = {
  "phq-9": { en: "Mood check-in (PHQ-9)", es: "Revisión del ánimo (PHQ-9)" },
  "gad-7": { en: "Worry check-in (GAD-7)", es: "Revisión de preocupación (GAD-7)" },
  audit: { en: "Alcohol check-in (AUDIT)", es: "Revisión sobre alcohol (AUDIT)" },
  "dast-10": { en: "Drug use check-in (DAST-10)", es: "Revisión sobre uso de drogas (DAST-10)" },
  "pcl-5": { en: "Stress check-in (PCL-5)", es: "Revisión de estrés (PCL-5)" },
};

export function rescreenName(key: string, lang: RLang): string {
  return NAMES[key]?.[lang] ?? key.toUpperCase();
}

export const REASSESS_COPY = {
  en: {
    tileTitle: "Reassessment due",
    tileBody: "A few short check-ins are ready for you. Each one takes a couple of minutes.",
    start: "Start",
    pageLede: "Just this one questionnaire — not the whole intake. Answer for the past two weeks.",
    submit: "Finish",
    answerAll: "Please answer every question.",
    done: "Thanks — your answers are saved and your care team can see them.",
    back: "Back to home",
    notAvailable: "This check-in isn't available right now.",
    part2: "42 CFR Part 2 protected",
  },
  es: {
    tileTitle: "Tienes una revisión pendiente",
    tileBody: "Hay unas revisiones cortas listas para ti. Cada una toma un par de minutos.",
    start: "Empezar",
    pageLede: "Solo este cuestionario — no toda la admisión. Responde pensando en las últimas dos semanas.",
    submit: "Terminar",
    answerAll: "Por favor responde todas las preguntas.",
    done: "Gracias — tus respuestas se guardaron y tu equipo de cuidado las puede ver.",
    back: "Volver al inicio",
    notAvailable: "Esta revisión no está disponible ahora.",
    part2: "Protegido por 42 CFR Parte 2",
  },
} as const;
