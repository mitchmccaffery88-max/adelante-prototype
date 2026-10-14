// §Advocate Access Redesign Phase 2 (final) — My profile.
//
// Same STRUCTURE as the patient "My profile" card (labelled rows + an Edit
// action), but the advocate's OWN identity fields, held on their link row.
//
// Deliberately absent, and not by oversight:
//  - Recovery start date: a patient self-tracking concept. If this advocate
//    also holds their own patient record (see "Support for myself"), that
//    record has its own, entirely separate.
//  - Privacy & consent toggles: an advocate's consent mechanism is the
//    document-based authorization system in My documents. Building a parallel
//    toggle here would imply a second, non-existent, way to grant access.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Globe2, Phone as PhoneIcon, ShieldCheck, UserCog } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ADVOCATE_AUTHORIZATION_TYPES } from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.2f3df0a939fd": {
    "en": "My profile",
    "es": "Mi perfil"
  },
  "ui.5301648dcf6b": {
    "en": "Edit",
    "es": "Editar"
  },
  "ui.9ae62c1cb5e1": {
    "en": "Not on file",
    "es": "No registrado"
  },
  "ui.d5b9b5abd180": {
    "en": "What you're authorized to see is set by the documents in",
    "es": "Lo que tienes autorización para ver depende de los documentos en"
  },
  "ui.143f7ba1fed6": {
    "en": "My documents",
    "es": "Mis documentos"
  },
  "ui.0c094972ee77": {
    "en": ", not by anything on this page.",
    "es": ", no por nada de esta página."
  },
  "ui.dae9ca6e1f21": {
    "en": "Edit my profile",
    "es": "Editar mi perfil"
  },
  "ui.0de783e67a6d": {
    "en": "Your own contact details. Changing these never changes what you can see.",
    "es": "Tus propios datos de contacto. Cambiarlos no cambia lo que puedes ver."
  },
  "ui.ab42293e29e1": {
    "en": "Your name",
    "es": "Tu nombre"
  },
  "ui.3dcd5d427ae3": {
    "en": "Relationship to the person you support",
    "es": "Relación con la persona a la que apoyas"
  },
  "ui.3b209045d4cd": {
    "en": "Sister, friend, caregiver…",
    "es": "Hermana, amistad, cuidador…"
  },
  "ui.77064d526523": {
    "en": "Phone",
    "es": "Teléfono"
  },
  "ui.1c7b0d771fbc": {
    "en": "Preferred language",
    "es": "Idioma preferido"
  },
  "ui.649df08a448e": {
    "en": "English",
    "es": "Inglés"
  },
  "ui.77dfd2135f4d": {
    "en": "Cancel",
    "es": "Cancelar"
  },
  "ui.efc007a393f6": {
    "en": "Save",
    "es": "Guardar"
  }
} as const;


export const Route = createFileRoute("/advocate/my-profile")({
  head: () => ({ meta: [
    { title: "My profile \u2014 Adelante advocate" },
    { name: "description", content: "Your my profile in the Adelante advocate portal." },
    { property: "og:title", content: "My profile \u2014 Adelante advocate" },
    { property: "og:description", content: "Your my profile in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateMyProfile,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

const LANG_LABEL: Record<string, string> = { en: "English", es: "Español" };

function AdvocateMyProfile() {
  const { lang: screenLang } = useI18n();

  const { linkId } = useAdvocateSession();
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  const [open, setOpen] = useState(false);
  if (!link) return null;

  const authLabel = ADVOCATE_AUTHORIZATION_TYPES.find(
    (a) => a.key === link.authorizationType,
  )?.label;

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={UserCog}
        title={SCREEN_COPY["ui.2f3df0a939fd"][screenLang]}
        lede="Your own details as the person advocating. This is not the record of the person you support."
      />

      <Card className="p-5" data-testid="advocate-profile-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <UserCog className="h-4 w-4" /> {SCREEN_COPY["ui.2f3df0a939fd"][screenLang]} </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {SCREEN_COPY["ui.5301648dcf6b"][screenLang]} </Button>
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Name">{link.advocateName}</Row>
          <Row label="Relationship">
            {link.relationship || <span className="text-muted-foreground">{SCREEN_COPY["ui.9ae62c1cb5e1"][screenLang]}</span>}
          </Row>
          <Row label="Phone">
            {link.contactPhone ? (
              <span className="inline-flex items-center gap-1.5">
                <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" /> {link.contactPhone}
              </span>
            ) : (
              <span className="text-muted-foreground">{SCREEN_COPY["ui.9ae62c1cb5e1"][screenLang]}</span>
            )}
          </Row>
          <Row label="Language">
            <span className="inline-flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
              {LANG_LABEL[link.preferredLanguage ?? "en"]}
            </span>
          </Row>
          <Row label="Invited to">{link.invitationSentTo}</Row>
          <Row label="Authorization">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal" />
              {authLabel ?? "Not confirmed"}
            </span>
          </Row>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {SCREEN_COPY["ui.d5b9b5abd180"][screenLang]}{" "}
          <Link to="/advocate/my-documents" className="font-medium text-teal underline">
            {SCREEN_COPY["ui.143f7ba1fed6"][screenLang]} </Link>
          {SCREEN_COPY["ui.0c094972ee77"][screenLang]} </p>
      </Card>

      <EditDialog
        linkId={linkId}
        open={open}
        onOpenChange={setOpen}
        initial={{
          advocateName: link.advocateName,
          relationship: link.relationship ?? "",
          contactPhone: link.contactPhone ?? "",
          preferredLanguage: link.preferredLanguage ?? "en",
        }}
      />
    </div>
  );
}

function EditDialog({
  linkId,
  open,
  onOpenChange,
  initial,
}: {
  linkId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: {
    advocateName: string;
    relationship: string;
    contactPhone: string;
    preferredLanguage: string;
  };
}) {
  const { lang: screenLang } = useI18n();

  const [form, setForm] = useState(initial);

  function save() {
    try {
      AdelanteEHR.updateAdvocateProfile(linkId, {
        advocateName: form.advocateName,
        relationship: form.relationship,
        contactPhone: form.contactPhone,
        preferredLanguage: form.preferredLanguage === "es" ? "es" : "en",
      });
      toast.success("Saved.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setForm(initial);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{SCREEN_COPY["ui.dae9ca6e1f21"][screenLang]}</DialogTitle>
          <DialogDescription>
            {SCREEN_COPY["ui.0de783e67a6d"][screenLang]} </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="adv-name">{SCREEN_COPY["ui.ab42293e29e1"][screenLang]}</Label>
            <Input
              id="adv-name"
              value={form.advocateName}
              onChange={(e) => setForm({ ...form, advocateName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adv-rel">{SCREEN_COPY["ui.3dcd5d427ae3"][screenLang]}</Label>
            <Input
              id="adv-rel"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              placeholder={SCREEN_COPY["ui.3b209045d4cd"][screenLang]}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adv-phone">{SCREEN_COPY["ui.77064d526523"][screenLang]}</Label>
            <Input
              id="adv-phone"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adv-lang">{SCREEN_COPY["ui.1c7b0d771fbc"][screenLang]}</Label>
            <Select
              value={form.preferredLanguage}
              onValueChange={(v) => setForm({ ...form, preferredLanguage: v })}
            >
              <SelectTrigger id="adv-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{SCREEN_COPY["ui.649df08a448e"][screenLang]}</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {SCREEN_COPY["ui.77dfd2135f4d"][screenLang]} </Button>
          <Button onClick={save}>{SCREEN_COPY["ui.efc007a393f6"][screenLang]}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
