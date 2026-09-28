// §E5 Phase A — reusable Adel voice layer: pure helpers (no React).
// Browser speech only — DEMO. No audio is ever stored; only confirmed text.

export type VoiceLang = "en" | "es";
export type VoiceRate = "slow" | "normal";

export const VOICE_SESSION_KEY = "adel-voice-on";
export const VOICE_RATE_VALUE: Record<VoiceRate, number> = { slow: 0.8, normal: 1 };

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

type RecognitionCtor = new () => {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
export function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
export const sttSupported = () => !!recognitionCtor();

export const speechLangTag = (lang: VoiceLang) => (lang === "es" ? "es-US" : "en-US");

/** Prefer a voice in the requested language (any Spanish region for es). */
export function pickVoice(lang: VoiceLang, voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const exact = voices.find((v) => v.lang?.toLowerCase() === speechLangTag(lang).toLowerCase());
  return exact ?? voices.find((v) => v.lang?.toLowerCase().startsWith(lang));
}

/**
 * Sensitive items: read aloud is fine, but the answer must be by tap only
 * (C-SSRS, substance use, anything Part 2).
 */
const TAP_ONLY_KEYS = new Set(["c-ssrs", "cssrs", "dast-10", "dast10", "audit", "audit-c", "history"]);
export function isTapOnlyStep(stepKey: string, opts: { isSud?: boolean } = {}): boolean {
  return !!opts.isSud || TAP_ONLY_KEYS.has(stepKey.toLowerCase());
}

/** Validated screeners — read VERBATIM, never paraphrased. */
const VALIDATED = ["phq", "gad", "audit", "dast", "pc-ptsd", "ahc-hrsn", "c-ssrs", "cssrs"];
export function isValidatedScreener(stepKey: string): boolean {
  const k = stepKey.toLowerCase();
  return VALIDATED.some((v) => k.startsWith(v));
}
