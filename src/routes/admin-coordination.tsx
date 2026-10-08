import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AdelanteEHR, STAFF_CANCEL_REASON_LABEL, useEhr, type Appointment, type StaffCancelReason } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";
import { STAFF_ROSTER, getSupervisor, requiresSupervision, useActingStaff } from "@/lib/roles";
import { ClientDate } from "@/components/ClientDate";
import { PostEnrollmentSetupCard } from "@/components/PostEnrollmentSetupCard";
import { reassignNeededItems } from "@/lib/staffLifecycle";
import {
  COORDINATION_ACTION_LABEL,
  REASSIGN_REASONS,
  canActOnCoordination,
  canViewCoordination,
  coordinationCancel,
  eligibleReassignTargets,
  listCoordinationAudit,
  listUnassignedPatients,
  reasonLabel,
  reassignCoverage,
  recordManualRebook,
  type ReassignReason,
} from "@/lib/coordination";

export const Route = createFileRoute("/admin-coordination")({
  head: () => ({
    meta: [
      { title: "Clinical Coordination — Adelante" },
      { name: "description", content: "Route intakes, resolve booking conflicts, and cover deactivated providers." },
      { property: "og:title", content: "Clinical Coordination — Adelante" },
      { property: "og:description", content: "Cover frozen providers, reassign visits with a reason, and find unassigned patients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoordinationPage,
});

function CoordinationPage() {
  const actor = useActingStaff();
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const profiles = useEhrExt(() => AdelanteEHRExt.listClinicianProfiles());
  const appts = useEhr(() => AdelanteEHR.listAppointments());
  const audit = useEhr(() => listCoordinationAudit());
  const unassigned = useEhr(() => listUnassignedPatients());
  const reassignNeeded = useEhr(() => reassignNeededItems());

  const canAct = canActOnCoordination(actor.role);
  if (!canViewCoordination(actor.role))
    return (
      <div className="mx-auto max-w-3xl px-4 py-8" data-testid="coordination-blocked">
        <Card className="p-4 text-sm">Clinical Coordination is for clinical coordinators, system administrators, and (view only) therapists, PMHNPs and ECM providers.</Card>
      </div>
    );

  const frozenIds = new Set(profiles.filter((p) => !p.active).map((p) => p.clinicianId));
  const affectedAppts = appts.filter(
    (a) => frozenIds.has(a.clinicianId) && a.status === "scheduled" && +new Date(a.start) > Date.now(),
  );
  const nameOf = (id?: unknown) => clinicians.find((c) => c.id === id)?.name ?? String(id ?? "—");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl text-navy">
            Clinical coordination center
            {!canAct && (
              <Badge variant="outline" className="ml-2 align-middle" data-testid="view-only">
                View only
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Cover deactivated providers, route unassigned patients, and confirm bookings.
          </p>
        </div>
        <Link to="/admin" className="text-sm underline">← Admin</Link>
      </header>

      {canAct && reassignNeeded.length > 0 && (
        <section data-testid="reassign-needed" className="space-y-2">
          <h2 className="font-semibold">Reassign needed</h2>
          <ul className="divide-y text-sm">
            {reassignNeeded.map((row) => (
              <li key={row.staffId} className="py-2">
                <b>{row.name}</b> · {row.counts.notesToSign} notes to sign · {row.counts.tasks} tasks · {row.counts.escalations} escalations · {row.counts.caseload} patients
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card className="p-4" data-testid="coverage-list">
        <h2 className="font-semibold mb-2">Frozen clinicians · appointments needing coverage ({affectedAppts.length})</h2>
        {affectedAppts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No future appointments on frozen clinicians.</p>
        ) : (
          <ul className="divide-y">
            {affectedAppts.map((a) => {
              const pt = patients.find((p) => p.id === a.patientId);
              return (
                <CoverageRow
                  key={a.id}
                  appt={a}
                  label={`${pt?.firstName ?? ""} ${pt?.lastName ?? ""}`}
                  clinicianName={nameOf(a.clinicianId)}
                  canAct={canAct}
                />
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4" data-testid="unassigned-list">
        <h2 className="font-semibold mb-2">Unassigned patients ({unassigned.length})</h2>
        {unassigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every patient has an active primary clinician.</p>
        ) : (
          <>
            <details open data-testid="unassigned-lost">
              <summary className="cursor-pointer text-sm font-medium py-1">
                Lost clinician (frozen / reassigned away) ({unassigned.filter((u) => u.cause === "lost").length})
              </summary>
              <UnassignedRows rows={unassigned.filter((u) => u.cause === "lost")} nameOf={nameOf} />
            </details>
            <details data-testid="unassigned-never">
              <summary className="cursor-pointer text-sm font-medium py-1">
                Never assigned ({unassigned.filter((u) => u.cause === "never").length})
              </summary>
              <UnassignedRows rows={unassigned.filter((u) => u.cause === "never")} nameOf={nameOf} />
            </details>
          </>
        )}
      </Card>

      {canAct && <PostEnrollmentSetupCard />}

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Clinician status</h2>
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="clinician-status">
          {profiles.map((p) => {
            const cl = clinicians.find((c) => c.id === p.clinicianId);
            const staff = STAFF_ROSTER.find((s) => s.clinicianId === p.clinicianId);
            const trainee = staff ? requiresSupervision(staff.role) : false;
            const sup = trainee && staff ? getSupervisor(staff.id) : undefined;
            return (
              <li key={p.clinicianId} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                <div>
                  <div className="font-medium">{cl?.name}{cl?.credential ? `, ${cl.credential}` : ""}</div>
                  <div className="text-xs text-muted-foreground">{p.specialty || "—"}</div>
                  {trainee && (
                    <div className="text-xs text-muted-foreground">
                      Trainee · Supervisor: {sup?.name ?? "needs a supervisor"}
                    </div>
                  )}
                </div>
                <Badge className={p.active ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}>
                  {p.active ? "Active" : "Frozen"}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      {canAct && (
      <Card className="p-4" data-testid="coordination-audit">
        <h2 className="font-semibold mb-2">Coordinator decisions ({audit.length})</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {audit.slice(0, 30).map((e) => {
              const pt = patients.find((p) => p.id === e.patientId);
              const d = e.detail ?? {};
              return (
                <li key={e.id} className="py-2">
                  <div>
                    <b>{COORDINATION_ACTION_LABEL[e.action] ?? e.action}</b>
                    {pt ? ` · ${pt.firstName} ${pt.lastName}` : ""}
                    {e.action === "coordination_reassign" ? ` · ${nameOf(d.from)} → ${nameOf(d.to)}` : ""}
                    {d.clinicianId ? ` · ${nameOf(d.clinicianId)}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Reason: {reasonLabel(e) || "—"}
                    {d.note ? ` · "${String(d.note)}"` : ""}
                    {d.supervisor ? ` · Supervisor: ${String(d.supervisor)}` : ""}
                    {" · "}
                    {String(d.actorName ?? e.actorId ?? "")} ({e.actorRole}) · <ClientDate value={e.at} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      )}
      {canAct && (
        <p className="text-sm text-muted-foreground">
          Related: <Link to="/admin-content" className="underline">Resource verification → Patient Content &amp; Resources Center</Link>
        </p>
      )}
    </div>
  );
}

function CoverageRow({ appt, label, clinicianName, canAct }: { appt: Appointment; label: string; clinicianName: string; canAct: boolean }) {
  const actor = useActingStaff();
  const who = { name: actor.staffName, role: actor.role, id: actor.staffId };
  const [mode, setMode] = useState<"" | "reassign" | "cancel">("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const options = eligibleReassignTargets(appt);
  const reset = () => {
    setMode("");
    setTo("");
    setReason("");
    setNote("");
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
  const picked = options.find((o) => o.clinicianId === to);
  return (
    <li className="py-3 text-sm space-y-2" data-testid="coverage-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <b>{label}</b> · <ClientDate value={appt.start} /> with {clinicianName}
        </span>
        {canAct && <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setMode(mode === "reassign" ? "" : "reassign")}>Reassign to…</Button>
          <Button size="sm" variant="outline" onClick={() => setMode(mode === "cancel" ? "" : "cancel")}>Cancel visit</Button>
          <Link to="/schedule" className="text-xs underline self-center" onClick={() => recordManualRebook(appt.id, who)}>
            Rebook manually
          </Link>
        </div>}
      </div>
      {canAct && mode === "reassign" && (
        <div className="rounded border p-3 space-y-2">
          <label className="block text-xs">
            Clinician (eligible only)
            <select aria-label="Reassign to" className="mt-1 block w-full rounded border bg-background p-2" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o.clinicianId} value={o.clinicianId}>
                  {o.name}, {o.credential} · {o.upcoming} upcoming{o.trainee ? ` · trainee — supervisor ${o.supervisorName}` : ""}
                </option>
              ))}
            </select>
          </label>
          {picked?.trainee && <p className="text-xs">Supervisor: <b>{picked.supervisorName}</b> (will be notified)</p>}
          <label className="block text-xs">
            Reason (required)
            <select aria-label="Reassign reason" className="mt-1 block w-full rounded border bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose…</option>
              {Object.entries(REASSIGN_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <Textarea aria-label="Reassign note" placeholder="Note (optional; required for Other). Not sent to the patient." value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={reset}>Close</Button>
            <Button
              size="sm"
              disabled={!to || !reason}
              onClick={() => run(() => reassignCoverage({ apptId: appt.id, toClinicianId: to, reason: reason as ReassignReason, note, actor: who }), "Reassigned — patient and both clinicians notified.")}
            >
              Confirm reassign
            </Button>
          </div>
        </div>
      )}
      {canAct && mode === "cancel" && (
        <div className="rounded border p-3 space-y-2">
          <label className="block text-xs">
            Reason (required)
            <select aria-label="Cancel reason" className="mt-1 block w-full rounded border bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose…</option>
              {Object.entries(STAFF_CANCEL_REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <Textarea aria-label="Cancel note" placeholder="Note (required for Other)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={reset}>Close</Button>
            <Button size="sm" variant="destructive" disabled={!reason} onClick={() => run(() => coordinationCancel({ apptId: appt.id, reason: reason as StaffCancelReason, note, actor: who }), "Visit cancelled.")}>
              Confirm cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function UnassignedRows({
  rows,
  nameOf,
}: {
  rows: ReturnType<typeof listUnassignedPatients>;
  nameOf: (id?: unknown) => string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-1">None.</p>;
  return (
    <ul className="divide-y">
      {rows.map(({ patient, why }) => (
        <li key={patient.id} className="py-2 text-sm flex flex-wrap items-center justify-between gap-2">
          <span>
            <b>{patient.firstName} {patient.lastName}</b>
            {patient.primaryClinicianId ? ` · was ${nameOf(patient.primaryClinicianId)}` : ""}
          </span>
          <Badge variant="outline">Unassigned · {why}</Badge>
        </li>
      ))}
    </ul>
  );
}
