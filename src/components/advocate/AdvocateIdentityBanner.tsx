import { StatusChip } from "@/components/ui/status-chip";
// §Advocate Build 2 item 1 — persistent identity banner.
//
// The patient's name is released by `advocatePatientIdentity`, which resolves
// the SAME live gate as every other advocate read. A link row existing is not
// enough: an AHCD that no clinician has activated, a family-participation link
// with no active ROI, an unclaimed/expired/revoked link, or a link whose
// authorization type was never confirmed all render the pending state with NO
// name. Nothing here can compute or override that decision.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.4ca7d4b7e5f5": {
    "en": "You're viewing",
    "es": "Estás viendo"
  },
  "ui.966723b3e3ac": {
    "en": "'s information",
    "es": "información de "
  }
} as const;


export function AdvocateIdentityBanner({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const identity = useEhr(() => AdelanteEHR.advocatePatientIdentity(linkId));

  if (!identity.allowed) {
    return (
      <Card
        data-testid="advocate-identity-pending"
        className="flex gap-3 border-attention bg-attention-soft p-4 text-sm"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
        <div>
          <StatusChip state="restricted" label="Access pending verification" />
          <p className="mt-1 text-muted-foreground">{identity.reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Until this is resolved we can't show you who you're connected to, or anything about
            their care.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      data-testid="advocate-identity-banner"
      className="flex flex-wrap items-center justify-between gap-3 border-teal/40 bg-teal/5 p-4 text-sm"
    >
      <span className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal" />
        <span className="font-medium text-navy">
          {SCREEN_COPY["ui.4ca7d4b7e5f5"][screenLang]} {identity.firstName}{SCREEN_COPY["ui.966723b3e3ac"][screenLang]} </span>
      </span>
      <StatusChip state="done" label="Access verified" />
    </Card>
  );
}
