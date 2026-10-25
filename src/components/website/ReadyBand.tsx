import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { GradedSun } from './HeroMedia';
export function LandingActions({magnetic=false}:{magnetic?:boolean}) { const {t}=useI18n();return <div className="daylight-actions"><Button asChild className="website-primary"><Link to="/start/signup" data-magnetic={magnetic||undefined}>{t('websiteStart')}<ArrowRight aria-hidden="true"/></Link></Button><Button asChild variant="outline" className="website-secondary"><Link to="/referral">{t('websiteHelp')}</Link></Button></div>; }
export function ReadyBand({id='ready'}:{id?:string}) { const {t}=useI18n();return <section id={id} aria-labelledby={`${id}-title`} className="daylight-ready daylight-band website-closing"><div className="daylight-container"><div className="daylight-ready-disc"><GradedSun/></div><h2 id={`${id}-title`}>{t('websiteReady')}</h2><p>{t('websiteReadyBody')}</p><LandingActions/></div></section>; }
