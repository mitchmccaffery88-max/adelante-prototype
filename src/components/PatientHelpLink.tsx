import { LifeBuoy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Persistent "Need help?" affordance for patient-facing surfaces.
 * Bilingual, low-literacy: one tap to phone support, plain-language label.
 */
export function PatientHelpLink({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <a
      href="tel:15595550123"
      aria-label={t("helpAriaLabel")}
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/5 " +
        "px-3 py-1.5 text-xs font-medium text-teal hover:bg-teal/10 " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        "min-h-11 sm:min-h-0 " +
        className
      }
    >
      <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t("helpNeedHelp")}</span>
      <span className="hidden sm:inline text-teal/70">· {t("helpCallUs")}</span>
    </a>
  );
}
