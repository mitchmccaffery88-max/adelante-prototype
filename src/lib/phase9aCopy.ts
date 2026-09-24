// §Phase 9a — patient-facing wording for record claiming, known justice
// involvement, and the pre-release "what your care team knows" card.
// Spanish is a first pass, PENDING bilingual review.
export const PHASE9A_COPY = {
  en: {
    haveCode: "I have a code from my care team",
    haveCodeBody:
      "If your care team gave you a sign-in code, enter it here. It connects you to the record they already started.",
    justiceKnownTitle: "Already on file",
    justiceKnownBody:
      "Your care team already knows you were recently in custody, so we won't ask about it again here.",
    knownTitle: "What your care team already knows",
    knownBody:
      "From the screening your reentry care team did with you before release. You don't need to tell us again.",
    knownBadge: "Reported by your reentry care team",
    knownFooter: "Something changed? Let your care team know.",
  },
  es: {
    haveCode: "Tengo un código de mi equipo de atención",
    haveCodeBody:
      "Si su equipo de atención le dio un código para entrar, escríbalo aquí. Lo conecta con el expediente que ya empezaron.",
    justiceKnownTitle: "Ya está en su expediente",
    justiceKnownBody:
      "Su equipo de atención ya sabe que estuvo bajo custodia recientemente, así que no le volveremos a preguntar aquí.",
    knownTitle: "Lo que su equipo de atención ya sabe",
    knownBody:
      "De la evaluación que su equipo de reingreso hizo con usted antes de salir. No necesita repetirlo.",
    knownBadge: "Informado por su equipo de reingreso",
    knownFooter: "¿Algo cambió? Avísele a su equipo de atención.",
  },
} as const;

/** Patient-facing names for AHC-HRSN domains (safety is never shown). */
export const HRSN_DOMAIN_NAME: Record<"en" | "es", Record<string, string>> = {
  en: {
    housing: "Housing",
    food: "Food",
    transportation: "Transportation",
    utilities: "Utilities (power, water, gas)",
  },
  es: {
    housing: "Vivienda",
    food: "Comida",
    transportation: "Transporte",
    utilities: "Servicios (luz, agua, gas)",
  },
};
