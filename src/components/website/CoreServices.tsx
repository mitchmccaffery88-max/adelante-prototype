import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Brain, Stethoscope, HandHeart, Users, Sunrise, Compass, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { coreServices } from '@/lib/website/dianaConfig';
const icons = [Brain, Stethoscope, HandHeart, Users, Sunrise, Compass];
export function CoreServices() {
 const { t } = useI18n(); const [open, setOpen] = useState<string | null>(null);
 return <section id="core-services" aria-labelledby="core-title" className="daylight-band daylight-surface daylight-core"><div className="daylight-container"><h2 id="core-title">{t('website.v2.core')}</h2><p>{t('website.diana.language')}</p><div className="daylight-services">{coreServices.map((service, index) => {
 const Icon = icons[index] ?? Brain; const expanded = open === service.id;
 return <article key={service.id} className="daylight-service" onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) setOpen(service.id); }} onMouseLeave={() => { if (window.matchMedia('(hover: hover)').matches) setOpen(current => current === service.id ? null : current); }} onFocus={event => { if (window.matchMedia('(hover: hover)').matches && event.target instanceof HTMLElement && event.target.matches(':focus-visible')) setOpen(service.id); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null); }}>
  <span className="daylight-icon tint-path-soft"><Icon aria-hidden="true"/></span>
  <h3><Button variant="ghost" aria-expanded={expanded} aria-controls={`service-${service.id}`} onClick={() => setOpen(expanded ? null : service.id)}>{t(service.title)}<ChevronDown aria-hidden="true"/></Button></h3>
  <div id={`service-${service.id}`} className={`daylight-service-detail${expanded ? ' is-open' : ''}`} hidden={!expanded}><p>{t(service.body)}</p><Link to={service.to} className="daylight-quiet">{t('website.v2.learn')}</Link></div>
 </article>;
 })}</div></div></section>;
}