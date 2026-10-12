import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { WEBSITE_NAV } from "@/lib/i18n.website";

export function WebsiteNavigation({ mobile = false }: { mobile?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const links = WEBSITE_NAV.map((n) => <Link key={n.hash} to="/" hash={n.hash} hashScrollIntoView={{ behavior: "smooth", block: "start" }} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground">{t(n.key)}</Link>);
  if (!mobile) return <nav aria-label={t("websiteNavigation")} className="hidden lg:flex items-center justify-center border-t">{links}</nav>;
  return <div className="lg:hidden">
    <Button variant="ghost" size="icon" aria-label={t("websiteMenu")} aria-expanded={open} aria-controls="website-mobile-nav" onClick={() => setOpen(!open)} className="h-11 w-11">{open ? <X /> : <Menu />}</Button>
    {open && <nav id="website-mobile-nav" aria-label={t("websiteNavigation")} className="absolute inset-x-0 top-full border-b bg-background px-4 py-3 shadow-sm">{links}</nav>}
  </div>;
}