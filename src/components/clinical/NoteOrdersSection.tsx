// §Clinical documentation Phase 3b — orders_section renderer.
//
// Deliberately thin: every piece of order behaviour is REUSED from the Orders
// infrastructure — CatalogPicker for product search, DraftOrderCard (which
// itself renders MedicationDoseSection) for the draft editor, `validateOrder`
// for the gate, `SignAttestation` + `AdelanteEHR.signOrders` for signing. No
// dose math, catalog search, or signing mechanism is reimplemented here.
//
// A quick pick is a starting point, not a bypass: it stages a plain draft
// MedOrder that must still clear the same validation gate.
import { useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  isProblemClinicallyActive,
  type MedOrder,
  type ReferralSource,
} from "@/lib/ehr";
import { useActingStaff, canAccess } from "@/lib/roles";
import {
  validateOrder,
  requiresAttribution,
  strengthProvenanceFor,
  draftOrderFromQuickPick,
} from "@/lib/orders";
import type { QuickPickMed, QuickPickReferral, TemplateSection } from "@/lib/templateSchema";
import { CatalogPicker, type CatalogSelection } from "@/components/orders/CatalogPicker";
import { DraftOrderCard, SignAttestation } from "@/components/clinical/OrdersTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function NoteOrdersSection({
  patientId,
  section,
  stagedIds,
  onStage,
  sourceNoteId,
}: {
  patientId: string;
  section: TemplateSection;
  /** Draft order ids staged from this note, tracked by the compose flow. */
  stagedIds: string[];
  onStage: (orderId: string) => void;
  /** Set once the note row exists; before that the link is applied on save. */
  sourceNoteId?: string;
}) {
  const { role, staffName } = useActingStaff();
  const canOrder = canAccess(role, "meds_erx").level === "write";
  const orders = useEhr(() => AdelanteEHR.listOrders(patientId));
  const problemRows = useEhr(() => AdelanteEHR.listProblems(patientId));
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [attested, setAttested] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [referralDraft, setReferralDraft] = useState<QuickPickReferral | null>(null);

  const allowMeds = section.allow?.meds !== false;
  const allowReferrals = Boolean(section.allow?.referrals);
  const problems = problemRows.filter(isProblemClinicallyActive).map((p) => ({
    id: p.id,
    label: p.icd10Code ? `${p.icd10Code} — ${p.description}` : p.description,
  }));
  const drafts = orders.filter((o) => o.status === "draft" && stagedIds.includes(o.id));
  const activeTherapy = orders.filter((o) => o.status === "signed" || o.status === "held");
  const needsAttribution = requiresAttribution(role);
  const issues = drafts.flatMap((o) => validateOrder(o, { needsAttribution }));
  const gatePasses = drafts.length > 0 && issues.length === 0;

  const stageDraft = (
    input: Omit<MedOrder, "id" | "patientId" | "status" | "attestedAt" | "attestedBy">,
  ) => {
    const row = AdelanteEHR.addDraftOrder(patientId, { ...input, sourceNoteId });
    onStage(row.id);
    setShowIssues(true);
  };

  const stageQuickPick = (qp: QuickPickMed) =>
    stageDraft(draftOrderFromQuickPick(qp, { createdBy: staffName, sourceNoteId }));

  const stageCatalog = (sel: CatalogSelection) =>
    stageDraft({
      drugName: sel.productName,
      productName: sel.productName,
      rxcui: sel.rxcui,
      strengthText: sel.strengthText,
      strengthSource: sel.strengthSource,
      doseForm: sel.doseForm,
      ingredientNames: sel.ingredientNames,
      offCatalog: sel.offCatalog,
      offCatalogJustification: sel.offCatalogJustification,
      createdBy: staffName,
    });

  const sign = () => {
    if (!gatePasses || !attested) return;
    const strengthProvenance = Object.fromEntries(
      drafts.map((d) => [d.id, strengthProvenanceFor(d)]),
    );
    const n = AdelanteEHR.signOrders(
      patientId,
      drafts.map((d) => d.id),
      staffName,
      { strengthProvenance },
    ).length;
    setAttested(false);
    setShowIssues(false);
    toast.success(`${n} order${n === 1 ? "" : "s"} signed from this note.`);
  };

  if (!canOrder) {
    return (
      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-3 text-xs text-muted-foreground">
        {section.title} — your role cannot place orders. Documentation fields are unaffected.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-border p-3">
      <div>
        <h5 className="font-display text-sm text-navy">{section.title}</h5>
        <p className="text-[11px] text-muted-foreground">
          Orders placed here follow the same validation, lifecycle and attestation as the Orders
          tab. They do not affect the note&apos;s required fields.
        </p>
      </div>

      {allowMeds && (section.quick_picks?.meds ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(section.quick_picks?.meds ?? []).map((qp) => (
            <Button
              key={qp.id}
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => stageQuickPick(qp)}
            >
              <Plus className="mr-1 h-3 w-3" />
              {qp.label || qp.drugName}
            </Button>
          ))}
        </div>
      )}

      {allowMeds && <CatalogPicker onSelect={stageCatalog} />}

      {allowReferrals && (section.quick_picks?.referrals ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(section.quick_picks?.referrals ?? []).map((qp) => (
            <Button
              key={qp.id}
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setReferralDraft(qp)}
            >
              <Plus className="mr-1 h-3 w-3" />
              {qp.label || qp.referringAgency}
            </Button>
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-3">
          {drafts.map((o) => (
            <DraftOrderCard
              key={o.id}
              order={o}
              patientId={patientId}
              needsAttribution={needsAttribution}
              problems={problems}
              showIssues={showIssues}
              activeOrders={activeTherapy}
            />
          ))}
          <SignAttestation checked={attested} onChange={setAttested} staffName={staffName} />
          <Button
            className="w-full"
            disabled={!gatePasses || !attested}
            onClick={sign}
            data-testid="note-orders-sign"
          >
            Sign {drafts.length} order{drafts.length === 1 ? "" : "s"}
          </Button>
          {!gatePasses && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Complete every required order field before signing — quick picks are a starting
              point, not a bypass.
            </p>
          )}
        </div>
      )}

      <ReferralQuickPickDialog
        quickPick={referralDraft}
        defaultFirstName={patient?.firstName ?? ""}
        defaultLastName={patient?.lastName ?? ""}
        onClose={() => setReferralDraft(null)}
      />
    </section>
  );
}

