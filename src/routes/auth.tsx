import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { HealthieService, useHealthie } from "@/lib/healthie";
import { useI18n } from "@/lib/i18n";
import { Sparkles, ShieldCheck, ArrowRight, UserIcon } from "lucide-react";
import { User } from "lucide-react";
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const patients = useHealthie(() => HealthieService.listPatients());
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [pickedId, setPickedId] = useState<string>(patients[0]?.id ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedId) {
      toast.error("Pick a person to continue");
      return;
    }
    HealthieService.setCurrentPatientId(pickedId);
    try {
      if (remember) {
        localStorage.setItem("adelante.session", JSON.stringify({ patientId: pickedId, email }));
      } else {
        sessionStorage.setItem("adelante.session", JSON.stringify({ patientId: pickedId, email }));
      }
    } catch { /* no-op */ }
    toast.success(mode === "signin" ? "Welcome back" : "Account created");
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
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
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
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="rounded-md border bg-secondary/40 p-3 space-y-2">
            <div className="text-xs font-medium text-navy">{t("authPickPerson")}</div>
            <div className="grid gap-1.5">
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
                      (p.intakeCompletedAt ? "border-teal/40 text-teal" : "border-gold/50 text-navy")
                    }
                  >
                    {p.intakeCompletedAt ? "intake ✓" : "new"}
                  </Badge>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">{t("authDemoNote")}</p>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(Boolean(v))}
            />
            Remember me on this device
          </label>

          <Button
            type="submit"
            className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
          >
            {t("authContinue")} <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-xs text-teal hover:underline"
          >
            {mode === "signin" ? t("authSwitchToSignUp") : t("authSwitchToSignIn")}
          </button>

          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 pt-2">
            <ShieldCheck className="h-3 w-3 text-teal" /> HIPAA · 42 CFR Part 2
          </p>
        </form>
      </Card>
    </div>
  );
}