import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type ExtendedConsentPurpose, type ConsentPurpose } from "@/lib/ehr";
import { ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Consent ledger — Adelante" },
      { name: "description", content: "Per-purpose consent state and append-only disclosure log." },
      { property: "og:title", content: "Consent ledger — Adelante" },
      { property: "og:description", content: "Per-purpose consent state and append-only disclosure log." },
    ],
  }),
  component: ConsentPage,
});

const PURPOSES: { key: ExtendedConsentPurpose; label: string; note: string }[] = [
  { key: "part2Sud", label: "Part 2 (SUD)", note: "Unlocks SUD-identifying rows. Revoke re-locks immediately." },
  { key: "ecmShare", label: "ECM information share", note: "Enhanced Care Management coordination." },
  { key: "sms", label: "SMS reminders", note: "Text message reminders and welcome messages." },
  { key: "hipaa", label: "HIPAA authorization", note: "Baseline authorization signed at intake." },
  { key: "telehealth", label: "Telehealth", note: "Video / phone visits." },
  { key: "roi", label: "Release of Information", note: "External disclosure to a named third party." },
  { key: "portal", label: "Patient portal", note: "Self-service portal access." },
  { key: "proxy", label: "Proxy / staff-completed forms", note: "Staff may complete forms on the patient's behalf." },
  { key: "group", label: "Group therapy", note: "Participation and shared attendance." },
];

function ConsentPage() {
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const events = useEhr(() => AdelanteEHR.listAllConsentEvents());
  const [selected, setSelected] = useState<string>(patients[0]?.id ?? "");
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
            Per-purpose consent state, revocable, with an append-only audit trail.
            Revoking <em>Part 2 (SUD)</em> immediately re-locks SUD-identifying rows across the app.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2 text-sm">
        <label className="text-muted-foreground">Patient:</label>
        <select
          className="rounded-md border bg-card px-2 py-1 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.programId} · {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      {patient && state ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {PURPOSES.map((p) => {
            const granted =
              p.key === "hipaa"
                ? patient.consents.hipaa
                : (state as Record<string, boolean | undefined>)[p.key] ?? false;
            const isCore = ["part2Sud", "ecmShare", "sms"].includes(p.key);
            return (
              <div key={p.key} className="rounded-xl border bg-card p-4">
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
                      AdelanteEHR.setConsent(patient.id, p.key as ConsentPurpose, !granted, "consent page");
                      toast.success(granted ? "Consent revoked" : "Consent granted");
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-navy hover:underline"
                  >
                    <Undo2 className="h-3 w-3" />
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
            <p className="p-4 text-sm text-muted-foreground">No consent events recorded for this patient.</p>
          ) : (
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
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
                    <td className="px-3 py-2">{e.purpose}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] rounded-full px-2 py-0.5 ${
                          e.action === "granted" ? "bg-teal/15 text-teal" : "bg-destructive/10 text-destructive"
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
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Append-only · minimum-necessary · de-identified programIds in exports.
        </p>
      </section>
    </div>
  );
}
