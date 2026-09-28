// §Signed-note revisions — addendum, correction (new version), void with
// approval, late-entry label and version history. The signed body above this
// panel is never edited in place.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, noteStatus, type ProgressNote } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { LATE_ENTRY_DRAFT_NOTE, NOTE_REVISION_LABEL } from "@/lib/noteRevisions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";

const SOAP = ["subjective", "objective", "assessment", "plan"] as const;

export function NoteRevisionPanel({
  patientId,
  note,
  canWrite,
}: {
  patientId: string;
  note: ProgressNote;
  canWrite: boolean;
}) {
  const { role, staffName, staffId, clinicianId } = useActingStaff();
  const [mode, setMode] = useState<null | "addendum" | "amend" | "void">(null);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [soap, setSoap] = useState<Record<(typeof SOAP)[number], string>>({
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
  });
  const status = noteStatus(note);
  if (status === "draft" || status === "declined") return null;

  const myId = clinicianId ?? staffId;
  const isAuthor =
    [note.signedById, note.clinicianId].some((i) => !!i && (i === myId || i === staffId)) ||
    note.signedBy === staffName;
  const canApprove = AdelanteEHR.canApproveNoteVoid(note, { staffId, clinicianId, name: staffName, role });
  const voided = !!note.voidedAt;
  const reset = () => {
    setMode(null);
    setText("");
    setReason("");
  };
  const run = (fn: () => void, ok: string) => {
    try {
      fn();
      toast.success(ok);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs" data-testid="note-revisions">
      <div className="flex flex-wrap gap-1.5">
        {voided && (
          <Badge variant="destructive" data-testid="note-voided">
            Voided — entered in error
          </Badge>
        )}
        {note.correctedAt && !voided && (
          <Badge className="border-0 bg-gold/30 text-navy" data-testid="note-corrected">
            Corrected · v{note.version}
          </Badge>
        )}
        {note.voidRequest && <Badge variant="outline">Void pending approval</Badge>}
        {note.lateEntry && (
          <Badge variant="outline" data-testid="note-late-entry" title={LATE_ENTRY_DRAFT_NOTE}>
            Late entry
          </Badge>
        )}
      </div>
      {voided && (
        <p className="rounded border border-destructive/40 bg-destructive/5 p-2 text-destructive">
          Voided by {note.voidedBy} (requested by {note.voidRequestedBy}) · <ClientDate value={note.voidedAt!} /> —{" "}
          {note.voidReason}
        </p>
      )}
      {note.correctedAt && !voided && (
        <p className="rounded border border-gold/60 bg-gold/10 p-2 text-navy">
          Corrected by {note.correctedBy} · <ClientDate value={note.correctedAt} /> — {note.correctionReason}
        </p>
      )}
      {note.lateEntry && (
        <p className="text-muted-foreground">
          Visit <ClientDate value={note.lateEntry.visitAt} /> · Signed <ClientDate value={note.lateEntry.signedAt} />.{" "}
          {LATE_ENTRY_DRAFT_NOTE}
        </p>
      )}

      {(note.addenda ?? []).length > 0 && (
        <div className="space-y-1.5" data-testid="note-addenda">
          <p className="font-medium text-navy">Addenda</p>
          {note.addenda!.map((a) => (
            <div key={a.id} className="rounded border border-border bg-secondary/20 p-2">
              <p className="whitespace-pre-wrap text-foreground/80">{a.text}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {a.byName} · <ClientDate value={a.at} />
              </p>
            </div>
          ))}
        </div>
      )}

      {note.voidRequest && canApprove && (
        <div className="rounded border border-destructive/40 p-2" data-testid="void-approval">
          <p className="text-navy">
            {note.voidRequest.byName} asked to void this note: “{note.voidRequest.reason}”
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                run(
                  () => AdelanteEHR.decideNoteVoid(patientId, note.id, { approve: true, staffId, clinicianId, name: staffName, role }),
                  "Note voided",
                )
              }
            >
              Approve void
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                run(
                  () => AdelanteEHR.decideNoteVoid(patientId, note.id, { approve: false, staffId, clinicianId, name: staffName, role }),
                  "Void declined",
                )
              }
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {canWrite && !voided && mode === null && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setMode("addendum")}>
            Add addendum
          </Button>
          {isAuthor && (
            <Button size="sm" variant="outline" onClick={() => setMode("amend")}>
              Correct note
            </Button>
          )}
          {isAuthor && !note.voidRequest && (
            <Button size="sm" variant="outline" onClick={() => setMode("void")}>
              Void (entered in error)
            </Button>
          )}
        </div>
      )}

      {mode === "addendum" && (
        <div className="space-y-2">
          <Label htmlFor={`add-${note.id}`}>Addendum (the original note stays unchanged)</Label>
          <Textarea id={`add-${note.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={text.trim().length < 3}
              onClick={() =>
                run(
                  () => AdelanteEHR.addNoteAddendum(patientId, note.id, { text, byId: myId, byName: staffName, role }),
                  "Addendum added",
                )
              }
            >
              Add addendum
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "amend" && (
        <div className="space-y-2">
          <p className="text-muted-foreground">
            Correcting creates a new version. The current version stays viewable as “Superseded”.
            {note.cosignRequired ? " The cosigner will need to cosign again." : ""}
          </p>
          {SOAP.map((k) => (
            <div key={k}>
              <Label htmlFor={`amend-${k}-${note.id}`} className="capitalize">
                {k}
              </Label>
              <Textarea
                id={`amend-${k}-${note.id}`}
                rows={2}
                value={soap[k]}
                onChange={(e) => setSoap((s) => ({ ...s, [k]: e.target.value }))}
              />
            </div>
          ))}
          <Label htmlFor={`amend-reason-${note.id}`}>Reason for correction (required)</Label>
          <Input id={`amend-reason-${note.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={reason.trim().length < 3}
              onClick={() =>
                run(
                  () =>
                    AdelanteEHR.amendProgressNote(patientId, note.id, {
                      changes: soap,
                      reason,
                      byId: myId,
                      byName: staffName,
                      role,
                    }),
                  "Note corrected — new version saved",
                )
              }
            >
              Save correction
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "void" && (
        <div className="space-y-2">
          <p className="text-muted-foreground">
            A supervisor or clinical coordinator must approve. The note stays viewable, marked “Voided”.
          </p>
          <Label htmlFor={`void-reason-${note.id}`}>Reason (required)</Label>
          <Input id={`void-reason-${note.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={reason.trim().length < 3}
              onClick={() =>
                run(
                  () => AdelanteEHR.requestNoteVoid(patientId, note.id, { reason, byId: myId, byName: staffName, role }),
                  "Void requested — waiting for approval",
                )
              }
            >
              Request void
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {((note.revisionLog ?? []).length > 0 || (note.priorVersions ?? []).length > 0) && (
        <details data-testid="note-version-history">
          <summary className="cursor-pointer font-medium text-navy">Version history</summary>
          <ul className="mt-2 space-y-1">
            {note.signedAt && (
              <li className="text-muted-foreground">
                Signed by {note.priorVersions?.[0]?.signedBy ?? note.signedBy} ·{" "}
                <ClientDate value={note.priorVersions?.[0]?.signedAt ?? note.signedAt} />
              </li>
            )}
            {(note.revisionLog ?? []).map((r, i) => (
              <li key={i} className="text-muted-foreground">
                {NOTE_REVISION_LABEL[r.action]} · {r.byName} · <ClientDate value={r.at} />
                {r.changed?.length ? ` · changed: ${r.changed.join(", ")}` : ""}
                {r.reason ? ` · why: ${r.reason}` : ""}
              </li>
            ))}
          </ul>
          {(note.priorVersions ?? []).map((v) => (
            <div key={v.version} className="mt-2 rounded border border-dashed border-border p-2 opacity-80" data-testid="note-superseded">
              <p className="font-medium text-navy">
                Version {v.version} — Superseded <ClientDate value={v.supersededAt} /> by {v.supersededBy}
              </p>
              <dl className="mt-1 space-y-1">
                {SOAP.map((k) =>
                  v[k] ? (
                    <div key={k}>
                      <dt className="capitalize text-muted-foreground">{k}</dt>
                      <dd className="text-foreground/70">{v[k]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
