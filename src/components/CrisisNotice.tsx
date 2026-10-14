// §Safety boundary — the same 988 crisis copy the persistent AppShell banner
// renders (t("crisisInCrisis") / t("crisisCallText") / 988 / t("crisisAnytime")),
// extracted so async surfaces can repeat it inline. Async messaging has no
// response-time guarantee, so every composer instance must carry this —
// it is not decoration.
import { Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.277450387478": {
    "en": "Crisis support",
    "es": "Apoyo en crisis"
  }
} as const;


export function CrisisNotice({ className }: { className?: string }) {
  const { lang: screenLang } = useI18n();

  const { t } = useI18n();
  return (
    <div
      role="region"
      aria-label={SCREEN_COPY["ui.277450387478"][screenLang]}
      className={cn(
        "flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs",
        className,
      )}
    >
      <Phone className="h-4 w-4 shrink-0 text-destructive" />
      <span>
        <span className="font-semibold text-destructive">{t("crisisInCrisis")}</span>{" "}
        {t("crisisCallText")}{" "}
        <a href="tel:988" className="font-semibold underline">
          988
        </a>{" "}
        {t("crisisAnytime")} <span className="text-muted-foreground">{t("msgAsyncNotice")}</span>
      </span>
    </div>
  );
}
