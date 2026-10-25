import type {StaffRole} from '../roles';
import {getPublicResources} from './publicDirectory';
export const PUBLIC_REPORT_ROLE='public_resource_reporter' as StaffRole;
export const publicReportActor={role:PUBLIC_REPORT_ROLE};
export const PUBLIC_REPORT_REASONS=['Closed','Wrong phone or address','Wrong hours','Something else'] as const;
export type PublicReportReason=typeof PUBLIC_REPORT_REASONS[number];
export type PublicResourceReport={id:string;resourceId:string;resourceType:'community_resource'|'naloxone_access_point';reason:PublicReportReason;note?:string;label:string;createdAt:string;simulated:true};
const reports:PublicResourceReport[]=[];const listeners=new Set<()=>void>();
export function subscribePublicReports(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function listPublicResourceReports(){return structuredClone(reports);}
export function canReportPublicResource(actor:{role:StaffRole;staffId?:string;clinicianId?:string}){return actor.role===PUBLIC_REPORT_ROLE&&!actor.staffId&&!actor.clinicianId;}
/** Narrow append-only anonymous queue item; no author/contact/identifier fields, no listing mutation. */
export function createPublicResourceReport(input:{actor:typeof publicReportActor;resourceId:string;resourceType:'community_resource'|'naloxone_access_point';reason:PublicReportReason;note?:string}){if(!canReportPublicResource(input.actor))return {ok:false,reason:'Public report actor required.'};if(!PUBLIC_REPORT_REASONS.includes(input.reason))return {ok:false,reason:'Choose a report reason.'};if(!getPublicResources().some(r=>r.id===input.resourceId&&r.type===input.resourceType))return {ok:false,reason:'Listing is not publicly available.'};const note=(input.note??'').slice(0,500).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[removed]').replace(/\b\d[\d\s()+./-]{6,}\d\b/g,'[removed]');const row:PublicResourceReport={id:crypto.randomUUID(),resourceId:input.resourceId,resourceType:input.resourceType,reason:input.reason,...(note.trim()?{note:note.trim()}:{}),label:`Public report: ${input.reason}`,createdAt:new Date().toISOString(),simulated:true};reports.push(row);listeners.forEach(l=>l());return {ok:true,report:structuredClone(row)};}
