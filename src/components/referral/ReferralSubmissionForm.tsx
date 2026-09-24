// §Phase 4d — the ONE referral submission form. Extracted verbatim from the
// public `/referral` route so staff can record a referral on someone's behalf
// from inside the EHR without a second implementation of the same fields,
// validation, duplicate-CIN check and honest welcome-SMS handling.
//
// `variant="public"` is the original page exactly as it shipped.
// `variant="staff"` is the same form with the marketing header and the
// public confirmation screen omitted (staff have the real queue).
import { useEffect, useState } from "react";
import {
  AdelanteEHR,
  REFERRAL_SOURCE_LABELS,
  type ReferralSource,
} from "@/lib/ehr";
import { useServerFn } from "@tanstack/react-start";
import { sendReferralWelcome } from "@/lib/referralWelcome.functions";
import { deliverReferrerUpdate } from "@/lib/referrerUpdateDelivery";
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
import { CheckCircle2, Lock, Send, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BenefitsStep, benefitsCinProblem, selectedPlanSnapshot } from "@/components/intake/BenefitsStep";
import { EMPTY_BENEFITS, benefitsAnswers, type BenefitsFormState } from "@/lib/intakeBenefits";

export function normalizeCin(v: string) {
  return v.replace(/\s+/g, "").toUpperCase();
}
/** Basic name@domain.tld shape. Blank is handled by callers (optional fields). */
export function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
import { REFERRER_CONTACT_REQUIRED_MSG } from "@/lib/referralOutreach";
export { REFERRER_CONTACT_REQUIRED_MSG };
/** Returns the first validation problem with contact details, or null. */
export function referralContactProblem(f: {
  referrerPhone: string;
  referrerEmail: string;
  email: string;
}): string | null {
  const rEmail = f.referrerEmail.trim();
  if (rEmail && !isValidEmail(rEmail)) return "Your work email doesn't look like a valid email address.";
  if (!f.referrerPhone.trim() && !rEmail) return REFERRER_CONTACT_REQUIRED_MSG;
  const email = f.email.trim();
  if (email && !isValidEmail(email)) return "The person's email doesn't look like a valid email address.";
  return null;
}

const sources: { value: ReferralSource; label: string }[] = (
  [
    "probation",
    "parole",
    "drug_court",
    "correctional",
    "community_based_organization",
    "community_peer",
    "self",
    "other",
  ] as ReferralSource[]
).map((value) => ({ value, label: REFERRAL_SOURCE_LABELS[value] }));

