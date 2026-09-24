// §Pre-demo E1 — distress choice chips in Patient Adel.
//
// This is NOT crisis detection and NEVER replaces it. Crisis interception
// (`detectCrisisLanguage` → canned 988 reply, before any model call) runs
// first in AdelChat and is untouched. This module only answers a softer
// question — "is this conversation heading into distress?" — so the chat can
// OFFER choices instead of asking yet another question. No model call: a
// small, deterministic keyword list over what the member has typed.
//
// OPEN — Spanish keywords and chip labels are pending bilingual review.

/** Lower-case substrings that mark a message as distress-leaning. */
export const DISTRESS_SIGNALS: readonly string[] = [
  // English
  "anxious", "anxiety", "panic", "overwhelm", "can't cope", "cant cope", "stressed",
  "scared", "afraid", "hopeless", "worthless", "so alone", "lonely", "can't breathe",
  "cant breathe", "falling apart", "freaking out", "craving", "want to use", "want to drink",
  "relapse", "crying", "can't sleep", "angry", "really bad", "so bad", "depressed", "heavy",
  // Spanish (pending review)
  "ansiedad", "ansios", "pánico", "panico", "abrumad", "no puedo más", "no puedo mas",
  "estresad", "miedo", "asustad", "sin esperanza", "muy sol", "llorando", "deprimid",
  "ganas de usar", "ganas de tomar", "recaída", "recaida", "no puedo dormir",
];

export function isDistressMessage(text: string): boolean {
  const t = ` ${text.toLowerCase()} `;
  return DISTRESS_SIGNALS.some((s) => t.includes(s));
}

/** How often (in member turns) the chips are re-offered inline in the thread. */
export const CHIP_EVERY_N_TURNS = 3;

/**
 * Decide whether to attach the chip set to the reply for this member turn.
 * `userTexts` = every member message so far, INCLUDING the one just sent.
 * Rule: the conversation is "in distress" from the first distress message on.
 * Chips attach at that first distress turn, then every CHIP_EVERY_N_TURNS
 * member turns after it. A persistent chip row is shown separately once
 * distress starts, so they are always one tap away between inline offers.
 */
export function distressChipDecision(userTexts: readonly string[]): {
  inDistress: boolean;
  offerInline: boolean;
} {
  const first = userTexts.findIndex(isDistressMessage);
  if (first === -1) return { inDistress: false, offerInline: false };
  const since = userTexts.length - 1 - first;
  return { inDistress: true, offerInline: since % CHIP_EVERY_N_TURNS === 0 };
}

export interface DistressChipCopy {
  heading: string;
  breathing: string;
  keepTalking: string;
  talkToSomeone: string;
  call988: string;
  text988: string;
  keepTalkingReply: string;
  teamToldReply: string;
}

const EN: DistressChipCopy = {
  heading: "Would any of these help right now?",
  breathing: "Breathing exercise",
  keepTalking: "Keep venting",
  talkToSomeone: "Talk to someone now",
  call988: "Call 988",
  text988: "Text 988",
  keepTalkingReply: "I'm here. Take your time — tell me more when you're ready.",
  teamToldReply:
    "I've let your care team know you want to talk to someone now. If you can't wait, call or text 988 — a real person answers any hour.",
};

/** PENDING bilingual review. */
const ES: DistressChipCopy = {
  heading: "¿Te ayudaría alguna de estas opciones ahora?",
  breathing: "Ejercicio de respiración",
  keepTalking: "Seguir desahogándome",
  talkToSomeone: "Hablar con alguien ahora",
  call988: "Llamar al 988",
  text988: "Texto al 988",
  keepTalkingReply: "Aquí estoy. Tómate tu tiempo — cuéntame más cuando quieras.",
  teamToldReply:
    "Le avisé a tu equipo de cuidado que quieres hablar con alguien ahora. Si no puedes esperar, llama o envía un texto al 988 — una persona real contesta a cualquier hora.",
};

export function distressChipCopy(lang: "en" | "es"): DistressChipCopy {
  return lang === "es" ? ES : EN;
}

/** Deterministic "find a meeting" intent, so the filtered directory chip is
 *  always offered even if the model forgets the ACTION line. */
export function isMeetingRequest(text: string): boolean {
  return /\b(meeting|meetings|aa|na|reuni[oó]n|reuniones)\b/i.test(text);
}
