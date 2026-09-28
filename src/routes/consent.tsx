import { listLegalDisclosures, revokeLegalDisclosure } from "@/lib/outpatientCare";
import { useActingStaff } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type ExtendedConsentPurpose, type ConsentPurpose } from "@/lib/ehr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { ConsentRecordsPanel } from "@/components/consent/ConsentRecordsPanel";
import { AdvocateConsentCard } from "@/components/consent/AdvocateConsentCard";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Consent ledger — Adelante" },
      { name: "description", content: "Per-purpose consent state and append-only disclosure log." },
      { property: "og:title", content: "Consent ledger — Adelante" },
      {
        property: "og:description",
        content: "Per-purpose consent state and append-only disclosure log.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { patientId?: string; category?: string } => ({
    patientId: typeof s.patientId === "string" ? s.patientId : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  component: ConsentPage,
});

const PURPOSES: { key: ExtendedConsentPurpose; label: string; note: string }[] = [
  {
    key: "part2Sud",
    label: "Part 2 (SUD)",
    note: "Unlocks SUD-identifying rows. Revoke re-locks immediately.",
  },
  {
    key: "ecmShare",
    label: "ECM information share",
    note: "Enhanced Care Management coordination.",
  },
  { key: "sms", label: "SMS reminders", note: "Text message reminders and welcome messages." },
  { key: "hipaa", label: "HIPAA authorization", note: "Baseline authorization signed at intake." },
  {
    key: "telehealth",
    label: "Telehealth",
    note: "Video / phone visits. Video is delivered by a HIPAA-aligned integrated vendor; medication management uses eScribe.",
  },
  {
    key: "roi",
    label: "Release of Information",
    note: "External disclosure to a named third party.",
  },
  { key: "portal", label: "Patient portal", note: "Self-service portal access." },
  {
    key: "proxy",
    label: "Proxy / staff-completed forms",
    note: "Staff may complete forms on the patient's behalf.",
  },
  { key: "group", label: "Group therapy", note: "Participation and shared attendance." },
];

