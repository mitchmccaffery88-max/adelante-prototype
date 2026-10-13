import { Link } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GetHelpNowModal } from "./GetHelpNowModal";

/**
 * §Patient portal correction — the real sticky patient header: wordmark, the
 * "What can I help you with today?" prompt (desktop) and a pill crisis link
 * that is separate from the sidebar's crisis block.
 */
export function CrisisHeader() {
  const { t, lang } = useI18n();
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div
      data-testid="patient-crisis-header"
      className="bg-surface-elevated/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/home" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-2xl bg-primary font-display text-lg leading-none text-primary-foreground">
            A
          </span>
          <span className="font-display text-xl">{t("appName")}</span>
        </Link>
        <p
          data-testid="patient-header-prompt"
          className="hidden flex-1 truncate text-base text-muted-foreground md:block"
        >
          {t("patientHeaderPrompt")}
        </p>
        {/* §Tier 1 Build A — the pill now opens the real crisis landing page
            (988 call + text, breathing, safety plan) instead of dialling. */}
        <Button
          onClick={() => setHelpOpen(true)}
          data-testid="patient-header-crisis-pill"
          className="ml-auto min-h-12 h-auto whitespace-normal border border-urgent bg-urgent px-4 py-2 text-sm font-semibold text-on-urgent hover:bg-urgent"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          <span>{t("helpNow")}{lang === "es" && <span className="block text-sm">Borrador</span>}</span>
        </Button>
      </div>
      <GetHelpNowModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
