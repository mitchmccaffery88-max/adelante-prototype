import {createFileRoute} from '@tanstack/react-router';
import {CareersPage} from '@/components/website/WebsiteForms';
import {websiteEn} from '@/lib/i18n.website';
export const Route=createFileRoute('/careers')({
 head:()=>({meta:[{title:websiteEn['website.v2.careers.title']+' — Adelante Health'},{name:'description',content:websiteEn['website.v2.careers.intro']},{property:'og:title',content:websiteEn['website.v2.careers.title']+' — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.careers.intro']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:CareersPage,
});
