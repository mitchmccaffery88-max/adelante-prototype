// §Part B1 — About You background questions. Spanish pending bilingual review.
export const BACKGROUND_COPY = {
  en: {
    heading: "A little background",
    justiceQ: "Have you been in jail, prison, or on probation or parole in the last 12 months?",
    justiceYes: "Yes", justiceNo: "No", justicePreferNot: "Prefer not to say",
    justiceDraft: "Draft — pending clinical sign-off",
    releaseLabel: "Release date (if you know it)",
    seekingQ: "What are you looking for? Check all that apply.",
    seeking: {
      mentalHealth: "Mental health support",
      medication: "Medication",
      substanceUse: "Substance use services",
    },
    seekingNote:
      "This helps us suggest the right content and resources. It doesn't change the questions everyone is asked. Substance use is only kept if you agree to share it on the Consent step.",
    alsoAdvocate: "Make this person my advocate",
    nameAdvocate: "Name an advocate (someone who can help with your care)",
    advName: "Advocate's name",
    advRel: "Relationship",
    advContact: "Their phone or email",
    advocateNote:
      "We'll send them an invitation. They can't see anything until you sign advocate consent.",
  },
  es: {
    heading: "Un poco de contexto",
    justiceQ: "¿Ha estado en la cárcel, en prisión, o en libertad condicional o bajo palabra en los últimos 12 meses?",
    justiceYes: "Sí", justiceNo: "No", justicePreferNot: "Prefiero no decir",
    justiceDraft: "Borrador — pendiente de aprobación clínica",
    releaseLabel: "Fecha de salida (si la sabe)",
    seekingQ: "¿Qué está buscando? Marque todo lo que corresponda.",
    seeking: {
      mentalHealth: "Apoyo de salud mental",
      medication: "Medicamentos",
      substanceUse: "Servicios para el uso de sustancias",
    },
    seekingNote:
      "Esto nos ayuda a sugerir contenido y recursos adecuados. No cambia las preguntas que se hacen a todos. El uso de sustancias solo se guarda si acepta compartirlo en el paso de Consentimiento.",
    alsoAdvocate: "Hacer a esta persona mi defensor (Borrador)",
    nameAdvocate: "Nombrar a un defensor (alguien que pueda ayudar con su cuidado)",
    advName: "Nombre del defensor",
    advRel: "Relación",
    advContact: "Su teléfono o correo",
    advocateNote:
      "Le enviaremos una invitación. No podrá ver nada hasta que usted firme el consentimiento para defensores.",
  },
} as const;
