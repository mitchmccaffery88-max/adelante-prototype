import { useI18n } from "@/lib/i18n";

/** Forthcoming logo: replace this placeholder in one place, public site only. */
export function WebsiteBrand() {
  const { t } = useI18n();
  return <span className="flex items-center gap-2" data-testid="website-brand">
    <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-display text-lg">A</span>
    <span className="font-display text-sm sm:text-xl text-primary leading-tight">{t("websiteBrand")}</span>
  </span>;
}