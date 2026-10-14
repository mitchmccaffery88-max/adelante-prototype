import { CircleAlert } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AdelanteEHR } from "@/lib/ehr";
import {
  crisisMatchLanguage,
  detectCrisisLanguage,
  scanTextForCrisis,
} from "@/lib/crisisTextDetection";
import { crisisCopy } from "@/lib/crisisCopy";
import { validateContact } from "@/lib/frontDoor";
import { Phone, Siren } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.ed212fa164b9": {
    "en": "Placeholder",
    "es": "Marcador de posición"
  },
  "ui.8952ed242470": {
    "en": "Tell us what brings you here",
    "es": "Cuéntanos qué te trae por aquí"
  },
  "ui.88c58e353405": {
    "en": "You're not here for mental health, medication, or substance use support for yourself — so let's not put you through an intake. Say a little about what you need and someone will point you in the right direction.",
    "es": "Como no buscas apoyo para ti en salud mental, medicación o sustancias, no es necesario hacer la admisión. Cuéntanos qué necesitas y te guiaremos."
  },
  "ui.86c6be7acc57": {
    "en": "In crisis now",
    "es": "En crisis ahora"
  },
  "ui.b84862891786": {
    "en": "Thanks — we've got it.",
    "es": "Gracias, lo hemos recibido."
  },
  "ui.d9d318eee8d1": {
    "en": "Someone will follow up. If this is urgent, call the main Adelante line, and if you're in crisis call or text 988.",
    "es": "Alguien te contactará. Si es urgente, llama a la línea principal de Adelante; si estás en crisis, llama o envía un texto al 988."
  },
  "ui.ffca59bc5b7d": {
    "en": "What are you looking for?",
    "es": "¿Qué estás buscando?"
  },
  "ui.53d62299a411": {
    "en": "In your own words — there's no wrong answer.",
    "es": "En tus propias palabras; no hay respuestas incorrectas."
  },
  "ui.5a698f5f3b7f": {
    "en": "Email or phone",
    "es": "Correo o teléfono"
  },
  "ui.365a764d6885": {
    "en": "you@example.com or (559) 555-0123",
    "es": "tu@ejemplo.com o (559) 555-0123"
  },
  "ui.ff957a428999": {
    "en": "Required — we can't point you anywhere if we can't reach you.",
    "es": "Obligatorio: no podemos guiarte si no logramos contactarte."
  },
  "ui.9bc2575c3930": {
    "en": "Send",
    "es": "Enviar"
  },
  "ui.b52b36b7269f": {
    "en": "Back",
    "es": "Atrás"
  },
  "ui.6e1aec070fa6": {
    "en": "Actually, I do want care for myself",
    "es": "En realidad, sí quiero cuidado para mí"
  }
} as const;


