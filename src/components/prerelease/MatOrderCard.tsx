// §Pre-release build 3 — MAT (buprenorphine/naloxone) ordering entry point.
//
// Deliberately thin, exactly like NoteOrdersSection: every piece of order
// behaviour is REUSED — CatalogPicker for product search, DraftOrderCard for
// the editor, `validateOrder` for the gate, SignAttestation for attestation.
// The only pre-release-specific logic lives in the store
// (`orderPreReleaseMat` / `signPreReleaseMatOrders`): the prescriber gate and
// the Build-1 capacity/legal-authority gate.
import { useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  canPrescribeMedications,
  isProblemClinicallyActive,
  type MedOrder,
  type PreReleaseEpisode,
} from "@/lib/ehr";
import { isMatOrder } from "@/lib/medAdherence";
import { useActingStaff } from "@/lib/roles";
import { validateOrder, requiresAttribution, strengthProvenanceFor } from "@/lib/orders";
import { CatalogPicker, type CatalogSelection } from "@/components/orders/CatalogPicker";
import { DraftOrderCard, SignAttestation } from "@/components/clinical/OrdersTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill, Plus } from "lucide-react";
import { toast } from "sonner";

/** Starting points, not bypasses: each stages a plain draft that must still
 *  clear the identical validation gate. */
const QUICK_PICKS: { label: string; draft: Partial<MedOrder> & { drugName: string } }[] = [
  {
    label: "Buprenorphine/naloxone 8-2 mg SL film",
    draft: {
      drugName: "Buprenorphine 8 MG / Naloxone 2 MG Sublingual Film",
      productName: "Buprenorphine 8 MG / Naloxone 2 MG Sublingual Film",
      strengthText: "8 MG / 2 MG",
      doseForm: "Sublingual Film",
      ingredientNames: ["buprenorphine", "naloxone"],
      route: "sublingual",
      isControlled: true,
      deaSchedule: "CIII",
    },
  },
  {
    label: "Naltrexone 50 mg tablet",
    draft: {
      drugName: "Naltrexone 50 MG Oral Tablet",
      productName: "Naltrexone 50 MG Oral Tablet",
      strengthText: "50 MG",
      doseForm: "Oral Tablet",
      ingredientNames: ["naltrexone"],
      route: "oral",
    },
  },
];

export function MatOrderCard({
  episode,
  blockedReason,
}: {
  episode: PreReleaseEpisode;
  /** Set when the Build-1 capacity gate blocks consent-dependent steps. */
  blockedReason?: string;
}) {
  const { role, staffName, staffId } = useActingStaff();
  const patientId = episode.patientId;
  const orders = useEhr(() => AdelanteEHR.listPreReleaseMatOrders(episode.id));
  const allOrders = useEhr(() => AdelanteEHR.listOrders(patientId));
  const problemRows = useEhr(() => AdelanteEHR.listProblems(patientId));
  const [attested, setAttested] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const canOrder = canPrescribeMedications(role);
  const drafts = orders.filter((o) => o.status === "draft");
  const placed = orders.filter((o) => o.status !== "draft");
  const activeTherapy = allOrders.filter((o) => o.status === "signed" || o.status === "held");
  const problems = problemRows.filter(isProblemClinicallyActive).map((p) => ({
    id: p.id,
    label: p.icd10Code ? `${p.icd10Code} — ${p.description}` : p.description,
  }));
  const needsAttribution = requiresAttribution(role);
  const issues = drafts.flatMap((o) => validateOrder(o, { needsAttribution }));
  const gatePasses = drafts.length > 0 && issues.length === 0;

  const stage = (input: Partial<MedOrder> & { drugName: string }) => {
    try {
      AdelanteEHR.orderPreReleaseMat({
        episodeId: episode.id,
        prescriber: { ...(staffId ? { staffId } : {}), staffName, role },
        order: { ...input, createdBy: staffName } as Omit<
          MedOrder,
          "id" | "patientId" | "status" | "attestedAt" | "attestedBy"
        >,
      });
      setShowIssues(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the order.");
    }
  };

  const stageCatalog = (sel: CatalogSelection) =>
    stage({
      drugName: sel.productName,
      productName: sel.productName,
      ...(sel.rxcui ? { rxcui: sel.rxcui } : {}),
      ...(sel.strengthText ? { strengthText: sel.strengthText } : {}),
      ...(sel.strengthSource ? { strengthSource: sel.strengthSource } : {}),
      ...(sel.doseForm ? { doseForm: sel.doseForm } : {}),
      ...(sel.ingredientNames ? { ingredientNames: sel.ingredientNames } : {}),
      ...(sel.offCatalog ? { offCatalog: sel.offCatalog } : {}),
      ...(sel.offCatalogJustification
        ? { offCatalogJustification: sel.offCatalogJustification }
        : {}),
    });

  const sign = () => {
    if (!gatePasses || !attested) return;
    try {
      const strengthProvenance = Object.fromEntries(
        drafts.map((d) => [d.id, strengthProvenanceFor(d)]),
      );
      const n = AdelanteEHR.signPreReleaseMatOrders({
        episodeId: episode.id,
        orderIds: drafts.map((d) => d.id),
        prescriber: { staffName, role },
        strengthProvenance,
      }).length;
      setAttested(false);
      setShowIssues(false);
      toast.success(`${n} order${n === 1 ? "" : "s"} signed to the chart.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign.");
    }
  };

  return (
    <Card className="p-4" data-testid="mat-order-card">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <Pill className="h-4 w-4" /> Medication-assisted treatment (MAT)
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Starts a real medication order in this member&apos;s chart — same catalog, validation,
        attestation and lifecycle as the Orders tab. Nothing about MAT is tracked separately here.
      </p>

      {blockedReason && (
        <p
          data-testid="mat-blocked"
          className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        >
          {blockedReason}
        </p>
      )}

      {placed.length > 0 && (
        <ul className="mb-3 space-y-1">
          {placed.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>{o.drugName}</span>
              <Badge variant="outline">{o.status}</Badge>
            </li>
          ))}
        </ul>
      )}

      {!canOrder ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Your role cannot place medication orders. MAT must be initiated by a prescriber — the rest
          of the pre-release checklist is unaffected.
        </p>
      ) : blockedReason ? null : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_PICKS.map((qp) => (
              <Button
                key={qp.label}
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                data-testid={`mat-quick-pick-${qp.draft.drugName.slice(0, 12)}`}
                onClick={() => stage(qp.draft)}
              >
                <Plus className="mr-1 h-3 w-3" />
                {qp.label}
              </Button>
            ))}
          </div>
          <CatalogPicker onSelect={stageCatalog} />

          {drafts.length > 0 && (
            <div className="space-y-3">
              {drafts.map((o) => (
                <div key={o.id} className="space-y-1">
                  {!isMatOrder(o) && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      This product isn&apos;t recognised as a MAT/MOUD medication — it will still be
                      ordered as an ordinary medication order.
                    </p>
                  )}
                  <DraftOrderCard
                    order={o}
                    patientId={patientId}
                    needsAttribution={needsAttribution}
                    problems={problems}
                    showIssues={showIssues}
                    activeOrders={activeTherapy}
                  />
                </div>
              ))}
              <SignAttestation checked={attested} onChange={setAttested} staffName={staffName} />
              <Button
                className="w-full"
                disabled={!gatePasses || !attested}
                onClick={sign}
                data-testid="mat-sign"
              >
                Sign {drafts.length} order{drafts.length === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
