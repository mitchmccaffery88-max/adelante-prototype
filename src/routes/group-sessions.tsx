// §Group sessions — staff-facing group care delivery.
//
// Billing codes and the 2–12 roster range are real DHCS content. Curriculum /
// topic names are still placeholders pending clinical content sign-off.
//
// Enrollment paths split by category:
//   sud_clinical_preauth   — staff-initiated only (this page), billable H0005.
//   skills_education       — eligible patients self-book from /schedule, H2014.
//   open_psychoeducational — eligible patients self-book, never billed.
// BOTH require the care-plan group-eligibility flag first; the store refuses
// any enrollment without it.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  formatLocationAddress,
  GROUP_BILLING,
  GROUP_CAPACITY_MAX,
  GROUP_CAPACITY_MIN,
  GROUP_CATEGORIES,
  GROUP_OCCURRENCE_MODALITIES,
  isVirtualGroupModality,
  useEhr,
  type GroupAttendanceStatus,
  type GroupCategory,
  type GroupOccurrenceModality,
  type GroupSession,
} from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  occurrenceStatuses,
  owedAttendeesForRole,
} from "@/lib/groupMetrics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { GroupEligibilityEditor } from "@/components/clinical/GroupEligibilityEditor";
import { ClientDate } from "@/components/ClientDate";
import { Lock, Users, CalendarPlus } from "lucide-react";

export const Route = createFileRoute("/group-sessions")({
  head: () => ({
    meta: [
      { title: "Group sessions — Adelante" },
      {
        name: "description",
        content:
          "Schedule group counseling, manage the standing roster, take attendance and document each occurrence.",
      },
      { property: "og:title", content: "Group sessions — Adelante" },
      {
        property: "og:description",
        content: "Group counseling schedule, roster, attendance and per-attendee documentation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupSessionsPage,
});

function GroupSessionsPage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "group_sessions");
  const groups = useEhr(() => AdelanteEHR.listGroupSessions());
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0];

  if (access.locked) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Card className="p-6 text-sm text-muted-foreground flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5" />
          {access.reason ?? "Your role doesn't have access to group sessions."}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <header>
        <h1 className="font-display text-2xl text-navy flex items-center gap-2">
          <Users className="h-5 w-5 text-teal" /> Group sessions
        </h1>
        <p className="text-sm text-muted-foreground">
          Group counseling schedule, standing roster, attendance and documentation. Topic and
          curriculum names are placeholders pending clinical content sign-off; billing codes and
          the 2–12 roster range are DHCS content.
        </p>
      </header>

      {access.level === "write" && <CreateGroupCard actor={staffName || role} />}

      {groups.length === 0 ? (
        <EmptyState title="No groups yet" description="Create a group to start a roster." />
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedId(g.id)}
                className={
                  "w-full rounded-lg border p-3 text-left text-sm " +
                  (selected?.id === g.id ? "border-teal bg-teal/5" : "bg-card hover:border-teal/50")
                }
              >
                <div className="font-medium text-navy">{g.topic}</div>
                <div className="text-xs text-muted-foreground">
                  {g.recurrence.kind === "weekly" ? "Weekly" : "One-off"} · cap {g.capacity}
                </div>
                {g.status === "cancelled" && (
                  <Badge className="mt-1 bg-destructive/15 text-destructive">Cancelled</Badge>
                )}
              </button>
            ))}
          </div>
          {selected && (
            <GroupDetail
              group={selected}
              canWrite={access.level === "write"}
              actor={staffName || role}
            />
          )}
        </div>
      )}
      {access.level === "write" && <ConfidentialityAckSetting actor={staffName || role} />}
    </div>
  );
}

/**
 * County/admin setting. The group confidentiality acknowledgment is NOT a DHCS
 * mandate, so it ships OFF and a county opts in. When off, nothing checks it.
 */
function ConfidentialityAckSetting({ actor }: { actor: string }) {
  const required = useEhr(() => AdelanteEHR.isGroupConfidentialityAckRequired());
  return (
    <Card className="p-4 space-y-1">
      <label className="flex items-center gap-2 text-xs text-navy">
        <input
          type="checkbox"
          aria-label="Require group confidentiality acknowledgment"
          checked={required}
          onChange={(e) => AdelanteEHR.setGroupConfidentialityAckRequired(e.target.checked, actor)}
        />
        Require a group confidentiality acknowledgment from every member (county setting)
      </label>
      <p className="text-[11px] text-muted-foreground">
        Optional — not a DHCS requirement. Off by default. When on, members agree not to disclose
        other participants' identities before an occurrence can be documented.
      </p>
    </Card>
  );
}

