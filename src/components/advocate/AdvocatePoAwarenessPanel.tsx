// §P1 My Care de-clutter, item 5 — probation/parole sharing shown to an
// identified advocate on a KNOWLEDGE basis only.
//
// Scoping is two gates, deliberately in two places:
//  - store: `AdelanteEHR.advocatePoDisclosure` (link validity, revocation,
//    audit). It cannot check population without closing an import cycle.
//  - render: `PopulationGate` on the justice-involved tracks, the same scope
//    the patient's own `PoDisclosureCard` uses.
//
// Awareness-only by design: no toggle, no clinical content, nothing that
// could carry 42 CFR Part 2 material. The advocate learns THAT some sharing
// is mandatory and whether the voluntary piece is currently on — never what
// was shared.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { PO_DISCLOSURE_ITEMS } from "@/lib/poDisclosure";
import { PopulationGate } from "@/components/PopulationGate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, Lock } from "lucide-react";

function Body({ linkId }: { linkId: string }) {
  const view = useEhr(() => AdelanteEHR.advocatePoDisclosure(linkId));
  if (!view.allowed) return null;
  const mandatory = PO_DISCLOSURE_ITEMS.filter((i) => i.tier === "mandatory");

  return (
    <Card className="p-5" data-testid="advocate-po-awareness">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <Gavel className="h-5 w-5 text-teal" /> Sharing with probation or parole
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        So you know what to expect when you help. You cannot change any of this — only the care
        team can, and only with the person's say-so where it is their choice.
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span className="font-medium text-navy">Voluntary sharing</span>
        <Badge variant="outline">{view.voluntaryActive ? "Turned on" : "Not shared"}</Badge>
      </div>
      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {mandatory.length} item{mandatory.length === 1 ? " is" : "s are"} shared because a court
          order or supervision condition requires it, whatever anyone here prefers.
        </span>
      </div>
    </Card>
  );
}

export function AdvocatePoAwarenessPanel({
  linkId,
  patientId,
}: {
  linkId: string;
  patientId: string | undefined;
}) {
  return (
    <PopulationGate
      patientId={patientId}
      viewer={{ kind: "staff" }}
      allow={["pre_release_ji", "post_release_ji"]}
    >
      <Body linkId={linkId} />
    </PopulationGate>
  );
}
