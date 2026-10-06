// §Scribe Phase 1 — capture (consent gate → simulated live transcript → end)
// and AI draft review (provenance, flags, resolve, confirm). All via runAction.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { actFor } from "@/lib/actions/act";
import { useActingStaff } from "@/lib/roles";
import { openBookVisit } from "@/lib/bookingFlow";
import {
  AI_DRAFT_LABEL, ALL_PARTY_REMINDER, captureBlocker, listScribeSessions, RETENTION_DRAFT_LABEL, reviewSummary,
  scribeView, segmentText, SPANISH_MARKER, SPEAKER_UNCERTAIN_LABEL, sweepScribeRetention, UNSUPPORTED_LABEL, UNSURE_LABEL,
  type ScribeParty, type ScribeSession,
} from "@/lib/scribe";
import { defaultFormat, FORMAT_SECTIONS, SCRIBE_FORMAT_DRAFT, SCRIBE_FORMAT_LABEL, SCRIBE_FORMATS, type ScribeFormat } from "@/lib/scribeFormats";
import { simulatedSurfaceLabel } from "@/lib/features";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const SPEAKER = { clinician: "Clinician", patient: "Patient", other: "Other" } as const;

export function ScribeWorkspace({ patientId, appointmentId }: { patientId: string; appointmentId?: string }) {
  const staff = useActingStaff();
  const actor = { name: staff.staffName, role: staff.role, staffId: staff.staffId, clinicianId: staff.clinicianId };
  const appts = useEhr(() => AdelanteEHR.listAppointments().filter((a) => a.patientId === patientId && Math.abs(+new Date(a.start) - Date.now()) < 2 * 86400000));
  const [apptId, setApptId] = useState<string>(appointmentId ?? "");
  const appt = appts.find((a) => a.id === apptId);
  const [format, setFormat] = useState<ScribeFormat>("soap");
  useEffect(() => setFormat(defaultFormat({ serviceType: appt?.serviceType })), [appt?.serviceType]);
  const [others, setOthers] = useState<ScribeParty[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const sessions = useEhr(() => listScribeSessions(patientId).map((s) => s.id + s.state).join(","));
  useEffect(() => { sweepScribeRetention(); }, [sessions]);
  const parties: ScribeParty[] = [{ kind: "patient", agreed: true }, ...others];
  const block = useEhr(() => captureBlocker({ actor, patientId, appointmentId: apptId || undefined, format, allPartyConfirmed: confirmed, parties }));
  const live = liveId ? listScribeSessions(patientId).find((s) => s.id === liveId) : undefined;

  useEffect(() => {
    if (!live || live.state !== "capturing") return;
    const t = setInterval(() => setShown((n) => Math.min(n + 1, live.transcript?.length ?? 0)), 900);
    return () => clearInterval(t);
  }, [live?.id, live?.state]);
  useEffect(() => {
    if (liveId && live && live.state === "discarded") { toast.message("Capture stopped — transcript discarded"); setLiveId(null); }
  }, [live?.state]);

  const run = (fn: () => void) => { try { fn(); } catch (e) { toast.error((e as Error).message); } };
  const start = () => run(() => {
    const s = actFor<ScribeSession>("scribe_start", "startScribeSession", patientId, { actor, patientId, appointmentId: apptId || undefined, format, allPartyConfirmed: confirmed, parties });
    setShown(0); setLiveId(s.id);
  });
  const end = () => run(() => { actFor("scribe_end", "endScribeSession", patientId, liveId, actor); toast.success(`Draft created in the chart · ${AI_DRAFT_LABEL}`); setLiveId(null); setConfirmed(false); });
  const discard = () => run(() => { actFor("scribe_discard", "discardScribeSession", patientId, liveId, actor, "stopped"); });
  const withdrew = () => run(() => { actFor("scribe_consent_withdraw", "withdrawAiRecordingConsent", patientId, { patientId, by: staff.staffName, role: staff.role, staffId: staff.staffId }); });

  const drafts = listScribeSessions(patientId).filter((s) => s.state === "drafted");

  return (
    <div className="space-y-4">
      {!live && (
        <Card className="p-4 space-y-3" data-testid="scribe-start">
          <h2 className="font-display text-lg text-navy">Start AI scribe <Badge variant="outline" className="ml-1 text-[10px]">{simulatedSurfaceLabel("scribe_simulated")}</Badge></h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">Visit
              <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={apptId} onChange={(e) => setApptId(e.target.value)} data-testid="scribe-visit">
                <option value="">No linked visit</option>
                {appts.map((a) => <option key={a.id} value={a.id}>{new Date(a.start).toLocaleString()} · {AdelanteEHR.getServiceType(a.serviceType)?.label ?? a.serviceType}</option>)}
              </select>
            </label>
            <label className="text-xs">Note format
              <select className="mt-1 w-full rounded border bg-background p-2 text-sm" value={format} onChange={(e) => setFormat(e.target.value as ScribeFormat)} data-testid="scribe-format">
                {SCRIBE_FORMATS.map((f) => <option key={f} value={f}>{SCRIBE_FORMAT_LABEL[f]}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">{SCRIBE_FORMAT_DRAFT}</p>
          <div className="rounded border border-dashed p-2 text-xs" data-testid="all-party-reminder">{ALL_PARTY_REMINDER}</div>
          <div className="space-y-1 text-sm">
            <div>People present: patient{others.map((o, i) => (
              <label key={i} className="ml-3 inline-flex items-center gap-1">
                <Checkbox checked={o.agreed} onCheckedChange={(v) => setOthers(others.map((x, j) => (j === i ? { ...x, agreed: v === true } : x)))} /> {o.kind} agreed
              </label>))}
            </div>
            <div className="flex gap-1">{(["advocate", "interpreter", "family"] as const).map((k) => <Button key={k} size="sm" variant="ghost" onClick={() => setOthers([...others, { kind: k, agreed: false }])}>+ {k}</Button>)}</div>
            <label className="flex items-center gap-2"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} data-testid="scribe-all-party" /> Everyone present has agreed to recording</label>
          </div>
          {block && (
            <div role="alert" className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="scribe-blocked">
              <p className="font-medium text-destructive">{block.reason}</p>
              <p className="mt-1 text-muted-foreground">What to do: {block.next}</p>
            </div>
          )}
          <Button className="w-full sm:w-auto" disabled={!!block} onClick={start} data-testid="scribe-start-btn">Start AI scribe</Button>
        </Card>
      )}
      {live && live.state === "capturing" && (
        <Card className="p-4 space-y-3" data-testid="scribe-live">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg text-navy">Capturing…</h2><Badge variant="outline">{simulatedSurfaceLabel("scribe_simulated")}</Badge></div>
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {(live.transcript ?? []).slice(0, shown).map((t) => (
              <div key={t.id}><span className="text-[11px] uppercase text-muted-foreground">{SPEAKER[t.speaker]}{t.speakerConfidence < 0.7 ? " (?)" : ""}</span><p className={t.asrConfidence < 0.75 ? "underline decoration-dotted" : ""}>{t.text}</p></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={end} data-testid="scribe-end">End session</Button>
            <Button variant="outline" onClick={discard}>Stop and discard</Button>
            <Button variant="outline" onClick={withdrew}>Patient withdrew consent</Button>
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
  const view = useEhr(() => scribeView(sessionId, staff.role));
  const s = view.session;
  const note = useEhr(() => (s?.noteId ? AdelanteEHR._findNote(s.patientId, s.noteId).n : undefined));
  const [rating, setRating] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string; mode: "edit" | "keep" } | null>(null);
  const summary = useMemo(() => (s ? reviewSummary(s) : null), [s, note]);
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
  const sections = [...FORMAT_SECTIONS[s.format].map((x) => ({ key: x.key, label: x.label })), { key: "client_response", label: "Client response" }, { key: "next_steps", label: "Next steps" }];
  return (
    <Card className="p-4 space-y-3" data-testid="scribe-draft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-0 bg-destructive/15 text-destructive">{signed ? "Signed" : AI_DRAFT_LABEL}</Badge>
        <Badge variant="outline">{SCRIBE_FORMAT_LABEL[s.format]}</Badge>
        {s.includedSpanish && <Badge variant="outline">{SPANISH_MARKER}</Badge>}
        {!compact && <Link to="/record/$patientId" params={{ patientId: pid }} search={{ section: "notes" } as never} className="text-xs text-teal underline">Open in chart notes</Link>}
      </div>
      <p className="text-sm font-medium" data-testid="scribe-summary">{summary.total} sentences · {summary.sourced} sourced · {summary.unsupported} unsupported · {summary.speakerUncertain} speaker uncertain{summary.unsure ? ` · ${summary.unsure} unsure` : ""}</p>
      {opened && !signed && (
        <div className="flex flex-wrap gap-1 text-[11px]" data-testid="scribe-flag-jumps">
          {s.sentences.filter((x) => x.resolution?.kind !== "deleted" && ((x.unsupported && !x.resolution) || x.speakerUncertain)).map((x, i) => (
            <a key={x.id} href={`#snt-${x.id}`} className="rounded border px-1.5 py-0.5 text-teal">Flag {i + 1}: {x.unsupported && !x.resolution ? "unsupported" : "speaker"}</a>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{s.transcriptDeleted ? `Transcript deleted ${new Date(s.transcriptDeleted.at).toLocaleString()} by ${s.transcriptDeleted.by} (${s.transcriptDeleted.reason}).` : RETENTION_DRAFT_LABEL}</p>
      {!opened && !signed ? (
        <Button onClick={() => run(() => actFor("scribe_open_draft", "openAiDraft", pid, sessionId, actor))} data-testid="scribe-open">Open AI draft to review</Button>
      ) : (
        <>
          {sections.map((sec) => (
            <div key={sec.key}>
              <h4 className="text-xs font-medium text-navy">{sec.label}</h4>
              <ul className="space-y-1 text-sm">
                {s.sentences.filter((x) => x.sectionKey === sec.key && x.resolution?.kind !== "deleted").map((x) => {
                  const ex = x.sources.map((r) => ({ r, seg: segmentText(s, r.segmentId) }));
                  return (
                    <li key={x.id} id={`snt-${x.id}`} className="rounded border p-2" data-testid={x.unsupported && !x.resolution ? "unsupported-sentence" : "sentence"}>
                      <span title={ex.map(({ r, seg }) => `${SPEAKER[r.speaker]}: ${seg?.text ?? "(transcript deleted — ref " + r.segmentId + ")"}`).join("\n") || UNSUPPORTED_LABEL}>{x.text}</span>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        {x.unsupported && <Badge className="border-0 bg-destructive/15 text-destructive">{x.resolution ? `Resolved: ${x.resolution.kind}` : UNSUPPORTED_LABEL}</Badge>}
                        {x.speakerUncertain && <Badge variant="outline">{SPEAKER_UNCERTAIN_LABEL}</Badge>}
                        {x.unsure && <Badge variant="outline">{UNSURE_LABEL}</Badge>}
                        {ex.map(({ r }) => <Badge key={r.segmentId} variant="secondary">{SPEAKER[r.speaker]} · {r.atSec}s</Badge>)}
                      </div>
                      {!signed && (editing?.id === x.id ? (
                        <div className="mt-1 flex gap-1">
                          <Input value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} placeholder={editing.mode === "keep" ? "Reason to keep" : ""} />
                          <Button size="sm" onClick={() => run(() => { editing.mode === "edit" ? actFor("scribe_sentence_edit", "editAiSentence", pid, sessionId, x.id, editing.text, actor) : actFor("scribe_sentence_keep", "keepAiSentence", pid, sessionId, x.id, editing.text, actor); setEditing(null); setReviewed(false); })}>Save</Button>
                        </div>
                      ) : (
                        <div className="mt-1 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: x.id, text: x.text, mode: "edit" })}>Edit</Button>
                          {x.unsupported && !x.resolution && <Button size="sm" variant="ghost" onClick={() => setEditing({ id: x.id, text: "", mode: "keep" })}>Keep with reason</Button>}
                          <Button size="sm" variant="ghost" onClick={() => run(() => actFor("scribe_sentence_delete", "deleteAiSentence", pid, sessionId, x.id, actor))} data-testid="sentence-delete">Delete</Button>
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="text-xs"><span className="font-medium">Suggested follow-ups</span> (nothing is created unless you accept):
            {s.followUps.map((f) => (
              <div key={f.id} className="mt-1 flex items-center gap-2">{f.label}{f.acceptedAt ? <Badge variant="secondary">Accepted</Badge> : <Button size="sm" variant="outline" onClick={() => run(() => { actFor("scribe_followup_accept", "acceptAiFollowUp", pid, sessionId, f.id, actor); if (f.kind === "book_visit") openBookVisit({ patientId: pid }); else toast.message("Send it from the chart's Tracking section."); })}>Accept</Button>}</div>
            ))}
          </div>
          {!signed && (note.aiScribe?.reviewConfirmedAt ? (
            <p className="text-sm text-teal" data-testid="scribe-confirmed">Review confirmed — sign from the chart's notes.</p>
          ) : (
            <div className="space-y-2 rounded border p-2">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={reviewed} onCheckedChange={(v) => setReviewed(v === true)} data-testid="scribe-reviewed" /> I reviewed and edited this note</label>
              <div className="flex items-center gap-1 text-xs">Rate the draft: {[1, 2, 3, 4, 5].map((n) => <Button key={n} size="sm" variant={rating === n ? "default" : "outline"} onClick={() => setRating(n)}>{n}</Button>)}</div>
              <Button disabled={!reviewed || !rating} onClick={() => run(() => actFor("scribe_review_confirm", "confirmAiReview", pid, sessionId, actor, rating))} data-testid="scribe-confirm">Confirm review</Button>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}
