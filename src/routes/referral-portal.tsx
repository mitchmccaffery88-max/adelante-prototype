import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EMR, type ExternalReferral } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/referral-portal")({
  head: () => ({ meta: [{ title: "Refer a person — Adelante" }] }),
  component: ReferralPortal,
});

function ReferralPortal() {
  const nav = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [f, setF] = useState<ExternalReferral>({
    referrerName: "",
    referrerOrg: "",
    referrerRole: "",
    firstName: "",
    lastName: "",
    dob: "",
    cin: "",
    county: "Tulare",
    custodyFacility: "",
    bookingDate: "",
    releaseDate: "",
    releaseConfidence: "estimated",
    pendingCharges: "",
    sudKnown: "unknown",
    currentMedications: "",
    phone: "",
    language: "en",
    consents: { treatment: false, telehealth: false, part2: false, sms: false },
  });

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Card className="p-6 text-center space-y-3">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
          <h1 className="text-xl font-semibold">Referral received</h1>
          <p className="text-sm text-muted-foreground">The care team will follow up. No clinical results are shared back without documented consent.</p>
          <p className="text-xs text-muted-foreground">Welcome SMS queued — will send only after communication consent is confirmed.</p>
          <Button onClick={() => nav({ to: "/" })} variant="outline">Return to dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <header>
        <div className="text-xs uppercase text-teal tracking-wider">External referral portal</div>
        <h1 className="text-2xl font-semibold mt-1">Refer a person to Adelante</h1>
        <p className="text-sm text-muted-foreground">Minimal fields, plain language. All fields optional except name.</p>
      </header>

      <Card className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Your name"><Input value={f.referrerName} onChange={(e) => setF({ ...f, referrerName: e.target.value })} /></Field>
          <Field label="Your organization"><Input value={f.referrerOrg} onChange={(e) => setF({ ...f, referrerOrg: e.target.value })} placeholder="Probation / drug court / ECM" /></Field>
          <Field label="Your role"><Input value={f.referrerRole} onChange={(e) => setF({ ...f, referrerRole: e.target.value })} /></Field>
          <Field label="County"><Input value="Tulare" disabled /></Field>
        </div>

        <div className="border-t pt-4 grid sm:grid-cols-2 gap-3">
          <Field label="Person first name"><Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
          <Field label="Person last name"><Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
          <Field label="Date of birth"><Input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
          <Field label="CIN / Medi-Cal ID (if known)"><Input value={f.cin} onChange={(e) => setF({ ...f, cin: e.target.value.toUpperCase() })} /></Field>
          <Field label="Custody facility"><Input value={f.custodyFacility} onChange={(e) => setF({ ...f, custodyFacility: e.target.value })} /></Field>
          <Field label="Booking date"><Input type="date" value={f.bookingDate} onChange={(e) => setF({ ...f, bookingDate: e.target.value })} /></Field>
          <Field label="Expected release date"><Input type="date" value={f.releaseDate} onChange={(e) => setF({ ...f, releaseDate: e.target.value })} /></Field>
          <Field label="Confidence">
            <select className="border rounded-md px-2 h-9 text-sm w-full" value={f.releaseConfidence} onChange={(e) => setF({ ...f, releaseConfidence: e.target.value as any })}>
              <option value="confirmed">Confirmed</option>
              <option value="estimated">Estimated</option>
              <option value="self_reported">Self-reported</option>
            </select>
          </Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Preferred language">
            <select className="border rounded-md px-2 h-9 text-sm w-full" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as any })}>
              <option value="en">English</option><option value="es">Español</option>
            </select>
          </Field>
        </div>

        <Field label="Pending charges (optional)"><Textarea rows={2} value={f.pendingCharges} onChange={(e) => setF({ ...f, pendingCharges: e.target.value })} /></Field>
        <Field label="Known / suspected substance use">
          <select className="border rounded-md px-2 h-9 text-sm w-full" value={f.sudKnown} onChange={(e) => setF({ ...f, sudKnown: e.target.value as any })}>
            <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </Field>
        <Field label="Current medications (if any)"><Textarea rows={2} value={f.currentMedications} onChange={(e) => setF({ ...f, currentMedications: e.target.value })} /></Field>

        <div className="border-t pt-4 space-y-2">
          <div className="font-medium text-sm">Consents (plain language)</div>
          <ConsentCheck label="Treatment — I agree to participate in Adelante care." checked={f.consents.treatment} onChange={(v) => setF({ ...f, consents: { ...f.consents, treatment: v } })} />
          <ConsentCheck label="Telehealth — I agree to be seen by video or phone." checked={f.consents.telehealth} onChange={(v) => setF({ ...f, consents: { ...f.consents, telehealth: v } })} />
          <ConsentCheck label="Part 2 / SUD-record sharing — I allow substance-use records to be shared with my Adelante team." checked={f.consents.part2} onChange={(v) => setF({ ...f, consents: { ...f.consents, part2: v } })} />
          <ConsentCheck label="Communication / SMS — I agree to receive text reminders." checked={f.consents.sms} onChange={(v) => setF({ ...f, consents: { ...f.consents, sms: v } })} />
        </div>

        <Button
          className="w-full"
          onClick={() => {
            if (!f.firstName || !f.lastName) return toast.error("First and last name are required");
            EMR.submitReferral(f);
            setSubmitted(true);
          }}
        >
          Submit referral
        </Button>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
function ConsentCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>{label}</span>
    </label>
  );
}
