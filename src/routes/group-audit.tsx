import { StaffTable } from "@/components/staff/StaffTable";
// §Group sessions — admin audit view for the eligibility gate.
//
// Same shape and discipline as the consent audit viewer: one filterable,
// read-only table over EXISTING audit events (no new logging mechanism), with
// detail redacted through the shared audit-redaction rules.
//
// Gate: `group_sessions` — the record class group management already uses. No
// new record class was invented for this surface.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, GROUP_CATEGORIES, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EyeOff, Users } from "lucide-react";
import { useActingRole } from "@/lib/roles";
import { redactAuditEvents } from "@/lib/auditRedaction";
import { roleSeesGroupJoinRequest } from "@/lib/groupJoinView";
import { ClientDate } from "@/components/ClientDate";

const copy = {
  all: "All",
  redacted: "Redacted",
  group_audit_table: "Group audit",
  group_audit_tableColumns: [
    "When",
    "Patient",
    "Event",
    "Actor",
    "Group",
    "Detail",
  ],
};

export const Route = createFileRoute("/group-audit")({
  head: () => ({
    meta: [
      { title: "Group eligibility audit — Adelante" },
      {
        name: "description",
        content:
          "Group eligibility changes and blocked enrollment attempts, filterable by patient and event.",
      },
      { property: "og:title", content: "Group eligibility audit — Adelante" },
      {
        property: "og:description",
        content: "Who set group eligibility, and every enrollment attempt that was refused.",
      },
    ],
  }),
  component: GroupAuditPage,
});

/** Only the group-eligibility / blocked-enrollment slice of the clinical stream. */
export const GROUP_AUDIT_ACTIONS = [
  { value: "group_eligibility_set", label: "Eligibility set" },
  { value: "group_eligibility_cleared", label: "Eligibility removed" },
  { value: "group_enrollment_blocked", label: "Enrollment blocked" },
  { value: "group_join_requested", label: "Join requested" },
  { value: "group_join_approved", label: "Join approved" },
  { value: "group_join_declined", label: "Join declined" },
  { value: "group_join_approval_blocked", label: "Join approval blocked" },
] as const;

const CATEGORY_LABEL = new Map(GROUP_CATEGORIES.map((c) => [c.key, c.label]));
const ACTION_LABEL = new Map(GROUP_AUDIT_ACTIONS.map((a) => [a.value, a.label]));
const ACTION_SET = new Set<string>(GROUP_AUDIT_ACTIONS.map((a) => a.value));

