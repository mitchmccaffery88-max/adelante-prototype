import { StatusChip } from "@/components/ui/status-chip";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClientDate } from "@/components/ClientDate";
import { FileCheck2, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.290e8f6ee324": {
    "en": "Paperwork for this kind of advocate",
    "es": "Documentación para este tipo de persona de apoyo"
  },
  "ui.9da81f9d48b9": {
    "en": "Ticking a box records what you've told us. The care team still checks the real document before anything opens up.",
    "es": "Marcar una casilla registra lo que nos has dicho. El equipo aún revisa el documento real antes de dar acceso."
  },
  "ui.26d10409791d": {
    "en": "Your paperwork",
    "es": "Tu documentación"
  },
  "ui.7ec9485d6624": {
    "en": "The care team asked for this on",
    "es": "El equipo de atención solicitó esto el"
  },
  "ui.67bb408ad3bc": {
    "en": "It's on file / I'm sending it",
    "es": "Está en el archivo / La estoy enviando"
  }
} as const;


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
  const { lang: screenLang } = useI18n();

  const requirements = requirementsForType(authorizationType);
  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="advocate-claim-docs">
      <p className="flex items-center gap-2 text-sm font-medium text-navy">
        <FileCheck2 className="h-4 w-4 text-teal" /> {SCREEN_COPY["ui.290e8f6ee324"][screenLang]} </p>
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
        {SCREEN_COPY["ui.9da81f9d48b9"][screenLang]} </p>
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
  const { lang: screenLang } = useI18n();

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
        <FileCheck2 className="h-4 w-4 text-teal" /> {SCREEN_COPY["ui.26d10409791d"][screenLang]} </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const def = ADVOCATE_DOC_REQUIREMENTS[row.key];
          return (
            <li key={row.key} className="space-y-1 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-navy">{def.label}</span>
                <StatusChip state={row.status === "verified" ? "done" : row.status === "attested" || def.staffOnly ? "team" : "yourturn"} label={STATUS_LABEL[row.status]} />
              </div>
              <p className="text-xs text-muted-foreground">{def.plainLanguage}</p>
              {row.requestedAt && row.status !== "verified" && (
                <p className="text-xs text-attention">
                  {SCREEN_COPY["ui.7ec9485d6624"][screenLang]} <ClientDate value={row.requestedAt} />.
                </p>
              )}
              {!def.staffOnly && row.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => attest(row.key)}>
                  {SCREEN_COPY["ui.67bb408ad3bc"][screenLang]} </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
