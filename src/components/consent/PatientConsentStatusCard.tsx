// §ASCMI consent — PATIENT-FACING, read-only status view.
//
// Lives as a section inside /home (patient shell owns three routes only; every
// other patient surface is a section — Phase 4 pattern). Capture and revoke
// stay staff-only: this component never writes, and the RBAC matrix already
// keeps `consent_ledger` writes off patient surfaces.
//
// PLACEHOLDER WARNING: the category labels come from CONSENT_CATEGORIES and are
// placeholders pending Christi's DHCS-sourced ASCMI categories.
import { AdelanteEHR, CONSENT_CATEGORIES, useEhr, type ConsentRecord } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck2 } from "lucide-react";

const CATEGORY_LABEL = new Map(CONSENT_CATEGORIES.map((c) => [c.key, c.label]));

const FORM_LABEL: Record<ConsentRecord["formType"], string> = {
  AB133: "Standard consent form",
  NonAB133: "Other consent form",
  Revocation: "Withdrawal form",
};

// Plain-language wording, matching the tone the rest of the patient home uses.
const STATUS_LABEL: Record<ConsentRecord["status"], string> = {
  active: "In effect now",
  expired: "Ended on its own",
  revoked: "You withdrew this",
  superseded: "Replaced by a newer form",
};

function prettyDate(value?: string) {
  if (!value) return "no end date";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(+d) ? value : d.toLocaleDateString();
}

export function PatientConsentStatusCard({ patientId }: { patientId: string }) {
  // Only ever this patient's own records — the store filters by patientId.
  const records = useEhr(() => AdelanteEHR.listConsentRecords(patientId));
  const active = records.find((r) => r.status === "active");
  const past = records.filter((r) => r.status !== "active");

  return (
    <Card className="p-5" data-testid="patient-consent-status">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <FileCheck2 className="h-4 w-4" /> Your consent form
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        What you signed, what it covers, and anything you changed later. Only your care team can
        change a form — ask them any time.
      </p>

      {!active && past.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          No consent form on file yet.
        </p>
      ) : null}

      {active ? (
        <div className="mt-3 rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-foreground">{FORM_LABEL[active.formType]}</div>
            <Badge variant="outline" className="text-[10px]">
              {STATUS_LABEL[active.status]}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Starts {prettyDate(active.effectiveDate)} · Ends {prettyDate(active.expirationDate)}
          </div>
          <div className="mt-2 text-xs font-medium text-foreground">You said yes to sharing:</div>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {active.sections.filter((s) => s.authorized).length === 0 ? (
              <li>Nothing on this form — no information is shared under it.</li>
            ) : (
              active.sections
                .filter((s) => s.authorized)
                .map((s) => <li key={s.category}>• {CATEGORY_LABEL.get(s.category) ?? s.category}</li>)
            )}
          </ul>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs font-medium text-foreground">Earlier forms</div>
          <ul className="mt-2 space-y-2">
            {past.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground">{FORM_LABEL[r.formType]}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Signed {prettyDate(r.signedAt.slice(0, 10))}
                  {r.revokedAt ? ` · withdrawn ${prettyDate(r.revokedAt.slice(0, 10))}` : ""}
                </div>
                {r.revocationReason ? (
                  <div className="mt-1 text-muted-foreground">Reason given: {r.revocationReason}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
