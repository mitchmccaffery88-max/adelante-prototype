import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShieldAlert, UserRound } from "lucide-react";
import { STAFF_ROLES, useActingStaff } from "@/lib/roles";
import { useStaffNavGroups } from "@/lib/navSections";
import { useEhr } from "@/lib/ehr";
import { canSeeAllEscalations, filterEscalations, listEscalations } from "@/lib/escalations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StaffNavSidebar } from "@/components/StaffNavSidebar";
import { StaffBreadcrumbs } from "@/components/StaffBreadcrumbs";
import { NotificationBell } from "@/components/NotificationBell";
import { StaffDensityProvider, StaffNewProvider } from "@/components/StaffDensity";

export function StaffShell({ children }: { children: ReactNode }) {
  const actor = useActingStaff();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const groups = useStaffNavGroups();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newTarget, setNewTarget] = useState<HTMLElement | null>(null);
  const roleLabel = STAFF_ROLES.find(r => r.key === actor.role)?.label ?? actor.role;
  const count = useEhr(() => filterEscalations(listEscalations(actor), actor, { view: canSeeAllEscalations(actor) ? "all" : "mine" }).filter(r => r.type === "crisis" && r.status !== "resolved").length);
  const hasLauncher = pathname.startsWith("/record/") || ["/clinician", "/admin", "/admin-claims", "/billing"].includes(pathname);
  const matches = groups.flatMap(g => g.entries).filter(e => `${e.label} ${e.desc}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <StaffDensityProvider><StaffNewProvider target={newTarget}>
    <div data-density="compact" data-testid="staff-shell" className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header data-testid="staff-shell-header" className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open staff navigation" onClick={() => setMobileOpen(true)}><Menu /></Button>
        <Link to="/" aria-label="Adelante home" className="shrink-0">
          <img src="/brand/adelante-compact.svg" alt="Adelante" className="h-8 w-auto dark:hidden" />
          <img src="/brand/adelante-compact-dark.svg" alt="Adelante" className="hidden h-8 w-auto dark:block" />
        </Link>
        <Popover open={quickOpen} onOpenChange={setQuickOpen}><PopoverTrigger asChild><Button variant="outline" size="icon" aria-label="Quick jump"><Search /></Button></PopoverTrigger>
          <PopoverContent className="w-[min(24rem,90vw)] p-2"><Input aria-label="Quick jump to a surface" placeholder="Quick jump…" value={query} onChange={e => setQuery(e.target.value)} />
            <nav aria-label="Quick jump results" className="mt-2 max-h-80 overflow-y-auto">{matches.map(e => <Button key={e.id} variant="ghost" asChild className="h-auto w-full justify-start whitespace-normal text-left"><Link to={e.to} search={(e.search ?? {}) as never} onClick={() => { setQuickOpen(false); setQuery(""); }}>{e.label}</Link></Button>)}{!matches.length && <p className="p-2 text-sm text-ink-muted">No matching surfaces.</p>}</nav>
          </PopoverContent>
        </Popover>
        <div data-testid="acting-role-indicator" title={`Acting as: ${roleLabel} · ${actor.staffName}`} className="ml-auto hidden min-w-0 rounded-sm border border-line bg-surface-sunk px-2 py-1 text-sm sm:block"><span className="text-ink-muted">Acting as: </span><span className="font-semibold">{roleLabel}</span><span className="hidden lg:inline"> · {actor.staffName}</span></div>
        {count > 0 && <Button asChild variant="ghost" className="shrink-0 bg-urgent text-on-urgent hover:bg-urgent"><Link to="/escalations" search={{ view: undefined, type: undefined, owner: undefined, overdue: undefined }} aria-label={`${count} open crisis escalations`}><ShieldAlert /><span>{count}</span><span className="hidden xl:inline">Crisis</span></Link></Button>}
        <NotificationBell audience="staff" className="ml-auto sm:ml-0" />
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Staff account"><UserRound /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>{actor.staffName} · {roleLabel}</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/auth">Sign in / out</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </header>
      <div className="flex min-h-0 flex-1">
        <StaffNavSidebar newSlot={<div ref={setNewTarget} data-testid="staff-new-slot" />} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 border-b border-line bg-surface-sunk px-3 py-2 text-sm sm:hidden" data-testid="acting-role-indicator-mobile"><span className="text-ink-muted">Acting as:</span><span className="min-w-0 break-words">{roleLabel} · {actor.staffName}</span>{hasLauncher && <Button className="ml-auto shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open create actions">+ New</Button>}</div>
          <StaffBreadcrumbs />
          {children}
        </div>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetContent side="left" className="w-[min(20rem,90vw)] bg-surface-sunk p-0 pt-12" data-testid="staff-navigation-sheet"><SheetTitle className="sr-only">Staff navigation</SheetTitle><StaffNavSidebar mobile onNavigate={() => setMobileOpen(false)} newSlot={hasLauncher ? <Button className="w-full" onClick={() => { setMobileOpen(false); newTarget?.querySelector<HTMLButtonElement>("button")?.click(); }}>+ New</Button> : undefined} /></SheetContent></Sheet>
    </div>
  </StaffNewProvider></StaffDensityProvider>;
}