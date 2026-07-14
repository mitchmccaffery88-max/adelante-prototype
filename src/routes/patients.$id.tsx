import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  EMR, useEMR, accessFor, resolveGate, isWritable,
  EPISODE_LABEL, LANE_LABEL, tMinusDays,
  type Access, type RecordClass, type Person,
} from "@/lib/emr";
import { docsForPerson } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Lock, ShieldAlert, Phone, Calendar, HelpCircle, FileText,
  Pill, HandHeart, Users, ClipboardList, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { ClientDate } from "@/components/ClientDate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/patients/$id")({
  head: () => ({ meta: [{ title: "Patient chart — Adelante wireframe" }] }),
  component: PatientChart,
});

type TabId =
  | "overview" | "psych" | "therapy" | "care_plan" | "sdoh" | "self_help"
  | "medications" | "cm_notes" | "peer_notes" | "documents"
  | "sud" | "consent" | "audit";

const TABS: { id: TabId; label: string; recordClass: RecordClass; icon?: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", recordClass: "demographics" },
  { id: "psych", label: "Psych eval", recordClass: "psych_eval" },
  { id: "therapy", label: "Therapy notes", recordClass: "therapy_notes" },
  { id: "care_plan", label: "Care plan", recordClass: "care_plan" },
  { id: "sdoh", label: "SDOH plan", recordClass: "sdoh_plan" },
  { id: "self_help", label: "Self-help", recordClass: "self_help" },
  { id: "medications", label: "Medications", recordClass: "medications" },
  { id: "cm_notes", label: "Case mgmt notes", recordClass: "case_management" },
  { id: "peer_notes", label: "Peer contacts", recordClass: "peer_contacts" },
  { id: "documents", label: "Documents", recordClass: "documents" },
  { id: "sud", label: "SUD / DMC-ODS", recordClass: "sud_treatment" },
  { id: "consent", label: "Consent ledger", recordClass: "demographics" },
  { id: "audit", label: "Audit", recordClass: "audit" },
];

