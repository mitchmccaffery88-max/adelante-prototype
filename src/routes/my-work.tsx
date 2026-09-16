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
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  DISENGAGEMENT_DRAFT,
  RESCREEN_CADENCE_DRAFT_NOTE,
  disengagementFlagged,
  disengagementRows,
  myCaseload,
  myOpenItems,
  screenerDueRows,
  type DisengagementRow,
} from "@/lib/myWork";
import { overdueByLabel } from "@/lib/crisisPolicy";
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
  const rescreens = useEhr(() => screenerDueRows(myCaseload(identity), { role: actor.role }));
  const quiet = useEhr(() => disengagementFlagged(disengagementRows(myCaseload(identity))));
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
                        {t.overdueDays}d overdue
                      </Badge>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

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
