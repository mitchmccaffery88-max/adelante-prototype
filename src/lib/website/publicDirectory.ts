import {listResources,isResourceVerified,subscribeResources,type CommunityResource} from '../communityResources';
import {listContent,subscribeContent} from '../contentPublishing';
import {liveNaloxoneAccessPoints,NALOXONE_ACCESS_POINTS} from '../safetyContent';
import {siteConfig} from './siteConfig';
import {statedCounty} from './resourceMetadata';
export const publicCategories = ['housing','food','transportation','employment','benefits','legal','recovery'] as const;
export type PublicCategory=typeof publicCategories[number];
export const CATEGORY_MAP:Record<PublicCategory,string[]>={housing:['housing','emergency_shelter'],food:['food'],transportation:['transportation'],employment:['employment'],benefits:['financial','healthcare'],legal:['legal'],recovery:['recovery_meetings','support_groups','naloxone_access_point']};
export type PublicResource={id:string;type:'community_resource'|'naloxone_access_point';name:string;nameEs?:string;description:string;descriptionEs?:string;city:string;county:string;hours:string;phone:string;website?:string;categoryId:string;showOnPublic:boolean;verified:boolean;checkedAt?:string};
export type DirectoryFilters={category?:string;county?:string;q?:string;demo?:boolean};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterPublicResources(records:PublicResource[],filters:DirectoryFilters={}) {return records.filter(r=>r.showOnPublic&&(r.verified||(filters.demo??siteConfig.publicDirectoryDemo))&&(!filters.category||!(filters.category in CATEGORY_MAP)||CATEGORY_MAP[filters.category as PublicCategory].includes(r.categoryId))&&(!filters.county||r.county===filters.county)&&(!filters.q||normalize(`${r.name} ${r.nameEs??''} ${r.description} ${r.descriptionEs??''} ${r.city}`).includes(normalize(filters.q.trim())))).sort((a,b)=>a.name.localeCompare(b.name));}
export function getPublicResourceRecords():PublicResource[]{
 const resources=listResources().map((r:CommunityResource):PublicResource=>({id:r.id,type:'community_resource',name:r.name,nameEs:r.nameEs,description:r.description,descriptionEs:r.descriptionEs,city:r.city??r.address.split(',').slice(1,2).join('').trim(),county:statedCounty(r),hours:r.hours,phone:r.phone,website:r.website,categoryId:r.categoryId,showOnPublic:r.showOnPublic??true,verified:isResourceVerified(r),checkedAt:r.verification?.verifiedAt}));
 const naloxone=new Map(liveNaloxoneAccessPoints().map(r=>[r.id,r]));for(const r of NALOXONE_ACCESS_POINTS)if(!naloxone.has(r.id))naloxone.set(r.id,r);for(const e of listContent('naloxone_access_point'))naloxone.set(e.id,{...naloxone.get(e.id),...e.body,id:e.id} as typeof NALOXONE_ACCESS_POINTS[number]);
 return [...resources,...[...naloxone.values()].map((r):PublicResource=>({id:r.id,type:'naloxone_access_point',name:r.name,nameEs:r.nameEs,description:r.what,descriptionEs:r.descriptionEs,city:r.city??'',county:statedCounty(r),hours:r.hours??'',phone:r.phone??'',website:r.website,categoryId:'naloxone_access_point',showOnPublic:r.showOnPublic??true,verified:r.verified===true,checkedAt:r.verifiedOn}))];
}
export function getPublicResources(filters:DirectoryFilters={}){return filterPublicResources(getPublicResourceRecords(),filters);}
export function getPublicCounties(){return [...new Set(getPublicResourceRecords().filter(r=>r.showOnPublic).map(r=>r.county).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
export function subscribePublicDirectory(listener:()=>void){const a=subscribeResources(listener),b=subscribeContent(listener);return()=>{a();b();};}
