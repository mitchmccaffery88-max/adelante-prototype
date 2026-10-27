import { useState } from 'react';
import { Pause, Play, Video, Sunrise, Languages, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import heroImg from '@/assets/hero-sunrise.jpg';
/** Real Adelante symbol, flat and unmodified (glow sits behind it). Sun centre in its 120×128 viewBox. */
export const SYMBOL_SRC='/brand/adelante-symbol.svg';
export const SYMBOL_SUN_CENTER={x:60/120,y:62/128};
export function HeroMedia({mode,paused:controlled,onPausedChange}:{mode:'sunrise'|'video';paused?:boolean;onPausedChange?:(paused:boolean)=>void}) {
 const {t}=useI18n();const [own,setOwn]=useState(false);const paused=controlled??own;const setPaused=(f:(p:boolean)=>boolean)=>{const next=f(paused);setOwn(next);onPausedChange?.(next);};
 return <div className={`daylight-media daylight-media-${mode}${paused?' hero-paused':''}`} data-testid="hero-media" data-mode={mode} data-future-media-slot="photo-video">
 {mode==='sunrise'?<><div className="daylight-sun-glow"><img src={SYMBOL_SRC} alt="" width="120" height="128" className="daylight-hero-symbol daylight-sun-entrance" data-testid="hero-symbol"/></div></>:<><img src={heroImg} width="1920" height="1080" alt={t('websiteHeroAlt')}/><span className="daylight-video-trust">{t('website.diana.caption.reentry')}</span></>}
 <Button variant="outline" className="daylight-pause" aria-pressed={paused} aria-label={t(paused?'website.v2.resume':'website.v2.pause')} onClick={()=>setPaused(p=>!p)}>{paused?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}<span>{t(paused?'website.v2.resume':'website.v2.pause')}</span></Button>
 </div>;
}
