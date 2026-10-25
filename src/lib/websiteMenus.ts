import { Brain, Sunrise, HeartHandshake, Route, House, Footprints, Gift, BadgeCheck, CircleHelp, Video, HandHeart, ClipboardList, Users, Send, Building2, Smartphone, Sparkles, CalendarCheck, Info, ShieldCheck, Briefcase, type LucideIcon } from "lucide-react";
import type { websiteEn } from "./i18n.website";
export type WebsiteKey = keyof typeof websiteEn;
export type MenuLink = { title: WebsiteKey; body?: WebsiteKey; to: string; hash?: string; icon: LucideIcon };
export type WebsiteMenu = { id: string; title: WebsiteKey; intro?: WebsiteKey; body?: WebsiteKey; columns: { title: WebsiteKey; links: MenuLink[] }[]; promo?: { title: WebsiteKey; body: WebsiteKey; cta: WebsiteKey; to: string; secondary?: boolean } };
const item = (title: WebsiteKey, to: string, icon: LucideIcon, body?: WebsiteKey, hash?: string): MenuLink => ({ title, to, icon, body, hash });
export const WEBSITE_MENUS: WebsiteMenu[] = [
 { id: "care", title: "website.v2.care", columns: [
  { title: "website.v2.who", links: [item("website.v2.anyone", "/care/everyday", Brain, "website.v2.anyone.body"),item("website.v2.coming", "/care/coming-home", Sunrise, "website.v2.coming.body"),item("website.v2.advocates", "/care/advocates", HeartHandshake,"website.v2.advocates.body")] },
  { title: "website.v2.journeys", links: [item("website.v2.everyday","/care/everyday",Route,"website.v2.everyday.body"),item("website.v2.first90","/care/coming-home",Route,"website.v2.first90.body"),item("website.v2.recovery","/care/recovery",Route,"website.v2.recovery.body"),item("website.v2.directory","/directory",House,"website.v2.directory.body")] },
  { title: "website.v2.howcare", links: [item("website.v2.how","/how-it-works",Footprints,"website.v2.how.body"),item("website.v2.what","/how-it-works",Gift,"website.v2.what.body","what"),item("website.v2.cost","/cost",BadgeCheck,"website.v2.cost.body"),item("website.v2.faq","/faq",CircleHelp,"website.v2.faq.body")] }
 ], promo: { title:"website.v2.care.promo.title", body:"website.v2.care.promo.body",cta:"websiteStart",to:"/start/signup",secondary:true } },
 { id:"team",title:"website.v2.team",intro:"website.v2.team.intro",body:"website.v2.team.body",columns:[
  {title:"websiteCareTeam",links:[item("websiteClinicians","/team",Brain,undefined,"care"),item("websitePsychiatry","/team",Video,undefined,"care"),item("websiteRecovery","/team",HandHeart,undefined,"care")]},
  {title:"websiteNavigationTeam",links:[item("websiteCoordinators","/team",ClipboardList,undefined,"navigation"),item("websiteReentry","/team",Sunrise,undefined,"navigation")]},
  {title:"websiteResourceTeam",links:[item("websiteResources","/team",Users,undefined,"resource")]},
  {title:"websiteAdvocateTeam",links:[item("websiteAdvocates","/team",HeartHandshake,undefined,"advocate")]}
 ],promo:{title:"website.v2.careers",body:"website.v2.team.promo.body",cta:"website.v2.team.promo.cta",to:"/careers"}},
 {id:"partners",title:"website.v2.partners",columns:[
  {title:"website.v2.refer",links:[item("websiteReferral","/referral",Send,"website.v2.referral.body"),item("website.v2.partner.title","/partners",Building2,"website.v2.partner.body")]},
  {title:"website.v2.platform",links:[item("website.v2.portal","/platform",Smartphone,"website.v2.portal.body","portal"),item("website.v2.record","/platform",ClipboardList,"website.v2.record.body","record"),item("website.v2.adel","/platform",Sparkles,"website.v2.adel.body","adel"),item("website.v2.practice","/platform",CalendarCheck,"website.v2.practice.body","practice")]}
 ],promo:{title:"website.v2.platform.promo.title",body:"website.v2.platform.promo.body",cta:"website.v2.platform.promo.cta",to:"/platform"}},
 {id:"about",title:"website.v2.about",columns:[{title:"website.v2.about.heading",links:[item("website.v2.about.title","/about",Info,"website.v2.about.body"),item("website.v2.team.intro","/team",Users),item("website.v2.privacy","/privacy",ShieldCheck,"website.v2.hipaa"),item("website.v2.faq.full","/faq",CircleHelp),item("website.v2.careers","/careers",Briefcase)]}]}
];
export const WEBSITE_FOOTER_LINKS = [item("website.v2.about","/about",Info),item("website.v2.team","/team",Users),item("website.v2.partners","/partners",Building2),item("website.v2.faq","/faq",CircleHelp),item("websiteReferral","/referral",Send),item("website.v2.careers","/careers",Briefcase),item("website.v2.contact","/contact",Send),item("website.v2.privacy","/privacy",ShieldCheck),item("website.v2.directory","/directory",House)];
export const DAYLIGHT_PUBLIC_ROUTES = ["/care/everyday","/care/coming-home","/care/recovery","/care/advocates","/how-it-works","/cost","/faq","/partners","/platform","/privacy","/careers","/contact","/directory"];
