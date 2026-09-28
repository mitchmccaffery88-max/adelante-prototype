// §E5 Phase A — plain-language (about 3rd grade) intake prompts, EN/ES.
// Draft — pending clinical sign-off. Spanish pending bilingual review.
// Validated screeners are NEVER rewritten here: only a short intro is added,
// and their questions are read verbatim from the screener definition.
import type { VoiceLang } from "@/lib/adelVoice";

export const VOICE_DRAFT_LABEL = "Draft — pending clinical sign-off";

type Copy = {
  optInTitle: string; optInBody: string; yes: string; no: string; privateSpot: string;
  on: string; off: string; play: string; replay: string; stop: string; slow: string; normal: string;
  transcript: string; answerByVoice: string; listening: string; heard: string; confirm: string; edit: string;
  noMic: string; typeHere: string; tapOnly: string; privately: string; helpNow: string; saved: string;
  noteLabel: string; noteHint: string; steps: Record<string, string>; screenerIntro: string; sensitiveIntro: string;
};

export const INTAKE_VOICE_COPY: Record<VoiceLang, Copy> = {
  en: {
    optInTitle: "Want me to read the questions out loud?",
    optInBody: "I can read each question to you. You can turn this off at any time.",
    yes: "Yes, read to me", no: "No thanks",
    privateSpot: "If you can, find a private spot before we start.",
    on: "Voice on", off: "Voice off", play: "Play", replay: "Replay", stop: "Stop", slow: "Slow", normal: "Normal",
    transcript: "What I said", answerByVoice: "Answer by voice", listening: "Listening…",
    heard: "I heard:", confirm: "Save this answer", edit: "Change the words if needed",
    noMic: "Voice answers don't work in this browser. You can type or tap instead.",
    typeHere: "Type your answer", tapOnly: "Tap your answer on the screen for this one.",
    privately: "Answer privately (don't read my answer back).",
    helpNow: "In crisis now", saved: "Saved.",
    noteLabel: "Anything else you want your care team to know?",
    noteHint: "Optional. You can type or say it.",
    steps: {
      welcome: "Hi. This will take about 10 minutes. You can stop and come back.",
      about: "Tell us a little about you. Your name, how to reach you, and your language.",
      consent: "This part is about who can see your health info. Read each one and pick yes or no.",
      coverage: "Do you have Medi-Cal or other health insurance? Pick what fits. It is OK if you don't know.",
      needs: "What would help you right now? Pick all that fit. Things like a place to stay, food, or a ride.",
      history: "These questions are about past use and past treatment. Tap your answers.",
      source: "How did you hear about us?",
      review: "Look over your answers. Tap Back to fix anything. Then tap Finish.",
    },
    screenerIntro: "Next is a short set of standard questions. I will read them just as they are written. Pick the answer that fits best.",
    sensitiveIntro: "The next questions are private. I will read them, but please tap your answers. I won't read your answers back.",
  },
  es: {
    optInTitle: "¿Quiere que le lea las preguntas en voz alta?",
    optInBody: "Puedo leerle cada pregunta. Puede apagar esto cuando quiera.",
    yes: "Sí, léame", no: "No, gracias",
    privateSpot: "Si puede, busque un lugar privado antes de empezar.",
    on: "Voz encendida", off: "Voz apagada", play: "Reproducir", replay: "Repetir", stop: "Parar", slow: "Lento", normal: "Normal",
    transcript: "Lo que dije", answerByVoice: "Responder con la voz", listening: "Escuchando…",
    heard: "Escuché:", confirm: "Guardar esta respuesta", edit: "Cambie las palabras si hace falta",
    noMic: "Las respuestas por voz no funcionan en este navegador. Puede escribir o tocar.",
    typeHere: "Escriba su respuesta", tapOnly: "Para esta, toque su respuesta en la pantalla.",
    privately: "Responder en privado (no leer mi respuesta en voz alta).",
    helpNow: "En crisis ahora", saved: "Guardado.",
    noteLabel: "¿Algo más que quiera que sepa su equipo de cuidado?",
    noteHint: "Opcional. Puede escribirlo o decirlo.",
    steps: {
      welcome: "Hola. Esto toma unos 10 minutos. Puede parar y volver después.",
      about: "Cuéntenos un poco de usted. Su nombre, cómo contactarle y su idioma.",
      consent: "Esta parte es sobre quién puede ver su información de salud. Lea cada una y elija sí o no.",
      coverage: "¿Tiene Medi-Cal u otro seguro de salud? Elija lo que aplique. Está bien si no sabe.",
      needs: "¿Qué le ayudaría ahora? Elija todo lo que aplique. Por ejemplo, un lugar para quedarse, comida o transporte.",
      history: "Estas preguntas son sobre uso y tratamiento en el pasado. Toque sus respuestas.",
      source: "¿Cómo supo de nosotros?",
      review: "Revise sus respuestas. Toque Atrás para cambiar algo. Luego toque Terminar.",
    },
    screenerIntro: "Ahora vienen unas preguntas estándar. Las leeré tal como están escritas. Elija la respuesta que mejor le quede.",
    sensitiveIntro: "Las siguientes preguntas son privadas. Las leeré, pero por favor toque sus respuestas. No leeré sus respuestas en voz alta.",
  },
};
