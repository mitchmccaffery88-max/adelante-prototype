import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Phone, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WebsiteBrand } from "@/components/WebsiteBrand";
import { WebsiteNavigation } from "@/components/WebsiteNavigation";
import { DemoControlsBar } from "@/components/DemoControlsBar";
import { useI18n } from "@/lib/i18n";
import "./website.css";

/** One public shell; application branding and navigation remain separate. */
export function WebsiteLayout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  return <div className="patient-theme min-h-dvh flex flex-col bg-background" data-testid="website-layout">
    <DemoControlsBar />
    <header data-testid="website-header" className="sticky top-10 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-2"><WebsiteBrand /></Link>
        <div className="ml-auto flex items-center gap-2">
          <WebsiteNavigation mobile />
          <Button asChild className="hidden sm:inline-flex min-h-12"><Link to="/start/signup">{t("websiteStart")}</Link></Button>
          <div className="hidden xl:flex items-center gap-1 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />HIPAA · 42 CFR Part 2</div>
          <div className="flex rounded-full bg-secondary p-0.5">
            <Button variant={lang === "en" ? "default" : "ghost"} onClick={() => setLang("en")} aria-label="Switch language to English" aria-pressed={lang === "en"} className="min-h-12 min-w-12 rounded-full px-2">EN</Button>
            <Button variant={lang === "es" ? "default" : "ghost"} onClick={() => setLang("es")} aria-label="Cambiar idioma a español" aria-pressed={lang === "es"} className="min-h-12 min-w-12 rounded-full px-2">ES</Button>
          </div>
          <Button asChild variant="ghost" size="icon" className="min-h-12 min-w-12"><Link to="/auth" aria-label={t("navSignIn")}><User className="h-5 w-5" /></Link></Button>
          <Link to="/auth" className="hidden md:inline-flex text-sm text-primary">{t("navSignIn")}</Link>
        </div>
      </div>
      <WebsiteNavigation />
    </header>
    {lang === "es" && <p className="border-b px-5 py-2 text-sm text-muted-foreground text-center">{t("websiteDraft")}</p>}
    <main className="flex-1">{children}</main>
    <div role="region" aria-label="Crisis support" className="sticky bottom-0 z-50 border-t border-destructive/30 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center gap-2 text-sm">
        <Phone className="h-4 w-4 text-destructive shrink-0" /><span><span className="font-semibold text-destructive">{t("crisisInCrisis")}</span> {t("crisisCallText")} <a href="tel:988" className="underline font-semibold">988</a> {t("crisisAnytime")}</span>
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
  </div>;
}
