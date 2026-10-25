import {Brain,Sunrise,Route,HeartHandshake,Video,ClipboardList,Users,HandHeart,type LucideIcon} from 'lucide-react';
import type {WebsiteKey} from '../websiteMenus';
export type JourneyId='everyday'|'coming-home'|'recovery'|'advocates';
export type JourneyData={id:JourneyId;title:WebsiteKey;intro:WebsiteKey;who:WebsiteKey;points:WebsiteKey[];tint:string;icon:LucideIcon;topics:{title:WebsiteKey;body:WebsiteKey}[];team:[LucideIcon,WebsiteKey][];path:boolean};
const topics=(group:string,count:number)=>Array.from({length:count},(_,i)=>({title:`website.v2.${group}.topic.${i}` as WebsiteKey,body:`website.v2.${group}.topic.${i}.body` as WebsiteKey}));
export const journeyPages:JourneyData[]=[
{id:'everyday',title:'website.v2.everyday',intro:'website.v2.journey.0.0',who:'websiteAnyoneBody',points:['website.v2.journey.0.1','website.v2.journey.0.2','website.v2.journey.0.3'],tint:'path-soft',icon:Brain,topics:topics('everyday',6),team:[[Brain,'websiteClinicians'],[Video,'websitePsychiatry'],[ClipboardList,'websiteCoordinators']],path:false},
{id:'coming-home',title:'website.v2.first90',intro:'website.v2.journey.1.0',who:'websiteComingHomeBody',points:['website.v2.coming.point1','website.v2.coming.point2','website.v2.journey.1.3'],tint:'sunrise-soft',icon:Sunrise,topics:topics('coming',3),team:[[Sunrise,'websiteReentry'],[ClipboardList,'websiteCoordinators'],[Users,'websiteResources']],path:true},
{id:'recovery',title:'website.v2.recovery',intro:'website.v2.journey.2.0',who:'website.v2.recovery.who',points:['website.v2.journey.2.1','website.v2.journey.2.2','website.v2.journey.2.3'],tint:'surface-sunk',icon:Route,topics:topics('recovery',9),team:[[HandHeart,'websiteRecovery'],[Brain,'websiteClinicians'],[Video,'websitePsychiatry']],path:true},
{id:'advocates',title:'website.v2.advocates',intro:'website.v2.journey.3.0',who:'websiteLovedOnesBody',points:['website.v2.journey.3.1','website.v2.journey.3.2','website.v2.journey.3.3'],tint:'path-faint',icon:HeartHandshake,topics:topics('consent',3),team:[[HeartHandshake,'websiteAdvocates'],[Users,'websiteResources'],[ClipboardList,'websiteCoordinators']],path:true}
];
