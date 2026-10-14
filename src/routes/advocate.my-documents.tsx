// §Advocate Access Redesign Phase 2 (final) — My documents.
//
// Consolidates the advocate's OWN authorization paperwork (HIPAA ROI, DHCS AR
// designation, AHCD document, conservatorship order — whichever the held
// instrument requires) into one destination, reusing the existing status panel
// rather than re-deriving requirement state here.
//
// The cross-link at the bottom is deliberate and one-directional in meaning:
// the patient's shared documents are a DIFFERENT owner's records, so they are
// named as such and reached by a link, never merged into this list.
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileStack, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvocateDocumentStatusPanel } from "@/components/advocate/AdvocateDocumentChecklist";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader, useSupportingName } from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.143f7ba1fed6": {
    "en": "My documents",
    "es": "Mis documentos"
  },
  "ui.116c89208996": {
    "en": "Paperwork belonging to the person you support — separate from your own authorization documents above. You can send documents on their behalf there.",
    "es": "Los documentos de la persona a la que apoyas están separados de tus documentos de autorización. Allí puedes enviar documentos en su nombre."
  },
  "ui.f2bcd022b764": {
    "en": "Open their documents",
    "es": "Abrir sus documentos"
  }
} as const;


export const Route = createFileRoute("/advocate/my-documents")({
  head: () => ({ meta: [
    { title: "My documents \u2014 Adelante advocate" },
    { name: "description", content: "Your my documents in the Adelante advocate portal." },
    { property: "og:title", content: "My documents \u2014 Adelante advocate" },
    { property: "og:description", content: "Your my documents in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateMyDocuments,
});

function AdvocateMyDocuments() {
  const { lang: screenLang } = useI18n();

  const { linkId, attestedName } = useAdvocateSession();
  const supportingName = useSupportingName(linkId);

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={FileStack}
        title={SCREEN_COPY["ui.143f7ba1fed6"][screenLang]}
        lede="The authorization paperwork that lets you act as an advocate — what's on file, what's still needed, and who it's waiting on."
      />

      <Card className="p-5">
        <AdvocateDocumentStatusPanel linkId={linkId} attestedName={attestedName} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <FileText className="h-4 w-4" />{" "}
            {supportingName ? `${supportingName}'s documents` : "Their documents"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {SCREEN_COPY["ui.116c89208996"][screenLang]} </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/advocate/documents">{SCREEN_COPY["ui.f2bcd022b764"][screenLang]}</Link>
        </Button>
      </Card>
    </div>
  );
}
