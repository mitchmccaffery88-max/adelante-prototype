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

interface Props {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, also surface read-only program/consent summary (admin view). */
  showAdminMeta?: boolean;
}

export function PatientProfileDialog({ patientId, open, onOpenChange, showAdminMeta }: Props) {
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
            <span>Day {patient.episodeDay} of 90</span>
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
                  <SelectItem value="en">English</SelectItem>
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
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="call">Phone call</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
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
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
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
                  placeholder="9 characters"
                  value={form.cin}
                  onChange={(e) =>
                    setForm({ ...form, cin: e.target.value.replace(/\s+/g, "").toUpperCase() })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Helps disambiguate people with similar names.
                </p>
              </Field>
            </div>
          </section>

          <section className="rounded-lg border bg-secondary/30 p-4 space-y-2">
            <div className="text-sm font-medium text-navy">Emergency contact</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input
                placeholder="Name"
                value={form.emergencyName}
                onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
              />
              <Input
                placeholder="Relationship"
                value={form.emergencyRelationship}
                onChange={(e) => setForm({ ...form, emergencyRelationship: e.target.value })}
              />
              <Input
                type="tel"
                placeholder="Phone"
                value={form.emergencyPhone}
                onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
              />
            </div>
          </section>

          {showAdminMeta && (
            <section className="rounded-lg border p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-navy">Consents</span>
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
                  ECM share: {consent.ecmShare ? "On" : "Off"}
                </Badge>
                <Badge variant="outline" className={consent.sms ? "border-teal/40 text-teal" : ""}>
                  SMS: {consent.sms ? "On" : "Off"}
                </Badge>
              </div>
              {eventsForPatient.length > 0 && (
                <div>
                  <div className="font-medium text-navy mb-1">Recent consent changes</div>
                  <ul className="space-y-1">
                    {eventsForPatient.map((e) => (
                      <li key={e.id} className="flex justify-between text-muted-foreground">
                        <span>
                          {e.purpose} · {e.action} · by {e.actor}
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
            Cancel
          </Button>
          <Button className="bg-navy text-navy-foreground hover:bg-navy/90" onClick={save}>
            Save profile
          </Button>
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
