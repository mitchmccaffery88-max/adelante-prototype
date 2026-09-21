// §Phase 3b — the two CalAIM answers, side by side.
//
// They are genuinely different questions and are NOT derived from each other:
//   - computed: does this person's active problem list contain a diagnosis on
//     the admin-curated CalAIM qualifying-code list? (clinical, recomputed)
//   - staff-set: did a human determine their Medi-Cal benefit status —
//     ECM enrollment, the 90-day JI reentry benefit? (plan/county paperwork
//     this app never sees)
//
// When they disagree, that disagreement is named here rather than silently
// resolved: neither answer overwrites the other.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { calaimComputedForPatient } from "@/lib/calaim";

export function CalaimEligibilityComparison({ patientId }: { patientId: string }) {
  const state = useEhr(() => {
    const p = AdelanteEHR.getPatient(patientId);
    if (!p) return null;
    return {
      computed: calaimComputedForPatient(p),
      ecm: Boolean(p.coverage?.ecmEligible),
    };
  });
  if (!state) return null;
  const { computed, ecm } = state;

  return (
    <div className="rounded border bg-muted/30 p-3 text-xs" data-testid="calaim-comparison">
      <p className="font-medium text-navy">CalAIM: two separate answers</p>
      {!computed.configured ? (
        <p className="mt-1 text-muted-foreground" data-testid="calaim-computed">
          Qualifying diagnosis: can&apos;t be computed — no CalAIM qualifying codes are configured
          yet.
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground" data-testid="calaim-computed">
          Qualifying diagnosis (computed from the active problem list):{" "}
          <span className="font-medium text-foreground">{computed.qualifies ? "yes" : "no"}</span>
          {computed.qualifies && (
            <>
              {" "}
              — {computed.rows.map((r) => r.icd10Code).join(", ")}
            </>
          )}
        </p>
      )}
      <p className="text-muted-foreground">
        ECM eligibility (set by staff):{" "}
        <span className="font-medium text-foreground">{ecm ? "marked eligible" : "not marked"}</span>
      </p>
      {computed.configured && computed.qualifies && !ecm && (
        <p className="mt-1.5 rounded bg-amber-50 p-2 text-amber-900" data-testid="calaim-disagree">
          This person has a qualifying diagnosis on file but is not marked ECM-eligible. That may be
          correct — a diagnosis does not by itself make someone ECM-enrolled. Check the benefit
          status if nobody has.
        </p>
      )}
      {computed.configured && !computed.qualifies && ecm && (
        <p className="mt-1.5 rounded bg-amber-50 p-2 text-amber-900" data-testid="calaim-disagree">
          Marked ECM-eligible with no qualifying diagnosis on the problem list. Again, that may be
          correct — ECM eligibility has routes this app can&apos;t see. Nothing is changed
          automatically.
        </p>
      )}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Neither answer sets the other. Nothing here is sent to a plan or county.
      </p>
    </div>
  );
}
