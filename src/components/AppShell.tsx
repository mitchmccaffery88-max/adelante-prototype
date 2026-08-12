import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { PatientHelpLink } from "@/components/PatientHelpLink";
import { MobileNav } from "@/components/MobileNav";
import { InstallAppButton } from "@/components/InstallAppButton";
import { NotificationBell } from "@/components/NotificationBell";
import { ShieldCheck, UserCog, ChevronDown, User as UserIcon, Phone, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { STAFF_ROSTER, STAFF_ROLES, useActingStaff } from "@/lib/roles";
import {
  useStaffNavGroups,
  STAFF_ROUTES,
  PATIENT_NAV,
  PATIENT_ROUTES,
  patientNavForPopulation,
  PUBLIC_NAV,
  isPublicRoute,
} from "@/lib/navSections";
import { usePopulation } from "@/components/PopulationGate";
import { StaffNavSidebar } from "@/components/StaffNavSidebar";
import { PatientSidebar } from "@/components/PatientSidebar";
import { CrisisHeader } from "@/components/patient/CrisisHeader";
import { CravingFab } from "@/components/patient/CravingFab";
import { StaffBreadcrumbs } from "@/components/StaffBreadcrumbs";
import { DemoStateSwitcher } from "@/components/DemoStateSwitcher";
import { RouteAccessGuard } from "@/components/RouteAccessGuard";
import { useReminderSweep } from "@/hooks/useReminderSweep";
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
  // §Reminders — client-side approximation of a scheduler: due reminders are
  // swept while the app is open. NOT a background service; production needs a
  // server-side scheduled job. See src/hooks/useReminderSweep.ts.
  useReminderSweep();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const population = usePopulation(currentId);
  // Restore the acting patient after a hard reload. Only ever accepts an id
  // that still exists (runtime-created demo records do not survive a reload),
  // and runs in an effect so SSR and hydration agree on the first paint.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem("adelante.currentPatientId");
    } catch {
      stored = null;
    }
    if (!stored || stored === AdelanteEHR.getCurrentPatientId()) return;
    if (!AdelanteEHR.getPatient(stored)) {
      try {
        window.localStorage.removeItem("adelante.currentPatientId");
      } catch {
        /* ignore */
      }
      return;
    }
    AdelanteEHR.setCurrentPatientId(stored);
  }, []);
  const { staffId, setActingStaff } = useActingStaff();
  // §Platform nav — every staff link comes from the RBAC nav engine, so a
  // role that fails a gate never sees the entry (same rule as recordSections).
  const staffNavGroups = useStaffNavGroups();
  const staffNav = staffNavGroups.flatMap((g) => g.entries);
  const signedIn = (() => {
    try {
      return Boolean(localStorage.getItem("adelante.session"));
    } catch {
      return false;
    }
  })();

  // Surfaces where the patient-facing UI should feel private:
  // hide the staff link strip in the mobile nav (still reachable via the
  // Staff dropdown on desktop).
  const isPatientSurface = PATIENT_ROUTES.includes(pathname as (typeof PATIENT_ROUTES)[number]);
  // §Landing nav — public, pre-sign-in surfaces get their own minimal nav.
  const isPublicSurface = !isPatientSurface && isPublicRoute(pathname);
  // The intake route renders its own crisis card; avoid a second 988 banner.
  const showCrisisBanner = pathname !== "/intake" && !isPatientSurface;

  // §Platform nav Phase 4 — desktop strip reads the shared patient registry so
  // it can never drift from the mobile tab bar again.
  // Population-gated entries (e.g. Obligations) are omitted for a general
  // population patient rather than linking into a section that gates itself.
  const patientNav = patientNavForPopulation(PATIENT_NAV, population.track);
  // Staff shell = persistent sidebar on any staff-owned route (plus the
  // full-page chart, which is staff-only too).
  const showStaffShell =
    !isPatientSurface &&
    (STAFF_ROUTES.includes(pathname) || pathname.startsWith("/record/")) &&
    staffNav.length > 0;

  return (
    <div className={cn("min-h-dvh flex flex-col", isPatientSurface && "patient-theme")}>
      <RouteAccessGuard />
      {/* Demo scenario control — fixed to the viewport so it is reachable at
          any height, not buried in the footer. */}
      <DemoStateSwitcher />
      {isPatientSurface && <CrisisHeader />}
      <header
        className={cn(
          "z-30 border-b bg-background/85 backdrop-blur",
          !isPatientSurface && "sticky top-0",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link
            to="/"
            className={cn("flex items-center gap-2 group", isPatientSurface && "hidden")}
          >
            <span className="h-8 w-8 rounded-lg bg-navy text-navy-foreground grid place-items-center font-display text-lg leading-none">
              A
            </span>
            <span className="font-display text-xl text-navy">{t("appName")}</span>
          </Link>

          {/* §Patient portal Build 1 — on patient surfaces the top strip is
              replaced by the persistent left sidebar. */}
          <nav
            className={cn(
              "items-center gap-1 ml-4",
              isPatientSurface ? "hidden" : "hidden md:flex",
            )}
          >
            {isPublicSurface
              ? PUBLIC_NAV.map((n) => (
                  <Link
                    key={n.id}
                    to={n.to}
                    hash={n.hash}
                    className="px-3 py-2 rounded-md text-sm font-medium text-foreground/70 transition-colors hover:text-foreground hover:bg-secondary"
                  >
                    {n.label}
                  </Link>
                ))
              : patientNav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.id}
                  to={n.to}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-navy text-navy-foreground"
                      : "text-foreground/70 hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {t(n.labelKey as Parameters<typeof t>[0])}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {isPublicSurface && (
              <Link
                to="/start"
                className="hidden sm:inline-flex items-center rounded-md bg-navy px-3 py-2 text-sm font-medium text-navy-foreground transition-colors hover:bg-navy/90"
              >
                Get started
              </Link>
            )}
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-teal" />
              HIPAA · 42 CFR Part 2
            </div>
            <div className="rounded-full bg-secondary p-0.5 flex text-xs">
              <button
                onClick={() => setLang("en")}
                aria-label="Switch language to English"
                aria-pressed={lang === "en"}
                className={cn(
                  "min-h-[44px] min-w-[44px] px-2.5 py-1 rounded-full transition-colors",
                  lang === "en" ? "bg-navy text-navy-foreground" : "text-foreground/60",
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLang("es")}
                aria-label="Cambiar idioma a español"
                aria-pressed={lang === "es"}
                className={cn(
                  "min-h-[44px] min-w-[44px] px-2.5 py-1 rounded-full transition-colors",
                  lang === "es" ? "bg-navy text-navy-foreground" : "text-foreground/60",
                )}
              >
                ES
              </button>
            </div>

            {isPatientSurface && <PatientHelpLink className="hidden sm:inline-flex" />}

            {/* §Notification feed — operational alerts for the acting staff identity. */}
            <NotificationBell />

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
                <div className="max-h-[60vh] overflow-y-auto">
                  {staffNavGroups.map((g) => (
                    <div key={g.group}>
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {g.label}
                      </DropdownMenuLabel>
                      {g.entries.map((s) => (
                        <DropdownMenuItem key={s.id} asChild>
                          <Link to={s.to} className="flex items-start gap-2">
                            <s.icon className="h-4 w-4 text-teal mt-0.5" />
                            <span>
                              <span className="block text-sm font-medium">{s.label}</span>
                              <span className="block text-xs text-muted-foreground">{s.desc}</span>
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </div>
                <DropdownMenuLabel className="mt-2 text-xs text-muted-foreground">
                  Acting as
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={staffId} onValueChange={(v) => setActingStaff(v)}>
                  {STAFF_ROSTER.map((s) => (
                    <DropdownMenuRadioItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                      <span className="ml-1 text-muted-foreground">
                        · {STAFF_ROLES.find((r) => r.key === s.role)?.label ?? s.role}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Account menu — sign in/out only. Persona switcher moved to footer. */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-2.5 py-1 min-h-[44px] text-xs font-medium text-navy hover:bg-navy/10">
                <span className="h-6 w-6 rounded-full bg-navy text-navy-foreground grid place-items-center text-[10px]">
                  {patient?.firstName?.[0] ?? "?"}
                </span>
                <span className="hidden sm:inline">
                  {signedIn && patient
                    ? `${patient.firstName} ${patient.lastName}`
                    : t("navSignIn")}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {signedIn ? (
                  <DropdownMenuItem
                    onClick={() => {
                      try {
                        localStorage.removeItem("adelante.session");
                      } catch {
                        /* no-op */
                      }
                      navigate({ to: "/auth" });
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> {t("authSignOut")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/auth">
                      <UserIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{" "}
                      {t("navSignIn")}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav — staff links only; patient nav lives in the bottom tab bar. */}
        {!isPatientSurface && !isPublicSurface && (
          <div className="md:hidden border-t overflow-x-auto">
            <div className="flex gap-1 px-3 py-2 min-w-max">
              {staffNav.map((n) => {
                const Icon = n.icon;
                const active = pathname === n.to;
                return (
                  <Link
                    key={n.id}
                    to={n.to}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap min-h-[44px]",
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
        )}
      </header>

      <main className={cn("flex-1", isPatientSurface && "pb-24 md:pb-0")}>
        {isPatientSurface ? (
          <div className="flex min-h-full">
            <PatientSidebar />
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
          </div>
        ) : showStaffShell ? (
          <div className="flex min-h-full">
            <StaffNavSidebar />
            <div className="min-w-0 flex-1">
              <StaffBreadcrumbs />
              <Outlet />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Persistent 988 crisis banner — §4c safety net */}
      {showCrisisBanner && (
        <div
          role="region"
          aria-label="Crisis support"
          className={cn(
            "sticky z-50 border-t border-destructive/30 bg-destructive/5 backdrop-blur",
            // On mobile patient surfaces, sit above the fixed bottom tab bar
            // so the 988 link is never obscured. Reset on md+ where the
            // MobileNav is hidden.
            isPatientSurface
              ? "bottom-[calc(env(safe-area-inset-bottom)+56px)] md:bottom-0"
              : "bottom-0",
          )}
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
        </div>
      )}

      <footer className={cn("border-t bg-secondary/40", isPatientSurface && "pb-20 md:pb-0")}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Adelante · Tulare County Pilot · Built with care</span>
          <div className="flex items-center gap-3">
            {isPatientSurface && <InstallAppButton />}
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal" />
              Demo data · no real PHI
            </span>
            <span className="text-[10px] text-muted-foreground">
              Demo scenarios · top-right control
            </span>
          </div>
        </div>
      </footer>

      {isPatientSurface && <MobileNav />}
      {isPatientSurface && <CravingFab />}
    </div>
  );
}
