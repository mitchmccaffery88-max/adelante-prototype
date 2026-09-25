import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { PatientHelpLink } from "@/components/PatientHelpLink";
import { InstallAppButton } from "@/components/InstallAppButton";
import { NotificationBell } from "@/components/NotificationBell";
import { ShieldCheck, UserCog, ChevronDown, User as UserIcon, Phone, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { STAFF_ROSTER, STAFF_ROLES, useActingStaff } from "@/lib/roles";
import {
  useStaffNavGroups,
  STAFF_ROUTES,
  PATIENT_ROUTES,
  PUBLIC_NAV,
  isPublicRoute,
  isAdvocateRoute,
} from "@/lib/navSections";
import { StaffNavSidebar } from "@/components/StaffNavSidebar";
import { PatientSidebar } from "@/components/PatientSidebar";
import { AdvocateSidebar } from "@/components/AdvocateSidebar";
import { UserNavigationDrawer } from "@/components/UserNavigationDrawer";

import { CrisisHeader } from "@/components/patient/CrisisHeader";
import { CravingFab } from "@/components/patient/CravingFab";
import { StaffBreadcrumbs } from "@/components/StaffBreadcrumbs";
import { AdvocateContextSwitch } from "@/components/ContextSwitcher";
import { DemoControlsBar } from "@/components/DemoControlsBar";
import { RouteAccessGuard } from "@/components/RouteAccessGuard";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { needsFirstIntake, isOnboardingComplete } from "@/lib/onboarding";
import { recoveryJourneyVisible } from "@/lib/seeking";
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
  const {
    staffId,
    setActingStaff,
    role: actingRole,
    staffName: actingStaffName,
  } = useActingStaff();
  const actingRoleLabel = STAFF_ROLES.find((r) => r.key === actingRole)?.label ?? actingRole;
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

  // Patient detail routes inherit the same shell as direct nav destinations.
  const isPatientSurface =
    PATIENT_ROUTES.includes(pathname as (typeof PATIENT_ROUTES)[number]) ||
    pathname.startsWith("/rescreen/") ||
    pathname.startsWith("/resources/") ||
    pathname === "/next-steps" ||
    pathname === "/consent" ||
    pathname === "/safety-check";
  // §Landing nav — public, pre-sign-in surfaces get their own minimal nav.
  const isPublicSurface = !isPatientSurface && isPublicRoute(pathname);
  // §Advocate Access Redesign Phase 1 — advocate surfaces are their own shell.
  // Without this branch `/advocate` fell through to the PATIENT registry.
  const isAdvocateSurface = !isPatientSurface && isAdvocateRoute(pathname);
  // The intake route renders its own crisis card; avoid a second 988 banner.
  const showCrisisBanner = pathname !== "/intake" && !isPatientSurface;
  // §Onboarding rework — before the first intake is submitted the patient
  // shell is slim: no sidebar, tab bar, staff menu or notifications. Only the
  // language toggle, the account menu and the 988 path remain.
  const onboarding = isPatientSurface && needsFirstIntake(patient);
  const showCraving =
    isPatientSurface && isOnboardingComplete(patient) && recoveryJourneyVisible(patient);

  // §Staff nav leak fix — a staff-owned route is neither patient nor public,
  // so the desktop strip used to fall through to the PATIENT registry. Staff
  // surfaces navigate via the left sidebar / Staff dropdown instead.
  const isStaffSurface =
    !isPatientSurface &&
    !isPublicSurface &&
    !isAdvocateSurface &&
    (STAFF_ROUTES.includes(pathname) ||
      pathname.startsWith("/record/") ||
      // §Pre-release pipeline — the roster import is a staff-owned bulk action
      // hung off the pre-release page, deliberately not its own nav entry, so
      // it has to be named here or the shell falls through to patient nav.
      pathname === "/pre-release-import" ||
      // §Agentic Roadmap prototype screens are staff-owned clinical demos.
      pathname.startsWith("/agentic/"));

  // Staff shell = persistent sidebar on any staff-owned route (plus the
  // full-page chart, which is staff-only too).
  const showStaffShell = isStaffSurface && staffNav.length > 0;

  return (
    <div className={cn("min-h-dvh flex flex-col", (isPatientSurface || isAdvocateSurface) && "patient-theme")}>
      {!isPublicSurface && <RouteAccessGuard />}
      {isPatientSurface && <OnboardingGuard />}
      {/* Demo scenario control — sticky at the viewport top so it is reachable at
          any height, not buried in the footer. */}
      <DemoControlsBar />
      {isPatientSurface && (
        <div className="sticky top-10 z-50 flex items-center border-b bg-surface-elevated/95 px-3 backdrop-blur md:block md:border-b-0 md:bg-transparent md:px-0">
          {!onboarding && <UserNavigationDrawer mode="patient" />}
          <div className="min-w-0 flex-1"><CrisisHeader /></div>
        </div>
      )}
      <header
        className={cn(
          "z-30 border-b bg-background/85 backdrop-blur",
          !isPatientSurface && "sticky top-10",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-4">
          {isAdvocateSurface && <UserNavigationDrawer mode="advocate" />}
          <Link
            to="/"
            className={cn("flex items-center gap-2 group", isPatientSurface && "hidden")}
          >
            <span className="h-8 w-8 rounded-lg bg-navy text-navy-foreground grid place-items-center font-display text-lg leading-none">
              A
            </span>
            <span className="font-display text-xl text-navy">{t("appName")}</span>
          </Link>

          {/* Public pages keep their informational links. Patient, advocate,
              and staff navigation live in their own sidebars/drawers. */}
          <nav
            className={cn(
              "items-center gap-1 ml-4",
              isPatientSurface || isStaffSurface || isAdvocateSurface ? "hidden" : "hidden md:flex",
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
                : null}
          </nav>

          <div className="ml-auto flex items-center gap-2 min-w-0">
            {/* B10 — who the staff user is acting as, always visible. */}
            {isStaffSurface && (
              <div
                data-testid="acting-role-indicator"
                className="hidden sm:block min-w-0 max-w-xs rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-[11px] leading-tight text-navy"
                title={`Acting as: ${actingRoleLabel} · ${actingStaffName}`}
              >
                <span className="text-muted-foreground">Acting as: </span>
                <span className="font-semibold">{actingRoleLabel}</span>
                <span> · {actingStaffName}</span>
              </div>
            )}
            {isPublicSurface && (
              <Link
                to="/start/signup"
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

            {isPatientSurface && !onboarding && <PatientHelpLink className="hidden sm:inline-flex" />}

            {/* §Notification feed — operational alerts for the acting staff identity. */}
            {(isPatientSurface || isAdvocateSurface || isStaffSurface) && !onboarding && <NotificationBell />}

            {/* Staff portal belongs only to staff pages. */}
            {isStaffSurface && <DropdownMenu>
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
            </DropdownMenu>}

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

        {isStaffSurface && (
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
        {/* B10 — phones: the role gets its own full-width line so it stays readable. */}
        {isStaffSurface && (
          <div
            data-testid="acting-role-indicator-mobile"
            className="sm:hidden border-t bg-teal/10 px-4 py-1 text-[11px] text-navy truncate"
          >
            <span className="text-muted-foreground">Acting as: </span>
            <span className="font-semibold">{actingRoleLabel}</span> · {actingStaffName}
          </div>
        )}
      </header>

      <main className="flex-1">
        {isPatientSurface ? (
          <div className="flex min-h-full">
            {!onboarding && <PatientSidebar />}
            <div className="min-w-0 flex-1">
              {/* §Advocate Build 2 item 3 — persistent, visible switch to the
                  advocate shell whenever an advocate session also exists. */}
              <div className="px-4 pt-4 sm:px-6 empty:hidden">
                <AdvocateContextSwitch />
              </div>
              <Outlet />
            </div>
          </div>
        ) : isAdvocateSurface ? (
          /* §Phase 2 correction — advocating swaps the rail wholesale: the
             patient sidebar is never rendered alongside it. */
          <div className="flex min-h-full">
            <AdvocateSidebar />
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
            "bottom-0",
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

      <footer className="border-t bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Adelante&nbsp; · Built with care</span>
          <div className="flex items-center gap-3">
            {isPatientSurface && <InstallAppButton />}
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal" />
              Demo data · no real PHI
            </span>
            {!isPublicSurface && (
              <span className="text-[10px] text-muted-foreground">
                Demo scenarios · top-right control
              </span>
            )}
          </div>
        </div>
      </footer>

      {showCraving && <CravingFab />}
    </div>
  );
}
