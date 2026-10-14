import { CircleAlert } from "lucide-react";
import { PossibleExistingPatientError, SignupNeedsVerificationError } from "@/lib/patientMatching";
import { SignupVerificationHelp } from "@/components/identity/SignupVerificationHelp";
import { ExistingPersonStep } from "@/components/identity/ExistingPersonStep";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import {
  CREDENTIAL_PROTOTYPE_NOTICE,
  HELPER_HINT,
  HELPER_QUESTION,
  credentialMeta,
  informalHelper,
  normalizeEnrollmentCode,
  redemptionMessage,
  validateSignup,
  validateCredentialOnly,
  type HelperAttribution,
  type RedemptionMessage,
  type SignupErrors,
  type SignupInput,
} from "@/lib/signup";
import { ArrowRight, Info, Phone, ShieldCheck, Ticket, UserCheck } from "lucide-react";
/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.b16c7ac6faff": {
    "en": "(optional)",
    "es": "(opcional)"
  },
  "ui.1ea156667c3d": {
    "en": "Name or organization — optional",
    "es": "Nombre u organización — opcional"
  },
  "ui.7105c6908765": {
    "en": "It looks like",
    "es": "Parece que"
  },
  "ui.c0c1e545c546": {
    "en": "RE-4K7P-92XB",
    "es": "RE-4K7P-92XB"
  },
  "ui.fa15eb95151c": {
    "en": "and would have been given to you on paper or by message when your re-entry plan was finished.",
    "es": "y se te habría entregado en papel o por mensaje cuando se terminó tu plan de reinserción."
  },
  "ui.67360c77312a": {
    "en": "Yes, I have a code",
    "es": "Sí, tengo un código"
  },
  "ui.7ecfed131e0f": {
    "en": "We'll open the record that's already waiting for you.",
    "es": "Abriremos el expediente que ya te está esperando."
  },
  "ui.39549952ced9": {
    "en": "No — I'm new here",
    "es": "No — soy nuevo/a aquí"
  },
  "ui.d24ca1134cb1": {
    "en": "Takes about a minute to set up an account.",
    "es": "Toma alrededor de un minuto crear una cuenta."
  },
  "ui.86b603304409": {
    "en": "Connect with our team",
    "es": "Conéctate con nuestro equipo"
  },
  "ui.458e8a0a6959": {
    "en": "Give them your name and date of birth and they'll pull up your plan. If you don't have your case manager's number, call the main Adelante line and say you're trying to reconnect.",
    "es": "Dales tu nombre y fecha de nacimiento y ellos buscarán tu plan. Si no tienes el número de tu gestor de casos, llama a la línea principal de Adelante y di que estás intentando reconectarte."
  },
  "ui.69b82d3770fa": {
    "en": "Other ways to reach us",
    "es": "Otras formas de contactarnos"
  },
  "ui.ea8c8ff054dd": {
    "en": "Step 1 — your code",
    "es": "Paso 1 — tu código"
  },
  "ui.96733a59c63e": {
    "en": "Enter your code",
    "es": "Ingresa tu código"
  },
  "ui.ffc4839c1d66": {
    "en": "Your care team already started a plan in your name. This code confirms it's you — we won't make you fill any of it in again.",
    "es": "Tu equipo de cuidado ya inició un plan a tu nombre. Este código confirma que eres tú — no te pediremos que vuelvas a completar nada."
  },
  "ui.adac69379a62": {
    "en": "Code",
    "es": "Código"
  },
  "ui.b2aa4590432d": {
    "en": "How you'll get back in",
    "es": "Cómo volverás a ingresar"
  },
  "ui.9bccf7c30b02": {
    "en": "Use a",
    "es": "Usar"
  },
  "ui.8be3c943b160": {
    "en": "Password",
    "es": "Contraseña"
  },
  "ui.809bd7550587": {
    "en": "4–8 digit PIN",
    "es": "PIN de 4 a 8 dígitos"
  },
  "ui.04a212215ef9": {
    "en": "Confirm",
    "es": "Confirmar"
  },
  "ui.2e02623966f9": {
    "en": "Continue",
    "es": "Continuar"
  },
  "ui.b52b36b7269f": {
    "en": "Back",
    "es": "Atrás"
  },
  "ui.a776fc05eea2": {
    "en": "Step 1 — your account",
    "es": "Paso 1 — tu cuenta"
  },
  "ui.4046b5818208": {
    "en": "Create your account",
    "es": "Crea tu cuenta"
  },
  "ui.77a1390f4f27": {
    "en": "Just enough to open a record in your name. The questions about care come next, and nothing here is shared outside your care team.",
    "es": "Solo lo necesario para abrir un expediente a tu nombre. Las preguntas sobre el cuidado vienen a continuación, y nada de lo que pongas aquí se comparte fuera de tu equipo de cuidado."
  },
  "ui.7e568a90221d": {
    "en": "First name",
    "es": "Nombre"
  },
  "ui.adec36a821f8": {
    "en": "Last name",
    "es": "Apellido"
  },
  "ui.9518425f4174": {
    "en": "Date of birth",
    "es": "Fecha de nacimiento"
  },
  "ui.77064d526523": {
    "en": "Phone",
    "es": "Teléfono"
  },
  "ui.84add5b29527": {
    "en": "Email",
    "es": "Correo electrónico"
  },
  "ui.50e2b46ef877": {
    "en": "you@example.com",
    "es": "tu@ejemplo.com"
  },
  "ui.c3cfdb17ef1e": {
    "en": "One of the two is enough — whichever is easier for us to reach you on.",
    "es": "Uno de los dos es suficiente — lo que sea más fácil para contactarte."
  },
  "ui.89b86ab0e66f": {
    "en": "Language",
    "es": "Idioma"
  },
  "ui.649df08a448e": {
    "en": "English",
    "es": "Inglés"
  },
  "ui.aaf374479756": {
    "en": "Create account",
    "es": "Crear cuenta"
  }
} as const;


