// §Reporting Redesign Tier 3 — "My work": the reflexive-need reports.
//
// Everything on this page is scoped to the ACTING staff member. It is a view,
// not a store: each section calls the shared helpers in `src/lib/myWork.ts`,
// which in turn read the same crisis / note / task / screener / engagement
// records every other surface reads. No new tracking mechanism, no second
// copy of anything.
//
// Draft policy values (re-screen cadence, disengagement thresholds) are
// labelled as draft on screen, the same discipline the crisis response clocks
// already use.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { canAccess, isPrescriberRole, useActingStaff } from "@/lib/roles";
import {
  DISENGAGEMENT_DRAFT,
  RESCREEN_CADENCE_DRAFT_NOTE,
  disengagementFlagged,
  disengagementRows,
  caseloadCrises,
  dueLabel,
  myCaseload,
  myContactsDue,
  myOpenItems,
  myPendingRefills,
  myTodayVisits,
  myPlanReviewsDue,
  myPendingLabs,
  screenerDueRows,
  type DisengagementRow,
} from "@/lib/myWork";
import { overdueByLabel } from "@/lib/crisisPolicy";
import { asamCosignOwnership, noteCosignOwnership } from "@/lib/ehr";
import { canSignNotes, isMyCosign } from "@/lib/notes";
import { canUseCaseloadReview } from "@/lib/caseloadRoles";
import { COORDINATION_ROLES } from "@/lib/coordinationRoles";
import { listUnassignedPatients } from "@/lib/coordination";
import { myAsamWork } from "@/lib/asamReporting";
import { ASAM_DRAFT_NOTE } from "@/lib/asam";
import { OutreachDraftDialog } from "@/components/chart/AdelDrafts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ClientDate } from "@/components/ClientDate";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  FileText,
  Lock,
  Scale,
  Siren,
  UserMinus,
} from "lucide-react";

