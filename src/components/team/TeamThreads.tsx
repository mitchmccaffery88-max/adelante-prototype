// §U2 — staff-to-staff team threads (staff shell only).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Lock, MessageSquare, RotateCcw, ShieldAlert } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { actFor } from "@/lib/actions/act";
import {
  chartRefView,
  getThreadFor,
  listThreadsFor,
  openMentionsFor,
  participantOptions,
  readBy,
  SUD_THREAD_LABEL,
  THREAD_DRAFT_LABEL,
  unreadCount,
  type ChartRef,
  type StaffThread,
} from "@/lib/staffThreads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";

function useThreadActor() {
  const s = useActingStaff();
  return { staffId: s.staffId, name: s.staffName, role: s.role };
}

/** Start a care team thread (with a patient) or a direct thread (no patient). */
export function NewThreadForm({ patientId, onDone }: { patientId?: string; onDone?: (threadId: string) => void }) {
  const actor = useThreadActor();
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sud, setSud] = useState(false);
  const kind = patientId ? "care_team" : "direct";
  const options = participantOptions({ kind, patientId, containsSud: sud }, [actor.staffId]);
  const start = () => {
    try {
      const t = actFor<StaffThread>("message_team", "startStaffThread", patientId, { kind, patientId, subject, participantIds: picked, fromSudContent: sud }, actor);
      toast.success("Thread started");
      if (onDone) onDone(t.id);
      else navigate({ to: "/team-messages", search: { thread: t.id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-3 text-sm" data-testid="new-team-thread">
      <p className="text-xs text-muted-foreground">
        {patientId ? "Care team thread about this patient. Staff only — the patient never sees it." : "Direct staff thread — no patient. To discuss a patient, start from their chart."}
      </p>
      <label className="block">Subject<input aria-label="Thread subject" className="mt-1 w-full rounded-md border bg-background p-2" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
      {patientId && (
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sud} onChange={(e) => { setSud(e.target.checked); setPicked([]); }} /> {SUD_THREAD_LABEL}</label>
      )}
      <fieldset className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
        <legend className="px-1 text-xs">Participants</legend>
        {options.map(({ member, reason }) => (
          <label key={member.id} className={`flex items-start gap-2 text-xs ${reason ? "text-muted-foreground" : ""}`}>
            <input type="checkbox" disabled={!!reason} checked={picked.includes(member.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, member.id] : p.filter((x) => x !== member.id)))} />
            <span>{member.name}{reason && <span className="block">{reason}</span>}</span>
          </label>
        ))}
      </fieldset>
      <Button onClick={start} disabled={!patientId && picked.length === 0}>Start thread</Button>
    </div>
  );
}

