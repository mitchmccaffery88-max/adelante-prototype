// Agentic Chart Review — open a referenced note in a side panel. Same access
// and Part 2 checks as the chart: no therapy_notes access → no body; a note
// whose gate class is locked for this role shows only a protected notice.
import { Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr, type ProgressNote } from "@/lib/ehr";
import { canAccess, getStaffMember, noteGateClass, useActingStaff } from "@/lib/roles";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { NoteRevisionPanel } from "@/components/clinical/NoteRevisionPanel";

export function noteVisibleToRole(
  role: Parameters<typeof canAccess>[0],
  patient: Parameters<typeof canAccess>[2],
  note: ProgressNote,
): { visible: boolean; reason?: string } {
  const base = canAccess(role, "therapy_notes", patient);
  if (base.level === "none" || base.locked) return { visible: false, reason: base.reason };
  const cls = noteGateClass(note);
  if (cls) {
    const g = canAccess(role, cls, patient);
    if (g.level === "none" || g.locked) return { visible: false, reason: g.reason };
  }
  return { visible: true };
}

export function NotePeekSheet({
  patientId,
  noteId,
  onOpenChange,
}: {
  patientId: string;
  noteId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { role } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const note = patient?.progressNotes?.find((n) => n.id === noteId);
  const gate = patient && note ? noteVisibleToRole(role, patient, note) : { visible: false };
  const author = note
    ? (getStaffMember(note.clinicianId)?.name ?? note.signedBy ?? note.clinicianId)
    : "";
  return (
    <Sheet open={!!noteId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg" data-testid="note-peek">
        <SheetTitle>Progress note</SheetTitle>
        {note && (
          <SheetDescription>
            {author} · <ClientDate value={note.date} /> · {note.sessionType.replace("_", " ")}
          </SheetDescription>
        )}
        {!note ? (
          <p className="mt-4 text-sm text-muted-foreground">This note is not available.</p>
        ) : !gate.visible ? (
          <p className="mt-4 rounded-md border p-3 text-sm text-muted-foreground" data-testid="note-peek-locked">
            This note is protected and is not shown for your role.
          </p>
        ) : (
          <div className="mt-4 space-y-3 text-sm" data-testid="note-peek-body">
            {(["subjective", "objective", "assessment", "plan"] as const).map((k) =>
              note[k] ? (
                <div key={k}>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k}</div>
                  <p className="whitespace-pre-wrap">{note[k]}</p>
                </div>
              ) : null,
            )}
            <NoteRevisionPanel patientId={patientId} note={note} canWrite={false} />
          </div>
        )}
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/record/$patientId" params={{ patientId }} search={{ section: "notes" }}>
            Open in the chart
          </Link>
        </Button>
      </SheetContent>
    </Sheet>
  );
}
