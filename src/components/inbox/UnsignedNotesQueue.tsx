import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
// §Inbox — cross-patient list of MY unsigned drafts, oldest-first.
//
// Aging reuses `timeOpenLabel` from CrisisPanel (the pattern already used by
// the crisis queue) rather than inventing a second age format; the tone
// thresholds are shared with the request queue below via `queueAgeTone`.
import { useEhr } from "@/lib/ehr";
import { listUnsignedWork } from "@/lib/unsignedWork";

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
  return "bg-surface-sunk text-attention border-0 text-[10px]";
}

export function UnsignedNotesQueue() {
  const { clinicianId, staffId } = useActingStaff();
  const authorId = clinicianId ?? staffId;
  // §EHR audit Phase 1a — same derivation as /notes-queue and the clinician
  // tile, scoped to my own work.
  const rows = useEhr(() => listUnsignedWork({ authorId }));

  if (rows.length === 0) {
    return <EmptyState icon={FileText} title="No unsigned notes" description="Nothing of yours is sitting in draft." />;
  }

  return (
    <StaffTable rows={rows} rowKey={(r)=>r.id} label="Your unsigned notes" testId="inbox-unsigned-table"
      views={[{id:"needs",label:"Needs you",matches:()=>true}]} defaultView="needs"
      columns={[
        {id:"patient",label:"Patient",sortValue:(r)=>`${r.patient.firstName} ${r.patient.lastName}`,cell:(r)=>`${r.patient.firstName} ${r.patient.lastName}`},
        {id:"note",label:"Note",sortValue:(r)=>r.kind === "undocumented_encounter" ? "Attended visit — no note written yet" : r.note?.templateTitle ?? "note",cell:(r)=>r.kind === "undocumented_encounter" ? "Attended visit — no note written yet" : (r.note?.templateTitle ?? `${r.note?.sessionType.replace("_", " ")} note`)},
        {id:"date",label:"Date",sortValue:(r)=>r.date,cell:(r)=><>{r.kind === "undocumented_encounter" ? "Visit " : "Drafted "}<ClientDate value={r.date} /></>},
        {id:"age",label:"Waiting",sortValue:(r)=>r.date,cell:(r)=><StatusChip lang="en" state="yourturn" label={timeOpenLabel(r.date)} />},
      ]}
      primaryAction={(r)=><Button asChild size="sm" variant="outline"><Link to="/record/$patientId" params={{patientId:r.patient.id}} search={{section:"notes"}}>Open note</Link></Button>}
    />
  );
}

