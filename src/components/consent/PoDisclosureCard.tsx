// §Adelante Journey Phase 3 — PATIENT-FACING, read-only PO disclosure view.
//
// The whole point of this card is the split: mandatory items are rendered as
// INFORMATION with no control at all (a toggle there would be a lie), and
// voluntary items show their real, revocable consent status from the
// ConsentRecord ledger. Patient surfaces never write consent — capture and
// revocation stay staff-side, exactly like PatientConsentStatusCard.
//
// PLACEHOLDER WARNING: the item classification and wording come from
// PO_DISCLOSURE_ITEMS and are placeholders pending Christi's confirmation
// against real county supervision-condition and court-order language.
import { AdelanteEHR, PO_VOLUNTARY_CONSENT_CATEGORY, useEhr } from "@/lib/ehr";
import { PO_DISCLOSURE_ITEMS } from "@/lib/poDisclosure";
import { PopulationGate } from "@/components/PopulationGate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, Lock } from "lucide-react";

function PoDisclosureBody({ patientId }: { patientId: string }) {
  const voluntaryActive = useEhr(() =>
    AdelanteEHR.isConsentCategoryAuthorized(patientId, PO_VOLUNTARY_CONSENT_CATEGORY),
  );
  const mandatory = PO_DISCLOSURE_ITEMS.filter((i) => i.tier === "mandatory");
  const voluntary = PO_DISCLOSURE_ITEMS.filter((i) => i.tier === "voluntary");

  return (
    <Card className="p-5" data-testid="po-disclosure-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Gavel className="h-4 w-4" /> Sharing with probation or parole
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Some things have to be shared because a court order or your supervision conditions require
        it — you cannot switch those off, and we will not show you a switch that does nothing.
        Everything else is your choice.
      </p>

      <div className="mt-4">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Lock className="h-3.5 w-3.5" /> Required by law — not your choice
        </div>
        <ul className="mt-2 space-y-2">
          {mandatory.map((i) => (
            <li key={i.key} className="rounded-md border bg-secondary/20 p-3 text-xs">
              <div className="font-medium text-foreground">{i.label}</div>
              <div className="mt-1 text-muted-foreground">{i.explanation}</div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Whether an order or condition applies to you is confirmed by your care team from the
          paperwork on file — not from anything you set here.
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-foreground">Your choice — you can withdraw</div>
          <Badge variant="outline" className="text-[10px]">
            {voluntaryActive ? "You said yes" : "Not shared"}
          </Badge>
        </div>
        <ul className="mt-2 space-y-2">
          {voluntary.map((i) => (
            <li key={i.key} className="rounded-md border p-3 text-xs">
              <div className="font-medium text-foreground">{i.label}</div>
              <div className="mt-1 text-muted-foreground">{i.explanation}</div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Tell your care team any time to start or stop this — sharing stops the moment it is
          withdrawn.
        </p>
      </div>
    </Card>
  );
}

export function PoDisclosureCard({ patientId }: { patientId: string }) {
  // Population-scoped (Phase 2 pattern): showing PO sharing to a General
  // Population member would be actively wrong, not merely noisy.
  return (
    <PopulationGate patientId={patientId} allow={["pre_release_ji", "post_release_ji"]}>
      <PoDisclosureBody patientId={patientId} />
    </PopulationGate>
  );
}
