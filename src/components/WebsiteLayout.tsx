import { useEarlyTapReplay } from "@/lib/earlyTap";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WebsiteBrand } from "@/components/WebsiteBrand";
import { WebsiteNavigation, WebsiteLanguageToggle, WebsiteSignIn } from "@/components/WebsiteNavigation";
import { DemoControlsBar } from "@/components/DemoControlsBar";
import { useI18n } from "@/lib/i18n";
import { WEBSITE_FOOTER_LINKS } from "@/lib/websiteMenus";
import "./website.css";

/** One public shell; application branding and navigation remain separate. */
export function WebsiteLayout({ children }: { children: ReactNode }) {
 const { t, lang } = useI18n();
 const location = useRouterState({select:s => s.location.href});
 useEarlyTapReplay();
 const shellRef = useRef<HTMLDivElement>(null); const crisisRef = useRef<HTMLElement>(null);
 const sentinel = useRef<HTMLDivElement>(null); const headerRef = useRef<HTMLElement>(null); const top = useRef<HTMLDivElement>(null);
 const [compact,setCompact] = useState(false); const [showTop,setShowTop] = useState(false);
 useEffect(() => {
  const measure = () => {
   const shell = shellRef.current; if (!shell) return;
   shell.style.setProperty("--website-crisis-height",`${crisisRef.current?.getBoundingClientRect().height ?? 48}px`);
   shell.style.setProperty("--website-demo-height",`${shell.querySelector('[data-testid="demo-controls-bar"]')?.getBoundingClientRect().height ?? 40}px`);
   shell.style.setProperty("--website-header-height",`${headerRef.current?.getBoundingClientRect().height ?? 156}px`);
  };
  const observer = new ResizeObserver(measure);
  if (crisisRef.current) observer.observe(crisisRef.current); if (headerRef.current) observer.observe(headerRef.current);
  const demo = shellRef.current?.querySelector('[data-testid="demo-controls-bar"]'); if (demo) observer.observe(demo);
  measure(); return () => observer.disconnect();
 },[]);
 useEffect(() => {
  if (!compact || !window.location.hash) return;
  const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
  if (!target) return;
  const observer = new ResizeObserver(() => target.scrollIntoView({block:"start",behavior:"instant"}));
  if (headerRef.current) observer.observe(headerRef.current);
  const timer = window.setTimeout(() => observer.disconnect(),250);
  return () => { window.clearTimeout(timer); observer.disconnect(); };
 },[compact,location]);
 useEffect(() => {
  const observer = new IntersectionObserver(entries => setCompact(!entries[0]?.isIntersecting));
  if (sentinel.current) observer.observe(sentinel.current);
  const update = () => setShowTop(window.scrollY > Math.max(0,document.documentElement.scrollHeight - window.innerHeight)/2 && window.scrollY > 120);
  window.addEventListener("scroll",update,{passive:true}); window.addEventListener("resize",update); update();
  return () => { observer.disconnect(); window.removeEventListener("scroll",update); window.removeEventListener("resize",update); };
 },[]);
 const backTop = () => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top:0,behavior:reduced ? "instant" : "smooth" });
  if (reduced) { top.current?.focus({preventScroll:true}); return; }
  const focus = () => { if (window.scrollY <= 1) { top.current?.focus({preventScroll:true}); window.removeEventListener("scroll",focus); } };
  window.addEventListener("scroll",focus,{passive:true}); focus();
 };
 return <div ref={shellRef} className="website-shell" data-testid="website-layout" onFocusCapture={event => {
  const target=event.target; if (!(target instanceof HTMLElement) || crisisRef.current?.contains(target)) return;
  const bottom=crisisRef.current?.getBoundingClientRect().top;
  if (bottom !== undefined && target.getBoundingClientRect().bottom > bottom) target.scrollIntoView({block:"center",behavior:"instant"});
 }}>
  <div id="website-top" ref={top} tabIndex={-1} className="website-top" />
  <a className="website-skip" href="#website-main">{t("website.v2.skip")}</a>
  <DemoControlsBar />
  <div ref={sentinel} className="website-sticky-sentinel" aria-hidden="true" />
  <header ref={headerRef} data-testid="website-header" className={`website-header${compact ? " website-header-compact" : ""}`}>
   <div className="website-header-row website-container">
    <Link to="/" aria-label="Adelante home" className="website-brand-link"><WebsiteBrand /></Link>
    <div className="website-header-actions">
     <Button asChild className="website-primary"><Link to="/start/signup">{t("websiteStart")}</Link></Button>
     <span className="website-trust"><ShieldCheck aria-hidden="true" />{t("website.v2.hipaa")}</span>
     <div className="website-desktop-control"><WebsiteLanguageToggle /></div>
     <div className="website-desktop-control"><WebsiteSignIn /></div>
     <WebsiteNavigation mobile />
    </div>
   </div>
   <WebsiteNavigation />
  </header>
  {lang === "es" && <p className="website-draft">{t("websiteDraft")}</p>}
  <main id="website-main" tabIndex={-1}>{children}</main>
  <aside ref={crisisRef} aria-label={t("website.v2.crisis.label")} className="website-crisis"><div className="website-container">{t("website.v2.crisis.before")} <a href="tel:988">988</a> {t("website.v2.crisis.after")}</div></aside>
  <footer data-testid="website-footer" className="website-footer">
   <div className="website-container"><div className="website-footer-main"><Link to="/" aria-label="Adelante home"><WebsiteBrand footer /></Link><nav aria-label={t("websiteNavigation")} className="website-footer-links">{WEBSITE_FOOTER_LINKS.map(link => <Link key={link.to} to={link.to}>{t(link.title)}</Link>)}</nav></div>
    <div className="website-footer-bottom"><span aria-label={t("websiteBrand")}>{t("website.v2.copyright")}</span><span className="website-footer-trust"><ShieldCheck aria-hidden="true" />{t("website.v2.hipaa")}</span><span>{t("websiteDemo")}</span></div>
   </div>
  </footer>
  {showTop && <Button size="icon" className="website-back-top website-primary" aria-label={t("websiteBackTop")} onClick={backTop}><ArrowUp aria-hidden="true" /></Button>}
 </div>;
}