/**
 * §Front-door Phase 3 — the ONE implementation of the front-door sign-up
 * flow, shared by two operators:
 *
 *  - Tier 1 (`operator` absent): the public `/start/signup` page. Anonymous
 *    person, optionally with an informal helper beside them who can type a
 *    name into one optional box. No verification, no gate.
 *  - Tier 2 (`operator` present): the staff-only assisted sign-up tool, run
 *    by an authenticated ECM Provider / CF Care Manager / Peer Specialist on
 *    someone's behalf. Same fields, same validation, same EHR calls — the
 *    only difference is WHO is operating it and that a real staff identity is
 *    attached to the record, the audit event, and (for redemption)
 *    `consumedBy`.
 *
 * Forking a second form here would be the bug; the tier only ever changes the
 * `HelperAttribution` value handed to the EHR.
 */
export interface SignupOperator {
  staffId: string;
  staffName: string;
  role: string;
}

export interface SignupFlowProps {
  /** Present => Tier 2. Absent => Tier 1 public flow. */
  operator?: SignupOperator;
  /** Called after a successful create/claim. Owns navigation. */
  onComplete: (patient: Patient, mode: "created" | "claimed") => void;
}

/**
 * The single place the tier is decided. Tier 2 wins whenever a real operator
 * is present; otherwise the optional free-text name becomes a Tier 1 record,
 * or nothing at all when it's blank.
 */
function attributionFor(
  operator: SignupOperator | undefined,
  helperName: string,
): HelperAttribution | undefined {
  if (operator) {
    return {
      tier: 2,
      operatorStaffId: operator.staffId,
      operatorStaffName: operator.staffName,
      operatorRole: operator.role,
    };
  }
  return informalHelper(helperName);
}

/**
 * Tier 1 field — one optional box, on BOTH branches of the public flow.
 * Never validated, never required, never blocks submit. Hidden in Tier 2,
 * where the operator's real identity is already attached.
 */
