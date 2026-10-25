import {createFileRoute} from '@tanstack/react-router';
import {ContactPage} from '@/components/website/WebsiteForms';
import {websiteEn} from '@/lib/i18n.website';
import {initialContactTopic} from '@/lib/website/websiteInbox';
export const Route=createFileRoute('/contact')({
 validateSearch:(search:Record<string,unknown>)=>({topic:initialContactTopic(search.topic)||undefined}),
head:()=>({meta:[{title:websiteEn['website.v2.contact.title']+' — Adelante Health'},{name:'description',content:websiteEn['website.v2.contact.intro']},{property:'og:title',content:websiteEn['website.v2.contact.title']+' — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.contact.intro']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:ContactRoute,
});

function ContactRoute(){const {topic}=Route.useSearch();return <ContactPage key={topic??'default'} topic={topic}/>;}
