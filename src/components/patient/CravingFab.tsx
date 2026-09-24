import { Link, useRouterState } from "@tanstack/react-router";
import { Waves } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * §Patient portal correction — always-visible "Craving right now" action.
 * §Tier 1 Build B — it now opens the real guided craving flow at /craving,
 * which itself runs the real Phase 5 urge-surfing timer (same tool, not a
 * second one) and logs a real craving entry.
 */
/** Surfaces where the FAB would be a dead-end self-link, or would sit on top
 *  of the page's own primary action. Checked against the live pathname. */
const FAB_SUPPRESSED = ["/craving", "/crisis", "/slip", "/adel"];

export function CravingFab() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (FAB_SUPPRESSED.includes(pathname)) return null;
  return (
    <Link
      to="/craving"
      data-testid="craving-fab"
      className="soft-shadow fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-50 inline-flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:opacity-95 md:bottom-6 md:right-6"
    >
      <Waves className="h-5 w-5" aria-hidden="true" />
      {t("cravingNow")}
    </Link>
  );
}
