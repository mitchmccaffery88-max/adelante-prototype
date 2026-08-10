import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import {
  CREDENTIAL_PROTOTYPE_NOTICE,
  credentialMeta,
  normalizeEnrollmentCode,
  redemptionMessage,
  validateSignup,
  validateCredentialOnly,
  type RedemptionMessage,
  type SignupErrors,
  type SignupInput,
} from "@/lib/signup";
import { ArrowRight, Info, Phone, ShieldCheck, Ticket } from "lucide-react";

export const Route = createFileRoute("/start/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — Adelante" },
      {
        name: "description",
        content:
          "Set up your Adelante account: your name, date of birth, and how we reach you. Takes about a minute, before any questions about care.",
      },
      { property: "og:title", content: "Create your account — Adelante" },
      {
        property: "og:description",
        content: "Set up your Adelante account before starting care — about a minute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

/**
 * §Front-door Phase 3 (groundwork) — one entry form, two real branches:
 * a brand-new self-service patient, or a Track A member claiming the record a
 * CF Care Manager already built for them with an `RE-XXXX-XXXX` code.
 *
 * The two-tier helper model (informal vs. authenticated staff operator) is NOT
 * built here; the branch state below is where it will hang off next.
 */
function SignupPage() {
  const [branch, setBranch] = useState<null | "code" | "new">(null);

  if (branch === "new") return <NewPatientForm onBack={() => setBranch(null)} />;
  if (branch === "code") return <RedeemCodePanel onBack={() => setBranch(null)} />;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-teal/40 text-teal">
          Step 1 — getting started
        </Badge>
        <h1 className="font-display mt-2 text-2xl text-navy">
          Do you have a code from your CF Care Manager or care team?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It looks like <span className="font-mono">RE-4K7P-92XB</span> and would have been given to
          you on paper or by message when your re-entry plan was finished.
        </p>
      </div>
      <div className="grid gap-2">
        <Button
          variant="outline"
          className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => setBranch("code")}
        >
          <span>
            <span className="block font-medium">Yes, I have a code</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              We'll open the record that's already waiting for you.
            </span>
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => setBranch("new")}
        >
          <span>
            <span className="block font-medium">No — I'm new here</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Takes about a minute to set up an account.
            </span>
          </span>
        </Button>
      </div>
    </Card>
  );
}

/**
 * The staff-fallback pattern used everywhere else in the front door
 * (`/start/reconnect`, `/start/other-help`): a human contact path, never a
 * dead end. Reused verbatim rather than re-worded per failure.
 */
