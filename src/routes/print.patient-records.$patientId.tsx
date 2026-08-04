// §Print/export center — combined patient-record packet.
//
// Query-flag driven, browser-print rendered. The document model (RBAC + SUD
// masking) lives in src/lib/printRecord.ts; this file only renders it and
// triggers window.print() once the data is on screen.
import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import {
  buildPrintRecordDocument,
  type NotesScope,
  type PrintFlags,
  type PrintNoteEntry,
} from "@/lib/printRecord";

interface PrintSearch extends PrintFlags {
  autoprint: boolean;
}

const sigFor = (o: { sigOverride?: string; sig?: string; dose?: string; route?: string; frequency?: string }) =>
  o.sigOverride ??
  o.sig ??
  [o.dose, o.route, o.frequency].filter(Boolean).join(" ") ??
  "—";

const bool = (v: unknown) => v === "1" || v === 1 || v === true || v === "true";
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export const Route = createFileRoute("/print/patient-records/$patientId")({
  validateSearch: (s: Record<string, unknown>): PrintSearch => {
    const all = bool(s.all);
    const scope = str(s.notes_scope);
    return {
      meds: all || bool(s.meds),
      mar: all || bool(s.mar),
      notes: all || bool(s.notes),
      // `?all=1` is the "everything, all-time" shortcut.
      notesScope: all
        ? "all"
        : ((["current", "range", "all"].includes(scope ?? "")
            ? scope
            : "current") as NotesScope),
      notesFrom: str(s.notes_from),
      notesTo: str(s.notes_to),
      marMonth: str(s.mar_month),
      autoprint: s.autoprint === undefined ? true : bool(s.autoprint),
    };
  },
  head: () => ({
    meta: [
      { title: "Print patient record — Adelante staff" },
      {
        name: "description",
        content:
          "Combined printable patient chart packet: medications, medication administration record, and signed progress notes.",
      },
      { property: "og:title", content: "Print patient record — Adelante staff" },
      {
        property: "og:description",
        content: "Flag-driven combined chart packet for printing, with consent-gated notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintRecordPage,
});

const PRINT_CSS = `
@media print {
  @page { size: letter; margin: 0.5in; }
  body * { visibility: hidden !important; }
  #print-record, #print-record * { visibility: visible !important; }
  #print-record { position: absolute; left: 0; top: 0; width: 100%; }
  .print-hide { display: none !important; }
  .print-section { break-inside: auto; page-break-inside: auto; }
  .print-block { break-inside: avoid; page-break-inside: avoid; }
  .print-break-before { break-before: page; page-break-before: page; }
}
`;

function PrintRecordPage() {
  const { patientId } = Route.useParams();
  const search = Route.useSearch();
  const { role, staffName } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const printed = useRef(false);

  const doc = patient
    ? buildPrintRecordDocument({ patient, role, flags: search })
    : undefined;
  const ready = Boolean(doc && doc.sections.length > 0);

  useEffect(() => {
    if (!ready || !search.autoprint || printed.current) return;
    printed.current = true;
    // One frame after paint so the packet is fully on screen first.
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [ready, search.autoprint]);

  if (!patient || !doc) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Client not found" description="This record is not available." />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <style>{PRINT_CSS}</style>
      <div className="print-hide mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
        <Link
          to="/record/$patientId"
          params={{ patientId }}
          className="text-muted-foreground text-xs underline"
        >
          Back to chart
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <div id="print-record" className="mx-auto max-w-4xl bg-white px-6 pb-16 text-black">
        <header className="print-block border-b-2 border-black pb-3">
          <h1 className="font-display text-lg font-bold">{doc.facilityName}</h1>
          <p className="mt-1 text-[11px] font-bold tracking-wide uppercase">
            Confidential — Protected Health Information
          </p>
          <p className="mt-2 text-xs">
            {patient.lastName}, {patient.firstName} · DOB {patient.dob} · MRN {patient.id}
          </p>
          <p className="text-[11px]">
            Printed <ClientDate value={doc.printedAt} /> by {staffName} · acting role {role}
          </p>
        </header>

        {doc.sections.length === 0 && (
          <p className="mt-6 text-xs">
            No sections requested. Add flags such as <code>?meds=1&amp;mar=1&amp;notes=1</code> or{" "}
            <code>?all=1</code>.
          </p>
        )}

        {doc.denied.map((d) => (
          <section key={d.key} className="print-block mt-6">
            <h2 className="border-b border-black text-sm font-bold">{d.label}</h2>
            <p className="mt-1 text-xs italic">Not included — {d.reason}</p>
          </section>
        ))}

        {doc.sections.map((section) => {
          if (section.key === "meds") {
            return (
              <section key="meds" className="print-section mt-6">
                <h2 className="border-b border-black text-sm font-bold">{section.label}</h2>
                {section.orders.length === 0 && (
                  <p className="mt-1 text-xs italic">No medication orders on file.</p>
                )}
                {section.orders.map((o) => (
                  <div key={o.id} className="print-block mt-2 text-xs">
                    <p className="font-semibold">
                      {o.productName ?? o.drugName}{" "}
                      <span className="font-normal">({o.status})</span>
                    </p>
                    <p>{sigFor(o)}</p>
                    <p className="text-[11px]">
                      Start {o.startDate ?? "—"}
                      {o.statusReason ? ` · ${o.statusReason}` : ""}
                      {o.attestedBy ? ` · signed by ${o.attestedBy}` : ""}
                    </p>
                  </div>
                ))}
              </section>
            );
          }
          if (section.key === "mar") {
            return (
              <section key="mar" className="print-section mt-6">
                <h2 className="border-b border-black text-sm font-bold">
                  {section.label} — {section.month}
                </h2>
                {section.rows.length === 0 && (
                  <p className="mt-1 text-xs italic">No charted doses in this month.</p>
                )}
                {section.rows.length > 0 && (
                  <table className="mt-2 w-full text-[11px]">
                    <thead>
                      <tr className="text-left">
                        <th className="border-b border-black py-1">Due</th>
                        <th className="border-b border-black py-1">Medication</th>
                        <th className="border-b border-black py-1">Action</th>
                        <th className="border-b border-black py-1">Reason</th>
                        <th className="border-b border-black py-1">Charted by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map(({ administration: a, order }) => (
                        <tr key={a.id} className="print-block align-top">
                          <td className="border-b border-neutral-300 py-1">
                            <ClientDate value={a.scheduledAt} />
                          </td>
                          <td className="border-b border-neutral-300 py-1">
                            {order?.productName ?? order?.drugName ?? a.orderId}
                            {a.isPrn ? " (PRN)" : ""}
                          </td>
                          <td className="border-b border-neutral-300 py-1">
                            {a.voided ? `voided (${a.action})` : a.action}
                          </td>
                          <td className="border-b border-neutral-300 py-1">{a.reason ?? "—"}</td>
                          <td className="border-b border-neutral-300 py-1">
                            {a.chartedBy}
                            {a.witnessedBy ? ` · witness ${a.witnessedBy}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            );
          }
          return (
            <section key="notes" className="print-section mt-6">
              <h2 className="border-b border-black text-sm font-bold">
                {section.label} — {section.scopeLabel}
              </h2>
              {section.entries.length === 0 && (
                <p className="mt-1 text-xs italic">No signed notes in this scope.</p>
              )}
              {section.entries.map((entry) => (
                <NoteBlock key={entry.note.id} entry={entry} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Renders one note. A masked note prints its header only — the model carries
 * no content for it at all, so there is nothing here that could leak.
 */
function NoteBlock({ entry }: { entry: PrintNoteEntry }) {
  if (entry.masked) {
    return (
      <div className="print-block mt-3 border border-neutral-400 p-2 text-xs">
        <p className="font-semibold">
          Note withheld — <ClientDate value={entry.note.date} />
        </p>
        <p className="italic">{entry.maskReason ?? "Not available to the acting role."}</p>
      </div>
    );
  }
  return (
    <div className="print-block mt-3 border-t border-neutral-300 pt-2 text-xs">
      {(entry.blocks ?? []).map((b, i) => {
        switch (b.kind) {
          case "title":
            return (
              <p key={i} className="text-sm font-bold">
                {b.text}
              </p>
            );
          case "meta":
            return (
              <p key={i} className="text-[10px] text-neutral-600">
                {b.text}
              </p>
            );
          case "heading":
            return (
              <p key={i} className="mt-2 border-b border-neutral-400 font-bold">
                {b.text}
              </p>
            );
          case "subheading":
            return (
              <p key={i} className="mt-1 font-semibold">
                {b.text}
              </p>
            );
          case "field":
            return (
              <p key={i}>
                <span className="font-semibold">{b.label}:</span> {b.value}
              </p>
            );
          default:
            return (
              <p key={i} className="whitespace-pre-wrap">
                {b.text}
              </p>
            );
        }
      })}
    </div>
  );
}