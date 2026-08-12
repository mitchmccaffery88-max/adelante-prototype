import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { PATIENT_MOBILE_NAV, PATIENT_ROUTES, type PatientRoute } from "@/lib/navSections";
import { PatientMoreSheet } from "@/components/patient/PatientMoreSheet";

export function MobileNav() {
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!PATIENT_ROUTES.includes(pathname as PatientRoute)) {
    return null;
  }

  return (
    <>
      <nav
        role="navigation"
        aria-label="Primary"
        data-testid="patient-tab-bar"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.15)]"
      >
        <div className="flex items-stretch justify-around gap-1 px-2 py-1">
          {PATIENT_MOBILE_NAV.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to;
            return (
              <Link
                key={n.id}
                to={n.to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] rounded-2xl py-2 text-[11px] font-medium",
                  active ? "bg-secondary text-primary" : "text-foreground/60",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                {t(n.labelKey as Parameters<typeof t>[0])}
              </Link>
            );
          })}

          <button
            type="button"
            data-testid="patient-more-trigger"
            onClick={() => setMoreOpen(true)}
            aria-label={t("navMore")}
            className="flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] rounded-2xl py-2 text-[11px] font-medium text-foreground/60"
          >
            <MoreHorizontal className="h-5 w-5" />
            {t("navMore")}
          </button>
        </div>
      </nav>

      <PatientMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