function ConsentPage() {
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const events = useEhr(() => AdelanteEHR.listAllConsentEvents());
  const search = Route.useSearch();
  const [selected, setSelected] = useState<string>(search.patientId ?? patients[0]?.id ?? "");
  const patient = useEhr(() => AdelanteEHR.getPatient(selected));
  const state = useEhr(() => (patient ? AdelanteEHR.getConsentState(patient.id) : null));

  const patientEvents = useMemo(
    () => events.filter((e) => patient && e.programId === patient.programId),
    [events, patient],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex items-start gap-3">
        <ShieldCheck className="h-6 w-6 text-teal mt-1" />
        <div>
          <h1 className="font-display text-2xl text-navy">Consent ledger</h1>
          <p className="text-sm text-muted-foreground">
            Per-purpose consent state, revocable, with an append-only audit trail. Revoking{" "}
            <em>Part 2 (SUD)</em> immediately re-locks SUD-identifying rows across the app.
          </p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
        <label className="text-muted-foreground" id="consent-patient-label">
          Patient:
        </label>
        <Select value={selected} onValueChange={(v) => setSelected(v)}>
          <SelectTrigger
            aria-labelledby="consent-patient-label"
            className="min-h-11 w-full sm:w-72"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.programId} · {p.firstName} {p.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {search.category === "telehealth" && patient && (
        <p role="status" className="rounded-md border border-teal/40 bg-teal/5 p-3 text-sm text-navy" data-testid="consent-focus">
          Telehealth consent is needed before this patient can join a group with online meetings.
          Record it below under Telehealth.
        </p>
      )}
      {patient && state ? (
        <ConsentRecordsPanel patient={patient} />
      ) : null}
      {patient ? <AdvocateConsentCard patientId={patient.id} /> : null}
      {patient ? <LegalDisclosureCard patientId={patient.id} focused={search.category === "legal_part2_disclosure"} /> : null}

      {patient && state ? (
        <section className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {PURPOSES.map((p) => {
            const granted =
              p.key === "hipaa"
                ? patient.consents.hipaa
                : ((state as Record<string, boolean | undefined>)[p.key] ?? false);
            const isCore = ["part2Sud", "ecmShare", "sms"].includes(p.key);
            return (
              <div key={p.key} id={`consent-${p.key}`} className={`rounded-xl border bg-card p-4 ${search.category === p.key ? "ring-2 ring-teal" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{p.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.note}</div>
                  </div>
                  <span
                    className={`text-[10px] rounded-full px-2 py-0.5 ${
                      granted ? "bg-teal/15 text-teal" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {granted ? "Granted" : "Not granted"}
                  </span>
                </div>
                {isCore && (
                  <button
                    onClick={() => {
                      AdelanteEHR.setConsent(
                        patient.id,
                        p.key as ConsentPurpose,
                        !granted,
                        "consent page",
                      );
                      toast.success(granted ? "Consent revoked" : "Consent granted");
                    }}
                    aria-label={granted ? `Revoke ${p.label} consent` : `Grant ${p.label} consent`}
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-navy/20 px-3 text-sm font-medium text-navy hover:bg-navy/5"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    {granted ? "Revoke" : "Grant"}
                  </button>
                )}
                {!isCore && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Extended purpose · management UI arrives with the next EMR-fields spec.
                  </p>
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-lg text-navy mb-2">Disclosure log</h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          {patientEvents.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No consent events recorded for this patient.
            </p>
          ) : (
            <>
              {/* Card list on mobile */}
              <ul className="sm:hidden divide-y">
                {patientEvents.map((e) => (
                  <li key={e.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{e.purpose}</span>
                      <span
                        className={`text-[10px] rounded-full px-2 py-0.5 ${
                          e.action === "granted"
                            ? "bg-teal/15 text-teal"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {e.action}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.at).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Actor: {e.actor}</div>
                    <div className="text-xs text-muted-foreground">Note: {e.note ?? "—"}</div>
                  </li>
                ))}
              </ul>

              {/* Table on sm+ */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">When</th>
                      <th className="text-left px-3 py-2">Purpose</th>
                      <th className="text-left px-3 py-2">Action</th>
                      <th className="text-left px-3 py-2">Actor</th>
                      <th className="text-left px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientEvents.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(e.at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">{e.purpose}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[10px] rounded-full px-2 py-0.5 ${
                              e.action === "granted"
                                ? "bg-teal/15 text-teal"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {e.action}
                          </span>
                        </td>
                        <td className="px-3 py-2">{e.actor}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Append-only · minimum-necessary · de-identified programIds in exports.
        </p>
      </section>
    </div>
  );
}

/** Legal / Part 2 disclosures captured on referrals — same consent store. */
function LegalDisclosureCard({ patientId, focused }: { patientId: string; focused: boolean }) {
  const { role, staffName, staffId } = useActingStaff();
  const rows = useEhr(() => listLegalDisclosures(patientId));
  const [reason, setReason] = useState<Record<string, string>>({});
  return (
    <section aria-label="Legal / Part 2 disclosure" className={`rounded-lg border p-4 space-y-2 ${focused ? "border-teal ring-2 ring-teal/30" : "border-border"}`}>
      <h2 className="font-display text-lg text-navy">Legal / Part 2 disclosure</h2>
      <p className="text-xs text-muted-foreground">Signed consents to share substance use treatment records with an outside provider (42 CFR Part 2). Captured on a referral.</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No disclosures on file.</p>}
      {rows.map((d) => (
        <div key={d.id} className="rounded-md border border-border p-3 text-sm space-y-1">
          <div className="font-medium text-navy break-words">To: {d.recipient}</div>
          <div className="text-xs text-muted-foreground break-words">Purpose: {d.purpose} · recorded <ClientDate value={d.recordedAt} /> by {d.recordedBy}</div>
          {d.revokedAt ? (
            <p className="text-xs text-destructive">Revoked <ClientDate value={d.revokedAt} /> by {d.revokedBy} — {d.revokeReason}</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input aria-label="Revoke reason" placeholder="Reason for revoking" className="h-9" value={reason[d.id] ?? ""} onChange={(e) => setReason({ ...reason, [d.id]: e.target.value })} />
              <Button size="sm" variant="outline" onClick={() => {
                try { revokeLegalDisclosure(d.id, { name: staffName, role, staffId }, reason[d.id] ?? ""); toast.success("Disclosure revoked"); }
                catch (e) { toast.error((e as Error).message); }
              }}>Revoke</Button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
