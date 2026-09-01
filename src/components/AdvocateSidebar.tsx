import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ADVOCATE_NAV_GROUPS } from "@/lib/navSections";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useAdvocateSessionId, SelfCareContextSwitch } from "@/components/ContextSwitcher";
import { HeartHandshake } from "lucide-react";

/**
 * §Advocate Access Redesign Phase 2 (corrected) — persistent left sidebar for
 * advocate mode.
 *
 * Deliberately the SAME shell as `PatientSidebar` (sticky full-height rail,
 * same rounded pill links, same active treatment) so switching context swaps
 * the sidebar's CONTENT, not the navigation paradigm. While advocating this
 * rail fully replaces the patient one — the shell never renders both.
 *
 * The context switch is pinned at the TOP of the rail, above the scrollable
 * nav, so it is reachable without scrolling at any page height.
 */
export function AdvocateSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const linkId = useAdvocateSessionId();
  const identity = useEhr(() => (linkId ? AdelanteEHR.advocatePatientIdentity(linkId) : undefined));
  const supportingName = identity?.allowed ? identity.firstName : null;

  return (
    <aside
      aria-label="Advocate navigation"
      data-testid="advocate-sidebar"
      className="hidden md:flex sticky top-[65px] h-[calc(100dvh-65px)] w-64 shrink-0 flex-col gap-1 border-r bg-sidebar px-3 pt-4 pb-6"
    >
      {/* Persistent, prominent context switch — never inside the scroll area. */}
      <div className="shrink-0 space-y-2 pb-3">
        <div
          data-testid="advocate-context-banner"
          className="flex items-center gap-2 rounded-2xl border border-teal/40 bg-teal/5 px-3 py-2.5 text-sm font-semibold text-navy"
        >
          <HeartHandshake className="h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
          <span className="truncate">
            {supportingName ? `Advocating for ${supportingName}` : "Advocate access"}
          </span>
        </div>
        <SelfCareContextSwitch className="text-sm" />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        {ADVOCATE_NAV_GROUPS.map((g) => (
          <div key={g.key} className="space-y-1">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.key === "support" && supportingName ? `Supporting ${supportingName}` : g.label}
            </p>
            {g.entries.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to;
              return (
                <Link
                  key={n.id}
                  to={n.to}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground soft-shadow"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{n.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
