import type { ChartActor } from '../chartActions';
import { AdelanteEHR } from '../ehr';
import { otpAllowed, OTP_RESEND_MS } from '../signupMatch';
import { canUseSignup } from './signupStore';
type Reset = { code: string; at: number; tries: number; used: boolean };
const resets = new Map<string,Reset>();
export function authPreview(actor: ChartActor, input: {operation:'signin'|'reset'|'verify';resetId?:string;code?:string}, now=Date.now()) {
 if(!canUseSignup(actor)) throw new Error('Public preview only.');
 let id=input.resetId; let success=false; let r=id?resets.get(id):undefined;
 if(input.operation==='reset'&&(!r||now-r.at>=OTP_RESEND_MS)) {id=crypto.randomUUID();r={code:String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),at:now,tries:0,used:false};resets.set(id,r);}
 if(input.operation==='verify'&&r){success=!r.used&&otpAllowed(r.at,r.tries,now)&&r.code===input.code;r.tries++;if(success)r.used=true;}
 const event=AdelanteEHR._recordAudit({category:'clinical',action:input.operation==='signin'?'signin_preview_failed':input.operation==='reset'?'reset_preview_code':'reset_preview_verified',actorRole:actor.role,detail:{resetId:id,reasonCode:success?'verified':'simulated',simulated:true}});
 return {resetId:id,demoCode:input.operation==='reset'?r?.code:undefined,resendAt:r?r.at+OTP_RESEND_MS:undefined,success,event};
}
