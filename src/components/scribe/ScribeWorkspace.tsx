// §Scribe Phase 1 — capture (consent gate → simulated live transcript → end)
// and AI draft review (provenance, flags, resolve, confirm). All via runAction.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { actFor } from "@/lib/actions/act";
import { useActingStaff } from "@/lib/roles";
import { openBookVisit } from "@/lib/bookingFlow";
import {
  AI_DRAFT_LABEL, ALL_PARTY_REMINDER, canCaptureScribe, captureBlocker, defaultSetting, DICTATION_CONSENT_DRAFT_LABEL, dictationBlocker, getScribeSession,
  IDENTIFYING_LABEL, ingestScribeSegments, isScribeOffline, listScribeSessions, NOISY_SETTING_LABEL, PRE_ENROLLMENT_RULE, PRIVATE_LOCATION_LABEL,
  RETENTION_DRAFT_LABEL, reviewSummary, SCRIBE_SETTING_LABEL, SCRIBE_SETTINGS, scribeView, segmentText, setScribeOffline, SETTING_DRAFT_LABEL,
  SPANISH_MARKER, SPEAKER_UNCERTAIN_LABEL, sweepScribeRetention, thresholdsFor, UNSUPPORTED_LABEL, UNSURE_LABEL,
  type ScribeParty, type ScribeSession, type ScribeSetting,
} from "@/lib/scribe";
import { AFBI_ACTIVITIES, AFBI_LOCATION_TYPES, AFBI_OUTCOMES } from "@/lib/afbiOutreach";
import { defaultFormat, FORMAT_SECTIONS, SCRIBE_FORMAT_DRAFT, SCRIBE_FORMAT_LABEL, SCRIBE_FORMATS, type ScribeFormat } from "@/lib/scribeFormats";
import { simulatedSurfaceLabel } from "@/lib/features";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const VISIT_FIELD_LABELS = [["service_type", "Service type"], ["service_date", "Date of service"], ["service_minutes", "Minutes"], ["modality", "Modality"], ["location", "Location"]] as const;
const SPEAKER = { clinician: "Clinician", patient: "Patient", other: "Other" } as const;

type Target = { kind: "note" } | { kind: "afbi"; initials?: string };

