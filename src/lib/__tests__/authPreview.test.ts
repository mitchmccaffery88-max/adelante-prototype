import {describe,it,expect} from 'vitest';
import {authPreview} from '../website/authPreview';
import {signupActor} from '../website/signupStore';
import {runAction} from '../actions/runAction';
const invoke=(input:Parameters<typeof authPreview>[1],now:number)=>{const r=runAction<ReturnType<typeof authPreview>>('website_auth_preview',signupActor,undefined,{args:[signupActor,input,now]});if(!r.ok)throw new Error(r.reason);return r.value;};
describe('simulated reset rules',()=>{
 it('six digits, resend after thirty seconds, expires at ten minutes',()=>{const a=invoke({operation:'reset'},1000);expect(a.demoCode).toMatch(/^\d{6}$/);const early=invoke({operation:'reset',resetId:a.resetId},30999);expect(early.resetId).toBe(a.resetId);const later=invoke({operation:'reset',resetId:a.resetId},31000);expect(later.resetId).not.toBe(a.resetId);expect(invoke({operation:'verify',resetId:a.resetId,code:a.demoCode},601000).success).toBe(false);});
 it('five tries and single-use',()=>{const a=invoke({operation:'reset'},1000);for(let i=0;i<5;i++)expect(invoke({operation:'verify',resetId:a.resetId,code:'invalid'},1001+i).success).toBe(false);expect(invoke({operation:'verify',resetId:a.resetId,code:a.demoCode},1010).success).toBe(false);const b=invoke({operation:'reset'},2000);expect(invoke({operation:'verify',resetId:b.resetId,code:b.demoCode},2001).success).toBe(true);expect(invoke({operation:'verify',resetId:b.resetId,code:b.demoCode},2002).success).toBe(false);});
});
