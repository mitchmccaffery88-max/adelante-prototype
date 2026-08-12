import { Link } from "@tanstack/react-router";
import { Waves } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * §Patient portal correction — always-visible "Craving right now" action.
 * Wired to the real urge-surfing timer exercise in the Phase 5 library
 * (deep-linked via the /library `exercise` search param), not a placeholder.
 */
export function CravingFab() {
  const { t } = useI18n();
  return (
    <Link
      to="/library"
      search={{ exercise: "urge-surfing-timer" }}
      data-testid="craving-fab"
      className="soft-shadow fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 z-50 inline-flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:opacity-95 md:bottom-6 md:right-6"
    >
      <Waves className="h-5 w-5" aria-hidden="true" />
      {t("cravingNow")}
    </Link>
  );
}
