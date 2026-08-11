// §ASCMI consent infrastructure — staff-facing capture + revocation UI.
//
// PLACEHOLDER WARNING: every category label and the attestation wording here
// is a PLACEHOLDER. They must be replaced with Christi's DHCS-sourced ASCMI
// categories and the real legal form language before production use.
//
// Signing reuses the exact typed-name + attestation-checkbox pattern already
// used for MAR, orders and note signing. No new signing mechanism.
import { useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  CONSENT_CATEGORIES,
  TELEHEALTH_CONSENT_CATEGORY,
  TELEHEALTH_DISCLOSURE_ELEMENTS,
  useEhr,
  type ConsentCategory,
  type ConsentFormType,
  type Patient,
} from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FORM_TYPES: { key: ConsentFormType; label: string }[] = [
  { key: "AB133", label: "AB 133 (placeholder)" },
  { key: "NonAB133", label: "Non-AB 133 (placeholder)" },
  { key: "Revocation", label: "Revocation form (placeholder)" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptySections = (): Record<ConsentCategory, boolean> =>
  Object.fromEntries(CONSENT_CATEGORIES.map((c) => [c.key, false])) as Record<
    ConsentCategory,
    boolean
  >;

export function ConsentRecordsPanel({ patient }: { patient: Patient }) {
  // Derived from the registry so a new ASCMI category never needs a matching
  // literal here (Phase 2 added three).
  const { role, staffId, staffName } = useActingStaff();
  const records = useEhr(() => AdelanteEHR.listConsentRecords(patient.id));
  const canWrite = canAccess(role, "consent_ledger", patient).level === "write";

  const [open, setOpen] = useState(false);
  const [formType, setFormType] = useState<ConsentFormType>("AB133");
  const [source, setSource] = useState("in person — consent tab");
  const [signedByName, setSignedByName] = useState("");
  const [attested, setAttested] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [expirationDate, setExpirationDate] = useState("");
  const [sections, setSections] = useState<Record<ConsentCategory, boolean>>(emptySections);

  const reset = () => {
    setSignedByName("");
    setAttested(false);
    setExpirationDate("");
    setSections(emptySections());
  };

  const submit = () => {
    try {
      AdelanteEHR.createConsentRecord({
        patientId: patient.id,
        formType,
        source,
        signedByName,
        attested,
        effectiveDate,
        expirationDate: expirationDate || undefined,
        sections: CONSENT_CATEGORIES.map((c) => ({
          category: c.key,
          authorized: sections[c.key],
        })),
        capturedBy: { staffId, staffName, role },
      });
      toast.success("Consent record captured");
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not capture consent");
    }
  };

  const revoke = (id: string) => {
    const reason = window.prompt("Reason for revocation (required)");
    if (reason === null) return;
    try {
      AdelanteEHR.revokeConsentRecord(id, { reason, revokedBy: staffName, role });
      toast.success("Consent revoked — original record retained");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-navy">Structured consent records</h2>
          <p className="text-xs text-muted-foreground">
            Placeholder categories — replace with DHCS/ASCMI categories before production.
          </p>
        </div>
        {canWrite ? (
          <Button variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Capture consent"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Your role has read-only access to the consent ledger.
          </span>
        )}
      </div>

      {open && canWrite ? (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Form type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as ConsentFormType)}>
                <SelectTrigger aria-label="Form type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORM_TYPES.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="consent-source">Source (how/where captured)</Label>
              <Input
                id="consent-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="consent-effective">Effective date</Label>
              <Input
                id="consent-effective"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="consent-expiration">Expiration date (optional)</Label>
              <Input
                id="consent-expiration"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Authorized categories (placeholder set)</legend>
            {CONSENT_CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={sections[c.key]}
                  onCheckedChange={(v) =>
                    setSections((s) => ({ ...s, [c.key]: v === true }))
                  }
                  aria-label={c.label}
                />
                {c.label}
              </label>
            ))}
            {/* The WORDING below is placeholder, but these four DISCLOSURE
                ELEMENTS are real DHCS telehealth-consent content and must be
                presented whenever telehealth consent is captured. */}
            {sections[TELEHEALTH_CONSENT_CATEGORY] ? (
              <div className="rounded-md border bg-secondary/20 p-3 text-xs space-y-1">
                <p className="font-medium">
                  Telehealth disclosures read to the patient (wording is placeholder pending legal
                  review; the elements themselves are required):
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {TELEHEALTH_DISCLOSURE_ELEMENTS.map((el) => (
                    <li key={el.key}>{el.text}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="consent-signature">Typed signature (patient name)</Label>
            <Input
              id="consent-signature"
              value={signedByName}
              onChange={(e) => setSignedByName(e.target.value)}
              placeholder="Type full name"
            />
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={attested}
                onCheckedChange={(v) => setAttested(v === true)}
                aria-label="Attestation"
              />
              <span>
                Attestation (placeholder text — pending legal review): the signer reviewed the
                selections above and authorized them electronically.
              </span>
            </label>
          </div>

          <Button onClick={submit} disabled={!attested || signedByName.trim().length < 2}>
            Save consent record
          </Button>
        </div>
      ) : null}

      <div className="rounded-xl border bg-card divide-y">
        {records.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No structured consent record on file for this patient.
          </p>
        ) : (
          records.map((r) => (
            <div key={r.id} className="p-3 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {r.formType} · {r.status}
                </span>
                {canWrite && r.status === "active" ? (
                  <Button size="sm" variant="outline" onClick={() => revoke(r.id)}>
                    Revoke
                  </Button>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                Effective {r.effectiveDate} → {r.expirationDate ?? "no expiration"} · signed{" "}
                {new Date(r.signedAt).toLocaleString()} by {r.signedBy.name} ({
                  r.signedBy.relationship
                })
              </div>
              <div className="text-xs text-muted-foreground">Source: {r.source}</div>
              <div className="text-xs">
                Authorized:{" "}
                {r.sections
                  .filter((s) => s.authorized)
                  .map((s) => s.category)
                  .join(", ") || "none"}
              </div>
              {r.status === "revoked" ? (
                <div className="text-xs text-destructive">
                  Revoked {r.revokedAt ? new Date(r.revokedAt).toLocaleString() : ""} by{" "}
                  {r.revokedBy} — {r.revocationReason}
                </div>
              ) : null}
              {r.supersedesId ? (
                <div className="text-[11px] text-muted-foreground">
                  Supersedes record {r.supersedesId}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}