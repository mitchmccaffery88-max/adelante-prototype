import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HealthieService, useHealthie, type ReferralSource, type ReferralStatus } from "@/lib/healthie";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Lock, Send, ShieldCheck, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { title: "Refer someone — Adelante" },
      {
        name: "description",
        content:
          "A short, private form to refer a recently released individual to Adelante care. No clinical detail required.",
      },
    ],
  }),
  component: ReferralPage,
});

const sources: { value: ReferralSource; label: string }[] = [
  { value: "probation", label: "Probation" },
  { value: "parole", label: "Parole" },
  { value: "drug_court", label: "Drug court / reentry court" },
  { value: "correctional", label: "Correctional health" },
  { value: "self", label: "Self / family / friend" },
  { value: "other", label: "Other" },
];

function ReferralPage() {
  const [submitted, setSubmitted] = useState(false);
  const [referrerKey, setReferrerKey] = useState<string>("");
  useEffect(() => {
    try {
      setReferrerKey(localStorage.getItem("adelante.referrerKey") ?? "");
    } catch {
      /* no-op */
    }
  }, []);
  const [form, setForm] = useState({
    referrerName: "",
    referringAgency: "",
    referrerEmail: "",
    referrerPhone: "",
    referralSource: "probation" as ReferralSource,
    firstName: "",
    lastName: "",
    phone: "",
    releaseDate: "",
    countyOfRelease: "Kings",
    consentToContact: false,
    notARobot: false,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.firstName ||
      !form.lastName ||
      !form.phone ||
      !form.referrerName ||
      !form.referringAgency
    ) {
      toast.error("Please complete the required fields");
      return;
    }
    if (!form.consentToContact) {
      toast.error("Please confirm consent to contact");
      return;
    }
    if (!form.notARobot) {
      toast.error("Please verify you're not a robot");
      return;
    }
    HealthieService.createReferral({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      releaseDate: form.releaseDate || undefined,
      referringAgency: form.referringAgency,
      referrerName: form.referrerName,
      referrerEmail: form.referrerEmail || undefined,
      referrerPhone: form.referrerPhone || undefined,
      referralSource: form.referralSource,
      countyOfRelease: form.countyOfRelease || undefined,
      consentToContact: form.consentToContact,
    });
    toast.success("Referral submitted", {
      description: "A welcome text will be sent within 2 hours.",
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-teal mx-auto" />
        <h1 className="font-display text-3xl text-navy mt-4">Thank you.</h1>
        <p className="text-muted-foreground mt-2">
          We'll reach out to this person with a warm welcome and next steps.
          You'll hear back if we need anything from you.
        </p>
        <Button
          className="mt-6 bg-navy text-navy-foreground hover:bg-navy/90"
          onClick={() => setSubmitted(false)}
        >
          Refer someone else
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">
          Refer someone
        </div>
        <h1 className="font-display text-3xl text-navy mt-1">
          Help someone start care.
        </h1>
        <p className="text-muted-foreground mt-2">
          A short form — about 2 minutes. We only ask for the basics.
          Please <strong>do not include</strong> charges, diagnoses, or substance-use
          details here. Those are collected privately with the person's consent.
        </p>
      </header>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <section className="space-y-4">
            <h2 className="font-display text-lg text-navy">About you</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Your name *">
                <Input
                  value={form.referrerName}
                  onChange={(e) => setForm({ ...form, referrerName: e.target.value })}
                />
              </Field>
              <Field label="Agency / organization *">
                <Input
                  value={form.referringAgency}
                  onChange={(e) => setForm({ ...form, referringAgency: e.target.value })}
                />
              </Field>
              <Field label="Work email">
                <Input
                  type="email"
                  value={form.referrerEmail}
                  onChange={(e) => setForm({ ...form, referrerEmail: e.target.value })}
                />
              </Field>
              <Field label="Work phone">
                <Input
                  type="tel"
                  value={form.referrerPhone}
                  onChange={(e) => setForm({ ...form, referrerPhone: e.target.value })}
                />
              </Field>
              <Field label="Referral source">
                <Select
                  value={form.referralSource}
                  onValueChange={(v) =>
                    setForm({ ...form, referralSource: v as ReferralSource })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          <section className="space-y-4 pt-2 border-t">
            <h2 className="font-display text-lg text-navy">About the person</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="First name *">
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </Field>
              <Field label="Last name *">
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </Field>
              <Field label="Phone *">
                <Input
                  type="tel"
                  placeholder="+1 555 555 0100"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Expected release date">
                <Input
                  type="date"
                  value={form.releaseDate}
                  onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                />
              </Field>
              <Field label="County of release">
                <Input
                  value={form.countyOfRelease}
                  onChange={(e) => setForm({ ...form, countyOfRelease: e.target.value })}
                />
              </Field>
            </div>
          </section>

          <div className="rounded-lg border-2 border-teal/30 bg-teal/5 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <Lock className="h-4 w-4 text-teal mt-0.5" />
              <p>
                We protect this information under HIPAA and 42 CFR Part 2.
                Any details about substance use are only collected later —
                directly from the person, with their consent.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.consentToContact}
                onCheckedChange={(v) =>
                  setForm({ ...form, consentToContact: Boolean(v) })
                }
              />
              <span>
                <strong>Consent to contact:</strong> The person knows about this
                referral and is OK with us reaching out by text or call.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.notARobot}
                onCheckedChange={(v) => setForm({ ...form, notARobot: Boolean(v) })}
              />
              <span>I'm not a robot.</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal" />
              Encrypted submission · rate-limited
            </p>
            <Button
              type="submit"
              size="lg"
              className="bg-navy text-navy-foreground hover:bg-navy/90"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit referral
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}