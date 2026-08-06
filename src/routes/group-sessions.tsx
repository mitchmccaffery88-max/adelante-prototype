// §Group sessions — staff-facing group care delivery.
//
// PLACEHOLDER CONTENT WARNING: topics, capacity numbers and any billing
// linkage on this screen are STRUCTURE ONLY. DHCS/DMC-ODS group-size limits,
// curriculum names and billing/CPT/H-codes are deliberately not authored here.
//
// Enrollment is staff-initiated by design: group placement is a clinical
// decision, unlike the patient-driven 1:1 scheduling flow, which this page
// does not touch.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  useEhr,
  type GroupAttendanceStatus,
  type GroupSession,
} from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { canAccess, useActingStaff } from "@/lib/roles";
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
          Group counseling schedule, standing roster, attendance and documentation. Topics and
          capacity are placeholders pending clinical content sign-off.
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
    </div>
  );
}

function CreateGroupCard({ actor }: { actor: string }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [facilitatorId, setFacilitatorId] = useState("");
  const [start, setStart] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [weekly, setWeekly] = useState(true);
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());

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
          <Label className="text-xs">Capacity (placeholder — no DHCS limit encoded)</Label>
          <Input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
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
                facilitatorId,
                serviceType: "therapy_group",
                modality: "in_person",
                start: startIso,
                durationMin: 60,
                capacity: Number(capacity) || 1,
                recurrence: weekly
                  ? { kind: "weekly", daysOfWeek: [new Date(startIso).getDay()] }
                  : { kind: "none" },
                createdBy: actor,
              });
              toast.success("Group created");
              setOpen(false);
              setTopic("");
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
        <p className="text-xs text-muted-foreground">
          {group.serviceType} · {group.modality} · {group.durationMin} min · capacity{" "}
          {group.capacity}
        </p>
      </Card>

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
