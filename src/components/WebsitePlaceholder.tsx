import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { WebsiteKey } from "@/lib/websiteMenus";
export function WebsitePlaceholder({ title, intro, menu, anchors = [] }: { title: WebsiteKey; intro: WebsiteKey; menu: WebsiteKey; anchors?: string[] }) {
 const { t } = useI18n();
 return <>
  <nav aria-label="Breadcrumb" className="website-breadcrumbs website-container"><Link to="/">{t("website.v2.home")}</Link><ChevronRight aria-hidden="true" /><span>{t(menu)}</span><ChevronRight aria-hidden="true" /><span aria-current="page">{t(title)}</span></nav>
  <section className="website-placeholder-band"><div className="website-container"><h1>{t(title)}</h1><p>{t(intro)}</p></div></section>
  <div className="website-placeholder-body website-container"><p>{t("website.v2.pending")}</p>{anchors.map(anchor => <div id={anchor} key={anchor} />)}</div>
 </>;
}