/** Pre-fills a draft using the EXISTING Referral entity/flow. */
function ReferralQuickPickDialog({
  quickPick,
  defaultFirstName,
  defaultLastName,
  onClose,
}: {
  quickPick: QuickPickReferral | null;
  defaultFirstName: string;
  defaultLastName: string;
  onClose: () => void;
}) {
  const { staffName } = useActingStaff();
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  if (!quickPick) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{quickPick.label || quickPick.referringAgency}</DialogTitle>
          <DialogDescription>
            Creates a referral through the existing referral flow, pre-filled from this template
            quick pick.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">First name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Last name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Agency: {quickPick.referringAgency}
          {quickPick.referrerName ? ` · Referrer: ${quickPick.referrerName}` : ""}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!firstName.trim() || !lastName.trim()) {
                toast.error("A first and last name are required.");
                return;
              }
              AdelanteEHR.createReferral({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                referringAgency: quickPick.referringAgency,
                referrerName: quickPick.referrerName || staffName,
                referrerEmail: quickPick.referrerEmail,
                referrerPhone: quickPick.referrerPhone,
                referralSource: (quickPick.referralSource ?? "self") as ReferralSource,
                countyOfRelease: quickPick.countyOfRelease,
                consentToContact: false,
                requestManualOutreach: true,
              });
              toast.success("Referral created from note.");
              onClose();
            }}
          >
            Create referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}