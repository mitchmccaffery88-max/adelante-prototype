import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import {
  Heart,
  ShieldCheck,
  Calendar,
  ClipboardList,
  FileInput,
  LayoutDashboard,
  UserCog,
  ChevronDown,
  User as UserIcon,
  Phone,
  HandHeart,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export function AppShell() {
  const { lang, setLang, t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const signedIn = (() => {
    try { return Boolean(localStorage.getItem("adelante.session")); } catch { return false; }
  })();

  // Surfaces where the patient-facing UI should feel private:
  // hide the staff link strip in the mobile nav (still reachable via the
  // Staff dropdown on desktop).
  const isPatientSurface = pathname === "/home" || pathname === "/intake" || pathname === "/schedule";
  // The intake route renders its own crisis card; avoid a second 988 banner.
  const showCrisisBanner = pathname !== "/intake";

  const patientNav = [
    { to: "/home" as const, label: t("navMyCare"), icon: Heart },
    { to: "/intake" as const, label: t("navIntake"), icon: ClipboardList },
  ];
  const staffNav = [
    { to: "/referral" as const, label: t("navReferrals"), icon: FileInput, desc: "Refer a client" },
    { to: "/case-manager" as const, label: t("navCaseManager"), icon: HandHeart, desc: "Check-ins & resources" },
    { to: "/clinician" as const, label: t("navClinician"), icon: Calendar, desc: "Caseload & sessions" },
    { to: "/admin" as const, label: t("navAdmin"), icon: LayoutDashboard, desc: "Pilot dashboard" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="h-8 w-8 rounded-lg bg-navy text-navy-foreground grid place-items-center font-display text-lg leading-none">
              A
            </span>
            <span className="font-display text-xl text-navy">{t("appName")}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {patientNav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-navy text-navy-foreground"
                      : "text-foreground/70 hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-teal" />
              HIPAA · 42 CFR Part 2
            </div>
            <div className="rounded-full bg-secondary p-0.5 flex text-xs">
              <button
                onClick={() => setLang("en")}
                className={cn(
                  "px-2.5 py-1 rounded-full transition-colors",
                  lang === "en" ? "bg-navy text-navy-foreground" : "text-foreground/60",
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLang("es")}
                className={cn(
                  "px-2.5 py-1 rounded-full transition-colors",
                  lang === "es" ? "bg-navy text-navy-foreground" : "text-foreground/60",
                )}
              >
                ES
              </button>
            </div>

            {/* Staff portal */}
            <DropdownMenu>
              <DropdownMenuTrigger className="hidden sm:inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary">
                <UserCog className="h-3.5 w-3.5 text-teal" />
                {t("navStaff")}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t("navStaffPortal")}
                </DropdownMenuLabel>
                {staffNav.map((s) => (
                  <DropdownMenuItem key={s.to} asChild>
                    <Link to={s.to} className="flex items-start gap-2">
                      <s.icon className="h-4 w-4 text-teal mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium">{s.label}</span>
                        <span className="block text-xs text-muted-foreground">{s.desc}</span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Account menu — sign in/out only. Persona switcher moved to footer. */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy hover:bg-navy/10">
                <span className="h-6 w-6 rounded-full bg-navy text-navy-foreground grid place-items-center text-[10px]">
                  {patient?.firstName?.[0] ?? "?"}
                </span>
                <span className="hidden sm:inline">
                  {signedIn && patient ? `${patient.firstName} ${patient.lastName}` : t("navSignIn")}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {signedIn ? (
                  <DropdownMenuItem
                    onClick={() => {
                      try { localStorage.removeItem("adelante.session"); } catch { /* no-op */ }
                      navigate({ to: "/auth" });
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> {t("authSignOut")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/auth">
                      <UserIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> {t("navSignIn")}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t overflow-x-auto">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {patientNav.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                    active
                      ? "bg-navy text-navy-foreground"
                      : "text-foreground/70 bg-secondary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {n.label}
                </Link>
              );
            })}
            {!isPatientSurface && (
              <span className="mx-1 self-center text-muted-foreground/50">·</span>
            )}
            {!isPatientSurface && staffNav.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                    active
                      ? "bg-navy text-navy-foreground"
                      : "text-foreground/60 border border-dashed",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Persistent 988 crisis banner — §4c safety net */}
      {showCrisisBanner && <div
        role="region"
        aria-label="Crisis support"
        className="sticky bottom-0 z-30 border-t border-destructive/30 bg-destructive/5 backdrop-blur"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center gap-2 text-xs sm:text-sm">
          <Phone className="h-4 w-4 text-destructive shrink-0" />
          <span>
            <span className="font-semibold text-destructive">{t("crisisInCrisis")}</span>{" "}
            {t("crisisCallText")}{" "}
            <a href="tel:988" className="underline font-semibold">
              988
            </a>{" "}
            {t("crisisAnytime")}
          </span>
        </div>
      </div>}

      <footer className="border-t bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>
            © {new Date().getFullYear()} Adelante · Tulare County Pilot · Built with care
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal" />
              Demo data · no real PHI
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[10px] text-foreground/70 hover:bg-secondary">
                Demo · switch patient
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Demo control · resets on reload
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={currentId}
                  onValueChange={(v) => AdelanteEHR.setCurrentPatientId(v)}
                >
                  {patients.map((p) => (
                    <DropdownMenuRadioItem key={p.id} value={p.id} className="text-sm">
                      <UserIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      <span className="flex-1">
                        {p.firstName} {p.lastName}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] rounded-full px-1.5 py-0.5",
                          p.intakeCompletedAt
                            ? "bg-teal/15 text-teal"
                            : "bg-gold/20 text-navy",
                        )}
                      >
                        {p.intakeCompletedAt ? "intake ✓" : "new"}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </footer>
    </div>
  );
}