export const Route = createFileRoute("/start/other-help")({
  head: () => ({
    meta: [
      { title: "Tell us what brings you here — Adelante" },
      {
        name: "description",
        content:
          "Not looking for care right now? Tell us what you need and we'll point you to the right place.",
      },
      { property: "og:title", content: "Tell us what brings you here — Adelante" },
      {
        property: "og:description",
        content: "Tell Adelante what you're looking for and we'll route you to the right place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OtherHelpPlaceholder,
});

/**
 * PLACEHOLDER (Phase 1). Where a "not seeking care for myself" visitor should
 * actually land is an open product decision. Until that's made this is a plain
 * free-text capture with a human follow-up promise — intentionally NOT an
 * invented destination or a triage tree.
 */
function OtherHelpPlaceholder() {
  const { lang: screenLang } = useI18n();

  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);

  // §Real-time crisis interception — same detector Adel uses, fired as the
  // person types. Resources appear immediately, before and regardless of any
  // submit. The staff-alert layer below is additive, not a replacement.
  const crisis = useMemo(() => detectCrisisLanguage(note), [note]);
  const contactCheck = validateContact(contact);
  // Same rule as Adel: the canned crisis block speaks the language the match
  // came in, taken from the pattern ids that already fired.
  const cc = crisisCopy(crisisMatchLanguage(crisis.patternIds));

  function submit() {
    if (!contactCheck.valid) {
      setTouched(true);
      return;
    }
    const id = AdelanteEHR.getCurrentPatientId();
    if (id) {
      AdelanteEHR.recordFrontDoorEntry(id, { otherHelpNote: note.trim() || undefined });
    }
    // Non-clinical holding store — explicitly NOT a chart. See CommunityInquiry.
    AdelanteEHR.createCommunityInquiry({
      body: note,
      contact,
      contactKind: contactCheck.kind ?? "phone",
      crisisFlagged: crisis.matched,
      patternIds: crisis.patternIds,
    });
    // §Crisis detection — free text from a person at the front door. Runs
    // whether or not a chart exists yet: with no patient id the scan raises an
    // anonymous crisis alert to the same role that owns the crisis queue.
    scanTextForCrisis(id, note, {
      surface: "the front-door 'what brings you here' note",
      anonymousContact: contact.trim(),
    });
    setSent(true);
    toast.success("Thanks — we've got it.");
  }

  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-gold/50 text-navy">
          {SCREEN_COPY["ui.ed212fa164b9"][screenLang]} </Badge>
        <h1 className="font-display mt-2 text-2xl text-navy">{SCREEN_COPY["ui.8952ed242470"][screenLang]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {SCREEN_COPY["ui.88c58e353405"][screenLang]} </p>
      </div>

      {crisis.matched ? (
        <div
          role="alert"
          data-testid="frontdoor-crisis-resources"
          className="space-y-2 rounded-lg border-2 border-input bg-surface-sunk p-4 text-sm"
        >
          <div className="flex items-center gap-2 font-semibold text-attention">
            <Siren className="h-4 w-4" /> {cc.frontDoorHeading}
          </div>
          <p className="text-muted-foreground">{cc.frontDoorBody}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="crisis" size="sm">
              <a href="tel:988">
                <Phone className="h-4 w-4" /> {cc.frontDoorCall}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="sms:988">{cc.frontDoorText}</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/crisis">{SCREEN_COPY["ui.86c6be7acc57"][screenLang]}</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {sent ? (
        <div className="rounded-lg border-2 border-teal/40 bg-teal/5 p-4 text-sm">
          <div className="font-medium text-navy">{SCREEN_COPY["ui.b84862891786"][screenLang]}</div>
          <p className="mt-1 text-muted-foreground">
            {SCREEN_COPY["ui.d9d318eee8d1"][screenLang]} </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="other-help">{SCREEN_COPY["ui.ffca59bc5b7d"][screenLang]}</Label>
          <Textarea
            id="other-help"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder={SCREEN_COPY["ui.53d62299a411"][screenLang]}
          />
          <div className="space-y-1 pt-2">
            <Label htmlFor="other-help-contact">
              {SCREEN_COPY["ui.5a698f5f3b7f"][screenLang]} <span className="text-attention">*</span>
            </Label>
            <Input
              id="other-help-contact"
              value={contact}
              onBlur={() => setTouched(true)}
              onChange={(e) => setContact(e.target.value)}
              placeholder={SCREEN_COPY["ui.365a764d6885"][screenLang]}
              aria-invalid={touched && !contactCheck.valid}
            />
            <p className="text-xs text-muted-foreground">
              {SCREEN_COPY["ui.ff957a428999"][screenLang]} </p>
            {touched && contactCheck.error ? (
              <p className="text-xs font-medium text-attention"><CircleAlert className="mr-1 inline size-4 shrink-0 align-text-bottom" aria-hidden="true" />{contactCheck.error}</p>
            ) : null}
          </div>
          <Button onClick={submit} disabled={!note.trim() || !contactCheck.valid}>
            {SCREEN_COPY["ui.9bc2575c3930"][screenLang]} </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button asChild variant="outline">
          <Link to="/start/support">{SCREEN_COPY["ui.b52b36b7269f"][screenLang]}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/intake">{SCREEN_COPY["ui.6e1aec070fa6"][screenLang]}</Link>
        </Button>
      </div>
    </Card>
  );
}