function HelperField({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (v: string) => void;
  idPrefix: string;
}) {
  const { lang: screenLang } = useI18n();

  return (
    <div className="space-y-1.5 rounded-lg border bg-secondary/30 p-4">
      <Label htmlFor={`${idPrefix}-helper`} className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-teal" /> {HELPER_QUESTION}
        <span className="text-xs font-normal text-muted-foreground">{SCREEN_COPY["ui.b16c7ac6faff"][screenLang]}</span>
      </Label>
      <Textarea
        id={`${idPrefix}-helper`}
        rows={2}
        maxLength={120}
        placeholder={SCREEN_COPY["ui.1ea156667c3d"][screenLang]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{HELPER_HINT}</p>
    </div>
  );
}

/** Tier 2 — say out loud whose identity is being attached to this record. */
function OperatorBanner({ operator }: { operator: SignupOperator }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-teal/40 bg-teal/5 p-3 text-xs">
      <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
      <span className="text-muted-foreground">
        You're completing this on someone's behalf. It will be recorded under{" "}
        <span className="font-medium text-navy">{operator.staffName}</span> — including as the
        person who used the enrollment code.
      </span>
    </div>
  );
}

/**
 * §Front-door Phase 3 (groundwork) — one entry form, two real branches:
 * a brand-new self-service patient, or a Track A member claiming the record a
 * CF Care Manager already built for them with an `RE-XXXX-XXXX` code.
 *
 * The two-tier helper model (informal vs. authenticated staff operator) is NOT
 * built here; the branch state below is where it will hang off next.
 */
