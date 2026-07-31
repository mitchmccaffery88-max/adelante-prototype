// §Inbox — cross-patient list of MY unsigned drafts, oldest-first.
//
// Aging reuses `timeOpenLabel` from CrisisPanel (the pattern already used by
// the crisis queue) rather than inventing a second age format; the tone
// thresholds are shared with the request queue below via `queueAgeTone`.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { timeOpenLabel } from "@/components/clinical/CrisisPanel";
import { FileText } from "lucide-react";

/** Shared aging tone: fresh < 24h, stale < 72h, overdue beyond that. */
export function queueAgeTone(iso: string, now: number = Date.now()): string {
  const hrs = (now - +new Date(iso)) / 3_600_000;
  if (hrs < 24) return "bg-muted text-muted-foreground border-0 text-[10px]";
  if (hrs < 72) return "bg-warning/20 text-navy border-0 text-[10px]";
  return "bg-destructive/15 text-destructive border-0 text-[10px]";
}

export function UnsignedNotesQueue() {
  const { clinicianId, staffId } = useActingStaff();
  const authorId = clinicianId ?? staffId;
  const rows = useEhr(() => AdelanteEHR.listDraftNotesBy(authorId));

  if (rows.length === 0) {
    return <EmptyState icon={FileText} title="No unsigned notes" description="Nothing of yours is sitting in draft." />;
  }

  return (
    <ul className="space-y-2">
      {rows.map(({ patient, note }) => (
        <Card key={note.id} className="p-3 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/record/$patientId"
              params={{ patientId: patient.id }}
              search={{ section: "notes" }}
              className="font-display text-base text-navy underline-offset-2 hover:underline"
            >
              {patient.firstName} {patient.lastName}
            </Link>
            <Badge className={queueAgeTone(note.date)}>{timeOpenLabel(note.date)}</Badge>
          </div>
          <p className="text-navy">
            {note.templateTitle ?? `${note.sessionType.replace("_", " ")} note`}
          </p>
          <p className="text-muted-foreground">
            Drafted <ClientDate value={note.date} />
          </p>
        </Card>
      ))}
    </ul>
  );
}
