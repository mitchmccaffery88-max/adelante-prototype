// §Onboarding rework — intake Welcome step and Re-assess entry copy.
// Spanish is a first pass, pending bilingual review.

export const INTAKE_WELCOME_COPY = {
  en: {
    lede: "Welcome. These questions help your care team get to know you, so your care fits your life.",
    time: "It takes about 10–15 minutes. You can stop anytime — your answers are saved, and you can pick up where you left off.",
    privacy: "Your information is private and protected by federal law (HIPAA and 42 CFR Part 2).",
    choiceTitle: "How would you like to do it?",
    selfTitle: "On my own",
    selfBody: "Go through the questions yourself, one page at a time.",
    adelTitle: "Guided by Adel",
    adelBody: "Adel asks one question at a time and checks each answer with you.",
    toggleLabel: "How to do intake",
    toggleSelf: "Self",
    toggleAdel: "Adel-guided",
  },
  es: {
    lede: "Bienvenido. Estas preguntas ayudan a su equipo de cuidado a conocerle, para que su cuidado se adapte a su vida.",
    time: "Toma unos 10 a 15 minutos. Puede parar cuando quiera: sus respuestas se guardan y puede continuar donde se quedó.",
    privacy: "Su información es privada y está protegida por la ley federal (HIPAA y 42 CFR Parte 2).",
    choiceTitle: "¿Cómo le gustaría hacerlo?",
    selfTitle: "Por mi cuenta",
    selfBody: "Conteste las preguntas usted mismo, una página a la vez.",
    adelTitle: "Con la guía de Adel",
    adelBody: "Adel hace una pregunta a la vez y confirma cada respuesta con usted.",
    toggleLabel: "Cómo hacer las preguntas iniciales",
    toggleSelf: "Por mi cuenta",
    toggleAdel: "Con Adel",
  },
} as const;

export const REASSESS_START_COPY = {
  en: {
    eyebrow: "Re-assess",
    title: "Let's catch up",
    question: "Has anything changed about you or your emergency contact since last time?",
    yes: "Yes, something changed",
    no: "No, nothing changed",
    saveContinue: "Save & continue",
    saved: "Your details are updated",
    dueLede: "Here's what your care team would like you to answer now:",
    start: "Start",
    nothingDue: "Nothing else is due right now. Thank you for checking in.",
    backHome: "Back to My Care",
    full: "Answer all the intake questions again",
  },
  es: {
    eyebrow: "Revisar",
    title: "Pongámonos al día",
    question: "¿Ha cambiado algo sobre usted o su contacto de emergencia desde la última vez?",
    yes: "Sí, algo cambió",
    no: "No, nada cambió",
    saveContinue: "Guardar y continuar",
    saved: "Sus datos se actualizaron",
    dueLede: "Esto es lo que su equipo de cuidado quiere que conteste ahora:",
    start: "Empezar",
    nothingDue: "No hay nada más pendiente por ahora. Gracias por ponerse al día.",
    backHome: "Volver a Mi cuidado",
    full: "Contestar todas las preguntas iniciales otra vez",
  },
} as const;
