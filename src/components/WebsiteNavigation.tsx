import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { createLink, Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { WEBSITE_NAV } from "@/lib/i18n.website";

// Router Links force aria-current=page for all matching '/' anchors. Public
// navigation owns its scroll-spy state, so the rendered anchor overrides it.
const NavigationAnchor = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<"a"> & { current?: "page" | "location" }>(
  ({ current, ...props }, ref) => <a {...props} ref={ref} aria-current={current} />,
);
const NavigationLink = createLink(NavigationAnchor);

export function WebsiteNavigation({ mobile = false, activeSection }: { mobile?: boolean; activeSection?: string }) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const links = WEBSITE_NAV.map((n) => <NavigationLink key={n.key} to={n.to} hash={n.hash} activeOptions={{ exact: true }} activeProps={{ className: "" }} current={n.to !== "/" && pathname === n.to ? "page" : pathname === "/" && n.hash && n.hash === activeSection ? "location" : undefined} hashScrollIntoView={{ behavior: "smooth", block: "start" }} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary hover:text-foreground aria-[current]:bg-accent aria-[current]:text-primary">{t(n.key)}</NavigationLink>);
  if (!mobile) return <nav aria-label={t("websiteNavigation")} className="hidden lg:flex items-center justify-center border-t">{links}</nav>;
  return <div className="lg:hidden">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={t("websiteMenu")} className="min-h-12 min-w-12">{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</Button></PopoverTrigger>
      <PopoverContent id="website-mobile-nav" align="end" className="patient-theme website-mobile-menu w-[min(24rem,calc(100vw-2rem))] max-h-[70dvh] overflow-y-auto">
        <div className="sm:hidden border-b pb-3 mb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1" role="group" aria-label={t("websiteFaqLangQ")}>
              <Button variant={lang === "en" ? "default" : "ghost"} onClick={() => setLang("en")} aria-label="Switch language to English" aria-pressed={lang === "en"} className="min-h-12 min-w-12">EN</Button>
              <Button variant={lang === "es" ? "default" : "ghost"} onClick={() => setLang("es")} aria-label="Cambiar idioma a español" aria-pressed={lang === "es"} className="min-h-12 min-w-12">ES</Button>
            </div>
            <Button asChild variant="ghost" className="min-h-12"><Link to="/auth" onClick={() => setOpen(false)}>{t("navSignIn")}</Link></Button>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4 text-primary" />HIPAA · 42 CFR Part 2</p>
        </div>
        <nav aria-label={t("websiteNavigation")}>{links}</nav>
      </PopoverContent>
    </Popover>
  </div>;
}