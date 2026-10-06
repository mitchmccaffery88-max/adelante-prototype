// §Scribe Phase 1 — SIMULATED scribe vendor adapter.
// No microphone, no speech-to-text, no LLM. Returns a scripted transcript (with
// Spanish/English code-switching) and a scripted draft whose sentences point at
// transcript segments. Production swaps this adapter for a real vendor under a
// BAA with Part 2 terms — see docs/sculptsoft-scribe-handoff.md.
import type { ScribeFormat } from "../scribeFormats";

export type ScribeSpeaker = "clinician" | "patient" | "other";
export interface TranscriptSegment {
  id: string;
  speaker: ScribeSpeaker;
  text: string;
  lang: "en" | "es" | "mixed";
  /** Seconds from capture start. */
  atSec: number;
  /** Diarization confidence (who said it), 0–1. */
  speakerConfidence: number;
  /** Recognition confidence (what was said), 0–1. */
  asrConfidence: number;
}
export interface DraftSentence {
  text: string;
  sourceIds: string[];
}
export interface ScribeDraftOutput {
  /** Section key → sentences. Keys are the format's narrative keys + client_response + next_steps. */
  sections: Record<string, DraftSentence[]>;
  followUps: { id: string; kind: "book_visit" | "rescreen"; label: string; detail?: string }[];
}

export interface ScribeAdapter {
  name: string;
  mode: "Simulated" | "Live";
  transcript(ctx: { patientFirstName: string }): TranscriptSegment[];
  draft(segments: TranscriptSegment[], format: ScribeFormat): ScribeDraftOutput;
}

const SEGMENTS: Omit<TranscriptSegment, "id">[] = [
  { speaker: "clinician", text: "How has your week been since we last met?", lang: "en", atSec: 4, speakerConfidence: 0.98, asrConfidence: 0.97 },
  { speaker: "patient", text: "Better, mostly. I went to work every day this week.", lang: "en", atSec: 9, speakerConfidence: 0.96, asrConfidence: 0.95 },
  { speaker: "patient", text: "Pero el sábado me sentí muy ansioso, no podía dormir.", lang: "es", atSec: 15, speakerConfidence: 0.95, asrConfidence: 0.9 },
  { speaker: "clinician", text: "Thank you for telling me. What helped when you couldn't sleep?", lang: "en", atSec: 22, speakerConfidence: 0.97, asrConfidence: 0.96 },
  { speaker: "patient", text: "I used the breathing exercise, la respiración, and called my sister.", lang: "mixed", atSec: 28, speakerConfidence: 0.93, asrConfidence: 0.88 },
  { speaker: "other", text: "She did call me Saturday night, around eleven.", lang: "en", atSec: 35, speakerConfidence: 0.55, asrConfidence: 0.9 },
  { speaker: "clinician", text: "We practiced grounding together today and reviewed your sleep routine.", lang: "en", atSec: 44, speakerConfidence: 0.97, asrConfidence: 0.95 },
  { speaker: "patient", text: "Sí, quiero seguir con eso. It makes sense.", lang: "mixed", atSec: 52, speakerConfidence: 0.94, asrConfidence: 0.62 },
  { speaker: "clinician", text: "Let's meet again in two weeks, and I'd like you to repeat the anxiety questionnaire before then.", lang: "en", atSec: 60, speakerConfidence: 0.98, asrConfidence: 0.96 },
  { speaker: "patient", text: "Okay, two weeks works for me.", lang: "en", atSec: 66, speakerConfidence: 0.96, asrConfidence: 0.97 },
];

function narrative(format: ScribeFormat): Record<string, DraftSentence[]> {
  // s1..s10 map to SEGMENTS[0..9].
  const report: DraftSentence[] = [
    { text: "Patient reports going to work every day this week.", sourceIds: ["s2"] },
    { text: "Patient reports feeling very anxious on Saturday and being unable to sleep.", sourceIds: ["s3"] },
    { text: "Patient used a breathing exercise and called a family member for support.", sourceIds: ["s5"] },
    { text: "A family member present confirmed the call on Saturday night.", sourceIds: ["s6"] },
  ];
  const intervention: DraftSentence[] = [
    { text: "Clinician practiced grounding with the patient and reviewed the sleep routine.", sourceIds: ["s7"] },
  ];
  const assessment: DraftSentence[] = [
    { text: "Patient is engaged and wants to continue the current coping skills.", sourceIds: ["s8"] },
    // Hallucination-guard demo: nothing in the transcript supports this.
    { text: "Patient denies any thoughts of self-harm.", sourceIds: [] },
  ];
  const plan: DraftSentence[] = [
    { text: "Follow up in two weeks.", sourceIds: ["s9", "s10"] },
    { text: "Repeat the anxiety questionnaire before the next visit.", sourceIds: ["s9"] },
  ];
  switch (format) {
    case "soap":
      return { soap_subjective: report, soap_objective: intervention, soap_assessment: assessment, soap_plan: plan };
    case "dap":
      return { dap_data: [...report, ...intervention], dap_assessment: assessment, dap_plan: plan };
    case "birp":
      return { birp_behavior: report, birp_intervention: intervention, birp_response: assessment, birp_plan: plan };
    case "girp":
      return {
        girp_goal: [{ text: "Goal discussed: improve sleep and manage anxiety with coping skills.", sourceIds: ["s3", "s7"] }, ...report.slice(0, 1)],
        girp_intervention: intervention,
        girp_response: assessment,
        girp_plan: plan,
      };
  }
}

export const MockScribeAdapter: ScribeAdapter = {
  name: "mock-scribe (Simulated)",
  mode: "Simulated",
  transcript() {
    return SEGMENTS.map((s, i) => ({ ...s, id: `s${i + 1}` }));
  },
  draft(_segments, format) {
    return {
      sections: {
        ...narrative(format),
        client_response: [{ text: "Patient responded well to grounding practice and agreed to continue.", sourceIds: ["s8"] }],
        next_steps: [{ text: "Next visit in two weeks; anxiety questionnaire before then.", sourceIds: ["s9"] }],
      },
      followUps: [
        { id: "fu-visit", kind: "book_visit", label: "Book a follow-up visit in two weeks" },
        { id: "fu-gad7", kind: "rescreen", label: "Send the anxiety questionnaire (GAD-7)", detail: "gad7" },
      ],
    };
  },
};

export const scribe: ScribeAdapter = MockScribeAdapter;
