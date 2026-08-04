// §Clinical documentation Phase 3b — autofill_section renderer.
//
// Read-only by design. The content is computed at render time for the compose
// view, and the SAME resolver output is snapshotted onto the note at sign time
// (see useNoteAutofillSnapshots) so a historical note never re-computes.
import { useMemo } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  resolveAutofillSections,
  type AutofillContext,
} from "@/lib/noteAutofill";
import type { AutofillSnapshot, TemplateSchema } from "@/lib/templateSchema";
import { Info } from "lucide-react";

/**
 * Build the autofill snapshots for a patient against a schema, using the same
 * 42 CFR Part 2 consent gate as the Notes tab and the problem list.
 */
export function useNoteAutofillSnapshots(
  patientId: string,
  schema: TemplateSchema | undefined,
  opts: { excludeNoteId?: string } = {},
): AutofillSnapshot[] {
  const { role } = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const orders = useEhr(() => AdelanteEHR.listOrders(patientId));
  const problems = useEhr(() => AdelanteEHR.listProblems(patientId));
  const allergies = useEhr(() => AdelanteEHR.listAllergies(patientId));
  const administrations = useEhr(() => AdelanteEHR.listAdministrations(patientId));
  const bookings = useEhr(() => AdelanteEHR.listBookings(patientId));
  const housingMoves = useEhr(() => AdelanteEHR.listHousingMoves(patientId));
  const sudLocked = patient ? canAccess(role, "screeners_sud", patient).locked : true;
  const excludeNoteId = opts.excludeNoteId;
  return useMemo(() => {
    if (!schema) return [];
    const ctx: AutofillContext = {
      orders,
      problems,
      allergies,
      administrations,
      notes: patient?.progressNotes ?? [],
      bookings,
      housingMoves,
      referrals: patient?.resourceReferrals ?? [],
      sudLocked,
      excludeNoteId,
      orderName: (id) => orders.find((o) => o.id === id)?.drugName ?? id,
      language: patient?.preferredLanguage === "es" ? "es" : "en",
    };
    return resolveAutofillSections(schema, ctx);
  }, [
    schema,
    orders,
    problems,
    allergies,
    administrations,
    bookings,
    housingMoves,
    patient,
    sudLocked,
    excludeNoteId,
  ]);
}

export function NoteAutofillCard({ snapshot }: { snapshot: AutofillSnapshot }) {
  return (
    <div
      className="rounded-md border border-border bg-secondary/20 p-3"
      data-testid={`autofill-${snapshot.sectionId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h5 className="font-display text-sm text-navy">{snapshot.title}</h5>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Auto-filled · read only
        </span>
      </div>
      {snapshot.lines.length > 0 && (
        <ul className="mt-2 space-y-1">
          {snapshot.lines.map((l, i) => (
            <li key={i} className="text-xs text-navy">
              {l.primary}
              {l.secondary && (
                <span className="block text-[11px] text-muted-foreground">{l.secondary}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {snapshot.notice && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{snapshot.notice}</span>
        </p>
      )}
    </div>
  );
}