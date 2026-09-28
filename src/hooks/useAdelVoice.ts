// §E5 Phase A — `useAdelVoice`: the one voice layer for the patient experience.
// Used by intake first; built to be reused by Adel chat, check-ins, self-help.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  VOICE_RATE_VALUE,
  VOICE_SESSION_KEY,
  pickVoice,
  recognitionCtor,
  speechLangTag,
  sttSupported,
  ttsSupported,
  type VoiceLang,
  type VoiceRate,
} from "@/lib/adelVoice";

// Global on/off, remembered for the session (off by default).
const listeners = new Set<() => void>();
function readOn(): boolean {
  try { return typeof window !== "undefined" && window.sessionStorage.getItem(VOICE_SESSION_KEY) === "1"; } catch { return false; }
}
export function setAdelVoiceOn(on: boolean) {
  try { window.sessionStorage.setItem(VOICE_SESSION_KEY, on ? "1" : "0"); } catch { /* private mode */ }
  if (!on && ttsSupported()) window.speechSynthesis.cancel();
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useAdelVoice(lang: VoiceLang) {
  const enabled = useSyncExternalStore(subscribe, readOn, () => false);
  const [rate, setRate] = useState<VoiceRate>("normal");
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const recRef = useRef<InstanceType<NonNullable<ReturnType<typeof recognitionCtor>>> | null>(null);

  useEffect(() => { setCanListen(sttSupported()); setCanSpeak(ttsSupported()); }, []);

  const stop = useCallback(() => {
    if (ttsSupported()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    setTranscript(text);
    if (!ttsSupported() || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = speechLangTag(lang);
    u.rate = VOICE_RATE_VALUE[rate];
    const v = pickVoice(lang, window.speechSynthesis.getVoices());
    if (v) u.voice = v;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, [lang, rate]);

  const replay = useCallback(() => { if (transcript) speak(transcript); }, [speak, transcript]);

  /** Speech-to-text. Result is NEVER saved here — the caller confirms first. */
  const listen = useCallback((onHeard: (text: string) => void, onFail?: () => void) => {
    const Ctor = recognitionCtor();
    if (!Ctor) { onFail?.(); return; }
    stop();
    const rec = new Ctor();
    rec.lang = speechLangTag(lang); rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onresult = (e) => { const t = e.results[0]?.[0]?.transcript ?? ""; if (t) onHeard(t); };
    rec.onerror = () => { setListening(false); onFail?.(); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); onFail?.(); }
  }, [lang, stop]);

  const stopListening = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);

  useEffect(() => () => { if (ttsSupported()) window.speechSynthesis.cancel(); recRef.current?.abort(); }, []);

  return {
    enabled, setEnabled: setAdelVoiceOn, rate, setRate, speaking, transcript,
    speak, replay, stop, listen, stopListening, listening, canListen, canSpeak,
  };
}
