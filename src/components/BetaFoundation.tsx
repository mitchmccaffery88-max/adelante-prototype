import { useEffect, useState, type ReactNode } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FlaskConical, CircleAlert } from 'lucide-react';
import { BETA_COPY, type FoundationContext } from '@/lib/persistence/foundation';
import { foundationCommand, foundationContext } from '@/lib/persistence/foundation.functions';
/** Opt-in build gate, not an authorization signal. SQL and auth protect actions. */
export function BetaFoundation({children}:{children:ReactNode}) {
 const enabled=import.meta.env['VITE_BETA_FOUNDATION']==='true';
 const {lang}=useI18n(); const copy=BETA_COPY[lang==='es'?'es':'en'];
 const read=useServerFn(foundationContext); const attest=useServerFn(foundationCommand);
 const [identity,setIdentity]=useState<FoundationContext|null>(null); const [agreed,setAgreed]=useState(false); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 useEffect(()=>{ if(!enabled) return; let active=true; read().then(result=>{if(active)setIdentity(result)}).catch(()=>{if(active)setError('Sign in with your provisioned Beta email account.');}); return()=>{active=false}; },[enabled,read]);
 if(!enabled)return children;
 return <><aside role="status" className="flex min-h-12 items-center justify-center gap-2 border-b border-border bg-gold px-4 py-2 text-on-gold"><FlaskConical className="size-5"/>{copy.banner}</aside>{identity?.attested?children:<main className="mx-auto max-w-xl px-6 py-12"><h1 className="text-2xl font-bold">{copy.title}</h1><p className="my-6">{copy.statement}</p>{copy.draft&&<p className="mb-4 text-muted-foreground">{copy.draft}</p>}<label className="flex min-h-12 items-center gap-3"><Checkbox checked={agreed} onCheckedChange={value=>setAgreed(value===true)}/>{copy.agree}</label>{error&&<p role="alert" className="my-4 flex gap-2 text-attention"><CircleAlert className="size-5 shrink-0"/>{error}</p>}<Button className="mt-6 w-full min-h-12" disabled={!agreed||!identity?.account_id||busy} onClick={async()=>{setBusy(true);try{await attest({data:{command:'attest',value:lang==='es'?'es':'en'}});setIdentity(await read())}catch{setError('Your agreement could not be saved. Please try again.')}finally{setBusy(false)}}}>{copy.agree}</Button><a href="tel:988" className="mt-6 block text-urgent">{lang==='es'?'Llama al 988':'Call 988'}</a></main>}</>;
}