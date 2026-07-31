// §Refusal record — bilingual risk-text provenance panel.
//
// A finalized refusal is a legal document: the wording the patient was
// ACTUALLY read (their language) and the clinically reviewed English wording
// are both frozen on the record. This panel surfaces both, side by side, with
// the version label and the reviewed/draft flag, so a reviewer can tell at a
// glance whether the signed disclosure was approved copy or a draft
// translation. Gated on meds_erx access — the same class that governs the MAR.
import { Badge } from "@/components/ui/badge";
import { canAccess, useActingRole } from "@/lib/roles";
import type { RefusalForm } from "@/lib/ehr";
import { AlertTriangle, Lock } from "lucide-react";

export function RefusalRiskTextRecord({ form }: { form: RefusalForm }) {
  const [role] = useActingRole();
  const { level } = canAccess(role, "meds_erx");
  if (level === "none")
    return (
      <p className="text-xs text-muted-foreground">
        Risk-text detail is restricted to clinical roles.
      </p>
    );

  const lang = (form.languageCode || "en").toUpperCase();
  // Undefined on forms created before translations existed — treat as reviewed.
  const isDraft = form.riskTextReviewed === false;
  const en = form.riskTextSnapshotEn;
  const translated = Boolean(en && en !== form.riskTextSnapshot);

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">Language: {lang}</Badge>
        <Badge variant="outline">Risk text {form.riskTextVersion}</Badge>
        {isDraft ? (
          <Badge variant="outline" className="border-amber-500/60 text-amber-700">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Draft translation — not clinically reviewed
          </Badge>
        ) : (
          <Badge variant="outline">Reviewed</Badge>
        )}
        {translated && form.riskTextSnapshotEnLocked && (
          <Badge variant="outline">
            <Lock className="mr-1 h-3 w-3" />
            English reference locked
          </Badge>
        )}
      </div>

      <div className={translated ? "grid gap-2 md:grid-cols-2" : "space-y-2"}>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {translated ? `Wording signed (${lang})` : "Wording signed"}
          </div>
          <p className="mt-1 whitespace-pre-line text-xs">{form.riskTextSnapshot}</p>
        </div>
        {translated && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isDraft ? "Reviewed English wording (on record)" : "English wording (locked reference copy)"}
            </div>
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{en}</p>
          </div>
        )}
      </div>
    </div>
  );
}
