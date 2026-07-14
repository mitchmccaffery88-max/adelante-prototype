import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdelanteEHR, useEhr, type ReferralSource, type ReferralStatus } from "@/lib/ehr";
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
import { useI18n } from "@/lib/i18n";

function normalizeCin(v: string) {
  return v.replace(/\s+/g, "").toUpperCase();
}
function maskCin(v?: string) {
  if (!v) return "";
  return v.length <= 4 ? v : `••••${v.slice(-4)}`;
}

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
  const { t } = useI18n();
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
    cin: "",
    dob: "",
    releaseDate: "",
    countyOfRelease: "Kings",
    consentToContact: false,
    noPhone: false,
    notARobot: false,
  });
  const [cinDup, setCinDup] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.firstName ||
      !form.lastName ||
      !form.referrerName ||
      !form.referringAgency
    ) {
      toast.error("Please complete the required fields");
      return;
    }
    if (!form.noPhone && !form.phone) {
      toast.error("Add a phone number, or check 'No reliable phone'");
      return;
    }
    if (!form.noPhone && !form.consentToContact) {
      toast.error("Please confirm consent to contact");
      return;
    }
    if (!form.notARobot) {
      toast.error("Please verify you're not a robot");
      return;
    }
    const result = AdelanteEHR.createReferral({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.noPhone ? undefined : form.phone,
      cin: form.cin ? normalizeCin(form.cin) : undefined,
      dob: form.dob || undefined,
      releaseDate: form.releaseDate || undefined,
      referringAgency: form.referringAgency,
      referrerName: form.referrerName,
      referrerEmail: form.referrerEmail || undefined,
      referrerPhone: form.referrerPhone || undefined,
      referralSource: form.referralSource,
      countyOfRelease: form.countyOfRelease || undefined,
      consentToContact: form.noPhone ? false : form.consentToContact,
      requestManualOutreach: form.noPhone,
    });
    const key = (form.referrerEmail || form.referrerName).trim().toLowerCase();
    try {
      localStorage.setItem("adelante.referrerKey", key);
    } catch { /* no-op */ }
    setReferrerKey(key);
    toast.success("Referral submitted", {
      description: result.outreachTask
        ? "No SMS sent — a care-team member will call within one business day."
        : "A welcome text will be sent within 2 hours.",
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
        <div className="mt-8 text-left">
          <ReferrerStatusTracker referrerKey={referrerKey} />
        </div>
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
      {referrerKey && (
        <div className="mb-6">
          <ReferrerStatusTracker referrerKey={referrerKey} />
        </div>
      )}
      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">
          {t("navReferrals")}
        </div>
        <h1 className="font-display text-3xl text-navy mt-1">{t("refTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("refSubtitle")}</p>
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
              <Field label="CIN / Medi-Cal ID (if known)">
                <Input
                  placeholder="9 characters — e.g. 90000000A"
                  maxLength={20}
                  value={form.cin}
                  onChange={(e) => setForm({ ...form, cin: normalizeCin(e.target.value) })}
                  onBlur={() => {
                    const cin = normalizeCin(form.cin);
                    if (!cin) return setCinDup(null);
                    const existingR = AdelanteEHR.listReferrals().find(
                      (r) => r.cin && normalizeCin(r.cin) === cin,
                    );
                    const existingP = AdelanteEHR.listPatients().find(
                      (p) => p.cin && normalizeCin(p.cin) === cin,
                    );
                    if (existingR) {
                      setCinDup(
                        `Heads up: a referral already exists for CIN ${maskCin(cin)} — ${existingR.firstName} ${existingR.lastName}.`,
                      );
                    } else if (existingP) {
                      setCinDup(
                        `Heads up: this CIN ${maskCin(cin)} is already enrolled (${existingP.programId}).`,
                      );
                    } else setCinDup(null);
                  }}
                />
                {cinDup && (
                  <p className="text-xs text-gold-foreground mt-1">{cinDup}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Optional. Helps avoid duplicate records when names are similar.
                </p>
              </Field>
              <Field label={form.noPhone ? "Phone (skipped)" : "Phone *"}>
                <Input
                  type="tel"
                  placeholder="+1 555 555 0100"
                  value={form.phone}
                  disabled={form.noPhone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Date of birth">
                <Input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
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
            <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
              <Checkbox
                checked={form.noPhone}
                onCheckedChange={(v) =>
                  setForm({ ...form, noPhone: Boolean(v) })
                }
              />
              <span>
                <strong>No reliable phone — request manual outreach.</strong>{" "}
                Skip the welcome text and queue a manual call from the care team.
              </span>
            </label>
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

const stageOrder: ReferralStatus[] = ["submitted", "contacted", "enrolled"];
const stageLabels: Record<ReferralStatus, string> = {
  submitted: "Received",
  contacted: "Eligibility verified · intake scheduled",
  enrolled: "Enrolled",
};

function ReferrerStatusTracker({ referrerKey }: { referrerKey: string }) {
  const { t } = useI18n();
  const all = useEhr(() => AdelanteEHR.listReferrals());
  if (!referrerKey) return null;
  const mine = all.filter((r) => {
    const k = (r.referrerEmail || r.referrerName).trim().toLowerCase();
    return k === referrerKey;
  });
  if (mine.length === 0) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-navy flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-teal" /> {t("refYourReferrals")}
        </h3>
        <Badge variant="outline">{mine.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Status only — no clinical detail.
      </p>
      <ul className="mt-3 space-y-3">
        {mine.slice(0, 10).map((r) => {
          const reachedIdx = stageOrder.indexOf(r.status);
          return (
            <li key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-medium text-navy">
                    {r.firstName} {r.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stageLabels[r.status]}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize text-[10px]">
                  {r.status}
                </Badge>
              </div>
              <div className="mt-2 flex gap-1">
                {stageOrder.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${i <= reachedIdx ? "bg-teal" : "bg-border"}`}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}