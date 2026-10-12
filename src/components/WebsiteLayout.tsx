import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUp, Phone, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WebsiteBrand } from "@/components/WebsiteBrand";
import { WebsiteNavigation } from "@/components/WebsiteNavigation";
import { DemoControlsBar } from "@/components/DemoControlsBar";
import { useI18n } from "@/lib/i18n";
import "./website.css";

/** One public shell; application branding and navigation remain separate. */
export function WebsiteLayout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const shellRef = useRef<HTMLDivElement>(null);
  const crisisRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>();
  useEffect(() => {
    const measure = () => {
      shellRef.current?.style.setProperty("--website-crisis-height", `${crisisRef.current?.getBoundingClientRect().height ?? 64}px`);
    };
    const observer = new ResizeObserver(measure);
    if (crisisRef.current) observer.observe(crisisRef.current);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => {
      setShowTop((pathname === "/" || pathname === "/team") && window.scrollY > window.innerHeight);
      if (pathname !== "/") { setActiveSection(undefined); return; }
      const offset = Math.max((headerRef.current?.getBoundingClientRect().bottom ?? 160) + 24, window.innerHeight * 0.35);
      let current: string | undefined;
      for (const id of ["how-it-works", "find-your-fit", "what-you-get", "faq"]) {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        if (rect && rect.top <= offset) current = id;
      }
      setActiveSection(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [pathname]);
  return <div ref={shellRef} className="patient-theme website-shell min-h-dvh flex flex-col bg-background" data-testid="website-layout" onFocusCapture={(event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || crisisRef.current?.contains(target)) return;
    const barTop = crisisRef.current?.getBoundingClientRect().top;
    if (barTop !== undefined && target.getBoundingClientRect().bottom > barTop) target.scrollIntoView({ block: "center", behavior: "instant" });
  }}>
    <DemoControlsBar />
    <header ref={headerRef} data-testid="website-header" className="sticky top-10 z-30 border-b bg-background/85 backdrop-blur" tabIndex={-1}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-2"><WebsiteBrand /></Link>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild className="min-h-12 px-3 sm:px-4"><Link to="/start/signup">{t("websiteStart")}</Link></Button>
          <WebsiteNavigation mobile activeSection={activeSection} />
          <div className="hidden xl:flex items-center gap-1 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />HIPAA · 42 CFR Part 2</div>
          <div className="hidden sm:flex rounded-full bg-secondary p-0.5">
            <Button variant={lang === "en" ? "default" : "ghost"} onClick={() => setLang("en")} aria-label="Switch language to English" aria-pressed={lang === "en"} className="min-h-12 min-w-12 rounded-full px-2">EN</Button>
            <Button variant={lang === "es" ? "default" : "ghost"} onClick={() => setLang("es")} aria-label="Cambiar idioma a español" aria-pressed={lang === "es"} className="min-h-12 min-w-12 rounded-full px-2">ES</Button>
          </div>
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex min-h-12 min-w-12"><Link to="/auth" aria-label={t("navSignIn")}><User aria-hidden="true" className="h-5 w-5" /></Link></Button>
          <Link to="/auth" className="hidden md:inline-flex text-sm text-primary">{t("navSignIn")}</Link>
        </div>
      </div>
      <WebsiteNavigation activeSection={activeSection} />
    </header>
    {lang === "es" && <p className="border-b px-5 py-2 text-sm text-muted-foreground text-center">{t("websiteDraft")}</p>}
    <main className="flex-1">{children}</main>
    <div ref={crisisRef} role="region" aria-label="Crisis support" className="fixed inset-x-0 bottom-0 z-50 border-t border-destructive/30 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center gap-2 text-sm">
        <Phone aria-hidden="true" className="h-4 w-4 text-destructive shrink-0" /><span><span className="font-semibold text-destructive">{t("crisisInCrisis")}</span> {t("crisisCallText")} <a href="tel:988" className="underline font-semibold">988</a> {t("crisisAnytime")}</span>
      </div>
    </div>
    <footer data-testid="website-footer" className="border-t bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 space-y-6 text-sm text-muted-foreground">
        <nav aria-label={t("websiteNavigation")} className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/about" className="inline-flex min-h-12 items-center hover:text-foreground">{t("websiteAboutNav")}</Link>
          <Link to="/team" className="inline-flex min-h-12 items-center hover:text-foreground">{t("websiteTeamNav")}</Link>
          <Link to="/about" hash="partners" hashScrollIntoView={{ behavior: "smooth", block: "start" }} className="inline-flex min-h-12 items-center hover:text-foreground">{t("websitePartners")}</Link>
          <Link to="/" hash="faq" hashScrollIntoView={{ behavior: "smooth", block: "start" }} className="inline-flex min-h-12 items-center hover:text-foreground">{t("websiteFaqNav")}</Link>
          <Link to="/referral" className="inline-flex min-h-12 items-center hover:text-foreground">{t("websiteReferral")}</Link>
        </nav>
        <div className="flex flex-wrap justify-between gap-3"><span>© {new Date().getFullYear()} {t("websiteBrand")} · {t("websiteBuilt")}</span><span>{t("websiteDemo")}</span></div>
      </div>
    </footer>
    {showTop && <Button variant="outline" className="website-back-top fixed right-4 z-40 min-h-12 bg-background" onClick={() => {
      headerRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }}><ArrowUp aria-hidden="true" />{t("websiteBackTop")}</Button>}
  </div>;
}
