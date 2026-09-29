import { useState } from "react";
import { act, actFor } from "@/lib/actions/act";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEhr } from "@/lib/ehr";
import { useActingStaff, type StaffRole } from "@/lib/roles";

type Actor = { id: string; name: string; role: StaffRole };
import {
  CONTACT_CADENCE,
  CONTACT_TYPE_LABEL,
  NOTE_HINT,
  NOTE_MAX,
  STATUS_LABEL,
  canSeeContactNote,
  canSeeRollup,
  canUseCaseloadReview,
  caseloadFor,
  caseloadRollup,
  checkInSummary,
  listContacts,
  logContact,
  markWeekReviewed,
  patientStatus,
  weekReview,
  type CaseloadStatus,
  type ContactType,
  type PatientCaseloadRow,
} from "@/lib/caseloadReview";

export const Route = createFileRoute("/caseload-review")({
  head: () => ({
    meta: [
      { title: "Weekly caseload review — Adelante" },
      { name: "description", content: "Case managers track contacts, check-in participation and weekly review sign-off." },
      { property: "og:title", content: "Weekly caseload review — Adelante" },
      { property: "og:description", content: "Contacts against a draft cadence, check-in trends and week sign-off for case managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaseloadReviewPage,
});

const STATUS_VARIANT: Record<CaseloadStatus, "default" | "secondary" | "destructive"> = {
  on_track: "secondary",
  due: "default",
  overdue: "destructive",
};

function CaseloadReviewPage() {
  const acting = useActingStaff();
  useEhr(() => 0);
  const actor: Actor = { id: acting.staffId, name: acting.staffName, role: acting.role };

  if (canSeeRollup(actor.role)) return <Rollup />;
  if (!canUseCaseloadReview(actor.role))
    return (
      <div className="mx-auto max-w-3xl px-4 py-8" data-testid="caseload-blocked">
        <Card className="p-4 text-sm">The weekly caseload review is for case managers and ECM providers.</Card>
      </div>
    );

  const rows = caseloadFor(actor.id).map((p) => patientStatus(p, actor.id));
  const review = weekReview(actor.id);
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Weekly caseload review</h1>
          <div className="text-sm text-muted-foreground">
            Cadence: one contact every {CONTACT_CADENCE.intensiveIntervalDays} days for the first{" "}
            {CONTACT_CADENCE.intensiveWindowDays} days, then every {CONTACT_CADENCE.maintenanceIntervalDays} days.{" "}
            <Badge variant="outline">{CONTACT_CADENCE.label}</Badge>
          </div>
        </div>
        {review ? (
          <Badge data-testid="week-reviewed">Week reviewed · {new Date(review.at).toLocaleString()}</Badge>
        ) : (
          <Button
            data-testid="mark-reviewed"
            onClick={() => {
              markWeekReviewed({ id: actor.id, name: actor.name, role: actor.role });
              toast.success("Week marked reviewed");
            }}
          >
            Mark week reviewed
          </Button>
        )}
      </header>
      {rows.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">No patients are assigned to you.</Card>
      ) : (
        <ul className="space-y-3" data-testid="caseload-list">
          {rows.map((r) => (
            <PatientRow key={r.patient.id} row={r} actor={actor} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PatientRow({ row, actor }: { row: PatientCaseloadRow; actor: Actor }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ContactType>("call");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const s = checkInSummary(row.patient, actor.role);
  const recent = listContacts(row.patient.id).slice(0, 3);
  return (
    <li>
      <Card className="p-4 space-y-2" data-testid={`caseload-row-${row.patient.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b>
            {row.patient.firstName} {row.patient.lastName}
          </b>
          <div className="flex flex-wrap gap-1">
            {row.carriedOver && <Badge variant="outline">Carried over</Badge>}
            <Badge variant={STATUS_VARIANT[row.status]} data-testid="caseload-status">
              {STATUS_LABEL[row.status]}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Last contact: {row.lastContact ?? "none"} · Contacts this week: {row.contactsThisWeek} · Attempts this week:{" "}
          {row.attemptsThisWeek}
        </p>
        <div className="text-sm" data-testid="checkin-summary">
          Check-ins this week: {s.daysThisWeek} of 7 days · Trend: {s.trend}
          <span className="block" data-testid="mood-count">
            Mood check-ins this week: {s.moodDaysThisWeek} of 7 days
          </span>
          {s.followUpSuggested && (
            <Badge variant="destructive" className="ml-2">
              Clinical follow-up suggested
            </Badge>
          )}
        </div>
        {recent.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {recent.map((c) => (
              <li key={c.id}>
                {c.date} · {CONTACT_TYPE_LABEL[c.type]} · {c.authorName}
                {c.note ? (canSeeContactNote(c, actor) ? ` — ${c.note}` : " — note hidden for your role") : ""}
              </li>
            ))}
          </ul>
        )}
        {!open ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Log contact
          </Button>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              Type
              <select
                aria-label="Contact type"
                className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as ContactType)}
              >
                {Object.entries(CONTACT_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Date
              <Input aria-label="Contact date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              Note (optional)
              <Textarea
                aria-label="Contact note"
                maxLength={NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1"
              />
              <span className="text-xs text-muted-foreground">{NOTE_HINT}</span>
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button
                size="sm"
                onClick={() => {
                  try {
                    actFor("contact_log", "logContact", row.patient.id,
                      { id: actor.id, name: actor.name, role: actor.role },
                      { patientId: row.patient.id, type, date, note },
                    );
                    toast.success(type === "attempt" ? "Attempt logged" : "Contact logged");
                    setOpen(false);
                    setNote("");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  );
}

function Rollup() {
  const rows = caseloadRollup();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
      <h1 className="text-2xl font-semibold">Caseload review roll-up</h1>
      <div className="text-sm text-muted-foreground">
        Counts by case manager this week. Notes are not shown here. <Badge variant="outline">{CONTACT_CADENCE.label}</Badge>
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm" data-testid="caseload-rollup">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Case manager</th>
              <th className="p-2">On track</th>
              <th className="p-2">Due</th>
              <th className="p-2">Overdue</th>
              <th className="p-2">Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staffId} className="border-b last:border-0">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.on_track}</td>
                <td className="p-2">{r.due}</td>
                <td className="p-2">{r.overdue}</td>
                <td className="p-2">{r.reviewed ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
