import { Link, useRouterState } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { PATIENT_SIDEBAR_NAV } from "@/lib/navSections";

/**
 * §Patient portal Build 1 — persistent left sidebar for desktop/tablet.
 * Same registry as the mobile tab bar; the layout adapts by viewport, there is
 * no second nav build. Crisis support is pinned to the bottom and is always
 * visible regardless of page scroll (the rail is sticky, full-height).
 */
export function PatientSidebar() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });

  return (
    <aside
      aria-label="Patient navigation"
      className="hidden md:flex sticky top-[73px] h-[calc(100dvh-73px)] w-64 shrink-0 flex-col gap-1 border-r bg-card/60 px-3 py-4"
    >
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {PATIENT_SIDEBAR_NAV.map((n) => {
          const Icon = n.icon;
          const active = n.hash
            ? pathname === n.to && hash === n.hash
            : pathname === n.to && !hash;
          return (
            <Link
              key={n.id}
              to={n.to}
              hash={n.hash}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/75 hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(n.labelKey as Parameters<typeof t>[0])}</span>
            </Link>
          );
        })}
      </nav>

      <a
        href="tel:988"
        data-testid="patient-crisis-link"
        className="mt-2 flex min-h-11 items-center gap-3 rounded-2xl border border-crisis/30 bg-crisis-soft px-3 py-3 text-base font-semibold text-crisis shadow-sm hover:bg-crisis/10"
      >
        <LifeBuoy className="h-5 w-5 shrink-0" aria-hidden="true" />
        {t("navCrisisSupport")} · 988
      </a>
    </aside>
  );
}