function StaffFallback() {
  return (
    <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
      <div className="flex items-start gap-3">
        <Phone className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
        <div>
          <div className="font-medium text-navy">Connect with our team</div>
          <p className="mt-1 text-muted-foreground">
            Give them your name and date of birth and they'll pull up your plan. If you don't have
            your case manager's number, call the main Adelante line and say you're trying to
            reconnect.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/start/reconnect">Other ways to reach us</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Code-redemption branch — claims an EXISTING patient record, never creates one. */
function RedeemCodePanel({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"password" | "pin">("password");
  const [credential, setCredential] = useState("");
  const [credentialConfirm, setCredentialConfirm] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [failure, setFailure] = useState<RedemptionMessage | null>(null);

  const isPin = kind === "pin";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailure(null);
    const normalized = normalizeEnrollmentCode(code);
    if (!normalized) {
      setFailure(redemptionMessage("malformed"));
      return;
    }
    const credErrors = validateCredentialOnly({
      credentialKind: kind,
      credential,
      credentialConfirm,
    });
    setErrors(credErrors);
    if (Object.keys(credErrors).length > 0) return;

    const status = AdelanteEHR.enrollmentCodeStatus(normalized);
    if (status !== "valid") {
      setFailure(redemptionMessage(status));
      return;
    }
    const { patient } = AdelanteEHR.redeemEnrollmentCode({
      code: normalized,
      credential: credentialMeta(kind),
    });
    AdelanteEHR.setCurrentPatientId(patient.id);
    toast.success(`Welcome back, ${patient.firstName}`, {
      description: "We found the plan your care team set up for you.",
    });
    navigate({ to: "/start" });
  }

  const err = (k: keyof SignupErrors) =>
    errors[k] ? (
      <p className="text-xs text-destructive" role="alert">
        {errors[k]}
      </p>
    ) : null;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-teal/40 text-teal">
          Step 1 — your code
        </Badge>
        <h1 className="font-display mt-2 flex items-center gap-2 text-2xl text-navy">
          <Ticket className="h-5 w-5 text-teal" /> Enter your code
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your care team already started a plan in your name. This code confirms it's you — we won't
          make you fill any of it in again.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="redeem-form">
        <div className="space-y-1.5">
          <Label htmlFor="rc-code">Code</Label>
          <Input
            id="rc-code"
            value={code}
            autoComplete="one-time-code"
            placeholder="RE-4K7P-92XB"
            className="font-mono uppercase"
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {failure && (
          <div
            className="space-y-3 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 text-sm"
            role="alert"
          >
            <div>
              <div className="font-medium text-navy">{failure.title}</div>
              <p className="mt-1 text-muted-foreground">{failure.body}</p>
            </div>
            {failure.offerStaffFallback && <StaffFallback />}
          </div>
        )}

        <div className="space-y-3 rounded-lg border bg-secondary/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <ShieldCheck className="h-4 w-4 text-teal" /> How you'll get back in
          </div>
          <div className="space-y-1.5">
            <Label>Use a</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "password" | "pin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="pin">4–8 digit PIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rc-cred">{isPin ? "PIN" : "Password"}</Label>
              <Input
                id="rc-cred"
                type="password"
                inputMode={isPin ? "numeric" : "text"}
                autoComplete="new-password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
              />
              {err("credential")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-cred2">Confirm</Label>
              <Input
                id="rc-cred2"
                type="password"
                inputMode={isPin ? "numeric" : "text"}
                autoComplete="new-password"
                value={credentialConfirm}
                onChange={(e) => setCredentialConfirm(e.target.value)}
              />
              {err("credentialConfirm")}
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {CREDENTIAL_PROTOTYPE_NOTICE}
          </p>
        </div>

        <Button
          type="submit"
          className="min-h-11 w-full bg-teal text-teal-foreground hover:bg-teal/90"
        >
          Continue <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </form>

      <Button variant="ghost" className="px-0" onClick={onBack}>
        Back
      </Button>
    </Card>
  );
}

/**
 * §Self-service sign-up — step 0 of the front door.
 *
 * Scope: SELF-SERVICE ENTRANTS ONLY (general population, Track B, and the
 * missed-handoff population), i.e. everyone who arrives at `/start`. Track A
 * pre-release patients are provisioned by the CF Care Manager through the
 * caseload upload path (`CaseloadUploadDialog`) and never pass through here.
 *
 * On submit this creates a REAL patient record via the normal
 * `AdelanteEHR.createPatient`, then hands off to Phase 1's `/start` routing
 * questions, which are untouched.
 *
 * The credential fields are PROTOTYPE-ONLY and are not authentication — see
 * the honesty note at the top of `src/lib/signup.ts`.
 */
function NewPatientForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { setLang } = useI18n();
  const [draft, setDraft] = useState<SignupInput>({
    firstName: "",
    lastName: "",
    dob: "",
    phone: "",
    email: "",
    preferredLanguage: "en",
    credentialKind: "password",
    credential: "",
    credentialConfirm: "",
  });
  const [errors, setErrors] = useState<SignupErrors>({});

  const set = <K extends keyof SignupInput>(k: K, v: SignupInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const isPin = draft.credentialKind === "pin";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSignup(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Check the highlighted fields");
      return;
    }
    const created = AdelanteEHR.createPatient({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      dob: draft.dob,
      ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
      ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
      preferredLanguage: draft.preferredLanguage,
      // Metadata only — the password/PIN itself is intentionally discarded.
      signupCredential: credentialMeta(draft.credentialKind),
    });
    AdelanteEHR.setCurrentPatientId(created.id);
    setLang(draft.preferredLanguage);
    toast.success("Account created", { description: "Next: a few quick questions." });
    navigate({ to: "/start" });
  }

  const err = (k: keyof SignupInput) =>
    errors[k] ? (
      <p className="text-xs text-destructive" role="alert">
        {errors[k]}
      </p>
    ) : null;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-teal/40 text-teal">
          Step 1 — your account
        </Badge>
        <h1 className="font-display mt-2 text-2xl text-navy">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Just enough to open a record in your name. The questions about care come next, and nothing
          here is shared outside your care team.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="su-first">First name</Label>
            <Input
              id="su-first"
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
            {err("firstName")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-last">Last name</Label>
            <Input
              id="su-last"
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
            {err("lastName")}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="su-dob">Date of birth</Label>
          <Input
            id="su-dob"
            type="date"
            autoComplete="bday"
            value={draft.dob}
            onChange={(e) => set("dob", e.target.value)}
          />
          {err("dob")}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="su-phone">Phone</Label>
            <Input
              id="su-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 555 0123"
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            {err("phone")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-email">Email</Label>
            <Input
              id="su-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
            />
            {err("email")}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          One of the two is enough — whichever is easier for us to reach you on.
        </p>

        <div className="space-y-1.5">
          <Label>Language</Label>
          <Select
            value={draft.preferredLanguage}
            onValueChange={(v) => set("preferredLanguage", v as "en" | "es")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-lg border bg-secondary/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <ShieldCheck className="h-4 w-4 text-teal" /> How you'll get back in
          </div>
          <div className="space-y-1.5">
            <Label>Use a</Label>
            <Select
              value={draft.credentialKind}
              onValueChange={(v) => set("credentialKind", v as "password" | "pin")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="pin">4–8 digit PIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="su-cred">{isPin ? "PIN" : "Password"}</Label>
              <Input
                id="su-cred"
                type="password"
                inputMode={isPin ? "numeric" : "text"}
                autoComplete="new-password"
                value={draft.credential}
                onChange={(e) => set("credential", e.target.value)}
              />
              {err("credential")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-cred2">Confirm</Label>
              <Input
                id="su-cred2"
                type="password"
                inputMode={isPin ? "numeric" : "text"}
                autoComplete="new-password"
                value={draft.credentialConfirm}
                onChange={(e) => set("credentialConfirm", e.target.value)}
              />
              {err("credentialConfirm")}
            </div>
          </div>
          {/* Honesty: say plainly that this isn't real sign-in security yet. */}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {CREDENTIAL_PROTOTYPE_NOTICE}
          </p>
        </div>

        <Button
          type="submit"
          className="min-h-11 w-full bg-teal text-teal-foreground hover:bg-teal/90"
        >
          Create account <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
