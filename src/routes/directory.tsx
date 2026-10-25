import { createFileRoute } from '@tanstack/react-router';
import { WebsitePlaceholder } from '@/components/WebsitePlaceholder';
import { websiteEn } from '@/lib/i18n.website';
export const Route = createFileRoute('/directory')({
 head:()=>({meta:[{title:'Resource Directory — Adelante Health'},{name:'description',content:websiteEn['website.v2.directory.body']},{property:'og:title',content:'Resource Directory — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.directory.body']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:()=> <WebsitePlaceholder title="website.v2.directory" intro="website.v2.directory.body" menu="website.v2.care"/>,
});
