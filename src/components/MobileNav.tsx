import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, ClipboardList, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const PATIENT_ROUTES = ["/home", "/intake", "/schedule"] as const;

export function MobileNav() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!PATIENT_ROUTES.includes(pathname as (typeof PATIENT_ROUTES)[number])) {
    return null;
  }

  const items = [
    { to: "/home" as const, label: t("navMyCare"), icon: Heart },
    { to: "/intake" as const, label: t("navIntake"), icon: ClipboardList },
    { to: "/schedule" as const, label: t("schTitle"), icon: Calendar },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch justify-around">
        {items.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-[44px] py-2 text-[11px] font-medium",
                active ? "text-navy" : "text-foreground/60",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-navy")} />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
