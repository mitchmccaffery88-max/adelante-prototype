import { createFileRoute } from '@tanstack/react-router';
import { PublicDirectory } from '@/components/website/PublicDirectory';
import { websiteEn } from '@/lib/i18n.website';
export const Route = createFileRoute('/directory')({
 validateSearch:(search:Record<string,unknown>)=>({category:typeof search.category==='string'?search.category:undefined,county:typeof search.county==='string'?search.county:undefined,q:typeof search.q==='string'?search.q:undefined}),
 head:()=>({meta:[{title:'Resource Directory — Adelante Health'},{name:'description',content:websiteEn['website.v2.directory.body']},{property:'og:title',content:'Resource Directory — Adelante Health'},{property:'og:description',content:websiteEn['website.v2.directory.body']},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component:PublicDirectory,
});
