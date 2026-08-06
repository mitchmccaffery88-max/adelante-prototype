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
import { ClientDate } from "@/components/ClientDate";

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
] as const;

const CATEGORY_LABEL = new Map(GROUP_CATEGORIES.map((c) => [c.key, c.label]));
const ACTION_LABEL = new Map(GROUP_AUDIT_ACTIONS.map((a) => [a.value, a.label]));
const ACTION_SET = new Set<string>(GROUP_AUDIT_ACTIONS.map((a) => a.value));

function GroupAuditPage() {
  const [role] = useActingRole();
  const [patientId, setPatientId] = useState("all");
  const [action, setAction] = useState("all");

  const patients = useEhr(() => AdelanteEHR.listPatients());

  const rows = useEhr(() => {
    const events = AdelanteEHR.listAuditEvents({
      category: "clinical",
      patientId: patientId === "all" ? undefined : patientId,
    })
      .filter((e) => ACTION_SET.has(e.action))
      .filter((e) => action === "all" || e.action === action);
    return redactAuditEvents(events, role);
  });

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

      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No group eligibility or blocked-enrollment events match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="group-audit-table">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Group</th>
                  <th className="p-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const d = r.detail as Record<string, unknown>;
                  const category = typeof d.category === "string" ? d.category : undefined;
                  return (
                    <tr key={r.event.id} className="align-top">
                      <td className="p-3 whitespace-nowrap text-xs">
                        <ClientDate value={r.event.at} />
                      </td>
                      <td className="p-3 text-xs">{r.subjectLabel}</td>
                      <td className="p-3 text-xs">
                        <Badge
                          variant={r.event.action === "group_enrollment_blocked" ? "destructive" : "outline"}
                          className="text-[10px]"
                        >
                          {ACTION_LABEL.get(r.event.action as never) ?? r.event.action.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">
                        {r.event.actorId ?? "—"}
                        <div className="text-muted-foreground">
                          {String(d.role ?? r.event.actorRole ?? "—")}
                        </div>
                      </td>
                      <td className="p-3 text-xs">
                        {typeof d.topic === "string" ? d.topic : (d.groupSessionId as string) ?? "—"}
                        {category ? (
                          <div className="text-muted-foreground">
                            {CATEGORY_LABEL.get(category as never) ?? category}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {typeof d.reason === "string"
                          ? d.reason
                          : Object.entries(d)
                              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : String(v)}`)
                              .join(" · ") || "—"}
                        {r.redacted ? (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <EyeOff className="h-3 w-3" /> {r.redactionReason}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