export function ScribeWorkspace({ patientId, appointmentId, target = { kind: "note" } }: { patientId?: string; appointmentId?: string; target?: Target }) {
  const staff = useActingStaff();
  const actor = { name: staff.staffName, role: staff.role, staffId: staff.staffId, clinicianId: staff.clinicianId };
  const pid = patientId ?? "";
  const isAfbi = target.kind === "afbi";
  const appts = useEhr(() => (pid ? AdelanteEHR.listAppointments().filter((a) => a.patientId === pid && Math.abs(+new Date(a.start) - Date.now()) < 2 * 86400000) : []));
  const [apptId, setApptId] = useState<string>(appointmentId ?? "");
  const appt = appts.find((a) => a.id === apptId);
  const [format, setFormat] = useState<ScribeFormat>("soap");
  useEffect(() => setFormat(defaultFormat({ serviceType: appt?.serviceType })), [appt?.serviceType]);
  const [setting, setSetting] = useState<ScribeSetting>(() => defaultSetting({ appointmentId: appointmentId, afbi: isAfbi }));
  useEffect(() => setSetting(defaultSetting({ appointmentId: apptId || undefined, afbi: isAfbi })), [apptId, isAfbi]);
  const [others, setOthers] = useState<ScribeParty[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [privateOk, setPrivateOk] = useState(false);
  const [offline, setOfflineState] = useState(isScribeOffline());
  const setOffline = (v: boolean) => { setScribeOffline(v); setOfflineState(v); };
  const [liveId, setLiveId] = useState<string | null>(null);
  const [, force] = useState(0);
  const sessions = useEhr(() => listScribeSessions(pid || undefined).map((s) => s.id + s.state).join(","));
  useEffect(() => { sweepScribeRetention(); }, [sessions]);
  const parties: ScribeParty[] = [{ kind: "patient", agreed: true }, ...others];
  const req = { actor, patientId: pid, appointmentId: apptId || undefined, format, allPartyConfirmed: confirmed, parties, setting, privateLocationConfirmed: privateOk, target: target.kind };
  const block = canCaptureScribe(staff.role) && pid ? captureBlocker(req) : null;
  const dictReq = { actor, target: target.kind, patientId: pid || undefined, appointmentId: apptId || undefined, format, initials: isAfbi ? target.initials : undefined, setting };
  const dictBlock = dictationBlocker(dictReq);
  const live = liveId ? getScribeSession(liveId) : undefined;
  const canLive = canCaptureScribe(staff.role) && Boolean(pid);

  // Simulated vendor stream: one segment per tick while capturing.
  useEffect(() => {
    if (!live || live.state !== "capturing") return;
    const t = setInterval(() => { ingestScribeSegments(live.id, 1); force((n) => n + 1); }, 900);
    return () => clearInterval(t);
  }, [live?.id, live?.state]);
  useEffect(() => {
    if (liveId && live && live.state === "discarded") { toast.message("Capture stopped — transcript discarded"); setLiveId(null); }
  }, [live?.state]);

  const run = (fn: () => void) => { try { fn(); } catch (e) { toast.error((e as Error).message); } };
  const start = () => run(() => { const s = actFor<ScribeSession>("scribe_start", "startScribeSession", pid, req); setLiveId(s.id); });
  const end = () => run(() => { actFor("scribe_end", "endScribeSession", pid, liveId, actor); toast.success(isAfbi ? `AFBI draft ready · ${AI_DRAFT_LABEL}` : `Draft created in the chart · ${AI_DRAFT_LABEL}`); setLiveId(null); setConfirmed(false); setPrivateOk(false); });
  const pause = () => run(() => { actFor(live?.paused ? "scribe_resume" : "scribe_pause", live?.paused ? "resumeScribeSession" : "pauseScribeSession", pid, liveId, actor); force((n) => n + 1); });
  const discard = () => run(() => { actFor("scribe_discard", "discardScribeSession", pid, liveId, actor, "stopped"); });
  const withdrew = () => run(() => { actFor("scribe_consent_withdraw", "withdrawAiRecordingConsent", pid, { patientId: pid, by: staff.staffName, role: staff.role, staffId: staff.staffId }); });
  const dictate = () => run(() => { actFor("scribe_dictate", "createDictationDraft", pid || undefined, dictReq); toast.success(`Dictation draft ready · ${AI_DRAFT_LABEL}`); });

  const drafts = listScribeSessions(pid || undefined).filter((s) => s.state === "drafted" && s.target === target.kind && (s.target === "note" || !s.afbiContactId) && (pid || s.startedBy.name === staff.staffName));
  const inPerson = setting !== "telehealth";
  // Thumb-zone bar on phones; inline inside the AFBI drawer. Sits ABOVE the
  // persistent 988 crisis banner (bottom-10) so neither covers the other.
  const bar = isAfbi ? "flex gap-2" : "fixed inset-x-0 bottom-10 z-30 flex gap-2 border-t bg-background p-3 sm:static sm:border-0 sm:p-0";

  return (
    <div className={isAfbi ? "space-y-4" : "space-y-4 pb-36 sm:pb-0"}>
      {!live && (
        <Card className="p-4 space-y-3" data-testid="scribe-start">
          <h2 className="font-display text-lg text-navy">{canLive ? "Start AI scribe" : "Dictate after the encounter"} <Badge variant="outline" className="ml-1 text-[10px]">{simulatedSurfaceLabel("scribe_simulated")}</Badge></h2>
          {/* 10–30 s pattern: the reason and next step come first. */}
          {canLive && block && (
            <div role="alert" className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="scribe-blocked">
              <p className="font-medium text-destructive">{block.reason}</p>
              <p className="mt-1 text-muted-foreground">What to do: {block.next}</p>
            </div>
          )}
          {isAfbi && !pid && <p className="rounded border border-dashed p-2 text-xs" data-testid="pre-enrollment-rule">{PRE_ENROLLMENT_RULE}</p>}
          <label className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-xs" data-testid="scribe-offline-toggle">
            <Checkbox checked={offline} onCheckedChange={(v) => setOffline(v === true)} aria-label="Demo: simulate no signal" /> Demo: simulate no signal
          </label>
          {canLive && (
            <>
              <div>
                <p className="text-xs font-medium">Setting</p>
                <div className="mt-1 grid grid-cols-3 gap-1" role="radiogroup" aria-label="Setting">
                  {SCRIBE_SETTINGS.map((k) => (
                    <Button key={k} type="button" size="sm" variant={setting === k ? "default" : "outline"} role="radio" aria-checked={setting === k} onClick={() => setSetting(k)} data-testid={`scribe-setting-${k}`}>{SCRIBE_SETTING_LABEL[k]}</Button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{SETTING_DRAFT_LABEL}{setting === "field" ? ` · ${NOISY_SETTING_LABEL}: stricter uncertainty flags` : ""}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {!isAfbi && (
                  <label className="text-xs">Visit
                    <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={apptId} onChange={(e) => setApptId(e.target.value)} data-testid="scribe-visit">
                      <option value="">No linked visit</option>
                      {appts.map((a) => <option key={a.id} value={a.id}>{new Date(a.start).toLocaleString()} · {AdelanteEHR.getServiceType(a.serviceType)?.label ?? a.serviceType}</option>)}
                    </select>
                  </label>
                )}
                {!isAfbi && (
                  <label className="text-xs">Note format
                    <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={format} onChange={(e) => setFormat(e.target.value as ScribeFormat)} data-testid="scribe-format">
                      {SCRIBE_FORMATS.map((f) => <option key={f} value={f}>{SCRIBE_FORMAT_LABEL[f]}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {!isAfbi && <p className="text-[11px] text-muted-foreground">{SCRIBE_FORMAT_DRAFT}</p>}
              <div className="rounded border border-dashed p-2 text-xs" data-testid="all-party-reminder">{ALL_PARTY_REMINDER}</div>
              {setting === "field" && (
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={privateOk} onCheckedChange={(v) => setPrivateOk(v === true)} data-testid="scribe-private" /> {PRIVATE_LOCATION_LABEL}</label>
              )}
              <div className="space-y-2 text-sm">
                <p>People present: patient{others.length ? ` + ${others.length}` : ""}</p>
                {others.map((o, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-1" data-testid="scribe-party">
                    {inPerson ? (
                      <>
                        <Input aria-label="Name" placeholder="Name" value={o.name ?? ""} onChange={(e) => setOthers(others.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                        <Input aria-label="Relationship" placeholder="Relationship" value={o.relationship ?? ""} onChange={(e) => setOthers(others.map((x, j) => (j === i ? { ...x, relationship: e.target.value } : x)))} />
                      </>
                    ) : <span className="col-span-2 capitalize">{o.kind}</span>}
                    <label className="flex items-center gap-1 text-xs"><Checkbox checked={o.agreed} onCheckedChange={(v) => setOthers(others.map((x, j) => (j === i ? { ...x, agreed: v === true } : x)))} aria-label="Agreed" /> agreed</label>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1">{(["interpreter", "advocate", "family", "other"] as const).map((k) => <Button key={k} size="sm" variant="ghost" onClick={() => setOthers([...others, { kind: k, agreed: false, relationship: k === "other" ? "" : k }])} data-testid={`scribe-add-${k}`}>+ {k === "other" ? "someone else" : k}</Button>)}</div>
                {inPerson && <p className="text-[11px] text-muted-foreground">In person, everyone else present must be named. A general checkbox doesn't count.</p>}
                <label className="flex items-center gap-2"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} data-testid="scribe-all-party" /> Everyone present has agreed to recording</label>
              </div>
            </>
          )}
          <div className="rounded border p-2 text-xs space-y-1" data-testid="scribe-dictation">
            <p className="font-medium">Dictate after the encounter</p>
            <p className="text-muted-foreground">Record your own spoken summary once you're online. Same review rules as a session draft. No audio is stored.</p>
            <p className="text-[11px] text-muted-foreground">{DICTATION_CONSENT_DRAFT_LABEL}</p>
            {dictBlock && <p className="text-destructive" data-testid="scribe-dictation-blocked">{dictBlock.reason} <span className="text-muted-foreground">{dictBlock.next}</span></p>}
          </div>
          {/* Thumb zone on phones. */}
          <div className={bar}>
            {canLive && <Button className="h-14 min-w-0 flex-1 whitespace-normal px-2 text-base leading-tight sm:h-10 sm:flex-none sm:px-4" disabled={!!block} onClick={start} data-testid="scribe-start-btn">Start AI scribe</Button>}
            <Button variant={canLive ? "outline" : "default"} className="h-14 min-w-0 flex-1 whitespace-normal px-2 text-base leading-tight sm:h-10 sm:flex-none sm:px-4" disabled={!!dictBlock} onClick={dictate} data-testid="scribe-dictate-btn">Dictate after the encounter</Button>
          </div>
        </Card>
      )}
      {live && live.state === "capturing" && (
        <Card className="p-4 space-y-3" data-testid="scribe-live">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <h2 className="font-display text-lg text-navy" data-testid="scribe-live-state">{live.paused ? "Paused — nothing is captured" : "Capturing…"}</h2>
            <div className="flex gap-1"><Badge variant="outline">{SCRIBE_SETTING_LABEL[live.setting]}</Badge>{live.setting === "field" && <Badge variant="outline">{NOISY_SETTING_LABEL}</Badge>}<Badge variant="outline">{simulatedSurfaceLabel("scribe_simulated")}</Badge></div>
          </div>
          <p className="text-sm text-muted-foreground">{live.transcript?.length ?? 0} lines captured{live.pauses.length ? ` · ${live.pauses.length} pause${live.pauses.length === 1 ? "" : "s"}` : ""}</p>
          <details className="rounded border p-2" open>
            <summary className="cursor-pointer text-xs font-medium">Transcript</summary>
            <div className="mt-2 max-h-80 space-y-2 overflow-y-auto text-sm">
              {(live.transcript ?? []).map((t) => (
                <div key={t.id}>
                  <div><span className="text-[11px] uppercase text-muted-foreground">{SPEAKER[t.speaker]}{t.speakerConfidence < thresholdsFor(live.setting).speaker ? " (?)" : ""}</span><p className={t.asrConfidence < thresholdsFor(live.setting).asr ? "underline decoration-dotted" : ""}>{t.text}</p></div>
                  {live.pauses.filter((g) => g.afterSegmentId === t.id).map((g, i) => <p key={i} className="my-1 border-y border-dashed py-1 text-center text-[11px] text-muted-foreground" data-testid="scribe-gap">— Paused{g.resumedAt ? "" : " (now)"}: not captured —</p>)}
                </div>
              ))}
              {live.pauses.filter((g) => !g.afterSegmentId).map((g, i) => <p key={`g${i}`} className="text-center text-[11px] text-muted-foreground" data-testid="scribe-gap">— Paused: not captured —</p>)}
            </div>
          </details>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button size="sm" variant="ghost" onClick={discard}>Stop and discard</Button>
            <Button size="sm" variant="ghost" onClick={withdrew}>Patient withdrew consent</Button>
          </div>
          <div className={bar}>
            {live.setting !== "telehealth" && <Button variant="outline" className="h-14 min-w-0 flex-1 whitespace-normal px-2 text-base leading-tight sm:h-10 sm:flex-none sm:px-4" onClick={pause} data-testid="scribe-pause">{live.paused ? "Resume" : "Pause"}</Button>}
            <Button className="h-14 min-w-0 flex-1 whitespace-normal px-2 text-base leading-tight sm:h-10 sm:flex-none sm:px-4" onClick={end} data-testid="scribe-end">End session</Button>
          </div>
        </Card>
      )}
      {drafts.map((s) => <ScribeDraftReview key={s.id} sessionId={s.id} />)}
    </div>
  );
}

export function ScribeDraftReview({ sessionId, compact }: { sessionId: string; compact?: boolean }) {
  const staff = useActingStaff();
  const actor = { name: staff.staffName, role: staff.role, staffId: staff.staffId, clinicianId: staff.clinicianId };
  const view = useEhr(() => scribeView(sessionId, staff.role, [staff.staffId, staff.clinicianId]));
  const s = view.session;
  const noteRaw = useEhr(() => (s?.noteId ? AdelanteEHR._findNote(s.patientId, s.noteId).n : undefined));
  const isAfbi = s?.target === "afbi";
  // AFBI drafts have no chart note: the session carries the review state.
  const note = isAfbi && s
    ? ({ status: s.afbiContactId ? "signed" : "draft", signedAt: s.afbiContactId ? s.reviewConfirmedAt : undefined, aiScribe: { openedAt: s.openedAt, reviewConfirmedAt: s.reviewConfirmedAt }, templateAnswers: {} } as unknown as NonNullable<typeof noteRaw>)
    : noteRaw;
  const [rating, setRating] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string; mode: "edit" | "keep" } | null>(null);
  const summary = s ? reviewSummary(s) : null;
  const isSigned = Boolean(note?.signedAt);
  // Retention: the transcript is deleted once the note is signed (audited stub).
  useEffect(() => { if (isSigned) sweepScribeRetention(); }, [isSigned]);
  // Part 2: hidden, not stubbed.
  if (view.masked) return null;
  if (!s || !note || !summary) return null;
  const run = (fn: () => void) => { try { fn(); } catch (e) { toast.error((e as Error).message); } };
  const pid = s.patientId;
  const signed = (note.status ?? "draft") !== "draft";
  const opened = Boolean(note.aiScribe?.openedAt);
  const sections = isAfbi
    ? [{ key: "afbi_summary", label: "What happened" }, { key: "afbi_next_step", label: "Next step" }]
    : [...FORMAT_SECTIONS[s.format].map((x) => ({ key: x.key, label: x.label })), { key: "client_response", label: "Client response" }, { key: "next_steps", label: "Next steps" }];
  const af = s.afbiFields;
  const setAf = (k: string, v: unknown) => run(() => { actFor("scribe_visit_field", "setAiDraftVisitField", pid || undefined, sessionId, k, v, actor); setReviewed(false); });
  return (
    <Card className="p-4 space-y-3" data-testid="scribe-draft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-0 bg-destructive/15 text-destructive">{signed ? "Signed" : AI_DRAFT_LABEL}</Badge>
        <Badge variant="outline">{isAfbi ? "AFBI contact" : SCRIBE_FORMAT_LABEL[s.format]}</Badge>
        <Badge variant="outline" data-testid="scribe-draft-setting">{SCRIBE_SETTING_LABEL[s.setting]}{s.kind === "dictation" ? " · Dictation" : ""}</Badge>
        {s.includedSpanish && <Badge variant="outline">{SPANISH_MARKER}</Badge>}
        {!compact && !isAfbi && <Link to="/record/$patientId" params={{ patientId: pid }} search={{ section: "notes" } as never} className="text-xs text-teal underline">Open in chart notes</Link>}
      </div>
      <p className="text-sm font-medium" data-testid="scribe-summary">{summary.total} sentences · {summary.sourced} sourced · {summary.unsupported} unsupported · {summary.speakerUncertain} speaker uncertain{summary.identifying ? ` · ${summary.identifying} identifying` : ""}{summary.unsure ? ` · ${summary.unsure} unsure` : ""}</p>
      {opened && !signed && (
        <div className="flex flex-wrap gap-1 text-[11px]" data-testid="scribe-flag-jumps">
          {s.sentences.filter((x) => x.resolution?.kind !== "deleted" && (((x.unsupported || x.identifying) && !x.resolution) || x.speakerUncertain)).map((x, i) => (
            <a key={x.id} href={`#snt-${x.id}`} className="rounded border px-1.5 py-0.5 text-teal">Flag {i + 1}: {x.identifying && !x.resolution ? "identifying" : x.unsupported && !x.resolution ? "unsupported" : "speaker"}</a>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{s.transcriptDeleted ? `Transcript deleted ${new Date(s.transcriptDeleted.at).toLocaleString()} by ${s.transcriptDeleted.by} (${s.transcriptDeleted.reason}).` : RETENTION_DRAFT_LABEL}</p>
      {!opened && !signed ? (
        <Button onClick={() => run(() => actFor("scribe_open_draft", "openAiDraft", pid || undefined, sessionId, actor))} data-testid="scribe-open">Open AI draft to review</Button>
      ) : (
        <>
          {!signed && isAfbi && af && (
            <div className="rounded border p-2 space-y-2 text-xs" data-testid="scribe-afbi-fields">
              <h4 className="font-medium text-navy">AFBI fields (from the draft — check each)</h4>
              <div className="flex flex-wrap gap-1">{AFBI_LOCATION_TYPES.map((l) => <Button key={l.id} size="sm" variant={af.locationType === l.id ? "default" : "outline"} onClick={() => setAf("locationType", l.id)}>{l.label}</Button>)}</div>
              <div className="flex flex-wrap gap-1">{AFBI_ACTIVITIES.map((a) => <Button key={a.id} size="sm" aria-pressed={af.activities.includes(a.id)} variant={af.activities.includes(a.id) ? "default" : "outline"} onClick={() => setAf("activities", af.activities.includes(a.id) ? af.activities.filter((x) => x !== a.id) : [...af.activities, a.id])}>{a.label}</Button>)}</div>
              <label className="flex items-center gap-2">Minutes <Input aria-label="AFBI minutes" type="number" className="w-20" defaultValue={af.minutes} onBlur={(e) => Number(e.target.value) !== af.minutes && setAf("minutes", Number(e.target.value))} /></label>
              <div className="flex flex-wrap gap-1">{AFBI_OUTCOMES.map((o) => <Button key={o.id} size="sm" variant={af.outcome === o.id ? "default" : "outline"} onClick={() => setAf("outcome", o.id)}>{o.label}</Button>)}</div>
              <label className="block">Next step <Input aria-label="AFBI next step" defaultValue={af.nextStep} onBlur={(e) => e.target.value !== af.nextStep && setAf("nextStep", e.target.value)} /></label>
            </div>
          )}
          {!signed && !isAfbi && (
            <div className="rounded border p-2" data-testid="scribe-visit-fields">
              <h4 className="text-xs font-medium text-navy">Visit details (DMC-ODS)</h4>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {VISIT_FIELD_LABELS.map(([k, label]) => (
                  <label key={k} className="text-[11px]">{label}
                    <Input
                      aria-label={label}
                      type={k === "service_minutes" ? "number" : k === "service_date" ? "date" : "text"}
                      defaultValue={String((note.templateAnswers as Record<string, unknown> | undefined)?.[k] ?? "")}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const cur = String((note.templateAnswers as Record<string, unknown> | undefined)?.[k] ?? "");
                        if (v && v !== cur) run(() => { actFor("scribe_visit_field", "setAiDraftVisitField", pid, sessionId, k, k === "service_minutes" ? Number(v) : v, actor); setReviewed(false); });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
          {sections.map((sec) => (
            <div key={sec.key}>
              <h4 className="text-xs font-medium text-navy">{sec.label}</h4>
              <ul className="space-y-1 text-sm">
                {s.sentences.filter((x) => x.sectionKey === sec.key && x.resolution?.kind !== "deleted").map((x) => {
                  const ex = x.sources.map((r) => ({ r, seg: segmentText(s, r.segmentId) }));
                  return (
                    <li key={x.id} id={`snt-${x.id}`} className="rounded border p-2" data-testid={(x.unsupported || x.identifying) && !x.resolution ? "unsupported-sentence" : "sentence"}>
                      <span title={ex.map(({ r, seg }) => `${SPEAKER[r.speaker]}: ${seg?.text ?? "(transcript deleted — ref " + r.segmentId + ")"}`).join("\n") || UNSUPPORTED_LABEL}>{x.text}</span>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        {x.unsupported && <Badge className="border-0 bg-destructive/15 text-destructive">{x.resolution ? `Resolved: ${x.resolution.kind}` : UNSUPPORTED_LABEL}</Badge>}
                        {x.identifying && <Badge className="border-0 bg-destructive/15 text-destructive" data-testid="identifying-flag">{x.resolution ? `Resolved: ${x.resolution.kind}` : IDENTIFYING_LABEL}</Badge>}
                        {x.speakerUncertain && <Badge variant="outline">{SPEAKER_UNCERTAIN_LABEL}</Badge>}
                        {x.unsure && <Badge variant="outline">{UNSURE_LABEL}</Badge>}
                        {ex.map(({ r }) => <Badge key={r.segmentId} variant="secondary">{SPEAKER[r.speaker]} · {r.atSec}s</Badge>)}
                      </div>
                      {!signed && (editing?.id === x.id ? (
                        <div className="mt-1 flex gap-1">
                          <Input value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} placeholder={editing.mode === "keep" ? "Reason to keep" : ""} />
                          <Button size="sm" onClick={() => run(() => { editing.mode === "edit" ? actFor("scribe_sentence_edit", "editAiSentence", pid || undefined, sessionId, x.id, editing.text, actor) : actFor("scribe_sentence_keep", "keepAiSentence", pid || undefined, sessionId, x.id, editing.text, actor); setEditing(null); setReviewed(false); })}>Save</Button>
                        </div>
                      ) : (
                        <div className="mt-1 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: x.id, text: x.text, mode: "edit" })}>Edit</Button>
                          {x.unsupported && !x.identifying && !x.resolution && <Button size="sm" variant="ghost" onClick={() => setEditing({ id: x.id, text: "", mode: "keep" })}>Keep with reason</Button>}
                          <Button size="sm" variant="ghost" onClick={() => run(() => actFor("scribe_sentence_delete", "deleteAiSentence", pid || undefined, sessionId, x.id, actor))} data-testid="sentence-delete">Delete</Button>
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {s.followUps.length > 0 && <div className="text-xs"><span className="font-medium">Suggested follow-ups</span> (nothing is created unless you accept):
            {s.followUps.map((f) => (
              <div key={f.id} className="mt-1 flex items-center gap-2">{f.label}{f.acceptedAt ? <Badge variant="secondary">Accepted</Badge> : <Button size="sm" variant="outline" onClick={() => run(() => { actFor("scribe_followup_accept", "acceptAiFollowUp", pid, sessionId, f.id, actor); if (f.kind === "book_visit") openBookVisit({ patientId: pid }); else toast.message("Send it from the chart's Tracking section."); })}>Accept</Button>}</div>
            ))}
          </div>}
          {!signed && (note.aiScribe?.reviewConfirmedAt ? (
            isAfbi ? (
              <Button className="h-12 w-full" onClick={() => run(() => { actFor("scribe_afbi_save", "saveAfbiFromScribe", pid || undefined, sessionId, actor); toast.success("Field outreach contact saved · Simulated AI draft · ISL, never billed to Medi-Cal"); })} data-testid="scribe-afbi-save">Save AFBI contact</Button>
            ) : <p className="text-sm text-teal" data-testid="scribe-confirmed">Review confirmed — sign from the chart's notes.</p>
          ) : (
            <div className="space-y-2 rounded border p-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} data-testid="scribe-reviewed" /> I reviewed and edited this {isAfbi ? "draft" : "note"}</label>
              <div className="flex items-center gap-1 text-xs">Rate the draft: {[1, 2, 3, 4, 5].map((n) => <Button key={n} size="sm" variant={rating === n ? "default" : "outline"} onClick={() => setRating(n)}>{n}</Button>)}</div>
              <Button disabled={!reviewed || !rating} onClick={() => run(() => actFor("scribe_review_confirm", "confirmAiReview", pid || undefined, sessionId, actor, rating))} data-testid="scribe-confirm">Confirm review</Button>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}
