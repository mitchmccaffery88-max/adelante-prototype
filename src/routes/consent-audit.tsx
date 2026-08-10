// §ASCMI consent audit viewer — one combined, filterable table over the
// existing `consent` + `disclosure` audit streams. Read-only; gated through
// the nav registry (`consent_ledger`, read is enough) exactly like every other
// consent surface, and redaction goes through the shared audit-redaction rules
// — never raw detail.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, CONSENT_CATEGORIES, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EyeOff, ShieldCheck } from "lucide-react";
import { useActingRole } from "@/lib/roles";
import { redactAuditEvents } from "@/lib/auditRedaction";
import { ClientDate } from "@/components/ClientDate";
import {
  advocateGateOutcome,
  categoriesForAuditEvent,
  CONSENT_AUDIT_EVENT_TYPES,
} from "@/lib/consentAudit";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/consent-audit")({
  head: () => ({
    meta: [
      { title: "Consent audit — Adelante" },
      {
        name: "description",
        content: "Consent capture, revocation and disclosure events, filterable by patient and category.",
      },
      { property: "og:title", content: "Consent audit — Adelante" },
      {
        property: "og:description",
        content: "Filterable trail of consent captures, revocations and Part 2 disclosures.",
      },
    ],
  }),
  component: ConsentAuditPage,
});

const CATEGORY_LABEL = new Map(CONSENT_CATEGORIES.map((c) => [c.key, c.label]));

/** One of the two advocate gates, pass/fail, named explicitly. */
function GateChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className="flex items-center gap-1 text-[11px]"
      data-testid={`gate-${ok ? "pass" : "fail"}`}
    >
      {ok ? (
        <Check className="h-3 w-3 text-teal" />
      ) : (
        <X className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={ok ? "text-navy" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function ConsentAuditPage() {
  const [role] = useActingRole();
  const [patientId, setPatientId] = useState("all");
  const [category, setCategory] = useState("all");
  const [action, setAction] = useState("all");

  const patients = useEhr(() => AdelanteEHR.listPatients());

  const rows = useEhr(() => {
    const events = AdelanteEHR.listAuditEvents({
      // §Group D item 7 — advocate reads are consent-conditional disclosures,
      // so they belong in the same trail. They are redacted by the SAME rules
      // (the `advocate` category already maps to `consent_ledger`).
      category: ["consent", "disclosure", "advocate"],
      patientId: patientId === "all" ? undefined : patientId,
    })
      .filter((e) => action === "all" || e.action === action)
      .filter((e) => category === "all" || categoriesForAuditEvent(e).includes(category as never));
    return redactAuditEvents(events, role).map((r) => ({
      ...r,
      categories: categoriesForAuditEvent(r.event),
      gates: advocateGateOutcome(r.event),
    }));
  });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-6 w-6 text-teal" />
        <div>
          <h1 className="font-display text-2xl text-navy">Consent audit</h1>
          <p className="text-sm text-muted-foreground">
            Every consent capture, revocation and Part 2 disclosure, in one trail. Detail is
            redacted to your role's access.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground" id="ca-patient">
            Patient
          </label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger aria-labelledby="ca-patient" className="min-h-11">
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
          <label className="text-xs text-muted-foreground" id="ca-category">
            Consent category
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-labelledby="ca-category" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CONSENT_CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground" id="ca-action">
            Event type
          </label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger aria-labelledby="ca-action" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {CONSENT_AUDIT_EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No consent events match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="consent-audit-table">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Categories</th>
                  <th className="p-3">Advocate gates</th>
                  <th className="p-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.event.id} className="align-top">
                    <td className="p-3 whitespace-nowrap text-xs">
                      <ClientDate value={r.event.at} />
                    </td>
                    <td className="p-3 text-xs">{r.subjectLabel}</td>
                    <td className="p-3 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {r.event.category}
                      </Badge>
                      <div className="mt-1">{r.event.action.replace(/_/g, " ")}</div>
                    </td>
                    <td className="p-3 text-xs">
                      {r.event.actorId ?? "—"}
                      <div className="text-muted-foreground">{r.event.actorRole ?? "—"}</div>
                    </td>
                    <td className="p-3 text-xs">
                      {r.categories.length === 0
                        ? "—"
                        : r.categories.map((c) => CATEGORY_LABEL.get(c) ?? c).join(", ")}
                    </td>
                    <td className="p-3 text-xs" data-testid="advocate-gates-cell">
                      {r.gates ? (
                        <div className="space-y-1">
                          <GateChip ok={r.gates.linkValid} label="Advocate link valid" />
                          <GateChip
                            ok={r.gates.consentActive}
                            label="Part 2 disclosure consent"
                          />
                          <div className="text-[11px] text-muted-foreground">
                            {r.gates.part2Disclosed
                              ? "SUD detail disclosed"
                              : "SUD detail masked"}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {Object.entries(r.detail)
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : String(v)}`)
                        .join(" · ") || "—"}
                      {r.redacted ? (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <EyeOff className="h-3 w-3" /> {r.redactionReason}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
