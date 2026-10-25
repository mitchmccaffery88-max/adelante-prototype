import type {ChartActor} from '../chartActions';
import type {StaffRole} from '../roles';
/** Preview principal grants append-only intake, never staff reads or clinical actions. */
export const websiteIntakeActor:ChartActor={role:'public_website_intake' as StaffRole};
export const careerRoles=['clinicians','psychiatry','recovery','coordinators','reentry','resources','peer','other'] as const;
export const contactTopics=['care','referral','partnering','careers','other'] as const;
export type ContactTopic=typeof contactTopics[number];
export type ResumeMetadata={name:string;size:number;type:string};
export const MAX_RESUME_BYTES=5*1024*1024;
export function resumeProblem(file:ResumeMetadata):'type'|'size'|null {
 const extension=file.name.split('.').pop()?.toLowerCase();
 const valid=extension==='pdf'?(file.type===''||file.type==='application/pdf'):extension==='docx'?(file.type===''||file.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'):false;
 if(!valid)return 'type';
 if(!Number.isFinite(file.size)||file.size<0||file.size>MAX_RESUME_BYTES)return 'size';
 return null;
}
export function contactShortcut(topic:string){return topic==='referral'?'/referral' as const:topic==='careers'?'/careers' as const:null;}
export function initialContactTopic(topic:unknown):ContactTopic|''{return contactTopics.some(t=>t===topic)?topic as ContactTopic:'';}
export type WebsiteIntake={kind:'career'|'contact';name:string;contact:string;topic:string;language:'en'|'es';message:string;license?:string;languages?:string;resume?:ResumeMetadata};
export type WebsiteInboxItem=Omit<WebsiteIntake,'resume'>&{id:string;label:'Career interest'|'Website message';createdAt:string;simulated:true;resume?:Pick<ResumeMetadata,'name'|'size'>};
const items:WebsiteInboxItem[]=[];
const listeners=new Set<()=>void>();
let revision=0;
export function subscribeWebsiteInbox(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function websiteInboxRevision(){return revision;}
export function canSubmitWebsiteIntake(actor:ChartActor){return actor.role===websiteIntakeActor.role&&!actor.staffId&&!actor.clinicianId;}
/** In-app demo read gate only, not a substitute for hosted authentication/RLS. No browser persistence or public read UI. */
export function listWebsiteInbox(actor:ChartActor):WebsiteInboxItem[]{return actor.role==='sys_admin'&&actor.staffId?structuredClone(items):[];}
export function saveWebsiteIntake(actor:ChartActor,input:WebsiteIntake){
 if(!canSubmitWebsiteIntake(actor))return {ok:false,reason:'Public website intake only.'};
 const topics=input.kind==='career'?careerRoles:contactTopics;
 if(!input.name.trim()||!input.contact.trim()||!topics.some(t=>t===input.topic)||(input.kind==='contact'&&!input.message.trim()))return {ok:false,reason:'Complete required fields.'};
 if(input.resume&&resumeProblem(input.resume))return {ok:false,reason:'Invalid résumé metadata.'};
 const row:WebsiteInboxItem={id:crypto.randomUUID(),kind:input.kind,label:input.kind==='career'?'Career interest':'Website message',name:input.name.trim().slice(0,200),contact:input.contact.trim().slice(0,300),topic:input.topic,language:input.language==='es'?'es':'en',message:input.message.trim().slice(0,4000),...(input.kind==='career'?{license:input.license?.slice(0,300),languages:input.languages?.slice(0,300),...(input.resume?{resume:{name:input.resume.name.slice(0,255),size:input.resume.size}}:{})}:{}),createdAt:new Date().toISOString(),simulated:true};
 items.push(row);revision++;listeners.forEach(l=>l());return {ok:true,id:row.id};
}