function CreateGroupCard({ actor }: { actor: string }) {
  return <CreateGroupCardInner actor={actor} />;
}

/**
 * Billing status at the point of choice. Staff should never have to reach the
 * claim-time block to learn a group is non-billable — this renders the moment
 * a category is selected. The hard enforcement stays in
 * `upsertClaimFromGroupAttendee`; this is prevention, not the gate.
 */
export function GroupBillingStatus({ category }: { category: GroupCategory }) {
  const info = GROUP_BILLING[category];
  return (
    <div
      data-testid="group-billing-status"
      data-billable={info.billable ? "true" : "false"}
      className={
        info.billable
          ? "rounded-md border border-teal/40 bg-teal/10 px-2 py-1.5 text-[11px] text-navy"
          : "rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-navy"
      }
    >
      {info.statusLabel}
      <span className="block text-muted-foreground">
        {info.billable
          ? `An occurrence with fewer than 2 present attendees is not billable as a group.`
          : `Attendance is engagement/reach data only — no claim is ever created.`}
      </span>
    </div>
  );
}

function CreateGroupCardInner({ actor }: { actor: string }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [facilitatorId, setFacilitatorId] = useState("");
  const [start, setStart] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [durationMin, setDurationMin] = useState("60");
  const [locationId, setLocationId] = useState("");
  const [category, setCategory] = useState<GroupCategory>("sud_clinical_preauth");
  const [weekly, setWeekly] = useState(true);
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const locations = useEhr(() => AdelanteEHR.listLocations());

  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4 mr-1.5" /> New group
      </Button>
    );

  return (
    <Card className="p-4 space-y-3">
      <h2 className="font-display text-sm text-navy">New group</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Topic (placeholder text, not a curriculum name)</Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Relapse prevention" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Facilitator</Label>
          <Select value={facilitatorId} onValueChange={setFacilitatorId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a facilitator" />
            </SelectTrigger>
            <SelectContent>
              {clinicians.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">First occurrence</Label>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as GroupCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <GroupBillingStatus category={category} />
          <p className="text-[11px] text-muted-foreground">
            {GROUP_CATEGORIES.find((c) => c.key === category)?.helper}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Capacity ({GROUP_CAPACITY_MIN}–{GROUP_CAPACITY_MAX}, DHCS limit)
          </Label>
          <Input
            type="number"
            min={GROUP_CAPACITY_MIN}
            max={GROUP_CAPACITY_MAX}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            {GROUP_CAPACITY_MAX} is the regulatory maximum (same for telehealth). A lower local cap
            is allowed; a higher one is not.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Session length (minutes)</Label>
          <Input
            type="number"
            min={5}
            step={5}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a location (optional)" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} — {formatLocationAddress(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">
            Description — patient-safe "what to expect" text (placeholder, not curriculum)
          </Label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A weekly conversation group. Come as you are."
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
        Repeats weekly on the same weekday
      </label>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            try {
              const startIso = start ? new Date(start).toISOString() : "";
              if (!startIso) throw new Error("Pick a start date and time.");
              if (!facilitatorId) throw new Error("Pick a facilitator.");
              AdelanteEHR.createGroupSession({
                topic,
                description,
                category,
                facilitatorId,
                serviceType: "therapy_group",
                modality: "in_person",
                locationId: locationId || undefined,
                start: startIso,
                durationMin: Number(durationMin) || 60,
                capacity: Number(capacity),
                recurrence: weekly
                  ? { kind: "weekly", daysOfWeek: [new Date(startIso).getDay()] }
                  : { kind: "none" },
                createdBy: actor,
              });
              toast.success("Group created");
              setOpen(false);
              setTopic("");
              setDescription("");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not create the group.");
            }
          }}
        >
          Create group
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function GroupDetail({
  group,
  canWrite,
  actor,
}: {
  group: GroupSession;
  canWrite: boolean;
  actor: string;
}) {
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const location = useEhr(() => AdelanteEHR.getLocation(group.locationId));
  const enrollments = useEhr(() => AdelanteEHR.listGroupEnrollments(group.id));
  const starts = useEhr(() => AdelanteEHR.groupOccurrenceStarts(group.id, 6));
  const [occurrence, setOccurrence] = useState<string>("");
  const activeStart = occurrence || starts[0] || "";
  const record = useEhr(() =>
    activeStart ? AdelanteEHR.getGroupOccurrence(group.id, activeStart) : undefined,
  );
  const [addId, setAddId] = useState("");
  const [attendance, setAttendance] = useState<Record<string, GroupAttendanceStatus>>({});
  const [topicCovered, setTopicCovered] = useState("");
  const [groupProcess, setGroupProcess] = useState("");
  const [perAttendee, setPerAttendee] = useState<Record<string, string>>({});
  // §Multi-facilitator: minutes + involvement are per-provider and edited at
  // documentation time, never a single combined time field.
  const [facMinutes, setFacMinutes] = useState<Record<string, string>>({});
  const [facInvolve, setFacInvolve] = useState<Record<string, string>>({});
  const [renderingId, setRenderingId] = useState("");

  const roster = useMemo(
    () =>
      enrollments.map((e) => ({
        enrollment: e,
        patient: patients.find((p) => p.id === e.patientId),
      })),
    [enrollments, patients],
  );

  const savedAttendance = record?.attendance ?? [];
  const present = savedAttendance.filter((a) => a.status !== "absent");

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <h2 className="font-display text-navy">{group.topic}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={GROUP_BILLING[group.category].billable ? "outline" : "secondary"}>
            {GROUP_CATEGORIES.find((c) => c.key === group.category)?.label}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {GROUP_BILLING[group.category].selfService
              ? "Eligible patients can self-book."
              : "Staff enrollment only."}{" "}
            {GROUP_BILLING[group.category].billable
              ? "Attendee notes flow to the Claims Worklist."
              : "Attendance is engagement data — never billed."}
          </span>
        </div>
        <GroupBillingStatus category={group.category} />
        <p className="text-xs text-muted-foreground">
          {group.serviceType} · {group.modality} · {group.durationMin} min · capacity{" "}
          {group.capacity}
        </p>
        {group.description && <p className="text-sm text-foreground">{group.description}</p>}
        {location && (
          <p className="text-xs text-muted-foreground">
            {location.name} — {formatLocationAddress(location)}
          </p>
        )}
      </Card>

      {canWrite && <RecurrenceEditor group={group} actor={actor} />}

      <OccurrenceStatusCard group={group} canWrite={canWrite} actor={actor} />

      <Card className="p-4 space-y-3">
        <h3 className="font-display text-sm text-navy">Standing roster</h3>
        {roster.length === 0 && (
          <p className="text-xs text-muted-foreground">Nobody enrolled yet.</p>
        )}
        <ul className="space-y-1 text-sm">
          {roster.map(({ enrollment, patient }) => (
            <li key={enrollment.id} className="flex items-center justify-between gap-2">
              <span>
                {patient ? `${patient.firstName} ${patient.lastName}` : enrollment.patientId}
              </span>
              {canWrite && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt("Reason for ending this enrollment?") ?? "";
                    try {
                      AdelanteEHR.endGroupEnrollment(enrollment.id, reason, actor);
                      toast.success("Enrollment ended");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not end enrollment.");
                    }
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        {canWrite && (
          <>
          <p className="text-[11px] text-muted-foreground">
            Enrollment is blocked until a therapist, PMHNP or case manager sets group eligibility
            on the patient's care plan (placeholder criteria).
          </p>
          <div className="flex gap-2">
            <Select value={addId} onValueChange={setAddId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Enroll a patient (staff decision)" />
              </SelectTrigger>
              <SelectContent>
                {patients
                  .filter((p) => !enrollments.some((e) => e.patientId === p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                      {AdelanteEHR.isGroupEligible(p.id) ? "" : " — not yet eligible"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!addId}
              onClick={() => {
                try {
                  AdelanteEHR.enrollInGroup({
                    sessionId: group.id,
                    patientId: addId,
                    enrolledBy: actor,
                  });
                  toast.success("Enrolled");
                  setAddId("");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not enroll.");
                }
              }}
            >
              Enroll
            </Button>
          </div>
          {addId && <GroupEligibilityEditor patientId={addId} actor={actor} />}
          </>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-display text-sm text-navy">Occurrence</h3>
        <div className="flex flex-wrap gap-2">
          {starts.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setOccurrence(s)}
              className={
                "rounded-md border px-2.5 py-1.5 text-xs " +
                (activeStart === s ? "border-teal bg-teal/10 text-navy" : "bg-card")
              }
            >
              <ClientDate value={s} />
            </button>
          ))}
        </div>

        {canWrite && activeStart && (
          <div className="space-y-2">
            <OccurrenceModalityPicker group={group} occurrenceStart={activeStart} actor={actor} />
            <h4 className="text-xs font-medium text-navy">Attendance</h4>
            {roster.map(({ enrollment, patient }) => {
              const current =
                attendance[enrollment.patientId] ??
                savedAttendance.find((a) => a.patientId === enrollment.patientId)?.status ??
                "present";
              return (
                <div key={enrollment.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{patient ? `${patient.firstName} ${patient.lastName}` : enrollment.patientId}</span>
                  <div className="flex gap-1">
                    {(["present", "late", "absent"] as GroupAttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          setAttendance((prev) => ({ ...prev, [enrollment.patientId]: st }))
                        }
                        className={
                          "rounded-md border px-2 py-1 text-xs " +
                          (current === st ? "border-teal bg-teal/10 text-navy" : "bg-card")
                        }
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              disabled={roster.length === 0}
              onClick={() => {
                try {
                  AdelanteEHR.recordGroupAttendance(
                    group.id,
                    activeStart,
                    roster.map(({ enrollment }) => ({
                      patientId: enrollment.patientId,
                      status:
                        attendance[enrollment.patientId] ??
                        savedAttendance.find((a) => a.patientId === enrollment.patientId)?.status ??
                        "present",
                    })),
                    actor,
                  );
                  toast.success("Attendance recorded");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not record attendance.");
                }
              }}
            >
              Save attendance
            </Button>
          </div>
        )}

        {canWrite && present.length > 0 && !record?.sharedNote && (
          <div className="space-y-3 border-t pt-3">
            <h4 className="text-xs font-medium text-navy">Documentation</h4>
            <div className="space-y-1.5">
              <Label className="text-xs">Topic covered (shared group note)</Label>
              <Textarea value={topicCovered} onChange={(e) => setTopicCovered(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Group process / content</Label>
              <Textarea value={groupProcess} onChange={(e) => setGroupProcess(e.target.value)} rows={3} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Every present attendee needs their own individualized note — a blanket group note is a
              documented DMC-ODS denial risk.
            </p>
            {present.map((a) => {
              const p = patients.find((x) => x.id === a.patientId);
              return (
                <div key={a.patientId} className="space-y-1.5">
                  <Label className="text-xs">
                    {p ? `${p.firstName} ${p.lastName}` : a.patientId} — participation & response
                  </Label>
                  <Textarea
                    rows={2}
                    value={perAttendee[a.patientId] ?? ""}
                    onChange={(e) =>
                      setPerAttendee((prev) => ({ ...prev, [a.patientId]: e.target.value }))
                    }
                  />
                </div>
              );
            })}
            <Button
              size="sm"
              onClick={() => {
                try {
                  const result = AdelanteEHR.documentGroupOccurrence({
                    sessionId: group.id,
                    occurrenceStart: activeStart,
                    facilitatorId: group.facilitatorId,
                    topicCovered,
                    groupProcess,
                    perAttendee,
                    modality: AdelanteEHR.groupOccurrenceModality(group.id, activeStart),
                    actor,
                  });
                  // Billing hook: each individualized note becomes its own
                  // claim row in the EXISTING Claims Worklist pipeline.
                  for (const [patientId, noteId] of Object.entries(
                    result.occurrence.attendeeNoteIds,
                  )) {
                    AdelanteEHRExt.upsertClaimFromGroupAttendee({
                      sessionId: group.id,
                      occurrenceStart: activeStart,
                      patientId,
                      facilitatorId: group.facilitatorId,
                      noteId,
                    });
                  }
                  toast.success(
                    `Documented — 1 group note + ${result.attendeeNoteIds.length} individualized notes`,
                  );
                  setPerAttendee({});
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not document.");
                }
              }}
            >
              Sign group note & create attendee notes
            </Button>
          </div>
        )}

        {record?.sharedNote && (
          <div className="rounded-md border bg-secondary/30 p-3 text-xs space-y-1">
            <div className="font-medium text-navy">Shared group note — signed</div>
            <div>Topic covered: {record.sharedNote.topicCovered || "—"}</div>
            <div>Process: {record.sharedNote.groupProcess || "—"}</div>
            <div>
              Individualized attendee notes: {Object.keys(record.attendeeNoteIds).length} (each in
              that patient's chart, signed individually)
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// §Group sessions — occurrence-level modality + the per-member telehealth
// consent gate.
//
// UX choice: the gate is surfaced HERE, before documentation, listing the
// specific rostered members missing telehealth consent. The store throws if a
// blocked member is documented as present, so the facilitator's resolution is
// explicit — capture consent, or record that member as not attending this
// virtual meeting. The meeting itself is never blocked for everyone else.
function OccurrenceModalityPicker({
  group,
  occurrenceStart,
  actor,
}: {
  group: GroupSession;
  occurrenceStart: string;
  actor: string;
}) {
  const gate = useEhr(() => AdelanteEHR.groupOccurrenceConsentGate(group.id, occurrenceStart));
  const modality = gate.modality;
  return (
    <div className="space-y-2 rounded-md border bg-secondary/20 p-3">
      <Label className="text-xs">How is this meeting delivered?</Label>
      <div className="flex flex-wrap gap-1">
        {GROUP_OCCURRENCE_MODALITIES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              try {
                AdelanteEHR.setGroupOccurrenceModality(
                  group.id,
                  occurrenceStart,
                  m.key as GroupOccurrenceModality,
                  actor,
                );
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not set modality.");
              }
            }}
            className={
              "rounded-md border px-2 py-1 text-xs " +
              (modality === m.key ? "border-teal bg-teal/10 text-navy" : "bg-card")
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Modality is per meeting, not per group — it is stamped onto every attendee note because the
        service is billed as delivered.
      </p>
      {isVirtualGroupModality(modality) &&
        (gate.blocked.length > 0 ? (
          <p className="text-[11px] text-destructive" role="alert">
            Telehealth consent missing for: {gate.blocked.map((b) => b.name).join(", ")}. They
            cannot be documented as attending this virtual meeting until consent is captured.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Telehealth consent is active for every rostered member.
          </p>
        ))}
      {gate.confidentialityRequired && gate.confidentialityMissing.length > 0 && (
        <p className="text-[11px] text-destructive" role="alert">
          Group confidentiality acknowledgment missing for:{" "}
          {gate.confidentialityMissing.map((b) => b.name).join(", ")}.
        </p>
      )}
    </div>
  );
}

// §Group sessions — recurrence editor.
//
// Editing the pattern regenerates FUTURE occurrences only; `updateGroupRecurrence`
// preserves anything in the past or already attended/documented, so a change
// today can never rewrite attendance history.
function RecurrenceEditor({ group, actor }: { group: GroupSession; actor: string }) {
  const [weekly, setWeekly] = useState(group.recurrence.kind === "weekly");
  const [days, setDays] = useState<number[]>(
    group.recurrence.daysOfWeek?.length
      ? group.recurrence.daysOfWeek
      : [new Date(group.start).getDay()],
  );
  const [until, setUntil] = useState(group.recurrence.until ?? "");
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-display text-sm text-navy">Recurrence</h3>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
        Repeats weekly
      </label>
      {weekly && (
        <div className="flex flex-wrap gap-1">
          {dayLabels.map((label, idx) => (
            <button
              key={label}
              type="button"
              aria-pressed={days.includes(idx)}
              onClick={() =>
                setDays((prev) =>
                  prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort(),
                )
              }
              className={
                "rounded-md border px-2 py-1 text-xs " +
                (days.includes(idx) ? "border-teal bg-teal/10 text-navy" : "bg-card")
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {weekly && (
        <div className="space-y-1.5">
          <Label className="text-xs">Repeat until (optional)</Label>
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Past and already-attended occurrences are never changed — only unused future
        occurrences are regenerated.
      </p>
      <Button
        size="sm"
        onClick={() => {
          try {
            const res = AdelanteEHR.updateGroupRecurrence(
              group.id,
              weekly
                ? { kind: "weekly", daysOfWeek: days, until: until || undefined }
                : { kind: "none" },
              actor,
            );
            toast.success(
              res.removedFutureOccurrences > 0
                ? `Recurrence updated — ${res.removedFutureOccurrences} unused future occurrence(s) regenerated`
                : "Recurrence updated",
            );
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not update recurrence.");
          }
        }}
      >
        Save recurrence
      </Button>
    </Card>
  );
}

// §Group sessions — attendance + note-completion status per occurrence.
//
// GATING: aggregate counts sit at the `group_sessions` (schedule management)
// gate. The attendee-level "who still owes a note" list is PHI plus group
// membership, so it is shown ONLY to roles holding `group_notes` access —
// managing the schedule must not reveal which patients are behind.
function OccurrenceStatusCard({ group, canWrite, actor }: { group: GroupSession; canWrite: boolean; actor: string }) {
  const { role } = useActingStaff();
  const notesAccess = canAccess(role, "group_notes");
  const canSeeAttendees = !notesAccess.locked;
  const rows = useEhr(() => occurrenceStatuses(group.id, 6));
  const [exception, setException] = useState<
    { start: string; mode: "cancel" | "reschedule" } | null
  >(null);
  const [reason, setReason] = useState("");
  const [newStart, setNewStart] = useState("");

  function submitException() {
    if (!exception) return;
    try {
      if (exception.mode === "cancel") {
        AdelanteEHR.cancelGroupOccurrence(group.id, exception.start, reason, actor);
        toast.success("Meeting cancelled. The recurring pattern is unchanged.");
      } else {
        AdelanteEHR.rescheduleGroupOccurrence(
          group.id,
          exception.start,
          new Date(newStart).toISOString(),
          reason,
          actor,
        );
        toast.success("Meeting moved. The recurring pattern is unchanged.");
      }
      setException(null);
      setReason("");
      setNewStart("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change that meeting.");
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm text-navy">Attendance &amp; documentation status</h3>
        {!canSeeAttendees && (
          <Badge variant="outline" className="text-[10px] inline-flex items-center gap-1">
            <Lock className="h-3 w-3" /> Counts only
          </Badge>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No occurrences scheduled.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            // DATA-LAYER GATE: the helper itself refuses to return attendee
            // identities to a role without `group_notes`, so this component
            // never holds a patient name it is not allowed to show.
            const owed = owedAttendeesForRole(role, group.id, r.occurrenceStart).attendees;
            return (
              <li key={r.occurrenceStart} className="rounded-md border p-2.5 text-xs space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-navy">
                    <ClientDate value={r.occurrenceStart} />
                  </span>
                  {r.cancelled && <Badge variant="outline">Cancelled</Badge>}
                  {r.movedFromStart && <Badge variant="outline">Moved</Badge>}
                  {r.attendanceRecorded ? (
                    <Badge className="bg-teal/15 text-teal">Attendance taken</Badge>
                  ) : (
                    <Badge variant="outline">Attendance not taken</Badge>
                  )}
                  {r.attendanceRecorded &&
                    (r.notesOwed === 0 ? (
                      <Badge className="bg-success/20 text-success">Notes complete</Badge>
                    ) : (
                      <Badge className="bg-gold/30 text-navy">{r.notesOwed} note(s) owed</Badge>
                    ))}
                </div>
                <div className="text-muted-foreground">
                  Present {r.present} · Late {r.late} · Absent {r.absent} · Individualized notes{" "}
                  {r.notesComplete}/{r.notesComplete + r.notesOwed}
                </div>
                {canSeeAttendees && owed.length > 0 && (
                  <div className="text-muted-foreground">
                    Owing:{" "}
                    {owed.map((o) => o.patientName).join(", ")}
                  </div>
                )}
                {r.cancelReason && (
                  <div className="text-muted-foreground">Reason: {r.cancelReason}</div>
                )}
                {canWrite && r.mutable && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setException({ start: r.occurrenceStart, mode: "cancel" });
                        setReason("");
                      }}
                    >
                      Cancel this meeting
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setException({ start: r.occurrenceStart, mode: "reschedule" });
                        setReason("");
                        setNewStart("");
                      }}
                    >
                      Move this meeting
                    </Button>
                  </div>
                )}
                {canWrite && !r.mutable && !r.cancelled && (
                  <div className="text-muted-foreground">
                    Locked — this meeting is past or already has attendance/notes. Amend the
                    documentation instead.
                  </div>
                )}
                {exception?.start === r.occurrenceStart && (
                  <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground">
                      This changes only this one meeting — the recurring pattern stays as it is.
                    </p>
                    {exception.mode === "reschedule" && (
                      <div className="space-y-1">
                        <Label className="text-[11px]">New date and time</Label>
                        <Input
                          type="datetime-local"
                          value={newStart}
                          onChange={(e) => setNewStart(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[11px]">Reason</Label>
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. facilitator out"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-[11px]" onClick={submitException}>
                        {exception.mode === "cancel" ? "Cancel meeting" : "Move meeting"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={() => setException(null)}
                      >
                        Keep as scheduled
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        "Complete" uses the same rule documentation enforces: every present or late attendee
        needs their own individualized note.
      </p>
    </Card>
  );
}
