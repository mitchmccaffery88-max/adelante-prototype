// §Advocate build 1 — the consent-documentation step, shown to the ADVOCATE.
//
// Two modes, one component so the wording can never diverge:
//  - `mode="claim"`: pre-claim checkboxes. Nothing is written to the store
//    yet; the parent passes the ticked keys into `claimAdvocateInvitation`.
//  - `mode="live"`: post-claim status on a real link, with attest actions.
//
// Staff-only requirements (clinician activation of a directive, certified
// court order) are rendered read-only in both modes — an advocate cannot tick
// their own capacity determination.
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import type { AdvocateAuthorizationType } from "@/lib/advocate";
import {
  ADVOCATE_DOC_REQUIREMENTS,
  requirementsForType,
  type AdvocateDocRequirementKey,
} from "@/lib/advocateDocs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientDate } from "@/components/ClientDate";
import { FileCheck2, Lock } from "lucide-react";

const STATUS_LABEL = {
  pending: "Not on file yet",
  attested: "You've confirmed it",
  verified: "Verified by the care team",
} as const;

export function AdvocateClaimDocumentChecklist({
  authorizationType,
  checked,
  onChange,
}: {
  authorizationType: AdvocateAuthorizationType;
  checked: AdvocateDocRequirementKey[];
  onChange: (keys: AdvocateDocRequirementKey[]) => void;
}) {
  const requirements = requirementsForType(authorizationType);
  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="advocate-claim-docs">
      <p className="flex items-center gap-2 text-sm font-medium text-navy">
        <FileCheck2 className="h-4 w-4 text-teal" /> Paperwork for this kind of advocate
      </p>
      <ul className="space-y-3">
        {requirements.map((r) => (
          <li key={r.key} className="flex gap-3 text-sm">
            {r.staffOnly ? (
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Checkbox
                id={`req-${r.key}`}
                className="mt-0.5"
                checked={checked.includes(r.key)}
                onCheckedChange={(v) =>
                  onChange(v ? [...checked, r.key] : checked.filter((k) => k !== r.key))
                }
              />
            )}
            <label htmlFor={`req-${r.key}`} className="cursor-pointer">
              <span className="font-medium text-navy">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{r.plainLanguage}</span>
              <span className="mt-1 block text-xs">
                {r.staffOnly ? (
                  <span className="text-muted-foreground">{r.attestation}</span>
                ) : (
                  r.attestation
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Ticking a box records what you've told us. The care team still checks the real document
        before anything opens up.
      </p>
    </div>
  );
}

export function AdvocateDocumentStatusPanel({
  linkId,
  attestedName,
}: {
  linkId: string;
  attestedName: string;
}) {
  const rows = useEhr(() => AdelanteEHR.advocateDocumentRequirements(linkId));
  if (rows.length === 0) return null;

  function attest(key: AdvocateDocRequirementKey) {
    try {
      AdelanteEHR.attestAdvocateDocumentRequirement({ linkId, key, attestedName });
      toast.success("Thanks — the care team has been told.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record that.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4" data-testid="advocate-doc-status">
      <p className="flex items-center gap-2 text-sm font-medium text-navy">
        <FileCheck2 className="h-4 w-4 text-teal" /> Your paperwork
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const def = ADVOCATE_DOC_REQUIREMENTS[row.key];
          return (
            <li key={row.key} className="space-y-1 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-navy">{def.label}</span>
                <Badge variant={row.status === "verified" ? "default" : "secondary"}>
                  {STATUS_LABEL[row.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{def.plainLanguage}</p>
              {row.requestedAt && row.status !== "verified" && (
                <p className="text-xs text-amber-700">
                  The care team asked for this on <ClientDate value={row.requestedAt} />.
                </p>
              )}
              {!def.staffOnly && row.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => attest(row.key)}>
                  It's on file / I'm sending it
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
