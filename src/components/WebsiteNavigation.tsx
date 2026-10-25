import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Briefcase, ChevronDown, Menu, ShieldCheck, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { WEBSITE_MENUS, type WebsiteMenu, type MenuLink } from "@/lib/websiteMenus";

export function WebsiteLanguageToggle() {
  const { t, lang, setLang } = useI18n();
  return <div className="website-language" role="group" aria-label={t("websiteFaqLangQ")}>
    <Button variant="ghost" data-early-tap="lang-en" aria-label="Switch language to English" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</Button>
    <Button variant="ghost" data-early-tap="lang-es" aria-label="Cambiar idioma a español" aria-pressed={lang === "es"} onClick={() => setLang("es")}>ES</Button>
  </div>;
}
export function WebsiteSignIn({ onClick }: { onClick?: () => void }) {
 const { t } = useI18n();
 return <Button asChild variant="outline" className="website-secondary"><Link to="/auth" onClick={onClick}><User aria-hidden="true" />{t("website.v2.signin")}</Link></Button>;
}
function CareerLink({ onClick }: { onClick?: () => void }) {
 const { t } = useI18n();
 return <Button asChild variant="ghost" className="website-career"><Link to="/careers" onClick={onClick}><Briefcase aria-hidden="true" />{t("website.v2.careers")}</Link></Button>;
}
function TileLink({ link, close }: { link: MenuLink; close: () => void }) {
 const { t } = useI18n(); const Icon = link.icon;
 return <Link to={link.to} hash={link.hash} hashScrollIntoView={{ block:"start" }} className="website-menu-tile" onClick={close}>
  <span className="website-icon-disc"><Icon aria-hidden="true" /></span><span><strong>{t(link.title)}</strong>{link.body && <span>{t(link.body)}</span>}</span>
 </Link>;
}
function MenuContents({ menu, close }: { menu: WebsiteMenu; close: () => void }) {
 const { t } = useI18n();
 return <div className={`website-mega-inner website-menu-${menu.id}`}>
  {menu.intro && <div className="website-menu-intro"><h2>{t(menu.intro)}</h2><p>{menu.body && t(menu.body)}</p></div>}
  <div className="website-menu-columns">{menu.columns.map((column) => <section key={column.title}><h3>{t(column.title)}</h3><div>{column.links.map((link,i) => <TileLink key={`${link.title}-${i}`} link={link} close={close} />)}</div></section>)}</div>
  {menu.promo && <div className="website-menu-promo"><h3>{t(menu.promo.title)}</h3><p>{t(menu.promo.body)}</p><Button asChild className="website-primary"><Link to={menu.promo.to} onClick={close}>{t(menu.promo.cta)}</Link></Button>{menu.promo.secondary && <Button asChild variant="outline" className="website-secondary"><Link to="/referral" onClick={close}>{t("websiteHelp")}</Link></Button>}</div>}
 </div>;
}
export function WebsiteNavigation({ mobile = false }: { mobile?: boolean }) {
 const { t } = useI18n();
 const [open, setOpen] = useState<string | null>(null);
 const [sheetOpen, setSheetOpen] = useState(false);
 const navRef = useRef<HTMLElement>(null);
 const sheetRef = useRef<HTMLDivElement>(null);
 const underline = useRef<HTMLSpanElement>(null);
 const triggers = useRef(new Map<string, HTMLButtonElement>());
 const location = useRouterState({ select: s => s.location.href });
 const close = () => setOpen(null);
 const moveLine = (id: string | null) => {
  const trigger = id ? triggers.current.get(id) : undefined;
  const line = underline.current; const nav = navRef.current;
  if (!line || !nav) return;
  if (!trigger) { line.style.width = "0px"; return; }
  const box = trigger.getBoundingClientRect(); const parent = nav.getBoundingClientRect();
  line.style.left = `${box.left - parent.left}px`; line.style.width = `${box.width}px`;
 };
 useEffect(() => { setOpen(null); setSheetOpen(false); }, [location]);
 useEffect(() => {
  if (mobile) return;
  moveLine(open);
  const resize = () => { if (window.innerWidth < 1024) close(); moveLine(open); };
  const key = (event: KeyboardEvent) => { if (event.key === "Escape" && open) { setOpen(null); triggers.current.get(open)?.focus(); } };
  const outside = (event: PointerEvent) => { if (event.target instanceof Node && !navRef.current?.contains(event.target)) close(); };
  window.addEventListener("resize",resize); document.addEventListener("keydown",key); document.addEventListener("pointerdown",outside);
  return () => { window.removeEventListener("resize",resize); document.removeEventListener("keydown",key); document.removeEventListener("pointerdown",outside); };
 }, [open,mobile]);
 useEffect(() => {
  if (!mobile) return;
  const resize = () => { if (window.innerWidth >= 1024) setSheetOpen(false); };
  window.addEventListener("resize", resize); return () => window.removeEventListener("resize",resize);
 },[mobile]);
 useEffect(() => {
  if (!sheetOpen) return;
  const crisis = document.querySelector(".website-crisis");
  const measure = () => sheetRef.current?.style.setProperty("--website-crisis-height", `${crisis?.getBoundingClientRect().height ?? 96}px`);
  const observer = new ResizeObserver(measure);
  if (crisis) observer.observe(crisis);
  measure();
  return () => observer.disconnect();
 },[sheetOpen]);
 if (mobile) return <div className="website-phone-nav">
  <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
   <Dialog.Trigger asChild><Button variant="ghost" size="icon" data-early-tap="menu" className="website-menu-button" aria-label={t("website.v2.open")} aria-expanded={sheetOpen}><Menu aria-hidden="true" /></Button></Dialog.Trigger>
   <Dialog.Portal><Dialog.Overlay className="website-sheet-scrim" /><Dialog.Content ref={sheetRef} id="website-mobile-nav" className="website-menu-sheet" aria-describedby={undefined}>
    <div className="website-sheet-header"><Dialog.Title>{t("website.v2.menu")}</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" className="website-menu-button" aria-label={t("website.v2.close")}><X aria-hidden="true" /></Button></Dialog.Close></div>
    <nav className="website-sheet-scroll" aria-label={t("websiteNavigation")}>{WEBSITE_MENUS.map(menu => <div key={menu.id} className="website-accordion">
      <Button variant="ghost" aria-expanded={open === menu.id} aria-controls={`website-phone-${menu.id}`} onClick={() => setOpen(open === menu.id ? null : menu.id)}>{t(menu.title)}<ChevronDown aria-hidden="true" /></Button>
      <div id={`website-phone-${menu.id}`} hidden={open !== menu.id}><MenuContents menu={menu} close={() => setSheetOpen(false)} /></div>
     </div>)}<CareerLink onClick={() => setSheetOpen(false)} /></nav>
    <div className="website-sheet-bottom"><WebsiteSignIn onClick={() => setSheetOpen(false)} /><WebsiteLanguageToggle /><p><ShieldCheck aria-hidden="true" />{t("website.v2.hipaa")}</p></div>
   </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
 </div>;
 return <>
  {open && <div className="website-nav-scrim" aria-hidden="true" onClick={close} />}
  <nav ref={navRef} className="website-desktop-nav" aria-label={t("websiteNavigation")} onMouseLeave={() => moveLine(open)}>
   <div className="website-nav-row">{WEBSITE_MENUS.map(menu => <Button key={menu.id} ref={node => { if (node) triggers.current.set(menu.id,node); else triggers.current.delete(menu.id); }} variant="ghost" className="website-nav-trigger" aria-expanded={open === menu.id} aria-controls={`website-mega-${menu.id}`} onMouseEnter={() => moveLine(menu.id)} onFocus={() => moveLine(menu.id)} onBlur={() => moveLine(open)} onClick={() => setOpen(open === menu.id ? null : menu.id)}>{t(menu.title)}<ChevronDown aria-hidden="true" /></Button>)}<span className="website-nav-divider" aria-hidden="true" /><CareerLink /></div>
   <span ref={underline} className="website-nav-underline" aria-hidden="true" />
   {WEBSITE_MENUS.map(menu => <div id={`website-mega-${menu.id}`} key={menu.id} className="website-mega-panel" hidden={open !== menu.id}><MenuContents menu={menu} close={close} /></div>)}
  </nav>
 </>;
}
