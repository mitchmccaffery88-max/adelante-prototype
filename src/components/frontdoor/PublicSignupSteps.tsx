import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SafetyNotice988 } from '@/components/frontdoor/SafetyNotice988';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CircleAlert, Check, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { StatusChip } from '@/components/ui/status-chip';
import { SignupVerificationHelp } from '@/components/identity/SignupVerificationHelp';
import { useI18n } from '@/lib/i18n';
import { runAction } from '@/lib/actions/runAction';
import { AdelanteEHR } from '@/lib/ehr';
import { signupActor, type SignupCommand, type SignupResult } from '@/lib/website/signupStore';
import { signupCopy } from '@/lib/website/signupCopy';
import { inviteCopy } from '@/lib/website/signupInviteCopy';
import { phoneKey, validAge } from '@/lib/signupMatch';
import { validateCredentialOnly, type CredentialKind } from '@/lib/signup';
import './flow.css';

/** Shared public command runner: every call goes through runAction('website_signup'). */
export function useSignupSession() {
 const [sessionId,setSessionId]=useState(''); const ref=useRef(''); const started=useRef(false); const [safety,setSafety]=useState(false);
 useEffect(()=>{if(!started.current){started.current=true;const r=runAction<SignupResult>('website_signup',signupActor,undefined,{args:[signupActor,{operation:'start'}]});if(r.ok){ref.current=r.value.sessionId;setSessionId(r.value.sessionId);}}},[]);
 function command(input:SignupCommand){const r=runAction<SignupResult>('website_signup',signupActor,undefined,{via:'runSignupCommand',args:[signupActor,{sessionId:ref.current,...input}]});if(!r.ok)return undefined;if((r.value as SignupResult&{safety?:boolean}).safety)setSafety(true);return r.value;}
 return {sessionId,command,safety};
}

export function FlowFrame({title,body,onBack,children,heading,safety}:{title:string;body?:string;onBack:()=>void;children:ReactNode;heading:React.RefObject<HTMLHeadingElement|null>;safety?:boolean}) {
 const {lang,setLang}=useI18n(); const c=signupCopy[lang];
 return <section className="public-flow" data-testid="public-signup"><div className="flex items-center justify-between gap-4"><Button variant="link" onClick={onBack}><ArrowLeft aria-hidden="true"/>{c.back}</Button><div className="flex gap-1"><Button variant={lang==='en'?'secondary':'ghost'} onClick={()=>setLang('en')}>EN</Button><Button variant={lang==='es'?'secondary':'ghost'} onClick={()=>setLang('es')}>ES</Button></div></div>
 <Card className="public-flow-card"><h1 ref={heading} tabIndex={-1} className="public-flow-title">{title}</h1>{body&&<p className="text-muted-foreground">{body}</p>}{safety&&<SafetyNotice988 lang={lang}/>}{children}</Card></section>;
}

export function ErrorLine({text}:{text:string}){return text?<p role="alert" aria-live="polite" className="flex gap-2 text-attention"><CircleAlert className="shrink-0"/>{text}</p>:null;}

/** One-time code entry for the contact the person typed (Simulated delivery, demo panel for testers). */
export function CodeEntry({outcome,onVerify,onResend}:{outcome?:SignupResult;onVerify:(otp:string)=>void;onResend:()=>void}) {
 const {lang}=useI18n(); const c=signupCopy[lang], t=inviteCopy[lang]; const [otp,setOtp]=useState(''); const [clock,setClock]=useState(0);
 useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),1000);setClock(Date.now());return()=>window.clearInterval(timer);},[]);
 const wait=clock<(outcome?.resendAt??0);
 return <form className="space-y-4" noValidate onSubmit={e=>{e.preventDefault();onVerify(otp);}}><StatusChip state="simulated" lang={lang} label={t.stillSimulated}/><p>{t.sentTo.replace('{to}',outcome?.contactMask??'')}</p><Label htmlFor="signup-otp">{t.code}</Label><Input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}/><Button className="public-flow-primary" type="submit">{t.check}</Button><Button type="button" variant="outline" className="w-full" disabled={wait} onClick={onResend}>{t.newCode}{wait?` (${Math.ceil(((outcome?.resendAt??0)-clock)/1000)})`:''}</Button><details className="border-t pt-3"><summary>{c.demo}</summary><output data-testid="signup-demo-code" className="font-mono">{outcome?.demoCode}</output></details></form>;
}

