// §Advocate Access Redesign Phase 2 (final) — Supporting → Documents.
// The PATIENT's shared documents. Distinct owner from "My documents" (the
// advocate's own authorization paperwork), and the two are cross-linked so
// the distinction is visible rather than implied.
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, FileStack } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvocateDocumentsPanel } from "@/components/advocate/AdvocateWorkspace";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import {
  AdvocateViewHeader,
  AdvocateSupportGate,
  useSupportingName,
} from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.143f7ba1fed6": {
    "en": "My documents",
    "es": "Mis documentos"
  },
  "ui.8ad2ae4cbd0d": {
    "en": "Your own authorization paperwork is kept separately.",
    "es": "Tus documentos de autorización se guardan por separado."
  },
  "ui.e94de7d6dc0f": {
    "en": "Open my documents",
    "es": "Abrir mis documentos"
  }
} as const;


export const Route = createFileRoute("/advocate/documents")({
  head: () => ({ meta: [
    { title: "Documents \u2014 Adelante advocate" },
    { name: "description", content: "Your documents in the Adelante advocate portal." },
    { property: "og:title", content: "Documents \u2014 Adelante advocate" },
    { property: "og:description", content: "Your documents in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateSharedDocumentsView,
});

function AdvocateSharedDocumentsView() {
  const { lang: screenLang } = useI18n();

  const { linkId } = useAdvocateSession();
  const name = useSupportingName(linkId);
  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={FileText}
        title={name ? `${name}'s documents` : "Their documents"}
        lede="Paperwork belonging to the person you support. A care team member reviews everything before it enters the medical record."
      />
      <AdvocateSupportGate linkId={linkId}>
        <AdvocateDocumentsPanel linkId={linkId} />
      </AdvocateSupportGate>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <FileStack className="h-4 w-4" /> {SCREEN_COPY["ui.143f7ba1fed6"][screenLang]} </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {SCREEN_COPY["ui.8ad2ae4cbd0d"][screenLang]} </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/advocate/my-documents">{SCREEN_COPY["ui.e94de7d6dc0f"][screenLang]}</Link>
        </Button>
      </Card>
    </div>
  );
}
