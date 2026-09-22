import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { getActingStaff, useActingRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * §Pre-release pipeline — honest provenance for a release date the record
 * already holds.
 *
 * The date on these screens used to start blank, so a person who had already
 * told a CF Care Manager their release date was asked for it again from
 * scratch. Now the field is pre-filled from the real pre-release episode and
 * this strip says exactly where the value came from, in the same stance as the
 * AHC-HRSN reconciliation: show the existing evidence, let a human confirm it,
 * never silently promote an estimate to a fact.
 */
export function ReleaseDateProvenance({
  patient,
  onConfirmed,
}: {
  patient: Patient | undefined;
  /** Lets a form re-sync its local draft after a confirmation writes through. */
  onConfirmed?: (date: string) => void;
}) {
  const [role] = useActingRole();
  if (!patient?.releaseDate) return null;

  const meta = patient.releaseDateMeta;
  const custody = patient.custody;
  const confidence = meta?.confidence;

  const line =
    confidence === "confirmed"
      ? "Confirmed release date."
      : meta?.source === "custody"
        ? "From the pre-release episode — anticipated, not yet confirmed."
        : confidence === "self_reported"
          ? "Entered by hand — not confirmed against the pre-release episode."
          : "Source not recorded.";

  const confirm = () => {
    const staff = getActingStaff();
    AdelanteEHR.confirmReleaseDate({
      patientId: patient.id,
      date: patient.releaseDate,
      actorId: staff.id,
      actorRole: role,
    });
    onConfirmed?.(patient.releaseDate ?? "");
    toast.success("Release date confirmed");
  };

  return (
    <div className="rounded-md border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
      <div>{line}</div>
      {custody ? (
        <div>
          Custody status:{" "}
          {custody.state === "in_custody"
            ? "In custody"
            : custody.state === "released"
              ? "Released"
              : "Unknown"}
          {custody.facilityName ? ` — ${custody.facilityName}` : ""}
          <span className="ml-1">(from the pre-release episode)</span>
        </div>
      ) : null}
      {confidence !== "confirmed" ? (
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={confirm}>
          Confirm this date
        </Button>
      ) : null}
    </div>
  );
}