/** After setup: no more gates. Passwordless by default, optional PIN/password, remember me, optional "Who referred you?". */
export function SignupSetup({command,kind,name}:{command:(i:SignupCommand)=>SignupResult|undefined;kind:'matched'|'new';name:string}) {
 const {lang}=useI18n(); const c=signupCopy[lang], t=inviteCopy[lang]; const navigate=useNavigate();
 const [credentialKind,setKind]=useState<CredentialKind>('passwordless'); const [cred,setCred]=useState(''); const [confirm,setConfirm]=useState(''); const [remember,setRemember]=useState(true); const [source,setSource]=useState(''); const [error,setError]=useState('');
 function done(e:React.FormEvent){e.preventDefault(); if(credentialKind!=='passwordless'&&Object.keys(validateCredentialOnly({credentialKind,credential:cred,credentialConfirm:confirm})).length){setError(c.credentialError);return;}
  const r=command({operation:'set_signin',credentialKind,remember}); if(source)command({operation:'referral_source',source}); if(!r?.patientId){setError(c.error);return;} AdelanteEHR.setCurrentPatientId(r.patientId); navigate({to:'/intake'}); }
 return <><p className="font-bold">{kind==='matched'?c.matched.replace('{name}',name):c.new}</p><ul className="space-y-3">{(kind==='matched'?c.matchedChecks:c.newChecks).map(x=><li className="flex gap-2" key={x}><Check className="shrink-0 text-path" aria-hidden="true"/>{x}</li>)}</ul>
 <form className="space-y-4 border-t pt-4" noValidate onSubmit={done} data-testid="signup-setup"><h2 className="text-xl font-bold">{t.setupTitle}</h2><p className="text-muted-foreground">{t.setupBody}</p><ErrorLine text={error}/>
 <RadioGroup value={credentialKind} onValueChange={v=>setKind(v as CredentialKind)} className="space-y-2">{([['passwordless',t.passwordless],['pin',t.pinOpt],['password',t.passwordOpt]] as const).map(([k,l])=><label key={k} className="flex items-center gap-2"><RadioGroupItem value={k}/>{l}</label>)}</RadioGroup>
 {credentialKind!=='passwordless'&&<><Label htmlFor="signup-credential">{c[credentialKind]}</Label><Input id="signup-credential" type="password" autoComplete="new-password" value={cred} onChange={e=>setCred(e.target.value)}/><Label htmlFor="signup-confirm">{c.confirm}</Label><Input id="signup-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/><p className="text-muted-foreground">{c.credentialNotice}</p></>}
 <label className="flex items-center gap-2"><Checkbox checked={remember} onCheckedChange={v=>setRemember(v===true)}/>{t.remember}</label>
 {kind==='new'&&<div className="space-y-2"><Label htmlFor="signup-source">{t.referredBy}</Label><select id="signup-source" className="h-12 w-full rounded-sm border border-line-strong bg-surface px-3" value={source} onChange={e=>setSource(e.target.value)}><option value="">—</option>{c.sources.map((s,i)=><option value={String(i)} key={s}>{s}</option>)}</select></div>}
 <Button className="public-flow-primary" type="submit">{t.done}<ArrowRight aria-hidden="true"/></Button></form></>;
}

type Screen = 'identity'|'contact'|'verify'|'paper'|'mismatch'|'add_contact'|'blocked'|'matched'|'new';
const emailOk = (v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** 27 Oct (Mitch) not-invited path: name + DOB, contact + channel, one code, then automatic matching. */
export function PublicSignupSteps() {
 const {lang}=useI18n(); const c=signupCopy[lang], t=inviteCopy[lang]; const navigate=useNavigate();
 const {sessionId,command,safety}=useSignupSession();
 const [screen,setScreen]=useState<Screen>('identity'); const [afterVerify,setAfterVerify]=useState<'matched'|'new'>('new');
 const [draft,setDraft]=useState({firstName:'',lastName:'',dob:'',phone:'',email:'',source:'',helperName:''});
 const [channel,setChannel]=useState<'sms'|'email'>('sms'); const [code,setCode]=useState('');
 const [outcome,setOutcome]=useState<SignupResult>(); const [error,setError]=useState(''); const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start',behavior:'instant'});setError('');},[screen]);
 const change=(k:keyof typeof draft,v:string)=>setDraft(d=>({...d,[k]:v}));
 const full=()=>({...draft,phone:channel==='sms'?draft.phone:'',email:channel==='email'?draft.email:'',preferredLanguage:lang,credentialKind:'passwordless' as CredentialKind});
 const field=(key:'firstName'|'lastName'|'dob',label:string,type='text')=><div className="space-y-2"><Label htmlFor={`signup-${key}`}>{label} — {c.required}</Label><Input id={`signup-${key}`} type={type} autoComplete={key==='firstName'?'given-name':key==='lastName'?'family-name':'bday'} value={draft[key]} onChange={e=>change(key,e.target.value)} /></div>;
 const land=(r?:SignupResult)=>{if(!r){setError(c.error);return;}setOutcome(r);if(r.outcome==='blocked')setScreen('blocked');else if(r.outcome==='matched')setScreen(screen==='paper'||screen==='mismatch'?'add_contact':'matched');else if(r.outcome==='new')setScreen('new');else if(r.outcome==='verify'){if(screen==='verify')setError(t.codeWrong);else setScreen('verify');}else if(r.outcome==='mismatch')setScreen('mismatch');else setError(c.error);};
 function identity(e:React.FormEvent){e.preventDefault();if(!draft.firstName.trim()||!draft.lastName.trim())return setError(c.error);if(!validAge(draft.dob))return setError(c.ageError);command({operation:'step',stepId:'identity'});setScreen('contact');}
 function contact(e:React.FormEvent){e.preventDefault();const v=channel==='sms'?draft.phone:draft.email;if(channel==='sms'?!phoneKey(v):!emailOk(v))return setError(c.contactError);const r=command({operation:'send_code',channel,draft:full()});if(r?.outcome!=='verify')return setError(c.contactError);setOutcome(r);setScreen('verify');}
 function paper(e:React.FormEvent){e.preventDefault();if(!code.trim()||!draft.lastName.trim()||!validAge(draft.dob))return setError(c.error);setAfterVerify('matched');land(command({operation:'finish',path:'code',code,draft:{...full(),firstName:''}}));}
 const back=()=>{setError('');if(screen==='contact'||screen==='paper')setScreen('identity');else if(screen==='verify')setScreen(afterVerify==='matched'?'add_contact':'contact');else if(screen==='identity')navigate({to:'/start'});else setScreen('identity');};
 const contactForm=(onSubmit:(e:React.FormEvent)=>void)=><form onSubmit={onSubmit} noValidate className="space-y-5"><div className="space-y-2"><Label>{t.how}</Label><RadioGroup value={channel} onValueChange={v=>setChannel(v as 'sms'|'email')} className="flex flex-wrap gap-4"><label className="flex items-center gap-2"><RadioGroupItem value="sms"/>{t.text}</label><label className="flex items-center gap-2"><RadioGroupItem value="email"/>{t.emailOpt}</label></RadioGroup></div>{channel==='sms'?<div className="space-y-2"><Label htmlFor="signup-phone">{c.phone}</Label><Input id="signup-phone" type="tel" autoComplete="tel" value={draft.phone} onChange={e=>change('phone',e.target.value)}/></div>:<div className="space-y-2"><Label htmlFor="signup-email">{c.email}</Label><Input id="signup-email" type="email" autoComplete="email" value={draft.email} onChange={e=>change('email',e.target.value)}/></div>}<StatusChip state="simulated" lang={lang} label={t.stillSimulated}/><Button className="public-flow-primary" type="submit" disabled={!sessionId}>{t.sendCode}<ArrowRight aria-hidden="true"/></Button></form>;
 const titles:Record<Screen,[string,string?]>={identity:[t.idTitle,t.idBody],contact:[t.contactTitle,t.contactBody],verify:[t.codeTitle],paper:[t.paperTitle,t.paperBody],mismatch:[c.mismatch,c.mismatchBody],add_contact:[t.addContactTitle,t.addContactBody],blocked:[lang==='es'?'Ayuda con tu cuenta':'Account help'],matched:[c.matched.replace('{name}',draft.firstName.trim())],new:[c.new]};
 const [title,body]=screen==='matched'||screen==='new'?[t.setupTitle]:titles[screen];
 return <FlowFrame title={title} body={body} onBack={back} heading={heading} safety={safety}><ErrorLine text={error}/>
 {screen==='identity'&&<form onSubmit={identity} noValidate className="space-y-5">{field('firstName',c.first)}{field('lastName',c.last)}{field('dob',c.dob,'date')}<Button className="public-flow-primary" type="submit" disabled={!sessionId}>{c.continue}<ArrowRight aria-hidden="true"/></Button><Button type="button" variant="link" className="w-full" onClick={()=>setScreen('paper')}><Ticket aria-hidden="true"/>{t.haveCode}</Button></form>}
 {screen==='contact'&&contactForm(contact)}
 {screen==='add_contact'&&contactForm(contact)}
 {screen==='verify'&&<CodeEntry outcome={outcome} onVerify={otp=>{const r=command({operation:'verify_code',otp});if(r?.outcome==='matched'&&afterVerify==='matched'){setOutcome(r);setScreen('matched');return;}land(r);}} onResend={()=>{const r=command({operation:'send_code',channel});if(r)setOutcome(r);}}/>}
 {screen==='paper'&&<form onSubmit={paper} noValidate className="space-y-5"><div className="space-y-2"><Label htmlFor="signup-code">{c.code} — {c.required}</Label><Input id="signup-code" value={code} maxLength={16} placeholder="RE-____-____" onChange={e=>setCode(e.target.value.toUpperCase())}/><p>{c.codeHint}</p></div>{field('lastName',c.last)}{field('dob',c.dob,'date')}<Button className="public-flow-primary" type="submit" disabled={!sessionId}>{c.continue}<ArrowRight aria-hidden="true"/></Button></form>}
 {screen==='mismatch'&&<div className="space-y-3">{outcome?.limited?<p className="text-attention">{c.limit}</p>:<><Label htmlFor="retry-code">{c.code}</Label><Input id="retry-code" value={code} onChange={e=>setCode(e.target.value)}/><Button className="public-flow-primary" onClick={()=>land(command({operation:'retry',code}))}>{c.retry}</Button></>}<Button variant="link" className="w-full" onClick={()=>{setAfterVerify('new');setScreen('identity');}}>{t.without}</Button></div>}
 {screen==='blocked'&&<><SignupVerificationHelp onBack={back} unframed/><Button variant="link" asChild><Link to="/auth">{c.help}</Link></Button><p>{c.frontdesk}</p></>}
 {(screen==='matched'||screen==='new')&&<SignupSetup command={command} kind={screen} name={draft.firstName.trim()}/>}
 </FlowFrame>;
}
