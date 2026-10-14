// §Batch E — shown when a sign-up exactly matches an existing record. The text
// is the same whether or not a record exists: it never names, confirms or
// describes another record. A staff review item is created behind the scenes.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.f4d677dcf715": {
    "en": "It looks like you may already have an account.",
    "es": "Parece que ya tienes una cuenta."
  },
  "ui.c58b6ae281aa": {
    "en": "To keep your information private, we can't create a second account or share details here. Try signing in, or ask for help to verify who you are.",
    "es": "Para mantener tu información privada, no podemos crear una segunda cuenta ni compartir detalles aquí. Intenta iniciar sesión o pide ayuda para verificar quién eres."
  },
  "ui.24a871aa3c98": {
    "en": "Forgot how you sign in? Use \"Sign in\" and choose \"Get help signing in\".",
    "es": "¿Olvidaste cómo iniciar sesión? Usa \"Iniciar sesión\" y elige \"Obtener ayuda para iniciar sesión\"."
  },
  "ui.0e77adb53d12": {
    "en": "Call the front desk and we'll verify your identity with you.",
    "es": "Llama a la recepción y verificaremos tu identidad contigo."
  },
  "ui.280be0930561": {
    "en": "A team member will also review this and may reach out.",
    "es": "Un miembro del equipo también revisará esto y podría ponerse en contacto."
  },
  "ui.b52b36b7269f": {
    "en": "Back",
    "es": "Atrás"
  }
} as const;


export function SignupVerificationHelp({ onBack }: { onBack: () => void }) {
  const { lang: screenLang } = useI18n();

  return (
    <Card className="space-y-3 p-6" role="status" data-testid="signup-verification-help">
      <p className="font-display text-lg text-navy">{SCREEN_COPY["ui.f4d677dcf715"][screenLang]}</p>
      <p className="text-sm text-muted-foreground">
        {SCREEN_COPY["ui.c58b6ae281aa"][screenLang]} </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>{SCREEN_COPY["ui.24a871aa3c98"][screenLang]}</li>
        <li>{SCREEN_COPY["ui.0e77adb53d12"][screenLang]}</li>
        <li>{SCREEN_COPY["ui.280be0930561"][screenLang]}</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Si necesitas ayuda en español, llama a la recepción.
      </p>
      <Button variant="outline" onClick={onBack}>{SCREEN_COPY["ui.b52b36b7269f"][screenLang]}</Button>
    </Card>
  );
}
