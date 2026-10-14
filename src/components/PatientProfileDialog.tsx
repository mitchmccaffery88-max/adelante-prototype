import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdelanteEHR,
  useEhr,
  type BestTime,
  type ContactChannel,
  type PreferredLanguage,
} from "@/lib/ehr";
import { toast } from "sonner";
import { ReleaseDateProvenance } from "@/components/ReleaseDateProvenance";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.987b9ced08d4": {
    "en": "Day",
    "es": "Día"
  },
  "ui.fb0d041b6206": {
    "en": "of 90",
    "es": "de 90"
  },
  "ui.649df08a448e": {
    "en": "English",
    "es": "Inglés"
  },
  "ui.c3328c39b0e2": {
    "en": "Text",
    "es": "Texto"
  },
  "ui.cac056598c76": {
    "en": "Phone call",
    "es": "Llamada telefónica"
  },
  "ui.bc17c1f0179a": {
    "en": "Video",
    "es": "Video"
  },
  "ui.a0cf42473466": {
    "en": "Morning",
    "es": "Mañana"
  },
  "ui.d682699b928c": {
    "en": "Afternoon",
    "es": "Tarde"
  },
  "ui.6734e19790f1": {
    "en": "Evening",
    "es": "Tarde"
  },
  "ui.cd5b0224ac4b": {
    "en": "9 characters",
    "es": "9 caracteres"
  },
  "ui.0ef38c23caa6": {
    "en": "Helps disambiguate people with similar names.",
    "es": "Ayuda a distinguir a personas con nombres similares."
  },
  "ui.9349f6a8c889": {
    "en": "Emergency contact",
    "es": "Contacto de emergencia"
  },
  "ui.709a23220f2c": {
    "en": "Name",
    "es": "Nombre"
  },
  "ui.9b4a86cba424": {
    "en": "Relationship",
    "es": "Parentesco"
  },
  "ui.77064d526523": {
    "en": "Phone",
    "es": "Teléfono"
  },
  "ui.d059376b7a75": {
    "en": "Consents",
    "es": "Consentimientos"
  },
  "ui.b8a08bcacf48": {
    "en": "ECM share:",
    "es": "Compartir ECM:"
  },
  "ui.d0a79c78aca0": {
    "en": "SMS:",
    "es": "SMS:"
  },
  "ui.3e03f76c12b5": {
    "en": "Recent consent changes",
    "es": "Cambios recientes en el consentimiento"
  },
  "ui.bb37dabe3e19": {
    "en": "· by",
    "es": "· por"
  },
  "ui.77dfd2135f4d": {
    "en": "Cancel",
    "es": "Cancelar"
  },
  "ui.f597c0e8201d": {
    "en": "Save profile",
    "es": "Guardar perfil"
  }
} as const;


interface Props {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, also surface read-only program/consent summary (admin view). */
  showAdminMeta?: boolean;
}