export function ThreadList({ selected }: { selected?: string }) {
  const actor = useThreadActor();
  const threads = useEhr(() => listThreadsFor(actor));
  if (threads.length === 0) return <p className="p-3 text-sm text-muted-foreground">No team threads yet. Use “Message team” in + New or on a chart.</p>;
  return (
    <ul className="divide-y" data-testid="team-thread-list">
      {threads.map((t) => {
        const p = t.patientId ? AdelanteEHR.getPatient(t.patientId) : undefined;
        const unread = unreadCount(t, actor.staffId);
        return (
          <li key={t.id}>
            <Link to="/team-messages" search={{ thread: t.id }} className={`block p-3 text-sm hover:bg-muted ${selected === t.id ? "bg-muted" : ""}`}>
              <span className="flex items-center justify-between gap-2"><span className="truncate font-medium">{t.subject}</span>{unread > 0 && <Badge>{unread}</Badge>}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {p ? `${p.firstName} ${p.lastName}` : "Direct"} · {t.status === "resolved" ? "Resolved" : "Open"}{t.containsSud ? " · SUD" : ""}{t.escalationKey ? " · Escalation" : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ThreadView({ threadId }: { threadId: string }) {
  const actor = useThreadActor();
  const json = useEhr(() => JSON.stringify(getThreadFor(threadId, actor) ?? null));
  const t = JSON.parse(json) as StaffThread | null;
  const [body, setBody] = useState("");
  const [add, setAdd] = useState("");
  const myMentions = useEhr(() => openMentionsFor(actor.staffId).filter((m) => m.threadId === threadId).map((m) => m.id).join(","));
  const lastAt = t?.messages.at(-1)?.at;
  useEffect(() => {
    if (!t || !lastAt) return;
    const me = t.participants.find((p) => p.staffId === actor.staffId);
    if (me?.lastReadAt && me.lastReadAt >= lastAt) return;
    try { actFor("staff_thread_read", "markThreadRead", t.patientId, t.id, actor); } catch { /* not a participant */ }
  }, [threadId, lastAt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!t) return <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> This thread isn't available to you.</Card>;
  const patient = t.patientId ? AdelanteEHR.getPatient(t.patientId) : undefined;
  const run = (id: string, via: string, ...args: unknown[]) => {
    try { actFor(id, via, t.patientId, ...args); return true; } catch (e) { toast.error((e as Error).message); return false; }
  };
  const send = () => {
    const refs: ChartRef[] = [];
    if (run("staff_thread_post", "postThreadMessage", t.id, { body, refs }, actor)) setBody("");
  };
  const addOptions = participantOptions(t, t.participants.map((p) => p.staffId));
  return (
    <div className="space-y-3" data-testid="team-thread">
      <header className="space-y-1">
        <h2 className="font-display text-lg text-navy">{t.subject}</h2>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {patient ? <Link className="underline" to="/record/$patientId" params={{ patientId: patient.id }} search={{}}>{patient.firstName} {patient.lastName}</Link> : "Direct thread"}
          {t.containsSud && <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> {SUD_THREAD_LABEL}</Badge>}
          {t.escalationKey && <Link className="underline" to="/escalations" search={{ view: "all", type: undefined, overdue: undefined, owner: undefined }}>Linked escalation</Link>}
          <Badge variant="secondary">{t.status === "resolved" ? "Resolved" : "Open"}</Badge>
        </p>
        <p className="text-xs text-muted-foreground">With: {t.participants.map((p) => p.name).join(", ")} · <span className="text-amber-900">{THREAD_DRAFT_LABEL}</span></p>
      </header>
      {myMentions && (
        <Card className="flex items-center justify-between gap-2 border-amber-300 p-2 text-xs">
          <span>You were mentioned — reply or mark done.</span>
          <Button size="sm" variant="outline" onClick={() => myMentions.split(",").forEach((m) => run("staff_thread_mention_done", "markMentionDone", m, actor))}>Mark done</Button>
        </Card>
      )}
      <ol className="space-y-2">
        {t.messages.map((m) => (
          <li key={m.id} className="rounded-md border p-2 text-sm" data-testid="team-message">
            <p className="text-xs text-muted-foreground">{m.authorName} · <ClientDate value={m.at} /></p>
            <p className="whitespace-pre-wrap">{m.body}</p>
            {m.refs.map((r, i) => { const v = chartRefView(r, actor, patient); return v.canOpen && patient ? <Link key={i} className="block text-xs underline" to="/record/$patientId" params={{ patientId: patient.id }} search={{ section: r.sectionId }}>{v.text}</Link> : <span key={i} className="block text-xs text-muted-foreground">{v.text}</span>; })}
            {m.authorStaffId === actor.staffId && <p className="text-[11px] text-muted-foreground">{readBy(t, m).length ? `Read by ${readBy(t, m).join(", ")}` : "Not read yet"}</p>}
          </li>
        ))}
      </ol>
      {t.status === "open" ? (
        <div className="space-y-2">
          <textarea aria-label="Team message" rows={3} className="w-full rounded-md border bg-background p-2 text-sm" placeholder="Write a message. Use @Name to ask someone for a reply." value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={send} disabled={!body.trim()}><MessageSquare className="h-4 w-4" /> Send</Button>
            <Button variant="outline" onClick={() => run("staff_thread_resolve", "resolveStaffThread", t.id, actor)}><CheckCircle2 className="h-4 w-4" /> Resolve</Button>
            {t.kind === "care_team" && !t.containsSud && <Button variant="ghost" onClick={() => run("staff_thread_flag_sud", "flagThreadSud", t.id, actor)}>Flag as SUD</Button>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Add participant" className="rounded-md border bg-background p-1.5" value={add} onChange={(e) => setAdd(e.target.value)}>
              <option value="">Add a person…</option>
              {addOptions.map(({ member, reason }) => <option key={member.id} value={member.id} disabled={!!reason}>{member.name}{reason ? ` — ${reason}` : ""}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!add} onClick={() => { if (run("staff_thread_add_participant", "addThreadParticipant", t.id, add, actor)) setAdd(""); }}>Add</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => run("staff_thread_reopen", "reopenStaffThread", t.id, actor)}><RotateCcw className="h-4 w-4" /> Reopen</Button>
      )}
    </div>
  );
}
