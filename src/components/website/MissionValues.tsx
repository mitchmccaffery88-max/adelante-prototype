import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { coreValues } from '@/lib/website/dianaConfig';
export function MissionSection() {
 const { t } = useI18n();
 return <section aria-labelledby="mission-title" className="daylight-band daylight-surface"><div className="daylight-container"><h2 id="mission-title">{t('website.diana.mission')}</h2><p className="daylight-mission-copy">{t('websiteMission')}</p></div></section>;
}
export function ValuesBanner() {
 const { t } = useI18n(); const [paused, setPaused] = useState(false);
 return <section aria-labelledby="values-banner-title" className={`daylight-values-band${paused ? ' values-paused' : ''}`}>
  <h2 id="values-banner-title" className="sr-only">{t('website.diana.values')}</h2>
  <ul className="sr-only">{coreValues.map(key => <li key={key}>{t(key)}</li>)}</ul>
  <div className="daylight-values-window" aria-hidden="true"><div className="daylight-values-track">{[0, 1].map(copy => <div className="daylight-values-list" key={copy}>{coreValues.map(key => <span key={key}>{t(key)}</span>)}</div>)}</div></div>
  <Button variant="outline" className="website-secondary daylight-values-control" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play aria-hidden="true"/> : <Pause aria-hidden="true"/>}{t(paused ? 'website.diana.values.play' : 'website.diana.values.pause')}</Button>
 </section>;
}