function PatientChart() {
  const { id } = Route.useParams();
  const person = useEMR((s) => s.people.find((p) => p.id === id));
  const role = useEMR((s) => s.role);
  const [tab, setTab] = useState<TabId>("overview");

  if (!person) {
    return (
      <div className="p-6"><Link to="/patients" className="text-teal hover:underline"><ArrowLeft className="inline h-4 w-4" /> Back</Link>
        <p className="mt-4">Person not found.</p></div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <Link to="/patients" className="text-xs text-teal hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to patients
      </Link>

      <ChartHeader person={person} />

      <div className="border-b overflow-x-auto">
        <div className="flex gap-0.5 min-w-max">
          {TABS.map((t) => {
            const acc = t.id === "consent" ? "read" : accessFor(role, t.recordClass);
            if (acc === "none") return null;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors",
                  tab === t.id ? "border-teal text-teal font-medium" : "border-transparent text-foreground/60 hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>{renderTab(tab, person)}</div>
    </div>
  );
}

function ChartHeader({ person }: { person: Person }) {
  const role = useEMR((s) => s.role);
  const activePart2 = person.consents.find((c) => c.type === "part2_sud" && c.status === "active");
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{person.firstName} {person.lastName}</h1>
            <Badge variant="outline" className="text-[10px]">Person ID {person.id}</Badge>
            <span className="text-xs text-muted-foreground">DOB {person.dob}</span>
            {person.cin && <span className="text-xs text-muted-foreground font-mono">CIN ••••{person.cin.slice(-4)}</span>}
          </div>
          <div className="mt-2 flex gap-1 flex-wrap">
            {person.episodes.map((e) => (
              <span key={e.id} className="text-xs rounded-full bg-teal/10 text-teal px-2 py-0.5">
                {EPISODE_LABEL[e.type]} · {e.status.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {person.releaseDate && (
            <div className="rounded-md border px-3 py-2 text-xs">
              <div className="font-medium">Release date</div>
              <div>{person.releaseDate.expected} · <span className="capitalize">{person.releaseDate.confidence}</span></div>
              <div className="text-muted-foreground">{tMinusDays(person.releaseDate.expected)} · {person.releaseDate.history.length} changes</div>
            </div>
          )}
          <div className="rounded-md border px-3 py-2 text-xs">
            <div className="font-medium">Consents</div>
            <div>Part 2: {activePart2 ? <span className="text-success font-medium">Active</span> : <span className="text-destructive">Not active</span>}</div>
          </div>
          <CrisisButton personId={person.id} />
        </div>
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">
        Viewing as <b className="text-foreground">{role.replace(/_/g, " ")}</b> — sections and edit controls change with the role.
      </div>
    </Card>
  );
}

function CrisisButton({ personId }: { personId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Crisis
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setOpen(false)}>
          <Card className="max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Crisis escalation</h3>
            <p className="text-xs text-muted-foreground">Two ladders — different responders and clocks. Peer specialist is not the terminal contact for acute risk.</p>
            <button className="w-full text-left rounded-md border p-3 hover:bg-secondary"
              onClick={() => { EMR.logEscalation(personId, "clinical_crisis"); toast.success("988 escalation logged"); setOpen(false); }}>
              <div className="flex items-center gap-2 font-medium text-destructive"><Phone className="h-4 w-4" /> Immediate risk → 988</div>
              <p className="text-xs text-muted-foreground mt-1">Life-safety. Clock: immediate.</p>
            </button>
            <button className="w-full text-left rounded-md border p-3 hover:bg-secondary"
              onClick={() => { EMR.logEscalation(personId, "clinical_crisis"); toast.success("Clinician paged"); setOpen(false); }}>
              <div className="font-medium">Urgent clinical → notify clinician</div>
              <p className="text-xs text-muted-foreground mt-1">Clock: same day.</p>
            </button>
            <button className="w-full text-left rounded-md border p-3 hover:bg-secondary"
              onClick={() => { EMR.logEscalation(personId, "sdoh_urgent"); toast.success("Case manager notified"); setOpen(false); }}>
              <div className="font-medium">Urgent social/SDOH → notify case manager</div>
              <p className="text-xs text-muted-foreground mt-1">Clock: 24–48h.</p>
            </button>
          </Card>
        </div>
      )}
    </>
  );
}

function renderTab(tab: TabId, person: Person) {
  switch (tab) {
    case "overview": return <OverviewTab person={person} />;
    case "psych": return <Gated person={person} rc="psych_eval"><PsychTab person={person} /></Gated>;
    case "therapy": return <Gated person={person} rc="therapy_notes"><NotesTab person={person} kind="therapy_note" title="Therapy progress notes" /></Gated>;
    case "care_plan": return <Gated person={person} rc="care_plan"><CarePlanTab person={person} /></Gated>;
    case "sdoh": return <Gated person={person} rc="sdoh_plan"><SDOHTab person={person} /></Gated>;
    case "self_help": return <Gated person={person} rc="self_help"><SelfHelpTab person={person} /></Gated>;
    case "medications": return <Gated person={person} rc="medications"><MedicationsTab person={person} /></Gated>;
    case "cm_notes": return <Gated person={person} rc="case_management"><NotesTab person={person} kind="cm_note" title="Case management notes" /></Gated>;
    case "peer_notes": return <Gated person={person} rc="peer_contacts"><PeerTab person={person} /></Gated>;
    case "documents": return <Gated person={person} rc="documents"><DocumentsTab person={person} /></Gated>;
    case "sud": return <Gated person={person} rc="sud_treatment"><SUDTab person={person} /></Gated>;
    case "consent": return <ConsentTab person={person} />;
    case "audit": return <Gated person={person} rc="audit"><AuditTab personId={person.id} /></Gated>;
  }
}

function Gated({ person, rc, children }: { person: Person; rc: RecordClass; children: React.ReactNode }) {
  const role = useEMR((s) => s.role);
  const gate = resolveGate(person, role, rc);
  if (gate.access === "none") return <LockedCard reason="Your role has no access to this section." />;
  if (!gate.unlocked) return <LockedCard reason={gate.reason} showConsentLink />;
  return <>{children}</>;
}

function LockedCard({ reason, showConsentLink }: { reason: string; showConsentLink?: boolean }) {
  return (
    <Card className="p-6 flex items-start gap-3 border-warning/30 bg-warning/5">
      <Lock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <div className="font-medium">Locked</div>
        <p className="text-muted-foreground">{reason}</p>
        {showConsentLink && <p className="text-xs mt-1 text-teal">See <b>Consent ledger</b> tab for status.</p>}
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer inline-flex items-center gap-1"><HelpCircle className="h-3 w-3" /> Why can't I see this?</summary>
          <p className="mt-1">42 CFR Part 2 requires specific patient consent before SUD-identifying records can be viewed outside the prescriber pathway.</p>
        </details>
      </div>
    </Card>
  );
}

function OverviewTab({ person }: { person: Person }) {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-2 space-y-3">
        <h3 className="font-semibold text-sm">Problem list</h3>
        <ul className="text-sm list-disc pl-5">{person.problems.length ? person.problems.map((p, i) => <li key={i}>{p}</li>) : <li className="text-muted-foreground list-none">No problems documented.</li>}</ul>
        <h3 className="font-semibold text-sm pt-2">Active diagnoses (ICD-10)</h3>
        <ul className="text-sm">{person.diagnoses.map((d, i) => <li key={i}><b>{d.code}</b> {d.label}</li>)}</ul>
        <h3 className="font-semibold text-sm pt-2">Recent events</h3>
        <ul className="text-sm">
          {person.events.slice(0, 6).map((e) => (
            <li key={e.id} className="border-b py-1.5 last:border-0 flex items-center justify-between gap-2">
              <span className="truncate">{e.title}</span>
              <span className="text-xs text-muted-foreground shrink-0"><ClientDate value={e.at} /></span>
              <Badge variant="outline" className="text-[9px]">{LANE_LABEL[e.lane]}</Badge>
              {e.part2 && <Badge className="text-[9px] bg-destructive/15 text-destructive border-0">Part 2</Badge>}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-teal" /><b>Next appointment</b></div>
        <p className="text-sm">{person.nextAppointmentAt ? <ClientDate value={person.nextAppointmentAt} /> : <span className="text-muted-foreground">None scheduled</span>}</p>
        <div className="pt-2 border-t"><b className="text-sm">Current meds</b>
          <ul className="text-sm">{person.medications.map((m) => <li key={m.id}>{m.name} {m.dose}</li>)}</ul></div>
        <div className="pt-2 border-t"><b className="text-sm">Risk flags</b>
          <p className="text-xs capitalize">{person.riskTier} risk · {person.tags?.join(", ")}</p></div>
      </Card>
    </div>
  );
}

function PsychTab({ person }: { person: Person }) {
  const role = useEMR((s) => s.role);
  const canWrite = isWritable(accessFor(role, "psych_eval"));
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Psych evaluation (CPT 90791)</h3>
        <Badge variant="outline" className="text-[10px]">PMHNP-authored</Badge>
      </div>
      <p className="text-xs text-muted-foreground">Assessment scoring thresholds require PMHNP authorship.</p>
      <Section label="Presenting problem">{person.problems.join(", ") || "—"}</Section>
      <Section label="History">Reviewed at intake.</Section>
      <Section label="Mental status">Alert, oriented ×3.</Section>
      <Section label="Diagnosis">{person.diagnoses.map((d) => `${d.code} ${d.label}`).join("; ")}</Section>
      <Section label="Safety assessment">No active SI/HI at this visit.</Section>
      <div className="text-xs text-muted-foreground">
        Author: Dr. R. Bagga, PMHNP · <ClientDate value={new Date().toISOString()} />
      </div>
      {canWrite && <Button size="sm" onClick={() => { EMR.addEvent(person.id, { episodeId: person.episodes[0].id, kind: "psych_eval", at: new Date().toISOString(), author: "Dr. R. Bagga", authorRole: "pmhnp", lane: "medicaid_ffs", title: "Psych eval addendum" }); toast.success("Addendum saved"); }}>Add addendum</Button>}
    </Card>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-sm">{children}</div></div>;
}

function NotesTab({ person, kind, title }: { person: Person; kind: "therapy_note" | "cm_note"; title: string }) {
  const role = useEMR((s) => s.role);
  const rc: RecordClass = kind === "therapy_note" ? "therapy_notes" : "case_management";
  const canWrite = isWritable(accessFor(role, rc));
  const notes = person.events.filter((e) => e.kind === kind);
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {canWrite && (
          <Button size="sm" onClick={() => { EMR.addEvent(person.id, { episodeId: person.episodes[0].id, kind, at: new Date().toISOString(), author: role, authorRole: role, lane: "medicaid_ffs", title: kind === "therapy_note" ? "Session note" : "Check-in note" }); toast.success("Note added"); }}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Add note
          </Button>
        )}
      </div>
      <ul className="text-sm divide-y">
        {notes.length ? notes.map((n) => (
          <li key={n.id} className="py-2 flex items-center justify-between gap-2">
            <span>{n.title}</span>
            <span className="text-xs text-muted-foreground"><ClientDate value={n.at} /></span>
            <Badge variant="outline" className="text-[9px]">{LANE_LABEL[n.lane]}</Badge>
          </li>
        )) : <li className="py-4 text-muted-foreground text-sm">No notes yet.</li>}
      </ul>
    </Card>
  );
}

function CarePlanTab({ person }: { person: Person }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold">Clinical care plan</h3>
      <p className="text-xs text-muted-foreground">The shared spine — CM + clinical write.</p>
      <Section label="Goals">{person.carePlan.goals.length ? person.carePlan.goals.join("; ") : "Stabilize depression symptoms; establish weekly CM contact."}</Section>
      <Section label="Interventions">{person.carePlan.interventions.length ? person.carePlan.interventions.join("; ") : "Weekly therapy (LCSW); monthly med-mgmt (PMHNP)."}</Section>
      <Section label="Responsible">{person.carePlan.responsible}</Section>
    </Card>
  );
}

function SDOHTab({ person }: { person: Person }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold">Community resource / SDOH plan</h3>
      <p className="text-xs text-muted-foreground">Closed-loop referral states: Sent · Accepted · Scheduled · Completed · Not completed.</p>
      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        {(["housing","food","transport","benefits"] as const).map((c) => (
          <div key={c} className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">{c}</div>
            <div>—</div>
            <Badge variant="outline" className="mt-1 text-[10px]">Sent</Badge>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Patient can read/edit their own SDOH plan.</p>
    </Card>
  );
}

function SelfHelpTab({ person }: { person: Person }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold">Self-help care plan</h3>
      <ul className="text-sm">
        {person.selfHelp.length ? person.selfHelp.map((m) => (
          <li key={m.id} className="border-b py-2 last:border-0 flex items-center justify-between">
            <span>{m.module} · {m.cadence}</span>
            <span className="text-xs text-muted-foreground">{m.completedDates.length} completions</span>
          </li>
        )) : <li className="text-muted-foreground">No modules assigned.</li>}
      </ul>
    </Card>
  );
}

function MedicationsTab({ person }: { person: Person }) {
  const role = useEMR((s) => s.role);
  const canWrite = isWritable(accessFor(role, "medications"));
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Pill className="h-4 w-4 text-teal" /> Medications</h3>
        {canWrite && <Button size="sm" onClick={() => toast.success("Sent to DoseSpot (mock)")}>Send to DoseSpot (stub)</Button>}
      </div>
      <ul className="text-sm divide-y">
        {person.medications.map((m) => (
          <li key={m.id} className="py-2 flex justify-between">
            <span>{m.name} · {m.dose} {m.epcs && <Badge className="ml-1 text-[9px] bg-destructive/15 text-destructive border-0">EPCS</Badge>}</span>
            <span className="text-xs text-muted-foreground">Prescribed <ClientDate value={m.prescribedAt} dateOnly /> · {m.prescriber}</span>
          </li>
        ))}
        {!person.medications.length && <li className="text-muted-foreground py-2">No active medications.</li>}
      </ul>
      <p className="text-xs text-muted-foreground">Buprenorphine continuity uses the EPCS path — stubbed only.</p>
    </Card>
  );
}

function PeerTab({ person }: { person: Person }) {
  const [billable, setBillable] = useState(false);
  const notes = person.events.filter((e) => e.kind === "peer_contact");
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><HandHeart className="h-4 w-4 text-teal" /> Peer contact log</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
        Billable peer encounter? (SB 803) — requires episode + note type
      </label>
      <Button size="sm" onClick={() => { EMR.addEvent(person.id, { episodeId: person.episodes[0].id, kind: "peer_contact", at: new Date().toISOString(), author: "Peer", authorRole: "peer_specialist", lane: billable ? "medicaid_ffs" : "non_billable", title: "Peer outreach contact" }); toast.success("Peer contact logged"); }}>Log contact</Button>
      <ul className="text-sm divide-y">
        {notes.map((n) => <li key={n.id} className="py-1.5 flex justify-between"><span>{n.title}</span><Badge variant="outline" className="text-[9px]">{LANE_LABEL[n.lane]}</Badge></li>)}
      </ul>
    </Card>
  );
}

function DocumentsTab({ person }: { person: Person }) {
  const [name, setName] = useState("release_paperwork.pdf");
  const docs = docsForPerson(person.id);
  useEMR((s) => s.people); // subscribe
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold">Documents</h3>
      <div className="flex gap-2 text-sm">
        <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded-md px-2 py-1 flex-1" />
        <Button size="sm" onClick={() => { EMR.addUploadedDoc(person.id, name); toast.success("Uploaded — Unverified"); }}>Upload (mock)</Button>
      </div>
      <p className="text-xs text-muted-foreground">Phone-assisted upload available for patients without a device. Scanned — no threats.</p>
      <ul className="text-sm divide-y">
        {docs.map((d) => (
          <li key={d.id} className="py-2 flex items-center justify-between gap-2">
            <span className="flex-1 truncate">{d.fileName}</span>
            {d.part2 && <Badge className="text-[9px] bg-destructive/15 text-destructive border-0">Carries redisclosure prohibition</Badge>}
            <Badge variant="outline" className={cn("text-[10px]", d.verified ? "text-success" : "text-warning")}>{d.verified ? "Verified" : "Unverified"}</Badge>
          </li>
        ))}
        {!docs.length && <li className="text-muted-foreground py-2">No documents.</li>}
      </ul>
    </Card>
  );
}

function SUDTab({ person }: { person: Person }) {
  const sudEp = person.episodes.find((e) => e.type === "SUD");
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold">SUD / DMC-ODS</h3>
      <p className="text-xs text-muted-foreground">Part 2-segmented per RBAC. Inherits protection.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-md border p-3">
          <div className="text-xs uppercase text-muted-foreground">Episode state</div>
          <div className="text-sm capitalize">{sudEp?.status.replace(/_/g, " ") ?? "—"}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs uppercase text-muted-foreground">ASAM level (stub)</div>
          <div className="text-sm">1.0 (recommended)</div>
          <p className="text-[10px] text-muted-foreground mt-1">Validated ASAM tool integrates post-MVP; scoring preserved, not AI-rewritten.</p>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs uppercase text-muted-foreground">MAT / meds</div>
          <div className="text-sm">Buprenorphine continuity via stubbed EPCS path.</div>
        </div>
      </div>
      <div>
        <b className="text-sm">LPHA routing</b>
        <p className="text-xs text-muted-foreground">Counselor assessments route to an LPHA (LCSW/LMFT/LPC/therapist) for review + diagnosis. LPHA is a permission, not a job title.</p>
      </div>
    </Card>
  );
}

function ConsentTab({ person }: { person: Person }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4 text-teal" /> Consent ledger</h3>
      <p className="text-xs text-muted-foreground">Revoking a Part 2 consent immediately re-locks the corresponding chart sections and writes an audit entry.</p>
      <ul className="text-sm divide-y">
        {person.consents.map((c) => (
          <li key={c.id} className="py-2 flex items-center justify-between gap-2">
            <div>
              <div className="font-medium capitalize">{c.type.replace(/_/g, " ")}</div>
              <div className="text-xs text-muted-foreground">Scope: {c.scope}{c.recipients.length ? ` · Recipients: ${c.recipients.join(", ")}` : ""}</div>
            </div>
            <Badge variant="outline" className={cn("text-[10px] capitalize",
              c.status === "active" && "text-success",
              c.status === "revoked" && "text-destructive",
              c.status === "offered" && "text-warning",
            )}>{c.status.replace(/_/g, " ")}</Badge>
            {c.status === "active" ? (
              <Button size="sm" variant="outline" onClick={() => { EMR.revokeConsent(person.id, c.id); toast.success("Consent revoked · sections re-locked"); }}>Revoke</Button>
            ) : c.status !== "expired" && (
              <Button size="sm" variant="outline" onClick={() => { EMR.reactivateConsent(person.id, c.id); toast.success("Consent activated"); }}>Activate</Button>
            )}
          </li>
        ))}
      </ul>
      <div className="pt-3 border-t">
        <b className="text-sm">Disclosure log</b>
        <p className="text-xs text-muted-foreground mt-1">Who received what, when, under which consent. (No disclosures yet in this demo.)</p>
      </div>
    </Card>
  );
}

function AuditTab({ personId }: { personId: string }) {
  const audit = useEMR((s) => s.audit).filter((a) => !a.personId || a.personId === personId);
  return (
    <Card className="p-5 space-y-2">
      <h3 className="font-semibold">Audit</h3>
      <p className="text-xs text-muted-foreground">Break-glass access — this view is itself logged.</p>
      <ul className="text-sm divide-y">
        {audit.map((a) => (
          <li key={a.id} className="py-1.5 text-xs"><ClientDate value={a.at} /> · <b>{a.actor}</b> ({a.actorRole}) — {a.action}</li>
        ))}
      </ul>
    </Card>
  );
}
