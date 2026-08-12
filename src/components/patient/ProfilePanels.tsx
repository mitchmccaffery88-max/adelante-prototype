// §P1 My Care de-clutter — the Profile surface's real panels.
//
// These two cards used to live inline in `PatientHome` (My Care). Nothing about
// them changed in the move: `MyProfileCard` still edits through the same
// `PatientProfileDialog`, and the consent toggles still write through
// `AdelanteEHR.setConsent` — the same field the care-team message composer
// reads for its Part 2 nudge. Only their home moved.
import { useState } from "react";
import { toast } from "sonner";
import { Globe2, Lock, Phone as PhoneIcon, UserCog } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

export function MyProfileCard({ patientId }: { patientId: string }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [open, setOpen] = useState(false);
  if (!patient) return null;
  const channelLabel: Record<string, string> = {
    text: "Text",
    call: "Phone call",
    video: "Video",
  };
  const timeLabel: Record<string, string> = {
    morning: "Mornings",
    afternoon: "Afternoons",
    evening: "Evenings",
  };
  const langLabel: Record<string, string> = { en: "English", es: "Español" };
  return (
    <Card className="p-5" id="my-profile" data-testid="my-profile-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
          <UserCog className="h-4 w-4" /> My profile
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Edit
        </Button>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="Name">
          {patient.firstName} {patient.lastName}
          {patient.preferredName ? (
            <span className="text-muted-foreground"> · "{patient.preferredName}"</span>
          ) : null}
        </Row>
        {patient.pronouns && <Row label="Pronouns">{patient.pronouns}</Row>}
        <Row label="Phone">
          {patient.phone ? (
            <span className="inline-flex items-center gap-1.5">
              <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" /> {patient.phone}
            </span>
          ) : (
            <span className="text-muted-foreground">Not on file</span>
          )}
        </Row>
        <Row label="Language">
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
            {langLabel[patient.preferredLanguage ?? "en"]}
          </span>
        </Row>
        {patient.contactPrefs && (
          <Row label="Contact">
            {channelLabel[patient.contactPrefs.channel]} ·{" "}
            {timeLabel[patient.contactPrefs.bestTime]}
          </Row>
        )}
        {patient.address && <Row label="Address">{patient.address}</Row>}
        {patient.emergencyContact?.name && (
          <Row label="Emergency">
            {patient.emergencyContact.name}
            {patient.emergencyContact.relationship
              ? ` (${patient.emergencyContact.relationship})`
              : ""}
            {patient.emergencyContact.phone ? ` · ${patient.emergencyContact.phone}` : ""}
          </Row>
        )}
      </dl>
      <PatientProfileDialog patientId={patientId} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

export function PrivacyConsentCard({ patientId }: { patientId: string }) {
  const consent = useEhr(() => AdelanteEHR.getConsentState(patientId));
  const rows: { key: "part2Sud" | "ecmShare" | "sms"; label: string; help: string }[] = [
    {
      key: "part2Sud",
      label: "Share substance-use information with my care team",
      help: "42 CFR Part 2 — only your Adelante care team. Never probation/parole.",
    },
    {
      key: "ecmShare",
      label: "Share with Enhanced Care Management partners",
      help: "Lets housing, food, and reentry partners coordinate.",
    },
    {
      key: "sms",
      label: "Text-message reminders",
      help: "Appointment and check-in reminders by SMS.",
    },
  ];
  return (
    <Card className="p-5" id="privacy-consent" data-testid="privacy-consent-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Lock className="h-4 w-4" /> Privacy & consent
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        You can change these at any time. Changes apply right away.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-3 rounded-md border p-3">
            <Switch
              checked={consent[r.key]}
              onCheckedChange={(v) => {
                AdelanteEHR.setConsent(patientId, r.key, v);
                toast.success(v ? "Consent granted" : "Consent withdrawn");
              }}
            />
            <div className="flex-1 text-sm">
              <div className="font-medium text-foreground">{r.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{r.help}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
