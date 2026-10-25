import { useI18n } from "@/lib/i18n";
/** Public-only live wordmark; symbol paths are unchanged supplied brand artwork. */
export function WebsiteBrand({ footer = false }: { footer?: boolean }) {
  const { t } = useI18n();
  return <span className={`website-brand${footer ? " website-brand-footer" : ""}`} data-testid="website-brand">
    <img src="/brand/adelante-symbol.svg" alt="" width="120" height="128" />
    <span><span className="website-wordmark">Adelante Health</span>{footer && <span className="website-tagline">{t("website.v2.tagline")}</span>}</span>
  </span>;
}
