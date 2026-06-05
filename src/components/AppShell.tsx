import { Link, Outlet, useRouterState } from "@tanstack/react-router";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HealthieService, useHealthie } from "@/lib/healthie";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const patientNav = [
  { to: "/home", label: "My care", icon: Heart },
  { to: "/intake", label: "Intake", icon: ClipboardList },
] as const;

const staffNav = [
  { to: "/referral", label: "Referrals", icon: FileInput, desc: "Refer a client" },
  { to: "/clinician", label: "Clinician", icon: Calendar, desc: "Caseload & sessions" },
  { to: "/admin", label: "Admin", icon: LayoutDashboard, desc: "Pilot dashboard" },
] as const;

export function AppShell() {
  const { lang, setLang, t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentId = useHealthie(() => HealthieService.getCurrentPatientId());
  const patient = useHealthie(() => HealthieService.getPatient(currentId));
  const patients = useHealthie(() => HealthieService.listPatients());

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
                Staff
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Staff portal
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

            {/* Demo patient switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy hover:bg-navy/10">
                <span className="h-6 w-6 rounded-full bg-navy text-navy-foreground grid place-items-center text-[10px]">
                  {patient?.firstName?.[0] ?? "?"}
                </span>
                <span className="hidden sm:inline">
                  {patient ? `${patient.firstName} ${patient.lastName}` : "Sign in"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Demo · switch patient
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={currentId}
                  onValueChange={(v) => HealthieService.setCurrentPatientId(v)}
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
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal">
                  Demo control: real builds will derive this from the auth session.
                </DropdownMenuLabel>
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
            <span className="mx-1 self-center text-muted-foreground/50">·</span>
            {staffNav.map((n) => {
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

      <footer className="border-t bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>
            © {new Date().getFullYear()} Adelante · Kings County Pilot · Built with care
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal" />
            Healthie sandbox · mocked
          </span>
        </div>
      </footer>
    </div>
  );
}
