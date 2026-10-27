import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusChip } from '@/components/ui/status-chip';
import { useI18n } from '@/lib/i18n';
import { signupCopy } from '@/lib/website/signupCopy';
import { inviteCopy } from '@/lib/website/signupInviteCopy';
import type { SignupResult } from '@/lib/website/signupStore';
import { ErrorLine, FlowFrame, SignupSetup, useSignupSession } from './PublicSignupSteps';

type Screen = 'loading'|'identity'|'mismatch'|'expired'|'resent'|'matched'|'new';

/**
 * 27 Oct (Mitch) — invite link front door. Tapping the link proves the contact
 * on file; last name + DOB confirm the person. Nothing from the referral is
 * shown before Matched, and the mismatch screen never says which part failed.
 */
export function InviteSignup({ token }: { token: string }) {
 const {lang}=useI18n(); const c=signupCopy[lang], t=inviteCopy[lang]; const navigate=useNavigate();
 const {sessionId,command,safety}=useSignupSession();
 const [screen,setScreen]=useState<Screen>('loading'); const [lastName,setLast]=useState(''); const [dob,setDob]=useState(''); const [firstName,setFirst]=useState(''); const [askFirst,setAskFirst]=useState(false);
 const [outcome,setOutcome]=useState<SignupResult>(); const [error,setError]=useState(''); const heading=useRef<HTMLHeadingElement>(null); const opened=useRef(false);
 useEffect(()=>{if(sessionId&&!opened.current){opened.current=true;const r=command({operation:'invite_open',token});setScreen(r?.outcome==='invite_identity'?'identity':'expired');}},[sessionId]);
 useEffect(()=>{heading.current?.focus();setError('');},[screen]);
 function confirm(e:React.FormEvent){e.preventDefault();if(!lastName.trim()||!dob)return setError(c.error);const r=command({operation:'invite_identity',lastName,dob});setOutcome(r);if(r?.outcome==='matched')setScreen('matched');else if(r?.outcome==='invite_expired')setScreen('expired');else setScreen('mismatch');}
 function without(e:React.FormEvent){e.preventDefault();if(!askFirst){setAskFirst(true);return;}if(!firstName.trim()||!lastName.trim()||!dob)return setError(c.error);const r=command({operation:'invite_continue',firstName,lastName,dob});setOutcome(r);if(r?.outcome==='new')setScreen('new');else if(r?.outcome==='blocked')navigate({to:'/auth'});else setError(c.error);}
 const titles:Record<Screen,string>={loading:t.inviteTitle,identity:t.inviteTitle,mismatch:t.noMatchTitle,expired:t.expiredTitle,resent:t.expiredTitle,matched:t.setupTitle,new:t.setupTitle};
 const bodies:Partial<Record<Screen,string>>={identity:`${t.inviteHello} ${t.inviteBody}`,mismatch:outcome?.limited?t.locked:t.noMatchBody,resent:t.resent};
 const idFields=<>{askFirst&&<div className="space-y-2"><Label htmlFor="invite-first">{t.firstName}</Label><Input id="invite-first" autoComplete="given-name" value={firstName} onChange={e=>setFirst(e.target.value)}/></div>}<div className="space-y-2"><Label htmlFor="invite-last">{c.last}</Label><Input id="invite-last" autoComplete="family-name" value={lastName} onChange={e=>setLast(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="invite-dob">{c.dob}</Label><Input id="invite-dob" type="date" autoComplete="bday" value={dob} onChange={e=>setDob(e.target.value)}/></div></>;
 return <FlowFrame title={titles[screen]} body={bodies[screen]} onBack={()=>navigate({to:'/start'})} heading={heading} safety={safety}><ErrorLine text={error}/>
 {screen==='identity'&&<form className="space-y-5" noValidate onSubmit={confirm}>{idFields}<Button className="public-flow-primary" type="submit">{t.confirm}<ArrowRight aria-hidden="true"/></Button></form>}
 {screen==='mismatch'&&<form className="space-y-4" noValidate onSubmit={without}>{(askFirst||!outcome?.limited)&&idFields}{!outcome?.limited&&!askFirst&&<Button type="button" className="public-flow-primary" onClick={e=>confirm(e as unknown as React.FormEvent)}>{t.tryAgain}</Button>}<Button type="submit" variant={outcome?.limited||askFirst?'default':'link'} className={outcome?.limited||askFirst?'public-flow-primary':'w-full'}>{t.without}</Button></form>}
 {screen==='expired'&&<div className="space-y-3"><Button className="public-flow-primary" onClick={()=>{const r=command({operation:'invite_resend',token});setOutcome(r);setScreen('resent');}}>{t.sendLink}</Button><Button variant="link" className="w-full" onClick={()=>{command({operation:'invite_lost',token});navigate({to:'/start/signup'});}}>{t.lost}</Button></div>}
 {screen==='resent'&&<><StatusChip state="simulated" lang={lang} label={t.stillSimulated}/>{outcome?.demoLink&&<details className="border-t pt-3"><summary>{c.demo}</summary><a className="text-path underline" data-testid="invite-demo-link" href={outcome.demoLink}>{outcome.demoLink}</a></details>}<Button variant="link" className="w-full" onClick={()=>{command({operation:'invite_lost',token});navigate({to:'/start/signup'});}}>{t.lost}</Button></>}
 {(screen==='matched'||screen==='new')&&<SignupSetup command={command} kind={screen} name={''}/>}
 </FlowFrame>;
}
