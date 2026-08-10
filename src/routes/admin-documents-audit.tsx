// §Group E item 3 — documents audit surface.
//
// Deliberately NOT a new audit system: it is the same `listAuditEvents` stream
// and the same `redactAuditEvents` rules as `/consent-audit` and
// `/admin-audit`, filtered to the document lifecycle. RBAC is the nav
// registry's `documents` record class, enforced here too, so the page cannot
// be reached by URL by a role the nav hides it from.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EyeOff, FileSearch, Lock } from "lucide-react";
import { useActingRole } from "@/lib/roles";
import { canAccess } from "@/lib/roles";
import { redactAuditEvents } from "@/lib/auditRedaction";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/admin-documents-audit")({
  head: () => ({
    meta: [
      { title: "Documents audit — Adelante" },
      {
        name: "description",
        content:
          "Uploads, Part 2 classification, malware blocks and chart promotions, with who and when.",
      },
      { property: "og:title", content: "Documents audit — Adelante" },
      {
        property: "og:description",
        content: "Filterable trail of every patient-document event, redacted to your role.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsAuditPage,
});

/** The document lifecycle, named. Every row on this page is one of these. */
export const DOCUMENT_AUDIT_EVENTS: { value: string; label: string; kind: string }[] = [
  { value: "document_uploaded", label: "Upload accepted", kind: "Upload" },
  { value: "document_upload_rejected", label: "Blocked by malware scan", kind: "Malware block" },
  { value: "document_verified", label: "Promoted into the record", kind: "Promotion" },
  { value: "document_rejected", label: "Not accepted", kind: "Promotion" },
  { value: "document_downloaded", label: "Downloaded", kind: "Access" },
  { value: "document_download_denied", label: "Download refused", kind: "Access" },
  { value: "advocate_document_uploaded", label: "Advocate upload", kind: "Upload" },
  {
    value: "advocate_document_upload_rejected",
    label: "Advocate upload blocked",
    kind: "Malware block",
  },
  { value: "advocate_documents_viewed", label: "Advocate viewed documents", kind: "Access" },
  { value: "advocate_document_downloaded", label: "Advocate download", kind: "Access" },
  {
    value: "advocate_document_download_denied",
    label: "Advocate download refused",
    kind: "Access",
  },
  {
    value: "advocate_document_verified_notified",
    label: "Advocate notified of promotion",
    kind: "Promotion",
  },
];

const EVENT_META = new Map(DOCUMENT_AUDIT_EVENTS.map((e) => [e.value, e]));
const DOCUMENT_ACTIONS = new Set(DOCUMENT_AUDIT_EVENTS.map((e) => e.value));

function DocumentsAuditPage() {
  const [role] = useActingRole();
  const [patientId, setPatientId] = useState("all");
  const [action, setAction] = useState("all");

  const patients = useEhr(() => AdelanteEHR.listPatients());
  const allowed = canAccess(role, "documents").level !== "none";

  const rows = useEhr(() => {
    if (!allowed) return [];
    const events = AdelanteEHR.listAuditEvents({
      category: ["clinical", "advocate"],
      patientId: patientId === "all" ? undefined : patientId,
    })
      .filter((e) => DOCUMENT_ACTIONS.has(e.action))
      .filter((e) => action === "all" || e.action === action);
    return redactAuditEvents(events, role);
  });

  if (!allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card className="flex gap-3 p-6 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-navy">You don't have access to the documents audit</p>
            <p className="mt-1 text-muted-foreground">
              This surface needs access to patient documents.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-start gap-3">
        <FileSearch className="mt-1 h-6 w-6 text-teal" />
        <div>
          <h1 className="font-display text-2xl text-navy">Documents audit</h1>
          <p className="text-sm text-muted-foreground">
            Uploads, Part 2 classification decisions, malware blocks and chart promotions — who,
            when, and what happened. Detail is redacted to your role's access.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground" id="da-patient">
            Patient
          </label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger aria-labelledby="da-patient" className="min-h-11">
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
          <label className="text-xs text-muted-foreground" id="da-action">
            Event type
          </label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger aria-labelledby="da-action" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All document events</SelectItem>
              {DOCUMENT_AUDIT_EVENTS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No document events match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="documents-audit-table">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Who</th>
                  <th className="p-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const meta = EVENT_META.get(r.event.action);
                  return (
                    <tr key={r.event.id} className="align-top">
                      <td className="p-3 whitespace-nowrap text-xs">
                        <ClientDate value={r.event.at} />
                      </td>
                      <td className="p-3 text-xs">{r.subjectLabel}</td>
                      <td className="p-3 text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {meta?.kind ?? "Document"}
                        </Badge>
                        <div className="mt-1">{meta?.label ?? r.event.action}</div>
                      </td>
                      <td className="p-3 text-xs">
                        {r.event.actorId ?? "—"}
                        <div className="text-muted-foreground">{r.event.actorRole ?? "—"}</div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {Object.entries(r.detail)
                          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : String(v)}`)
                          .join(" · ") || "—"}
                        {r.redacted ? (
                          <div className="mt-1 flex items-center gap-1 text-[11px]">
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