export function SignupFlow({ operator, onComplete }: SignupFlowProps) {
  const { lang: screenLang } = useI18n();

  const tier2 = Boolean(operator);
  const [branch, setBranch] = useState<null | "code" | "new">(null);

  if (branch === "new")
    return <NewPatientForm operator={operator} onComplete={onComplete} onBack={() => setBranch(null)} />;
  if (branch === "code")
    return <RedeemCodePanel operator={operator} onComplete={onComplete} onBack={() => setBranch(null)} />;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-teal/40 text-teal">
          {tier2 ? "Assisted sign-up — step 1" : screenLang === "es" ? "Paso 1 — para empezar" : "Step 1 — getting started"}
        </Badge>
        <h1 className="font-display mt-2 text-2xl text-navy">
          {tier2
            ? "Do they have a code from their CF Care Manager or care team?"
            : screenLang === "es" ? "¿Tienes un código de tu gestor de cuidado CF o de tu equipo?" : "Do you have a code from your CF Care Manager or care team?"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {SCREEN_COPY["ui.7105c6908765"][screenLang]} <span className="font-mono">{SCREEN_COPY["ui.c0c1e545c546"][screenLang]}</span> {SCREEN_COPY["ui.fa15eb95151c"][screenLang]} </p>
      </div>
      <div className="grid gap-2">
        <Button
          variant="outline"
          className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => setBranch("code")}
        >
          <span>
            <span className="block font-medium">{SCREEN_COPY["ui.67360c77312a"][screenLang]}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {SCREEN_COPY["ui.7ecfed131e0f"][screenLang]} </span>
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
          onClick={() => setBranch("new")}
        >
          <span>
            <span className="block font-medium">{SCREEN_COPY["ui.39549952ced9"][screenLang]}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {SCREEN_COPY["ui.d24ca1134cb1"][screenLang]} </span>
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
  const { lang: screenLang } = useI18n();

  return (
    <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
      <div className="flex items-start gap-3">
        <Phone className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
        <div>
          <div className="font-medium text-navy">{SCREEN_COPY["ui.86b603304409"][screenLang]}</div>
          <p className="mt-1 text-muted-foreground">
            {SCREEN_COPY["ui.458e8a0a6959"][screenLang]} </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/start/reconnect">{SCREEN_COPY["ui.69b82d3770fa"][screenLang]}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Code-redemption branch — claims an EXISTING patient record, never creates one. */
export function RedeemCodePanel({
  operator,
  onComplete,
  onBack,
}: SignupFlowProps & { onBack: () => void }) {
  const { lang: screenLang } = useI18n();

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"password" | "pin">("password");
  const [credential, setCredential] = useState("");
  const [credentialConfirm, setCredentialConfirm] = useState("");
  const [helperName, setHelperName] = useState("");
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
      assistedBy: attributionFor(operator, helperName),
    });
    onComplete(patient, "claimed");
  }

  const err = (k: keyof SignupErrors) =>
    errors[k] ? (
      <p className="text-xs text-attention" role="alert"><CircleAlert className="mr-1 inline size-4 shrink-0 align-text-bottom" aria-hidden="true" />
        {errors[k]}
      </p>
    ) : null;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-teal/40 text-teal">
          {SCREEN_COPY["ui.ea8c8ff054dd"][screenLang]} </Badge>
        <h1 className="font-display mt-2 flex items-center gap-2 text-2xl text-navy">
          <Ticket className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.96733a59c63e"][screenLang]} </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {SCREEN_COPY["ui.ffc4839c1d66"][screenLang]} </p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="redeem-form">
        <div className="space-y-1.5">
          <Label htmlFor="rc-code">{SCREEN_COPY["ui.adac69379a62"][screenLang]}</Label>
          <Input
            id="rc-code"
            value={code}
            autoComplete="one-time-code"
            placeholder={SCREEN_COPY["ui.c0c1e545c546"][screenLang]}
            className="font-mono uppercase"
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {!operator && (
          <HelperField value={helperName} onChange={setHelperName} idPrefix="rc" />
        )}
        {operator && <OperatorBanner operator={operator} />}

        {failure && (
          <div
            className="space-y-3 rounded-lg border-2 border-input bg-surface-sunk p-4 text-sm"
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
            <ShieldCheck className="h-4 w-4 text-teal" /> {SCREEN_COPY["ui.b2aa4590432d"][screenLang]} </div>
          <div className="space-y-1.5">
            <Label>{SCREEN_COPY["ui.9bccf7c30b02"][screenLang]}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "password" | "pin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">{SCREEN_COPY["ui.8be3c943b160"][screenLang]}</SelectItem>
                <SelectItem value="pin">{SCREEN_COPY["ui.809bd7550587"][screenLang]}</SelectItem>
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
              <Label htmlFor="rc-cred2">{SCREEN_COPY["ui.04a212215ef9"][screenLang]}</Label>
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
          {SCREEN_COPY["ui.2e02623966f9"][screenLang]} <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </form>

      <Button variant="ghost" className="px-0" onClick={onBack}>
        {SCREEN_COPY["ui.b52b36b7269f"][screenLang]} </Button>
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
function NewPatientForm({
  operator,
  onComplete,
  onBack,
}: SignupFlowProps & { onBack: () => void }) {
  const { lang: screenLang } = useI18n();

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
  const [signupHelp, setSignupHelp] = useState(false);
  const [existing, setExisting] = useState<{ ids: string[]; input: Record<string, unknown> } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateSignup(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Check the highlighted fields");
      return;
    }
    let created;
    const payload = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      dob: draft.dob,
      ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
      ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
      preferredLanguage: draft.preferredLanguage,
      // Metadata only — the password/PIN itself is intentionally discarded.
      signupCredential: credentialMeta(draft.credentialKind),
      signupAssistedBy: attributionFor(operator, draft.helperName ?? ""),
      ...(operator ? { matchSource: "assisted_signup" as const } : { matchSource: "self_signup" as const }),
    };
    try {
      created = AdelanteEHR.createPatient(payload as Parameters<typeof AdelanteEHR.createPatient>[0]);
    } catch (err) {
      // §Batch E — never reveal or confirm another record to an unverified person.
      if (err instanceof SignupNeedsVerificationError) { setSignupHelp(true); return; }
      if (err instanceof PossibleExistingPatientError) { setExisting({ ids: err.matches.map((m) => m.patientId), input: payload }); return; }
      throw err;
    }
    // Tier 2 runs on a staff device: never switch the staff member's UI
    // language to the patient's preference.
    if (!operator) setLang(draft.preferredLanguage);
    onComplete(created, "created");
  }

  const err = (k: keyof SignupInput) =>
    errors[k] ? (
      <p className="text-xs text-attention" role="alert"><CircleAlert className="mr-1 inline size-4 shrink-0 align-text-bottom" aria-hidden="true" />
        {errors[k]}
      </p>
    ) : null;

  if (signupHelp) return <SignupVerificationHelp onBack={() => setSignupHelp(false)} />;
  if (existing && operator)
    return (
      <ExistingPersonStep
        operator={operator}
        existingIds={existing.ids}
        input={existing.input}
        onBack={() => setExisting(null)}
        onCreated={(p) => { setExisting(null); onComplete(p, "created"); }}
      />
    );
  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-teal/40 text-teal">
          {SCREEN_COPY["ui.a776fc05eea2"][screenLang]} </Badge>
        <h1 className="font-display mt-2 text-2xl text-navy">{SCREEN_COPY["ui.4046b5818208"][screenLang]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {SCREEN_COPY["ui.77a1390f4f27"][screenLang]} </p>
      </div>

      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="su-first">{SCREEN_COPY["ui.7e568a90221d"][screenLang]}</Label>
            <Input
              id="su-first"
              className={errors.firstName ? "border-2 border-input" : undefined}
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
            {err("firstName")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-last">{SCREEN_COPY["ui.adec36a821f8"][screenLang]}</Label>
            <Input
              id="su-last"
              className={errors.lastName ? "border-2 border-input" : undefined}
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
            {err("lastName")}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="su-dob">{SCREEN_COPY["ui.9518425f4174"][screenLang]}</Label>
          <Input
            id="su-dob"
            className={errors.dob ? "border-2 border-input" : undefined}
              type="date"
            autoComplete="bday"
            value={draft.dob}
            onChange={(e) => set("dob", e.target.value)}
          />
          {err("dob")}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="su-phone">{SCREEN_COPY["ui.77064d526523"][screenLang]}</Label>
            <Input
              id="su-phone"
              className={errors.phone ? "border-2 border-input" : undefined}
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 555 0123"
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            {err("phone")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-email">{SCREEN_COPY["ui.84add5b29527"][screenLang]}</Label>
            <Input
              id="su-email"
              className={errors.email ? "border-2 border-input" : undefined}
              type="email"
              autoComplete="email"
              placeholder={SCREEN_COPY["ui.50e2b46ef877"][screenLang]}
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
            />
            {err("email")}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {SCREEN_COPY["ui.c3cfdb17ef1e"][screenLang]} </p>

        {!operator && (
          <HelperField
            value={draft.helperName ?? ""}
            onChange={(v) => set("helperName", v)}
            idPrefix="su"
          />
        )}
        {operator && <OperatorBanner operator={operator} />}

        <div className="space-y-1.5">
          <Label>{SCREEN_COPY["ui.89b86ab0e66f"][screenLang]}</Label>
          <Select
            value={draft.preferredLanguage}
            onValueChange={(v) => set("preferredLanguage", v as "en" | "es")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{SCREEN_COPY["ui.649df08a448e"][screenLang]}</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-lg border bg-secondary/40 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-navy">
            <ShieldCheck className="h-4 w-4 text-teal" /> {SCREEN_COPY["ui.b2aa4590432d"][screenLang]} </div>
          <div className="space-y-1.5">
            <Label>{SCREEN_COPY["ui.9bccf7c30b02"][screenLang]}</Label>
            <Select
              value={draft.credentialKind}
              onValueChange={(v) => set("credentialKind", v as "password" | "pin")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">{SCREEN_COPY["ui.8be3c943b160"][screenLang]}</SelectItem>
                <SelectItem value="pin">{SCREEN_COPY["ui.809bd7550587"][screenLang]}</SelectItem>
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
              <Label htmlFor="su-cred2">{SCREEN_COPY["ui.04a212215ef9"][screenLang]}</Label>
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
          {SCREEN_COPY["ui.aaf374479756"][screenLang]} <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </form>

      <Button variant="ghost" className="px-0" onClick={onBack}>
        {SCREEN_COPY["ui.b52b36b7269f"][screenLang]} </Button>
    </Card>
  );
}