export const Route = createFileRoute("/my-work")({
  head: () => ({
    meta: [
      { title: "My work — Adelante" },
      {
        name: "description",
        content:
          "Your personal Adelante worklist: crisis escalations you claimed, your unsigned notes, your overdue case tasks, caseload re-screens due and patients going quiet.",
      },
      { property: "og:title", content: "My work — Adelante" },
      {
        property: "og:description",
        content:
          "One scoped rollup of the crisis claims, notes, tasks, re-screens and disengagement risk that belong to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyWorkPage,
});

function SectionHeading({
  id,
  icon: Icon,
  title,
  purpose,
  count,
}: {
  id: string;
  icon: typeof Siren;
  title: string;
  purpose: string;
  count?: number;
}) {
  return (
    <div className="space-y-0.5">
      <h2 id={id} className="flex items-center gap-2 font-display text-lg text-navy">
        <Icon className="h-4 w-4 text-teal" aria-hidden />
        {title}
        {count !== undefined && (
          <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">{count}</Badge>
        )}
      </h2>
      <p className="max-w-2xl text-xs text-muted-foreground">{purpose}</p>
    </div>
  );
}

function Row({
  patientId,
  name,
  primary,
  secondary,
  badge,
  section,
}: {
  patientId: string;
  name: string;
  primary: string;
  secondary?: React.ReactNode;
  badge?: React.ReactNode;
  section?: string;
}) {
  return (
    <Card className="p-3 text-xs space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/record/$patientId"
          params={{ patientId }}
          search={section ? { section } : {}}
          className="font-display text-base text-navy underline-offset-2 hover:underline"
        >
          {name}
        </Link>
        {badge}
      </div>
      <p className="text-navy">{primary}</p>
      {secondary && <p className="text-muted-foreground">{secondary}</p>}
    </Card>
  );
}

function levelBadge(row: DisengagementRow) {
  if (row.level === "at_risk")
    return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">At risk (draft)</Badge>;
  if (row.level === "watch")
    return <Badge className="bg-warning/20 text-navy border-0 text-[10px]">Watch (draft)</Badge>;
  return (
    <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
      No contact recorded
    </Badge>
  );
}

const CONTACT_LABEL: Record<DisengagementRow["lastContactKind"], string> = {
  appointment: "attended appointment",
  message: "message they sent",
  self_help: "self-help activity",
  none: "nothing recorded",
};

import { hieFollowUps, KIND_LABEL, HIE_LABEL } from "@/lib/hie";

function MyWorkPage() {
  const actor = useActingStaff();
  const notes = canAccess(actor.role, "therapy_notes");
  const tasks = canAccess(actor.role, "worklist");
  const crisis = canAccess(actor.role, "crisis_queue");
  const screeners = canAccess(actor.role, "screeners_mh");
  const allowed =
    notes.level !== "none" || tasks.level !== "none" || crisis.level !== "none";

  const identity = {
    staffId: actor.staffId,
    staffName: actor.staffName,
    ...(actor.clinicianId ? { clinicianId: actor.clinicianId } : {}),
  };

  const open = useEhr(() => myOpenItems(identity));
  const caseload = useEhr(() => myCaseload(identity));
  const missedVisits = useEhr(() => {
    const ids = new Set(myCaseload(identity).map((p) => p.id));
    return AdelanteEHR.listAppointments().filter((a) => ids.has(a.patientId) && a.status === "no_show" && Date.now() - +new Date(a.start) <= 30 * 86400000);
  });
  const rescreens = useEhr(() => screenerDueRows(myCaseload(identity), { role: actor.role }));
  const quiet = useEhr(() => disengagementFlagged(disengagementRows(myCaseload(identity))));
  // §10d-1 — ASAM group. `null` = the role fails the Part 2 check: hidden.
  const asam = useEhr(() =>
    myAsamWork({ role: actor.role, staffId: actor.staffId, staffName: actor.staffName, clinicianId: actor.clinicianId }),
  );
  const visits = useEhr(() => myTodayVisits(identity));
  const noteCosigns = useEhr(() =>
    canSignNotes(actor.role)
      ? AdelanteEHR.listNotesAwaitingCosign().filter(({ note }) =>
          isMyCosign(note, { role: actor.role, staffName: actor.staffName, staffId: actor.staffId, clinicianId: actor.clinicianId }),
        )
      : [],
  );
  const planReviews = useEhr(() => myPlanReviewsDue(identity));
  const pendingLabsJson = useEhr(() => JSON.stringify(myPendingLabs(identity, actor.role)));
  const pendingLabRows = JSON.parse(pendingLabsJson) as ReturnType<typeof myPendingLabs>;
  const outside = useEhr(() => hieFollowUps(myCaseload(identity).map((p) => p.id), actor.role));
  const refills = useEhr(() => myPendingRefills({ ...identity, role: actor.role }));
  const myCrises = useEhr(() => caseloadCrises(identity, actor.role));
  const contactsDue = useEhr(() => (canUseCaseloadReview(actor.role) ? myContactsDue(actor.staffId) : []));
  const isCoordinator = COORDINATION_ROLES.includes(actor.role);
  const coord = useEhr(() => {
    if (!isCoordinator) return null;
    const needsSupervisor =
      AdelanteEHR.listNotesAwaitingCosign().filter(({ note }) => noteCosignOwnership(note).kind === "needs_supervisor").length +
      AdelanteEHR.listAsamAwaitingCosign().filter(({ asam }) => asamCosignOwnership(asam).kind === "needs_supervisor").length;
    return {
      voids: AdelanteEHR.listPendingNoteVoids({ staffId: actor.staffId, name: actor.staffName, role: actor.role }),
      lost: listUnassignedPatients().filter((u) => u.cause === "lost"),
      crises: AdelanteEHR.listOpenCrisisEscalations().length,
      needsSupervisor,
    };
  });
  const asamCosignCount = asam?.cosignsForMe.length ?? 0;
  // Referenced so the store subscription covers late-arriving demo data.
  useEhr(() => AdelanteEHR.listPatients().length);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="No personal worklist for this role"
          description="Your role doesn't hold notes, case tasks or crisis escalations, so there is nothing to scope to you."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/reporting">
          <ArrowLeft className="h-3.5 w-3.5" /> Reporting home
        </Link>
      </Button>

      <header className="space-y-1">
        <h1 className="font-display text-2xl text-navy">My work</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Everything currently open on {actor.staffName}, plus two early-warning lists for the{" "}
          {caseload.length} patient{caseload.length === 1 ? "" : "s"} on your caseload. Nothing here
          is shared work — every row is claimed by, assigned to, or authored by you.
        </p>
      </header>

      {/* ---------- Start of day ---------- */}
      <section aria-labelledby="today-heading" className="space-y-3" data-testid="my-work-today">
        <SectionHeading
          id="today-heading"
          icon={CalendarClock}
          title="Today's visits"
          purpose="Your visits scheduled for today."
          count={visits.length}
        />
        {visits.length === 0 ? (
          <Card className="p-3 text-xs text-muted-foreground">No visits on your schedule today.</Card>
        ) : (
          <div className="space-y-2">
            {visits.map((v) => (
              <Row
                key={v.appointment.id}
                patientId={v.patientId}
                name={v.patientName}
                primary={`${new Date(v.appointment.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${(v.appointment.serviceType ?? "visit").replace(/_/g, " ")}`}
                secondary={`${v.appointment.durationMin} min · ${v.appointment.modality ?? "video"}`}
              />
            ))}
          </div>
        )}
      </section>

      {outside.length > 0 && (
        <section aria-labelledby="hie-heading" className="space-y-3" data-testid="my-work-hie">
          <SectionHeading
            id="hie-heading"
            icon={CalendarClock}
            title="Outside event — follow up"
            purpose={HIE_LABEL}
            count={outside.length}
          />
          <div className="space-y-2">
            {outside.map(({ draft, encounter }) => {
              const p = AdelanteEHR.getPatient(encounter.patientId);
              return (
                <Row
                  key={draft.id}
                  patientId={encounter.patientId}
                  name={p ? `${p.firstName} ${p.lastName}` : "Patient"}
                  section="outside-records"
                  primary={`Outside event — follow up · ${KIND_LABEL[encounter.kind]}, ${new Date(encounter.at).toLocaleDateString()}`}
                  secondary={`${encounter.facility} · Draft by Adel waiting · ${HIE_LABEL}`}
                  badge={<OutreachDraftDialog patientId={encounter.patientId} reason="outside_event" />}
                />
              );
            })}
          </div>
        </section>
      )}

      {missedVisits.length > 0 && (
        <section aria-labelledby="missed-heading" className="space-y-3" data-testid="my-work-missed">
          <SectionHeading
            id="missed-heading"
            icon={CalendarClock}
            title="Missed visits — reach out"
            purpose="Caseload patients who missed a visit in the last 30 days. Adel can draft a plain-language message you review and send."
            count={missedVisits.length}
          />
          <div className="space-y-2">
            {missedVisits.map((a) => {
              const p = AdelanteEHR.getPatient(a.patientId);
              return (
                <Row
                  key={a.id}
                  patientId={a.patientId}
                  name={p ? `${p.firstName} ${p.lastName}` : "Patient"}
                  section="appointments"
                  primary={`Missed visit · ${new Date(a.start).toLocaleDateString()}`}
                  badge={<OutreachDraftDialog patientId={a.patientId} reason="missed_visit" />}
                />
              );
            })}
          </div>
        </section>
      )}

      {pendingLabRows.length > 0 && (
        <section aria-labelledby="labs-pending-heading" className="space-y-3" data-testid="my-work-labs-pending">
          <SectionHeading
            id="labs-pending-heading"
            icon={CalendarClock}
            title="Result pending"
            purpose="Placeholder lab orders (not sent) still waiting on a result."
            count={pendingLabRows.length}
          />
          <div className="space-y-2">
            {pendingLabRows.map((r) => (
              <Row
                key={r.id}
                patientId={r.patientId}
                name={r.patientName}
                section="tracking"
                primary={`${r.label} — result pending`}
                secondary={dueLabel(r.dueAt)}
              />
            ))}
          </div>
        </section>
      )}

      {planReviews.length > 0 && (
        <section aria-labelledby="plan-review-heading" className="space-y-3" data-testid="my-work-plan-reviews">
          <SectionHeading
            id="plan-review-heading"
            icon={CalendarClock}
            title="Plan review due"
            purpose="Care plans on your caseload whose review date is today or earlier."
            count={planReviews.length}
          />
          <div className="space-y-2">
            {planReviews.map((r) => (
              <Row
                key={r.patientId}
                patientId={r.patientId}
                name={r.patientName}
                section="care-plan"
                primary="Care plan review"
                secondary={dueLabel(r.dueAt)}
              />
            ))}
          </div>
        </section>
      )}

      {(canSignNotes(actor.role) || asam) && (
        <section aria-labelledby="cosign-heading" className="space-y-3" data-testid="my-work-cosigns">
          <SectionHeading
            id="cosign-heading"
            icon={FileText}
            title="Cosigns owed"
            purpose="Progress notes and ASAM assessments waiting on your cosignature — the same count as the Cosign inbox."
            count={noteCosigns.length + asamCosignCount}
          />
          {noteCosigns.length + asamCosignCount === 0 ? (
            <Card className="p-3 text-xs text-muted-foreground">Nothing waiting on your cosignature.</Card>
          ) : (
            <div className="space-y-2">
              {noteCosigns.map(({ patient, note }) => (
                <Row
                  key={note.id}
                  patientId={patient.id}
                  name={`${patient.firstName} ${patient.lastName}`}
                  section="notes"
                  primary={`Cosign ${note.templateTitle ?? "progress note"} by ${note.signedBy ?? "author"}`}
                  secondary={<Link to="/cosign-inbox" className="underline">Open the cosign inbox</Link>}
                />
              ))}
              {asamCosignCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Plus {asamCosignCount} ASAM co-signature{asamCosignCount === 1 ? "" : "s"} — listed under ASAM below.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {isPrescriberRole(actor.role) && (
        <section aria-labelledby="refill-heading" className="space-y-3" data-testid="my-work-refills">
          <SectionHeading
            id="refill-heading"
            icon={ClipboardList}
            title="Refill requests"
            purpose="Pending refills for patients you prescribe for."
            count={refills.length}
          />
          {refills.length === 0 ? (
            <Card className="p-3 text-xs text-muted-foreground">No pending refills for your patients.</Card>
          ) : (
            <div className="space-y-2">
              {refills.map((r) => (
                <Row
                  key={r.refill.id}
                  patientId={r.patientId}
                  name={r.patientName}
                  primary={r.refill.medicationName}
                  secondary={<Link to="/clinician" className="underline">Review on the refill card</Link>}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {crisis.level !== "none" && (
        <section aria-labelledby="mycrisis-heading" className="space-y-3" data-testid="my-work-crises">
          <SectionHeading
            id="mycrisis-heading"
            icon={Siren}
            title="Crisis items for my patients"
            purpose="Open crisis items on your caseload, claimed or not."
            count={myCrises.length}
          />
          {myCrises.length === 0 ? (
            <Card className="p-3 text-xs text-muted-foreground">No open crisis items for your patients.</Card>
          ) : (
            <div className="space-y-2">
              {myCrises.map((c) => (
                <Row
                  key={c.escalation.id}
                  patientId={c.patientId}
                  name={c.patientName}
                  primary={c.escalation.category === "sdoh" ? "Open urgent social need" : "Open crisis item"}
                  secondary={<Link to="/crisis-queue" search={{ scope: undefined, lane: undefined }} className="underline">{c.escalation.claimedBy ? `Claimed by ${c.escalation.claimedBy}` : "Unclaimed"} · open the crisis queue</Link>}
                  badge={
                    <Badge className={`border-0 text-[10px] ${c.sla.overdue ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {c.escalation.severity}
                    </Badge>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {coord && (
        <section aria-labelledby="coord-heading" className="space-y-3" data-testid="my-work-coordinator">
          <SectionHeading
            id="coord-heading"
            icon={ClipboardList}
            title="Coordinator queue"
            purpose="Void approvals, patients who lost their clinician, open crisis items and cosigns that need a supervisor."
            count={coord.voids.length + coord.lost.length + coord.crises + coord.needsSupervisor}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Card className="p-3 text-xs"><Link to="/inbox" className="underline">Void approvals pending</Link>: {coord.voids.length}</Card>
            <Card className="p-3 text-xs"><Link to="/admin-coordination" className="underline">Unassigned — lost clinician</Link>: {coord.lost.length}</Card>
            <Card className="p-3 text-xs"><Link to="/crisis-queue" search={{ scope: undefined, lane: undefined }} className="underline">Open crisis items</Link>: {coord.crises}</Card>
            <Card className="p-3 text-xs"><Link to="/cosign-inbox" className="underline">Cosigns needing a supervisor</Link>: {coord.needsSupervisor}</Card>
          </div>
        </section>
      )}

      {canUseCaseloadReview(actor.role) && (
        <section aria-labelledby="contacts-heading" className="space-y-3" data-testid="my-work-contacts">
          <SectionHeading
            id="contacts-heading"
            icon={UserMinus}
            title="Contacts due"
            purpose="Caseload patients due or overdue for a contact, on the same draft cadence as the weekly caseload review."
            count={contactsDue.length}
          />
          {contactsDue.length === 0 ? (
            <Card className="p-3 text-xs text-muted-foreground">Everyone on your caseload is on track.</Card>
          ) : (
            <div className="space-y-2">
              {contactsDue.map((r) => (
                <Row
                  key={r.patient.id}
                  patientId={r.patient.id}
                  name={`${r.patient.firstName} ${r.patient.lastName}`}
                  primary={r.lastContact ? `Last contact ${r.lastContact}` : "No contact logged yet"}
                  secondary={<Link to="/caseload-review" className="underline">Open the weekly caseload review</Link>}
                  badge={
                    <span className="flex items-center gap-2">
                      <OutreachDraftDialog patientId={r.patient.id} reason="contact_due" />
                      <Badge className={`border-0 text-[10px] ${r.status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-navy"}`}>
                        {r.status === "overdue" ? "Overdue" : "Due"}
                      </Badge>
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------- 1. My open items ---------- */}
      <section aria-labelledby="open-items-heading" className="space-y-3">
        <SectionHeading
          id="open-items-heading"
          icon={ClipboardList}
          title="My open items"
          purpose="Crisis escalations you claimed, your unsigned notes and your overdue case tasks, in one rollup."
          count={open.total}
        />
        {open.overdueCrises > 0 && (
          <Card className="border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {open.overdueCrises} claimed escalation{open.overdueCrises === 1 ? " is" : "s are"} past
            the draft response target.
          </Card>
        )}

        {open.total === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nothing open on you"
            description="No claimed escalations, no unsigned notes, no overdue tasks."
          />
        ) : (
          <div className="space-y-4">
            {open.clinicalCrises.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-navy">
                  Crisis escalations you claimed ({open.clinicalCrises.length})
                </p>
                {open.clinicalCrises.map((c) => (
                  <Row
                    key={c.escalation.id}
                    patientId={c.patientId}
                    name={c.patientName}
                    section="alerts"
                    primary={c.escalation.triggerDetail ?? "Crisis escalation"}
                    secondary={
                      <>
                        Claimed {c.escalation.claimedAt ? <ClientDate value={c.escalation.claimedAt} /> : "—"} ·
                        draft {c.sla.thresholdLabel} target
                      </>
                    }
                    badge={
                      c.sla.overdue ? (
                        <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                          {overdueByLabel(c.sla.overdueByMs)}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
                          {c.escalation.severity}
                        </Badge>
                      )
                    }
                  />
                ))}
              </div>
            )}

            {open.sdohCrises.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-navy">
                  Urgent social needs you claimed ({open.sdohCrises.length})
                </p>
                {open.sdohCrises.map((c) => (
                  <Row
                    key={c.escalation.id}
                    patientId={c.patientId}
                    name={c.patientName}
                    section="sdoh"
                    primary={c.escalation.triggerDetail ?? "Urgent social need"}
                    secondary={<>Draft {c.sla.thresholdLabel} target</>}
                    badge={
                      c.sla.overdue ? (
                        <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                          {overdueByLabel(c.sla.overdueByMs)}
                        </Badge>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            )}

            {open.unsignedNotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-navy">
                  Your unsigned notes ({open.unsignedNotes.length})
                </p>
                {open.unsignedNotes.map((n) => (
                  <Row
                    key={n.note.id}
                    patientId={n.patientId}
                    name={n.patientName}
                    section="notes"
                    primary={n.note.templateTitle ?? `${n.note.sessionType.replace("_", " ")} note`}
                    secondary={<>Drafted <ClientDate value={n.note.date} /></>}
                    badge={
                      <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
                        {n.ageDays}d old
                      </Badge>
                    }
                  />
                ))}
              </div>
            )}

            {open.overdueTasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-navy">
                  Your overdue case tasks ({open.overdueTasks.length})
                </p>
                {open.overdueTasks.map((t) => (
                  <Row
                    key={t.task.id}
                    patientId={t.patientId}
                    name={t.patientName}
                    primary={t.task.title}
                    secondary={<>Due {t.task.dueDate.slice(0, 10)} · {t.task.origin}</>}
                    badge={
                      <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                        {dueLabel(t.task.dueDate)}
                      </Badge>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------- ASAM (Part 2 — hidden for roles without access) ---------- */}
      {asam && (
        <section aria-labelledby="asam-heading" className="space-y-3" data-testid="my-work-asam">
          <SectionHeading
            id="asam-heading"
            icon={Scale}
            title="ASAM"
            purpose="ASAM assessments assigned to you (needed, due, overdue), your drafts awaiting co-signature, and co-signatures waiting on you. 42 CFR Part 2 protected."
            count={asam.tasks.length + asam.myDraftsAwaitingCosign.length + asam.cosignsForMe.length}
          />
          <Card className="bg-warning/10 p-3 text-[11px] leading-snug text-navy">
            Due windows and reassessment interval: {ASAM_DRAFT_NOTE}.
          </Card>
          {asam.tasks.length + asam.myDraftsAwaitingCosign.length + asam.cosignsForMe.length === 0 ? (
            <EmptyState icon={Scale} title="No ASAM work on you" description="Nothing assigned, awaiting co-signature, or waiting on your signature." />
          ) : (
            <div className="space-y-2">
              {asam.tasks.map((t) => (
                <Row
                  key={t.taskId}
                  patientId={t.patientId}
                  name={t.patientName}
                  section="asam"
                  primary={`${t.title} — due ${t.dueDate}`}
                  secondary={t.reason}
                  badge={
                    <Badge
                      data-testid={`asam-state-${t.state}`}
                      className={`border-0 text-[10px] ${t.state === "overdue" ? "bg-destructive/15 text-destructive" : t.state === "due" ? "bg-warning/20 text-navy" : "bg-muted text-muted-foreground"}`}
                    >
                      {t.state === "overdue" ? "Overdue" : t.state === "due" ? "Needed now" : `Due ${new Date(`${t.dueDate}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}`}
                    </Badge>
                  }
                />
              ))}
              {asam.myDraftsAwaitingCosign.map((c) => (
                <Row
                  key={c.asamId}
                  patientId={c.patientId}
                  name={c.patientName}
                  section="asam"
                  primary="Your ASAM draft — awaiting LPHA co-signature"
                  secondary={`Waiting ${c.ageDays} day${c.ageDays === 1 ? "" : "s"}. No outputs fire until co-signed.`}
                  badge={<Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Cosign pending</Badge>}
                />
              ))}
              {asam.cosignsForMe.map((c) => (
                <Row
                  key={`cs-${c.asamId}`}
                  patientId={c.patientId}
                  name={c.patientName}
                  section="asam"
                  primary={`Co-sign ASAM authored by ${c.authorName}`}
                  secondary={<Link to="/cosign-inbox" className="underline">Open the cosign inbox</Link>}
                  badge={<Badge className="bg-warning/20 text-navy border-0 text-[10px]">Needs your co-signature</Badge>}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------- 2. Screeners due ---------- */}
      <section aria-labelledby="rescreen-heading" className="space-y-3">
        <SectionHeading
          id="rescreen-heading"
          icon={CalendarClock}
          title="Re-screens due on my caseload"
          purpose="Caseload patients whose last completed screen is older than the draft re-screen cadence."
          count={rescreens.length}
        />
        <Card className="bg-warning/10 p-3 text-[11px] leading-snug text-navy">
          {RESCREEN_CADENCE_DRAFT_NOTE}
        </Card>
        {screeners.level === "none" ? (
          <EmptyState
            icon={Lock}
            title="Screener results are restricted"
            description="Your role can't view screener results, so re-screen prompts aren't shown."
          />
        ) : rescreens.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No re-screens prompted"
            description="Nobody on your caseload has passed a draft cadence step since their last completed screen."
          />
        ) : (
          <div className="space-y-2">
            {rescreens.map((r) => (
              <Row
                key={`${r.patientId}-${r.screenerKey}`}
                patientId={r.patientId}
                name={r.patientName}
                section="tracking"
                primary={`${r.screenerKey.toUpperCase()} — last completed ${r.daysSinceLast} days ago`}
                secondary={`Past the ${r.cadenceStep}-day draft cadence step`}
                badge={
                  r.taskAlreadySent ? (
                    <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
                      Re-screen requested
                    </Badge>
                  ) : (
                    <Badge className="bg-warning/20 text-navy border-0 text-[10px]">
                      {r.cadenceStep}d step
                    </Badge>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ---------- 3. Disengagement risk ---------- */}
      <section aria-labelledby="disengagement-heading" className="space-y-3">
        <SectionHeading
          id="disengagement-heading"
          icon={UserMinus}
          title="Caseload going quiet"
          purpose="Early warning only. Contact means an attended appointment, a message the patient sent, or self-help activity."
          count={quiet.length}
        />
        <Card className="bg-warning/10 p-3 text-[11px] leading-snug text-navy">
          {DISENGAGEMENT_DRAFT.note}
        </Card>
        {quiet.length === 0 ? (
          <EmptyState
            icon={UserMinus}
            title="Nobody flagged"
            description={`Everyone on your caseload has a contact signal inside the draft ${DISENGAGEMENT_DRAFT.watch}-day window.`}
          />
        ) : (
          <div className="space-y-2">
            {quiet.map((row) => (
              <Row
                key={row.patientId}
                patientId={row.patientId}
                name={row.patientName}
                primary={
                  row.daysSinceContact === null
                    ? "No contact of any kind recorded"
                    : `${row.daysSinceContact} days since last contact`
                }
                secondary={
                  row.lastContactAt ? (
                    <>
                      Last signal: {CONTACT_LABEL[row.lastContactKind]} ·{" "}
                      <ClientDate value={row.lastContactAt} />
                    </>
                  ) : (
                    "No appointment, message or self-help activity on file."
                  )
                }
                badge={levelBadge(row)}
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        <FileText className="mr-1 inline h-3 w-3" />
        Re-screen cadence and disengagement thresholds are draft assumptions pending real
        operational policy. They prompt a look, they do not assert a due date.
      </p>
    </div>
  );
}
