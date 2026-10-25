import {createFileRoute} from '@tanstack/react-router';
import {FaqPage} from '@/components/website/RemainingInformationPages';
import {websiteEn} from '@/lib/i18n.website';
export const Route=createFileRoute('/faq')({
 head:()=>({meta:[{title:websiteEn['website.v2.faq.full']+' — Adelante Health'},{name:'description',content:websiteEn['website.v2.faq.intro']},{property:'og:title',content:websiteEn['website.v2.faq.full']+' — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.faq.intro']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:FaqPage,
});
