import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { WebsiteKey } from '@/lib/websiteMenus';
import { GradedSun } from './HeroMedia';
import { ReadyBand } from './ReadyBand';
import './daylight.css';
import './pages.css';
export function WebsitePage({title,intro,menu='website.v2.care',tint,icon:Icon,children,ready=true}:{title:WebsiteKey;intro:WebsiteKey;menu?:WebsiteKey;tint?:string;icon?:LucideIcon;children:ReactNode;ready?:boolean}){const {t}=useI18n();return <div className="daylight-landing website-page"><nav className="daylight-container page-breadcrumb" aria-label={t('website.v2.breadcrumb')}><Link to="/">{t('website.v2.home')}</Link><ChevronRight aria-hidden="true"/>{menu==='website.v2.team'?<span>{t(menu)}</span>:menu==='website.v2.partners'?title==='website.v2.partner.title'?<span>{t(menu)}</span>:<Link to="/partners">{t(menu)}</Link>:<Link to="/" hash={menu==='website.v2.about'?'landing-about':'journeys'}>{t(menu)}</Link>}<ChevronRight aria-hidden="true"/><span aria-current="page">{t(title)}</span></nav><section className={`page-header${tint?' tint-'+tint:''}`} aria-labelledby="page-title"><div className="daylight-container"><div>{Icon&&<span className="daylight-icon tint-path-faint"><Icon aria-hidden="true"/></span>}<h1 id="page-title">{t(title)}</h1><p>{t(intro)}</p></div><div aria-hidden="true" className="page-sun"><GradedSun/></div></div></section>{children}{ready&&<ReadyBand/>}</div>;}