function GroupAuditPage() {
  const [role] = useActingRole();
  const [patientId, setPatientId] = useState("all");
  const [action, setAction] = useState("all");
  // Same `type="date"` + since/until pattern as the admin audit log.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const patients = useEhr(() => AdelanteEHR.listPatients());

  const view = useEhr(() => {
    const events = AdelanteEHR.listAuditEvents({
      category: "clinical",
      patientId: patientId === "all" ? undefined : patientId,
      since: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      until: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    })
      .filter((e) => ACTION_SET.has(e.action))
      .filter((e) => action === "all" || e.action === action);
    // §Part 2 — protected (SUD group) join entries are hidden from roles
    // failing the check on that patient; only a count remains.
    const visible = events.filter(
      (e) =>
        !(e.detail as Record<string, unknown> | undefined)?.protected ||
        roleSeesGroupJoinRequest(role, { protected: true, patientId: e.patientId ?? "" }),
    );
    return { list: redactAuditEvents(visible, role), hidden: events.length - visible.length };
  });

  const rows = view.list;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex items-start gap-3">
        <Users className="mt-1 h-6 w-6 text-teal" />
        <div>
          <h1 className="font-display text-2xl text-navy">Group eligibility audit</h1>
          <p className="text-sm text-muted-foreground">
            Every change to a patient's group eligibility, and every enrollment attempt that was
            refused — who, when, which group, and why. Detail is redacted to your role's access.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs text-muted-foreground" id="ga-patient">
            Patient
          </label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger aria-labelledby="ga-patient" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All patients</SelectItem>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.programId} · {p.firstName} {p.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground" id="ga-action">
            Event type
          </label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger aria-labelledby="ga-action" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {GROUP_AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="ga-from">
            From
          </label>
          <Input
            id="ga-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-h-11"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground" htmlFor="ga-to">
            To
          </label>
          <Input
            id="ga-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-h-11"
          />
        </div>
      </div>
      {(from || to) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFrom("");
            setTo("");
          }}
        >
          Clear dates
        </Button>
      )}

      {view.hidden > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="group-audit-hidden">
          {view.hidden} protected entr{view.hidden === 1 ? "y" : "ies"} not shown for your role.
        </p>
      )}
      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No group eligibility or blocked-enrollment events match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <StaffTable
    views={[
      { id: "all", label: copy.all, matches: () => true },
      { id: "redacted", label: copy.redacted, matches: (r) => r.redacted },
    ]}
    rows={rows}
    rowKey={(r) => r.event.id}
    label={copy.group_audit_table}
    testId="group-audit-table"
    rowAttributes={(r) => ({ "data-row-id": r.event.id })}
    columns={[
      {
        id: "c0",
        label: copy.group_audit_tableColumns[0],
        cell: (r) => {
          const d = r.detail as Record<string, unknown>;
          const category =
            typeof d.category === "string" ? d.category : undefined;
          return (
            <>
              <ClientDate value={r.event.at} />
            </>
          );
        },
      },
      {
        id: "c1",
        label: copy.group_audit_tableColumns[1],
        cell: (r) => {
          const d = r.detail as Record<string, unknown>;
          const category =
            typeof d.category === "string" ? d.category : undefined;
          return <>{r.subjectLabel}</>;
        },
      },
      {
        id: "c2",
        label: copy.group_audit_tableColumns[2],
        cell: (r) => {
          const d = r.detail as Record<string, unknown>;
          const category =
            typeof d.category === "string" ? d.category : undefined;
          return (
            <>
              <Badge
                variant={
                  r.event.action === "group_enrollment_blocked" ||
                  r.event.action === "group_join_approval_blocked"
                    ? "outline"
                    : "outline"
                }
                className="text-sm"
              >
                {ACTION_LABEL.get(r.event.action as never) ??
                  r.event.action.replace(/_/g, " ")}
              </Badge>
            </>
          );
        },
      },
      {
        id: "c3",
        label: copy.group_audit_tableColumns[3],
        cell: (r) => {
          const d = r.detail as Record<string, unknown>;
          const category =
            typeof d.category === "string" ? d.category : undefined;
          return (
            <>
              {r.event.actorId ?? "—"}
              <div className="text-muted-foreground">
                {String(d.role ?? r.event.actorRole ?? "—")}
              </div>
            </>
          );
        },
      },
      {
        id: "c4",
        label: copy.group_audit_tableColumns[4],
        cell: (r) => {
          const d = r.detail as Record<string, unknown>;
          const category =
            typeof d.category === "string" ? d.category : undefined;
          return (
            <>
              {typeof d.topic === "string"
                ? d.topic
                : ((d.groupSessionId as string) ?? "—")}
              {category ? (
                <div className="text-muted-foreground">
                  {CATEGORY_LABEL.get(category as never) ?? category}
                </div>
              ) : null}
            </>
          );
        },
      },
      {
        id: "c5",
        label: copy.group_audit_tableColumns[5],
        cell: (r) => {
          const d = r.detail as Record<string, unknown>;
          const category =
            typeof d.category === "string" ? d.category : undefined;
          return (
            <>
              {typeof d.reason === "string"
                ? d.reason
                : Object.entries(d)
                    .map(
                      ([k, v]) =>
                        `${k}: ${Array.isArray(v) ? v.join("/") : String(v)}`,
                    )
                    .join(" · ") || "—"}
              {r.redacted ? (
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <EyeOff className="h-3 w-3" /> {r.redactionReason}
                </div>
              ) : null}
            </>
          );
        },
      },
    ]}
  />
          </div>
        )}
      </Card>
    </div>
  );
}