export function ReferralSubmissionForm({
  variant = "public",
  onSubmitted,
}: {
  variant?: "public" | "staff";
  /** Staff hosts close their dialog here; the public page shows its own thanks. */
  onSubmitted?: (referralId: string) => void;
}) {
  const staff = variant === "staff";
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  // B6 — the public "your referrals" list is gone: it showed referred
  // people's names to anyone on a shared computer. Clear the storage key that
  // powered it so nothing lingers from earlier visits.
  const [confirmation, setConfirmation] = useState<{
    reference: string;
    textStatus: "sent" | "not_configured" | "failed" | "no_phone" | "pending";
  } | null>(null);
  useEffect(() => {
    if (staff) return;
    try {
      localStorage.removeItem("adelante.referrerKey");
    } catch {
      /* no-op */
    }
  }, [staff]);
  // §Phase 4d — deliberately NOT prefilled from the acting staff member: a
  // staff member recording a referral is usually relaying someone else's
  // details, and prefilling would quietly change what the form asserts.
  const [form, setForm] = useState({
    referrerName: "",
    referringAgency: "",
    referrerEmail: "",
    referrerPhone: "",
    referralSource: "probation" as ReferralSource,
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    cin: "",
    dob: "",
    releaseDate: "",
    countyOfRelease: "Tulare",
    // §Phase 4c — three real states, UNANSWERED by default. Never silently "no".
    justiceInvolved: "" as "" | "yes" | "no" | "unsure",
    consentToContact: false,
    noPhone: false,
    notARobot: false,
  });
  // §Phase 8b — optional benefits via the shared step (CIN lives here now).
  const [benefits, setBenefits] = useState<BenefitsFormState>(EMPTY_BENEFITS);
  const sendWelcome = useServerFn(sendReferralWelcome);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.referrerName || !form.referringAgency) {
      toast.error("Please complete the required fields");
      return;
    }
    const contactProblem = referralContactProblem(form);
    if (contactProblem) {
      toast.error(contactProblem);
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
    if (!form.justiceInvolved) {
      toast.error("Please answer whether this individual is justice-involved");
      return;
    }
    if (benefitsCinProblem(benefits)) {
      toast.error("The Medi-Cal ID needs 9 letters or numbers, or leave it blank.");
      return;
    }
    const ji = form.justiceInvolved === "yes";
    const reported = benefitsAnswers(benefits, selectedPlanSnapshot(benefits.planId));
    const { cin: reportedCin, ...reportedRest } = reported ?? {};
    const result = AdelanteEHR.createReferral({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.noPhone ? undefined : form.phone,
      email: form.email.trim().toLowerCase() || undefined,
      // Medi-Cal ID writes to the EXISTING `Referral.cin` — no parallel field.
      cin: reportedCin ? normalizeCin(reportedCin) : undefined,
      ...(reportedRest.coverageType ? { reportedBenefits: reportedRest } : {}),
      dob: form.dob || undefined,
      releaseDate: ji ? form.releaseDate || undefined : undefined,
      justiceInvolved: form.justiceInvolved,
      referringAgency: form.referringAgency,
      referrerName: form.referrerName,
      referrerEmail: form.referrerEmail || undefined,
      referrerPhone: form.referrerPhone || undefined,
      referralSource: form.referralSource,
      countyOfRelease: ji ? form.countyOfRelease || undefined : undefined,
      consentToContact: form.noPhone ? false : form.consentToContact,
      requestManualOutreach: form.noPhone,
      channel: staff ? "staff" : "public",
    });
    if (!staff) {
      setConfirmation({
        reference: referralReference(result.id),
        textStatus: result.referrerPhone ? "pending" : "no_phone",
      });
      setSubmitted(true);
      // B6 — confirmation text to the referrer, honest outcome recorded on the
      // referral (sent / not_configured / failed). A confirmation EMAIL
      // depends on the email transport ticket and is not attempted here.
      if (result.referrerPhone) {
        void deliverReferrerUpdate(result, "received").then((status) =>
          setConfirmation((c) => (c ? { ...c, textStatus: status } : c)),
        );
      }
    } else {
      onSubmitted?.(result.id);
    }
    // §Phase 4a — actually try to send, then report what really happened.
    // This used to claim a text had been sent without attempting one.
    if (AdelanteEHR.referralWantsWelcomeSms(result) && result.phone) {
      let outcome: { status: "sent" | "not_configured" | "failed"; detail?: string } = {
        status: "failed",
        detail: "send did not complete",
      };
      try {
        outcome = await sendWelcome({
          data: {
            to: result.phone,
            firstName: result.firstName,
            referrerName: result.referrerName,
            referringAgency: result.referringAgency,
          },
        });
      } catch (err) {
        outcome = { status: "failed", detail: err instanceof Error ? err.message : "send error" };
      }
      AdelanteEHR.recordReferralWelcomeDelivery(result.id, outcome);
      if (outcome.status === "sent") {
        toast.success("Referral submitted", {
          description: "A welcome text has been sent to this person.",
        });
      } else {
        toast.success("Referral submitted", {
          description:
            "No text was sent — a care-team member will call within one business day.",
        });
      }
      return;
    }
    toast.success("Referral submitted", {
      description: "No text was sent — a care-team member will call within one business day.",
    });
  };

  if (submitted && !staff) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16" data-testid="referral-confirmation">
        <div className="text-center">
          <CheckCircle2 className="h-12 w-12 text-teal mx-auto" />
          <h1 className="font-display text-3xl text-navy mt-4">Referral received</h1>
          {confirmation && (
            <p className="mt-2 text-sm text-muted-foreground">
              Reference number{" "}
              <span className="font-mono font-semibold text-navy" data-testid="referral-reference">
                {confirmation.reference}
              </span>
            </p>
          )}
        </div>
        <Card className="mt-8 p-5 text-left space-y-3">
          <h2 className="font-display text-lg text-navy">What happens next</h2>
          <ul className="space-y-2 text-sm text-foreground">
            <li>Our team will reach out to the person you referred with a warm welcome.</li>
            <li>You'll get status updates as the referral moves forward.</li>
            <li>Keep the reference number if you need to contact us about this referral.</li>
          </ul>
          {confirmation && (
            <p className="text-xs text-muted-foreground" data-testid="referrer-text-status">
              {confirmation.textStatus === "sent"
                ? "We sent a confirmation text to your phone."
                : confirmation.textStatus === "pending"
                  ? "Sending a confirmation text to your phone…"
                  : confirmation.textStatus === "not_configured"
                    ? "No confirmation text was sent — text messaging isn't connected yet."
                    : confirmation.textStatus === "failed"
                      ? "We couldn't send a confirmation text. Your referral was still received."
                      : "No phone number was given, so no confirmation text was sent."}
            </p>
          )}
        </Card>
        <div className="text-center">
          <Button
            className="mt-6 bg-navy text-navy-foreground hover:bg-navy/90"
            onClick={() => {
              setSubmitted(false);
              setConfirmation(null);
            }}
          >
            Refer someone else
          </Button>
        </div>
      </div>
    );
  }

  const formBody = (
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
              onValueChange={(v) => setForm({ ...form, referralSource: v as ReferralSource })}
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
          <Field label={form.noPhone ? "Phone (skipped)" : "Phone *"}>
            <Input
              type="tel"
              placeholder="+1 555 555 0100"
              value={form.phone}
              disabled={form.noPhone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              data-testid="referral-person-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </Field>
        </div>

        {/* §Phase 4c — one form, conditional fields. Unanswered by default:
            we never assume someone is not justice-involved. */}
        <div className="rounded-lg border p-4 space-y-3">
          <Label className="text-sm">Is this individual justice-involved? *</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Currently or recently in custody, on probation or parole, or in a reentry program.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "yes", label: "Yes" },
                { v: "no", label: "No" },
                { v: "unsure", label: "Unsure" },
              ] as const
            ).map((o) => (
              <Button
                key={o.v}
                type="button"
                size="sm"
                variant={form.justiceInvolved === o.v ? "default" : "outline"}
                onClick={() => setForm({ ...form, justiceInvolved: o.v })}
              >
                {o.label}
              </Button>
            ))}
          </div>
          {form.justiceInvolved === "yes" && (
            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <Field label="Release date (Actual or Expected)">
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
          )}
        </div>
        {/* §Phase 8b — optional: a referrer who doesn't know can skip it. */}
        <div className="rounded-lg border p-4" data-testid="referral-benefits">
          <BenefitsStep value={benefits} onChange={setBenefits} optional audience="third_party" personName={form.firstName} />
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
          <Checkbox
            checked={form.noPhone}
            onCheckedChange={(v) => setForm({ ...form, noPhone: Boolean(v) })}
          />
          <span>
            <strong>No reliable phone — request manual outreach.</strong> No welcome text is sent.
            A follow-up task is created for the care team, due the next day, and the team will use
            your contact details if they can&apos;t reach this person.
          </span>
        </label>
      </section>

      <div className="rounded-lg border-2 border-teal/30 bg-teal/5 p-4 space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <Lock className="h-4 w-4 text-teal mt-0.5" />
          <p>
            We protect this information under HIPAA and 42 CFR Part 2. Any details about substance
            use are only collected later — directly from the person, with their consent.
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={form.consentToContact}
            onCheckedChange={(v) => setForm({ ...form, consentToContact: Boolean(v) })}
          />
          <span>
            <strong>Consent to contact:</strong> The person knows about this referral and is OK with
            us reaching out by text or call.
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
          data-testid="referral-submit"
        >
          <Send className="h-4 w-4 mr-2" />
          Submit referral
        </Button>
      </div>
    </form>
  );

  if (staff) return formBody;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">
          {t("navReferrals")}
        </div>
        <h1 className="font-display text-3xl text-navy mt-1">{t("refTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("refSubtitle")}</p>
      </header>

      <Card className="p-6">{formBody}</Card>
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

/** Short, shareable reference derived from the referral id (no PII). */
function referralReference(id: string): string {
  return `REF-${id.slice(0, 8).toUpperCase()}`;
}
