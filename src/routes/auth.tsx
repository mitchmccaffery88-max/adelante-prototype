import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import { Sparkles, ShieldCheck, ArrowRight, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Adelante" },
      {
        name: "description",
        content: "Sign in to Adelante to access your care plan, sessions, and goals.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, setLang } = useI18n();
  const navigate = useNavigate();
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pickedId, setPickedId] = useState<string>(patients[0]?.id ?? "");
  // Signup state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [lang, setLangPref] = useState<"en" | "es">("en");

  const persist = (patientId: string) => {
    try {
      const payload = JSON.stringify({ patientId, email });
      if (remember) localStorage.setItem("adelante.session", payload);
      else sessionStorage.setItem("adelante.session", payload);
    } catch {
      /* no-op */
    }
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedId) {
      toast.error("Pick a person to continue");
      return;
    }
    AdelanteEHR.setCurrentPatientId(pickedId);
    persist(pickedId);
    toast.success("Welcome back");
    navigate({ to: "/home" });
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    const created = AdelanteEHR.createPatient({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dob || undefined,
      phone: phone || undefined,
      preferredLanguage: lang,
    });
    AdelanteEHR.setCurrentPatientId(created.id);
    persist(created.id);
    setLang(lang);
    toast.success("Account created", {
      description: "Next: complete your intake.",
    });
    navigate({ to: "/home" });
  };

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-10">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal/15 text-teal px-3 py-1 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> {t("authWelcome")}
        </div>
        <h1 className="font-display text-3xl text-navy mt-3">
          {mode === "signin" ? t("authSignInTitle") : t("authSignUpTitle")}
        </h1>
        {mode === "signup" && (
          <p className="text-xs text-muted-foreground mt-1">{t("authNewSignupCaption")}</p>
        )}
      </div>

      <Card className="p-6">
        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("authEmail")}</Label>
              <Input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("authPassword")}</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="rounded-md border bg-secondary/40 p-3 space-y-2">
              <div className="text-xs font-medium text-navy">{t("authDemoPersonas")}</div>
              <p className="text-[10px] text-muted-foreground">{t("authDemoPersonasNote")}</p>
              <div className="grid gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {patients.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 rounded-md border bg-card p-2 text-sm cursor-pointer hover:border-teal"
                  >
                    <input
                      type="radio"
                      name="persona"
                      checked={pickedId === p.id}
                      onChange={() => setPickedId(p.id)}
                      className="accent-teal"
                    />
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">
                      {p.firstName} {p.lastName}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        "text-[10px] " +
                        (p.intakeCompletedAt
                          ? "border-teal/40 text-teal"
                          : "border-gold/50 text-navy")
                      }
                    >
                      {p.intakeCompletedAt ? "intake ✓" : "new"}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
              Remember me on this device
            </label>

            <Button
              type="submit"
              className="w-full min-h-11 bg-navy text-navy-foreground hover:bg-navy/90"
            >
              {t("authContinue")} <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("authFirstName")}</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("authLastName")}</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("authDob")}</Label>
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                autoComplete="bday"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("authPhone")}</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 555 0123"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("authLanguage")}</Label>
              <Select value={lang} onValueChange={(v) => setLangPref(v as "en" | "es")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full min-h-11 bg-teal text-teal-foreground hover:bg-teal/90"
            >
              {t("authCreateAccount")} <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">{t("authResetsNote")}</p>
          </form>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-xs text-teal hover:underline"
        >
          {mode === "signin" ? t("authSwitchToSignUp") : t("authSwitchToSignIn")}
        </button>

        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 pt-2">
          <ShieldCheck className="h-3 w-3 text-teal" /> HIPAA · 42 CFR Part 2
        </p>
      </Card>
    </div>
  );
}
