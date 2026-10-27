import { useEffect, useRef, useState } from 'react';
import { SafetyNotice988 } from '@/components/frontdoor/SafetyNotice988';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CircleAlert, Check, Ticket, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { StatusChip } from '@/components/ui/status-chip';
import { SignupVerificationHelp } from '@/components/identity/SignupVerificationHelp';
import { useI18n } from '@/lib/i18n';
import { runAction } from '@/lib/actions/runAction';
import { AdelanteEHR } from '@/lib/ehr';
import { signupActor, type SignupCommand, type SignupResult } from '@/lib/website/signupStore';
import { signupCopy, signupPaths, signupSteps } from '@/lib/website/signupCopy';
import { phoneKey, validAge } from '@/lib/signupMatch';
import { validateCredentialOnly } from '@/lib/signup';
import './flow.css';
export function PublicSignupSteps() {
 const {lang,setLang}=useI18n(); const c=signupCopy[lang]; const navigate=useNavigate();
 const [step,setStep]=useState(0); const [screen,setScreen]=useState<'steps'|'saved'|'verify'|'mismatch'|'blocked'|'matched'|'new'>('steps');
 const [draft,setDraft]=useState({firstName:'',lastName:'',dob:'',phone:'',email:'',preferredLanguage:lang,credentialKind:'password' as 'password'|'pin',source:'',helperName:''});
 const [credential,setCredential]=useState(''); const [confirm,setConfirm]=useState(''); const [path,setPath]=useState<'code'|'no_code'|'new'|''>(''); const [code,setCode]=useState(''); const [otp,setOtp]=useState('');
 const [sessionId,setSessionId]=useState(''); const started=useRef(false); const [outcome,setOutcome]=useState<SignupResult>(); const [error,setError]=useState(''); const [clock,setClock]=useState(0); const heading=useRef<HTMLHeadingElement>(null); const [safety,setSafety]=useState(false);
 function command(input:SignupCommand) { const r=runAction<SignupResult>('website_signup',signupActor,undefined,{via:'runSignupCommand',args:[signupActor,{sessionId,...input}]}); if(!r.ok){setError(c.error);return;} setSessionId(r.value.sessionId); setOutcome(r.value); if((r.value as SignupResult&{safety?:boolean}).safety)setSafety(true); if(['verify','mismatch','blocked','matched','new','saved'].includes(r.value.outcome)) setScreen(r.value.outcome as typeof screen); return r.value; }
 useEffect(()=>{if(!started.current){started.current=true;const r=runAction<SignupResult>('website_signup',signupActor,undefined,{args:[signupActor,{operation:'start'}]});if(r.ok)setSessionId(r.value.sessionId);}},[]);
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start',behavior:'instant'});setError('');},[step,screen]);
 useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),1000);setClock(Date.now());return()=>window.clearInterval(timer);},[]);
 const change=(key:keyof typeof draft,value:string)=>setDraft(d=>({...d,[key]:value}));
 function proceed(e:React.FormEvent){e.preventDefault();let err=''; if(step===0&&(!draft.firstName.trim()||!draft.lastName.trim()))err=c.error; if(step===1&&!validAge(draft.dob))err=c.ageError; if(step===2&&((!draft.phone&&!draft.email)||(draft.phone&&!phoneKey(draft.phone))||(draft.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))))err=c.contactError; if(step===3&&!path)err=c.error; if(step===4&&Object.keys(validateCredentialOnly({credentialKind:draft.credentialKind,credential,credentialConfirm:confirm})).length)err=c.credentialError; if(err){setError(err);return;} command({operation:'step',stepId:signupSteps[step]}); if(step<4)setStep(step+1);else command({operation:'finish',draft:{...draft,preferredLanguage:lang},path:path||'new',code}); }
 const back=()=>{setError('');if(screen!=='steps')setScreen('steps');else if(step>0)setStep(step-1);else navigate({to:'/start'});};
 const enter=(later=false)=>{if(!outcome?.patientId)return; AdelanteEHR.setCurrentPatientId(outcome.patientId);navigate({to:later?'/home':'/intake'});};
 const field=(key:'firstName'|'lastName'|'dob'|'phone'|'email',label:string,type='text',required=false)=><div className="space-y-2"><Label htmlFor={`signup-${key}`}>{label}{required?` — ${c.required}`:''}</Label><Input id={`signup-${key}`} type={type} autoComplete={key==='firstName'?'given-name':key==='lastName'?'family-name':key==='dob'?'bday':key==='phone'?'tel':'email'} value={draft[key]} onChange={e=>change(key,e.target.value)} /></div>;
 const body=screen==='steps'?c.hints[step]:screen==='matched'?c.matchedBody:screen==='new'?c.newBody:screen==='verify'?c.verifyBody:screen==='mismatch'?c.mismatchBody:screen==='saved'?c.saved:'';
 const title=screen==='steps'?c.steps[step]:screen==='matched'?c.matched.replace('{name}',draft.firstName.trim()):screen==='new'?c.new:screen==='verify'?c.verify:screen==='mismatch'?c.mismatch:screen==='saved'?c.saved:'';
 return <section className="public-flow" data-testid="public-signup"><div className="flex items-center justify-between gap-4"><Button variant="link" onClick={back}><ArrowLeft aria-hidden="true"/>{c.back}</Button><div className="flex gap-1"><Button variant={lang==='en'?'secondary':'ghost'} onClick={()=>setLang('en')}>EN</Button><Button variant={lang==='es'?'secondary':'ghost'} onClick={()=>setLang('es')}>ES</Button></div></div>
 <Card className="public-flow-card">{screen==='blocked'?<><h1 ref={heading} tabIndex={-1} className="public-flow-title">{lang==='es'?'Ayuda con tu cuenta':'Account help'}</h1><SignupVerificationHelp onBack={back} unframed/><Button variant="link" asChild><Link to="/auth">{c.help}</Link></Button><p>{c.frontdesk}</p></>:<>
 {screen==='steps'&&<p className="text-muted-foreground">{c.step} {step+1} {c.of} 5 · {5-step} {c.minutes}</p>}
 <h1 ref={heading} tabIndex={-1} className="public-flow-title">{title}</h1><p className="text-muted-foreground">{body}</p>
 {safety&&<SafetyNotice988 lang={lang}/>}
 {(step===4||screen==='verify'||screen==='saved')&&<StatusChip state="simulated" lang={lang} label={c.simulated}/>}
 {error&&<p role="alert" aria-live="polite" className="flex gap-2 text-attention"><CircleAlert className="shrink-0"/>{error}</p>}
 {screen==='steps'&&<form onSubmit={proceed} noValidate className="space-y-5">
 {step===0&&<>{field('firstName',c.first,'text',true)}{field('lastName',c.last,'text',true)}</>}
 {step===1&&field('dob',c.dob,'date',true)}
 {step===2&&<>{field('phone',c.phone,'tel')}{field('email',c.email,'email')}</>}
 {step===3&&<><RadioGroup value={path} onValueChange={v=>setPath(v as typeof path)} className="space-y-3">{signupPaths.map((p,i)=>{const Icon=[Ticket,Search,UserPlus][i];return <label key={p} className="public-flow-choice"><RadioGroupItem value={p}/>{Icon&&<Icon aria-hidden="true" className="shrink-0 text-path"/>}<span><strong className="block">{c.choices[i]}</strong><span className="text-muted-foreground">{c.choiceHints[i]}</span></span></label>;})}</RadioGroup><p className="text-muted-foreground">{c.unsure}</p>{path==='code'&&<div className="space-y-2"><Label htmlFor="signup-code">{c.code} — {c.required}</Label><Input id="signup-code" value={code} maxLength={16} placeholder="RE-____-____" onChange={e=>setCode(e.target.value.toUpperCase())}/><p>{c.codeHint}</p></div>}{path==='no_code'&&<div className="space-y-2"><Label htmlFor="signup-source">{c.source}</Label><select id="signup-source" value={draft.source} onChange={e=>change('source',e.target.value)}><option value="">—</option>{c.sources.map((s,i)=><option value={String(i)} key={s}>{s}</option>)}</select></div>}</>}
 {step===4&&<><p>{c.credentialNotice}</p><Label>{c.language}</Label><div className="flex gap-2"><Button type="button" variant={lang==='en'?'secondary':'outline'} onClick={()=>setLang('en')}>English</Button><Button type="button" variant={lang==='es'?'secondary':'outline'} onClick={()=>setLang('es')}>Español</Button></div><RadioGroup value={draft.credentialKind} onValueChange={v=>change('credentialKind',v)} className="flex flex-wrap gap-4">{(['password','pin'] as const).map(k=><label key={k} className="flex items-center gap-2"><RadioGroupItem value={k}/>{c[k]}</label>)}</RadioGroup><Label htmlFor="signup-credential">{c[draft.credentialKind]} — {c.required}</Label><Input id="signup-credential" type="password" autoComplete="new-password" value={credential} onChange={e=>setCredential(e.target.value)}/><Label htmlFor="signup-confirm">{c.confirm} — {c.required}</Label><Input id="signup-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/><Label htmlFor="signup-helper">{c.helper}</Label><Input id="signup-helper" value={draft.helperName} onChange={e=>change('helperName',e.target.value)}/></>}
 <Button className="public-flow-primary" type="submit" disabled={!sessionId}>{step===4?c.finish:c.continue}<ArrowRight aria-hidden="true"/></Button><p className="text-center text-muted-foreground">{c.next[step]}</p>
 <Button type="button" variant="link" className="w-full" onClick={()=>command({operation:'save',draft:{firstName:draft.firstName,lastName:draft.lastName,dob:draft.dob,phone:draft.phone,email:draft.email,preferredLanguage:lang,credentialKind:'password'}})}>{c.save}</Button>
 </form>}
 {screen==='saved'&&<Button className="public-flow-primary" onClick={()=>setScreen('steps')}>{c.resume}</Button>}
 {screen==='verify'&&<div className="space-y-4"><Label htmlFor="signup-otp">{c.otp}</Label><Input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}/><Button className="public-flow-primary" onClick={()=>{const r=command({operation:'verify',otp});if(r?.outcome==='verify')setError(c.otpError);}}>{c.connect}</Button><Button variant="outline" className="w-full" disabled={clock<(outcome?.resendAt??0)} onClick={()=>command({operation:'resend'})}>{c.resend}{clock<(outcome?.resendAt??0)?` (${Math.ceil(((outcome?.resendAt??0)-clock)/1000)})`:''}</Button><details className="border-t pt-3"><summary>{c.demo}</summary><output data-testid="signup-demo-code" className="font-mono">{outcome?.demoCode}</output></details></div>}
 {screen==='mismatch'&&<div className="space-y-3">{outcome?.limited?<p className="text-attention">{c.limit}</p>:<><Label htmlFor="retry-code">{c.code}</Label><Input id="retry-code" value={code} onChange={e=>setCode(e.target.value)}/><Button className="public-flow-primary" onClick={()=>command({operation:'retry',code})}>{c.retry}</Button></>}</div>}
 {(screen==='verify'||screen==='mismatch')&&<><Button variant="link" className="w-full" onClick={()=>command({operation:'continue'})}>{c.without}</Button><p className="text-muted-foreground">{c.withoutHint}</p></>}
 {(screen==='matched'||screen==='new')&&<><ul className="space-y-3">{(screen==='matched'?c.matchedChecks:c.newChecks).map(t=><li className="flex gap-2" key={t}><Check className="shrink-0 text-path" aria-hidden="true"/>{t}</li>)}</ul><Button className="public-flow-primary" onClick={()=>enter()}>{screen==='matched'?c.plan:c.intake}</Button>{screen==='new'&&<Button variant="link" className="w-full" onClick={()=>enter(true)}>{c.later}</Button>}</>}
 </>}</Card></section>;
}
