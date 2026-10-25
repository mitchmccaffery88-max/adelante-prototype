import {createFileRoute} from '@tanstack/react-router';
import {CostPage} from '@/components/website/RemainingInformationPages';
import {websiteEn} from '@/lib/i18n.website';
export const Route=createFileRoute('/cost')({
 head:()=>({meta:[{title:websiteEn['website.v2.cost.title']+' — Adelante Health'},{name:'description',content:websiteEn['website.v2.cost.intro']},{property:'og:title',content:websiteEn['website.v2.cost.title']+' — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.cost.intro']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:CostPage,
});
