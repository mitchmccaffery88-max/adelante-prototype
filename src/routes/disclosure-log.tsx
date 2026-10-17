import { StaffTable } from "@/components/staff/StaffTable";
// §Batch C1/C2 — organisation-wide Part 2 disclosure log + record-access log.
// sys_admin and the compliance stand-in (credentialing coordinator) only.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  CHANNEL_LABEL,
  DISCLOSURE_LOG_ROLES,
  listDisclosureLog,
  markEmergencyReviewed,
  PART2_NOTICE_DRAFT_LABEL,
  type DisclosureChannel,
  type RecipientType,
} from "@/lib/part2Disclosure";
import { accessEventsFor, ACCESS_LOG_LABEL } from "@/lib/accessLog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/disclosure-log")({
  head: () => ({
    meta: [
      { title: "Disclosure & access log — Adelante" },
      { name: "description", content: "Who shared substance-use records with whom, and who opened each chart." },
      { property: "og:title", content: "Disclosure & access log — Adelante" },
      { property: "og:description", content: "Part 2 disclosure log and record-access log for compliance review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisclosureLogPage,
});

const copy = {
  disclosures: "Disclosures",
  access: "Record access",
  when: "When",
  person: "Person",
  recipient: "Recipient",
  purpose: "Purpose",
  detail: "Detail",
  actor: "Who",
};

const RECIPIENT_TYPES: RecipientType[] = ["internal", "advocate", "provider", "hie", "legal", "county", "patient", "other"];

function DisclosureLogPage() {
  const me = useActingStaff();
  const [channel, setChannel] = useState<DisclosureChannel | "">("");
  const [rtype, setRtype] = useState<RecipientType | "">("");
  const [patientId, setPatientId] = useState("");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const rowsJson = useEhr(() =>
    JSON.stringify(
      listDisclosureLog({ channel: channel || undefined, recipientType: rtype || undefined, patientId: patientId || undefined, emergencyOnly }),
    ),
  );
  const accessJson = useEhr(() => JSON.stringify(patientId ? accessEventsFor(patientId).slice(0, 100) : []));
  if (!DISCLOSURE_LOG_ROLES.includes(me.role))
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Only system admins and compliance can view the disclosure log.
        </Card>
      </div>
    );
  const rows = JSON.parse(rowsJson) as ReturnType<typeof listDisclosureLog>;
  const access = JSON.parse(accessJson) as ReturnType<typeof accessEventsFor>;
  const name = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName.slice(0, 1)}.` : id;
  };
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Disclosure log</h1>
        <p className="text-sm text-muted-foreground">
          Every time substance-use records left the program. Class names only — never the content. Notice wording: {PART2_NOTICE_DRAFT_LABEL}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Channel" className={sel} value={channel} onChange={(e) => setChannel(e.target.value as DisclosureChannel | "")}>
          <option value="">All channels</option>
          {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Recipient type" className={sel} value={rtype} onChange={(e) => setRtype(e.target.value as RecipientType | "")}>
          <option value="">All recipients</option>
          {RECIPIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Person" className={sel} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">All people</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={emergencyOnly} onChange={(e) => setEmergencyOnly(e.target.checked)} /> Emergencies only
        </label>
      </div>
      <StaffTable
    rows={rows}
    rowKey={(r) => r.id}
    label={copy.disclosures}
    testId="disclosure-log-table"
    emptyState="No disclosures match."
    columns={[
      {
        id: "when",
        label: copy.when,
        cell: (r) => new Date(r.at).toLocaleString(),
      },
      { id: "person", label: copy.person, cell: (r) => name(r.patientId) },
      {
        id: "recipient",
        label: copy.recipient,
        cell: (r) => (
          <>
            to {r.recipient.name}
            {r.recipient.organization
              ? ` (${r.recipient.organization})`
              : ""} · {r.recipient.type}
          </>
        ),
      },
      { id: "purpose", label: copy.purpose, cell: (r) => r.purpose },
      {
        id: "detail",
        label: copy.detail,
        cell: (r) => (
          <>
            {CHANNEL_LABEL[r.channel]} · {r.recordClasses.join(", ")} ·{" "}
            {r.consentRef} · {r.actorName} ({r.actingRole.replace(/_/g, " ")})
            {r.viewedAs ? ` as ${r.viewedAs}` : ""}
            {r.simulated && <Badge variant="outline">Simulated</Badge>}
            {r.emergency && (
              <Badge variant="outline">
                Emergency —{" "}
                {r.complianceReview === "reviewed"
                  ? "reviewed"
                  : "review pending"}
              </Badge>
            )}
          </>
        ),
      },
    ]}
    primaryAction={(r) => r.emergency && r.complianceReview !== "reviewed" ? (
      <Button size="sm" variant="outline" onClick={() => {
        try { markEmergencyReviewed(r.id, { name: me.staffName, role: me.role, staffId: me.staffId }); AdelanteEHR._emit(); toast.success("Marked reviewed."); }
        catch (e) { toast.error((e as Error).message); }
      }}>Mark reviewed</Button>
    ) : null}
  />
      <div>
        <h2 className="text-base font-semibold text-navy">Who accessed this record</h2>
        <p className="text-xs text-muted-foreground">{ACCESS_LOG_LABEL}. Pick a person above.</p>
      </div>
      {patientId && (
        <StaffTable
    rows={access}
    rowKey={(a) => a.id}
    label={copy.access}
    testId="access-log-table"
    emptyState="No record views logged yet."
    columns={[
      {
        id: "when",
        label: copy.when,
        cell: (a) => new Date(a.at).toLocaleString(),
      },
      { id: "actor", label: copy.actor, cell: (a) => a.actorName },
      {
        id: "detail",
        label: copy.detail,
        cell: (a) => (
          <>
            {(a.role ?? "").replace(/_/g, " ")} · {a.kind} · {a.sectionId}
            {a.viewedAs ? ` · viewed as ${a.viewedAs}` : ""}
          </>
        ),
      },
    ]}
  />
      )}
    </div>
  );
}
