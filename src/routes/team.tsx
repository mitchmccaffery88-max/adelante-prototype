import {createFileRoute} from '@tanstack/react-router';
import {TeamPage} from '@/components/website/RemainingInformationPages';
import {websiteEn} from '@/lib/i18n.website';
export const Route=createFileRoute('/team')({
 head:()=>({meta:[{title:websiteEn['website.v2.team.page.title']+' — Adelante Health'},{name:'description',content:websiteEn['website.v2.team.page.intro']},{property:'og:title',content:websiteEn['website.v2.team.page.title']+' — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.team.page.intro']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:TeamPage,
});