export function PatientProfileDialog({ patientId, open, onOpenChange, showAdminMeta }: Props) {
  const { lang: screenLang } = useI18n();

  const patient = useEhr(() => (patientId ? AdelanteEHR.getPatient(patientId) : undefined));
  const consentEvents = useEhr(() => AdelanteEHR.listAllConsentEvents());

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    pronouns: "",
    preferredLanguage: "en" as PreferredLanguage,
    phone: "",
    email: "",
    dob: "",
    releaseDate: "",
    contactChannel: "text" as ContactChannel,
    bestTime: "morning" as BestTime,
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    address: "",
    cin: "",
  });

  useEffect(() => {
    if (!patient) return;
    setForm({
      firstName: patient.firstName,
      lastName: patient.lastName,
      preferredName: patient.preferredName ?? "",
      pronouns: patient.pronouns ?? "",
      preferredLanguage: patient.preferredLanguage ?? "en",
      phone: patient.phone ?? "",
      email: patient.email ?? "",
      dob: patient.dob ?? "",
      releaseDate: patient.releaseDate ?? "",
      contactChannel: patient.contactPrefs?.channel ?? "text",
      bestTime: patient.contactPrefs?.bestTime ?? "morning",
      emergencyName: patient.emergencyContact?.name ?? "",
      emergencyRelationship: patient.emergencyContact?.relationship ?? "",
      emergencyPhone: patient.emergencyContact?.phone ?? "",
      address: patient.address ?? "",
      cin: patient.cin ?? "",
    });
  }, [patient?.id]);

  if (!patient) return null;

  const save = () => {
    AdelanteEHR.updateProfile(patient.id, {
      firstName: form.firstName,
      lastName: form.lastName,
      preferredName: form.preferredName || undefined,
      pronouns: form.pronouns || undefined,
      preferredLanguage: form.preferredLanguage,
      phone: form.phone || undefined,
      email: form.email || undefined,
      dob: form.dob || undefined,
      releaseDate: form.releaseDate || undefined,
      contactPrefs: { channel: form.contactChannel, bestTime: form.bestTime },
      emergencyContact: form.emergencyName
        ? {
            name: form.emergencyName,
            relationship: form.emergencyRelationship,
            phone: form.emergencyPhone,
          }
        : undefined,
      address: form.address || undefined,
      cin: form.cin ? form.cin.replace(/\s+/g, "").toUpperCase() : undefined,
    });
    toast.success("Profile saved");
    onOpenChange(false);
  };

  const consent = AdelanteEHR.getConsentState(patient.id);
  const eventsForPatient = consentEvents
    .filter((e) => e.programId === patient.programId)
    .slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-navy">
            {patient.firstName} {patient.lastName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <span className="font-mono">{patient.programId}</span>
            <span>·</span>
            <span>{SCREEN_COPY["ui.987b9ced08d4"][screenLang]} {patient.episodeDay} {SCREEN_COPY["ui.fb0d041b6206"][screenLang]}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="grid sm:grid-cols-2 gap-3">
            <Field label="First name">
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name">
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
            <Field label="Preferred name">
              <Input
                value={form.preferredName}
                onChange={(e) => setForm({ ...form, preferredName: e.target.value })}
              />
            </Field>
            <Field label="Pronouns">
              <Input
                value={form.pronouns}
                onChange={(e) => setForm({ ...form, pronouns: e.target.value })}
              />
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                value={form.dob ? form.dob.slice(0, 10) : ""}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
            </Field>
            <Field label="Release date">
              <Input
                type="date"
                value={form.releaseDate ? form.releaseDate.slice(0, 10) : ""}
                onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
              />
              <ReleaseDateProvenance
                patient={patient}
                onConfirmed={(date) => setForm({ ...form, releaseDate: date })}
              />
            </Field>

            <Field label="Phone">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Preferred language">
              <Select
                value={form.preferredLanguage}
                onValueChange={(v) =>
                  setForm({ ...form, preferredLanguage: v as PreferredLanguage })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{SCREEN_COPY["ui.649df08a448e"][screenLang]}</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contact channel">
              <Select
                value={form.contactChannel}
                onValueChange={(v) => setForm({ ...form, contactChannel: v as ContactChannel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{SCREEN_COPY["ui.c3328c39b0e2"][screenLang]}</SelectItem>
                  <SelectItem value="call">{SCREEN_COPY["ui.cac056598c76"][screenLang]}</SelectItem>
                  <SelectItem value="video">{SCREEN_COPY["ui.bc17c1f0179a"][screenLang]}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Best time">
              <Select
                value={form.bestTime}
                onValueChange={(v) => setForm({ ...form, bestTime: v as BestTime })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{SCREEN_COPY["ui.a0cf42473466"][screenLang]}</SelectItem>
                  <SelectItem value="afternoon">{SCREEN_COPY["ui.d682699b928c"][screenLang]}</SelectItem>
                  <SelectItem value="evening">{SCREEN_COPY["ui.6734e19790f1"][screenLang]}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="CIN / Medi-Cal ID">
                <Input
                  placeholder={SCREEN_COPY["ui.cd5b0224ac4b"][screenLang]}
                  value={form.cin}
                  onChange={(e) =>
                    setForm({ ...form, cin: e.target.value.replace(/\s+/g, "").toUpperCase() })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {SCREEN_COPY["ui.0ef38c23caa6"][screenLang]} </p>
              </Field>
            </div>
          </section>

          <section className="rounded-lg border bg-secondary/30 p-4 space-y-2">
            <div className="text-sm font-medium text-navy">{SCREEN_COPY["ui.9349f6a8c889"][screenLang]}</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input
                placeholder={SCREEN_COPY["ui.709a23220f2c"][screenLang]}
                value={form.emergencyName}
                onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
              />
              <Input
                placeholder={SCREEN_COPY["ui.9b4a86cba424"][screenLang]}
                value={form.emergencyRelationship}
                onChange={(e) => setForm({ ...form, emergencyRelationship: e.target.value })}
              />
              <Input
                type="tel"
                placeholder={SCREEN_COPY["ui.77064d526523"][screenLang]}
                value={form.emergencyPhone}
                onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
              />
            </div>
          </section>

          {showAdminMeta && (
            <section className="rounded-lg border p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-navy">{SCREEN_COPY["ui.d059376b7a75"][screenLang]}</span>
                <Badge
                  variant="outline"
                  className={consent.part2Sud ? "border-teal/40 text-teal" : ""}
                >
                  Part 2 SUD: {consent.part2Sud ? "On" : "Off"}
                </Badge>
                <Badge
                  variant="outline"
                  className={consent.ecmShare ? "border-teal/40 text-teal" : ""}
                >
                  {SCREEN_COPY["ui.b8a08bcacf48"][screenLang]} {consent.ecmShare ? "On" : "Off"}
                </Badge>
                <Badge variant="outline" className={consent.sms ? "border-teal/40 text-teal" : ""}>
                  {SCREEN_COPY["ui.d0a79c78aca0"][screenLang]} {consent.sms ? "On" : "Off"}
                </Badge>
              </div>
              {eventsForPatient.length > 0 && (
                <div>
                  <div className="font-medium text-navy mb-1">{SCREEN_COPY["ui.3e03f76c12b5"][screenLang]}</div>
                  <ul className="space-y-1">
                    {eventsForPatient.map((e) => (
                      <li key={e.id} className="flex justify-between text-muted-foreground">
                        <span>
                          {e.purpose} · {e.action} {SCREEN_COPY["ui.bb37dabe3e19"][screenLang]} {e.actor}
                        </span>
                        <span>{new Date(e.at).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {SCREEN_COPY["ui.77dfd2135f4d"][screenLang]} </Button>
          <Button className="bg-navy text-navy-foreground hover:bg-navy/90" onClick={save}>
            {SCREEN_COPY["ui.f597c0e8201d"][screenLang]} </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
