import { useState } from 'react';
import { Pause, Play, Video, Sunrise, Languages, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import heroImg from '@/assets/hero-sunrise.jpg';
export function GradedSun({animated=false}:{animated?:boolean}) {
 return <svg viewBox="0 0 440 440" aria-hidden="true" className={animated?'daylight-sun daylight-sun-entrance':'daylight-sun'}><defs><linearGradient id={animated?'hero-sun-grade':'ready-sun-grade'} x1="0" y1="0" x2="0" y2="1"><stop className="sun-stop-start" offset="0"/><stop className="sun-stop-end" offset="1"/></linearGradient></defs><g className="daylight-sun-rays">{Array.from({length:12},(_,i)=><path key={i} transform={`rotate(${i*30} 220 220)`} d="M220 42V80"/>)}</g><circle cx="220" cy="220" r="112" fill={`url(#${animated?'hero-sun-grade':'ready-sun-grade'})`}/><path className="daylight-sun-path" d="M195 313c-8-39 54-46 55-83 0-29-43-33-42-59 0-16 17-30 31-35-6 23-17 30 0 45 36 28 26 59-5 82-18 14-32 28-28 50z"/></svg>;
}
export function HeroMedia({mode,paused:controlled,onPausedChange}:{mode:'sunrise'|'video';paused?:boolean;onPausedChange?:(paused:boolean)=>void}) {
 const {t}=useI18n();const [own,setOwn]=useState(false);const paused=controlled??own;const setPaused=(f:(p:boolean)=>boolean)=>{const next=f(paused);setOwn(next);onPausedChange?.(next);};
 return <div className={`daylight-media daylight-media-${mode}${paused?' hero-paused':''}`} data-testid="hero-media" data-mode={mode}>
 {mode==='sunrise'?<><div className="daylight-sun-glow"><GradedSun animated /></div>{([[Video,'website.v2.teletherapy'],[Sunrise,'website.v2.reentry.support'],[Languages,'website.v2.languages'],[BadgeCheck,'website.v2.cost.body']] as const).map(([Icon,key],i)=><span className={`daylight-service-chip chip-${i}`} key={key}><Icon aria-hidden="true"/>{t(key)}</span>)}</>:<><img src={heroImg} width="1920" height="1080" alt={t('websiteHeroAlt')}/><span className="daylight-video-trust">{t('websiteTrustLanguage')}</span></>}
 <Button variant="outline" className="daylight-pause" aria-pressed={paused} aria-label={t(paused?'website.v2.resume':'website.v2.pause')} onClick={()=>setPaused(p=>!p)}>{paused?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}<span>{t(paused?'website.v2.resume':'website.v2.pause')}</span></Button>
 </div>;
}
