// Patient-side advocate sharing consent. Advocate invitations are held until
// `roi_collateral` is authorized; this is where the patient signs it. The new
// record copies every section of the one in force, so nothing else changes.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { deliverConsentedAdvocateInvitations, advocateInvitationConsentActive } from "@/lib/advocateInviteDelivery";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function AdvocateConsentCard({ patientId }: { patientId: string }) {
  const pending = useEhr(() =>
    AdelanteEHR.listAdvocateLinks(patientId).filter((l) => l.status === "invited" && !l.notificationSentAt).length,
  );
  const active = useEhr(() => advocateInvitationConsentActive(patientId));
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  if (pending === 0 && !active) return null;
  const sign = () => {
    try {
      const prior = AdelanteEHR.activeConsentRecord(patientId);
      const sections = (prior?.sections ?? []).filter((s) => s.category !== "roi_collateral");
      AdelanteEHR.createConsentRecord({
        patientId,
        formType: prior?.formType ?? "NonAB133",
        source: "patient_portal",
        signedByName: name.trim().slice(0, 100),
        attested: ok,
        effectiveDate: new Date().toISOString().slice(0, 10),
        sections: [...sections, { category: "roi_collateral", authorized: true }],
        capturedBy: { staffName: "Patient (self-signed)", role: "patient" },
        ...(prior ? { supersedesId: prior.id } : {}),
      });
      void deliverConsentedAdvocateInvitations(patientId);
      toast.success("Consent signed. Your helper's invitation is on its way.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign that.");
    }
  };
  return (
    <Card className="p-4 space-y-3" data-testid="advocate-consent-card">
      <h2 className="font-medium text-navy">Share with my helper (advocate)</h2>
      {active ? (
        <p className="text-sm text-muted-foreground">Signed. Your helper can get their invitation.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            You named {pending} helper{pending === 1 ? "" : "s"}. Sign here so we can send the invitation.
            This does not share substance-use records.
          </p>
          <Input placeholder="Type your full name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={ok} onCheckedChange={(v) => setOk(v === true)} /> I agree to share with my helper.
          </label>
          <Button onClick={sign} disabled={!ok || name.trim().length < 2} data-testid="advocate-consent-sign">
            Sign consent
          </Button>
        </>
      )}
    </Card>
  );
}
