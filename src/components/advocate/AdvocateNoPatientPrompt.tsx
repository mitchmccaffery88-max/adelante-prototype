// §Advocate Build 2 — fixes the real dead-end: an advocate-only visitor who
// lands on /patient or /home has no patient record and used to get the generic
// "we don't have a record for you yet / get started" empty state, which is both
// wrong and a dead end. If an advocate session exists we show the way back to
// the advocate shell instead of the sign-up prompt.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdvocateSessionId } from "@/components/ContextSwitcher";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.c05091c7e9e4": {
    "en": "You're signed in as an advocate",
    "es": "Iniciaste sesión como persona de apoyo"
  },
  "ui.56a040b7a5b8": {
    "en": "This page is a patient's own care portal, and you don't have a patient record here. Your advocate view is in a separate place.",
    "es": "Esta página es el portal de cuidado del paciente y no tienes un registro aquí. Tu vista de persona de apoyo está en otro lugar."
  },
  "ui.4d23ea8e743a": {
    "en": "Go to my advocate view",
    "es": "Ir a mi vista de persona de apoyo"
  }
} as const;


export function AdvocateNoPatientPrompt({ fallback }: { fallback: ReactNode }) {
  const { lang: screenLang } = useI18n();

  const linkId = useAdvocateSessionId();
  if (!linkId) return <>{fallback}</>;
  return (
    <Card className="space-y-3 p-6 text-sm" data-testid="advocate-no-patient-prompt">
      <p className="flex items-center gap-2 font-display text-lg text-navy">
        <HeartHandshake className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.c05091c7e9e4"][screenLang]} </p>
      <p className="text-muted-foreground">
        {SCREEN_COPY["ui.56a040b7a5b8"][screenLang]} </p>
      <Button asChild>
        <Link to="/advocate">{SCREEN_COPY["ui.4d23ea8e743a"][screenLang]}</Link>
      </Button>
    </Card>
  );
}
