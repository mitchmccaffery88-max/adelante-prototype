// §Crisis copy — language-aware canned crisis text.
//
// WHY THIS EXISTS: crisis interception runs in BOTH languages already
// (`crisisTextDetection.ts`, 11 English + 11 Spanish patterns), but every
// canned reply it produced was hardcoded English. Someone who wrote
// "quiero morirme" correctly tripped the safety path and then got answered
// in a language they may not read.
//
// The language signal is NOT re-derived here: it comes from the matched
// pattern ids, which already carry it (`es_` prefix). See
// `crisisMatchLanguage` in crisisTextDetection.ts. There is deliberately no
// second language-detection mechanism.
//
// ─────────────────────────────────────────────────────────────────────────
// OPEN — HUMAN REVIEW REQUIRED (bilingual clinician, Christi / Dr. Bagga):
// The Spanish strings below are a careful plain-language translation, NOT a
// clinically reviewed or approved crisis script. This is the highest-stakes
// copy in the product. Treat it as pending review; do not cite it as
// validated. The 988 number itself is unchanged — 988 answers in Spanish.
// ─────────────────────────────────────────────────────────────────────────
import type { CrisisLang } from "@/lib/crisisTextDetection";

export interface CrisisCopy {
  /** Adel's canned reply when a message trips the crisis path. */
  adelReply: string;
  /** Badge above that reply. */
  careTeamAlerted: string;
  /** Chip that opens /crisis from the reply. */
  getHelpNow: string;
  /** Persistent strip under the Adel thread. */
  stripPrompt: string;
  stripCall: string;
  stripSupport: string;
  /** Front-door "what brings you here" live crisis block. */
  frontDoorHeading: string;
  frontDoorBody: string;
  frontDoorCall: string;
  frontDoorText: string;
  /** Intake crisis card (screener trigger or crisis words in an answer). */
  intakeHeading: string;
  intakeBefore988: string;
  intakeAfter988: string;
  intakeCall: string;
}

const EN: CrisisCopy = {
  adelReply:
    "I'm really glad you told me. I want you to talk to a person, not me, right now. Call or text 988 — someone answers any hour, and it's free.",
  careTeamAlerted: "Your care team has been alerted",
  getHelpNow: "In crisis now",
  stripPrompt: "Need a person right now?",
  stripCall: "Call",
  stripSupport: "In crisis now",
  frontDoorHeading: "Help is available right now",
  frontDoorBody:
    "What you wrote sounds heavy. You don't have to finish this form — talk to a person now. The 988 Suicide & Crisis Lifeline answers any hour, free.",
  frontDoorCall: "Call 988",
  frontDoorText: "Text 988",
  intakeHeading: "It sounds like things are really hard right now.",
  intakeBefore988: "You're not alone — and help is here. Please call or text",
  intakeAfter988: "anytime to talk to someone. Your care team has also been notified.",
  intakeCall: "Talk to someone now",
};

/** PENDING bilingual clinical review — see the header note. */
const ES: CrisisCopy = {
  adelReply:
    "Me alegra mucho que me lo hayas dicho. Ahora mismo quiero que hables con una persona, no conmigo. Llama o envía un mensaje de texto al 988 — alguien contesta a cualquier hora, y es gratis.",
  careTeamAlerted: "Tu equipo de cuidado ya fue avisado",
  getHelpNow: "En crisis ahora",
  stripPrompt: "¿Necesitas hablar con una persona ahora?",
  stripCall: "Llama al",
  stripSupport: "En crisis ahora",
  frontDoorHeading: "Hay ayuda para ti ahora mismo",
  frontDoorBody:
    "Lo que escribiste suena muy pesado. No tienes que terminar este formulario — habla con una persona ahora. La Línea 988 de Suicidio y Crisis contesta a cualquier hora, gratis, y en español.",
  frontDoorCall: "Llama al 988",
  frontDoorText: "Envía un texto al 988",
  intakeHeading: "Parece que las cosas están muy difíciles ahora.",
  intakeBefore988: "No estás solo — hay ayuda. Llama o envía un texto al",
  intakeAfter988: "a cualquier hora para hablar con alguien. Tu equipo de cuidado también fue avisado.",
  intakeCall: "Hablar con alguien ahora",
};

const TABLE: Record<CrisisLang, CrisisCopy> = { en: EN, es: ES };

/** Copy for a crisis reply, chosen by the language the MATCH came in. */
export function crisisCopy(lang: CrisisLang): CrisisCopy {
  return TABLE[lang] ?? EN;
}

/** True while the Spanish crisis script is still awaiting clinical sign-off. */
export const ES_CRISIS_COPY_PENDING_REVIEW = true;
