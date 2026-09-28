// §E5 Phase A — staff/admin-only production guardrail for the voice layer.
export function VoiceGuardrailNotice() {
  return (
    <div role="note" data-testid="voice-guardrail" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground space-y-1">
      <p className="font-semibold text-navy">Adel voice (read aloud / answer by voice) — demo only</p>
      <ul className="list-disc pl-5 text-xs space-y-0.5">
        <li>Browser speech recognition may send audio to the browser vendor (e.g. Google or Apple).</li>
        <li>Production requires a speech vendor covered by a signed BAA.</li>
        <li>Transcripts are PHI; 42 CFR Part 2 applies to substance use content.</li>
        <li>No audio is stored. Only the confirmed text answer is saved, the same as a typed answer.</li>
        <li>Sensitive items (C-SSRS, substance use, Part 2) are read aloud but answered by tap only.</li>
      </ul>
    </div>
  );
}
