import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  HandHeart,
  Calendar,
  FileInput,
  FileCheck,
  Receipt,
  BarChart3,
  Settings,
  ShieldAlert,
  ChevronDown,
  UserCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EMR, ROLES, useEMR, type Role } from "@/lib/emr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Role[] };

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["patient", "case_manager", "peer_specialist", "therapist", "pmhnp", "billing", "sys_admin", "referral_submitter"] },
  { to: "/patients", label: "Patients", icon: Users, roles: ["case_manager", "peer_specialist", "therapist", "pmhnp"] },
  { to: "/caseload", label: "My caseload", icon: HandHeart, roles: ["case_manager", "peer_specialist"] },
  { to: "/referrals", label: "Referrals & intake", icon: FileInput, roles: ["case_manager"] },
  { to: "/schedule", label: "Schedule", icon: Calendar, roles: ["case_manager", "peer_specialist", "therapist", "pmhnp"] },
  { to: "/documents", label: "Documents to verify", icon: FileCheck, roles: ["case_manager", "therapist", "pmhnp"] },
  { to: "/billing", label: "Billing & claims", icon: Receipt, roles: ["billing", "sys_admin"] },
  { to: "/population", label: "Population health", icon: BarChart3, roles: ["sys_admin", "billing"] },
  { to: "/admin", label: "Admin", icon: Settings, roles: ["sys_admin"] },
  { to: "/referral-portal", label: "Referral portal (external)", icon: ExternalLink, roles: ["referral_submitter"] },
];

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = useEMR((s) => s.role);
  const nav = NAV.filter((n) => n.roles.includes(role));
  const isPortal = pathname === "/referral-portal";

  if (isPortal) {
    return (
      <div className="min-h-screen bg-secondary/40">
        <PrototypeBanner />
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <PrototypeBanner />
      <TopBar />
      <div className="flex-1 flex">
        <aside className="hidden md:flex w-60 flex-col border-r bg-background">
          <nav className="p-3 space-y-0.5">
            {nav.map((n) => {
              const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-teal/10 text-teal font-medium"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto p-3 text-[11px] text-muted-foreground border-t">
            <div className="font-medium text-foreground/70 mb-1">Tulare County · MVP</div>
            Kings County appears in ISL context only.
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <MobileNav items={nav} pathname={pathname} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PrototypeBanner() {
  return (
    <div className="bg-warning/25 border-b border-warning/40 text-[12px] text-foreground/80">
      <div className="max-w-full px-4 py-1.5 flex items-center gap-2 justify-center text-center">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>
          <b>Prototype</b> — synthetic data, not for clinical use. No real PHI, no integrations, no persistence.
        </span>
      </div>
    </div>
  );
}

function TopBar() {
  const role = useEMR((s) => s.role);
  const currentRole = ROLES.find((r) => r.id === role)!;

  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="px-4 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-md bg-teal text-teal-foreground grid place-items-center font-semibold text-sm">
            A
          </span>
          <span className="font-semibold text-foreground">Adelante</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">EMR wireframe</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            placeholder="Search (stub)"
            className="hidden md:block h-8 w-64 rounded-md border bg-background px-3 text-sm placeholder:text-muted-foreground"
          />
          <RoleSwitcher />
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-foreground/70">
            <UserCircle className="h-4 w-4" />
            {currentRole.label}
          </div>
        </div>
      </div>
    </header>
  );
}

function RoleSwitcher() {
  const role = useEMR((s) => s.role);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-secondary">
        View as: <span className="text-teal">{ROLES.find((r) => r.id === role)?.label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Demo role — resets on reload</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={role}
          onValueChange={(v) => {
            EMR.setRole(v as Role);
            toast(`Viewing as ${ROLES.find((r) => r.id === v)?.label}`);
          }}
        >
          {ROLES.map((r) => (
            <DropdownMenuRadioItem key={r.id} value={r.id} className="text-sm">
              <span className="flex-1">
                <span className="block font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.hint}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden border-b bg-background px-3 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-foreground/70 inline-flex items-center gap-1"
      >
        Menu <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {items.map((n) => {
            const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs",
                  active ? "bg-teal/10 text-teal" : "text-foreground/70 bg-secondary",
                )}
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
