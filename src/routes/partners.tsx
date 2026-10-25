import {createFileRoute} from '@tanstack/react-router';
import {PartnersPage} from '@/components/website/RemainingInformationPages';
import {websiteEn} from '@/lib/i18n.website';
export const Route=createFileRoute('/partners')({
 head:()=>({meta:[{title:websiteEn['website.v2.partner.title']+' — Adelante Health'},{name:'description',content:websiteEn['website.v2.partners.intro']},{property:'og:title',content:websiteEn['website.v2.partner.title']+' — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.partners.intro']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:PartnersPage,
});
