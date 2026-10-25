// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {JourneyPage} from './JourneyPage';
import {journeyPages} from '@/lib/website/journeyPages';
import {websiteEn} from '@/lib/i18n.website';
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:'en',t:(k:keyof typeof websiteEn)=>websiteEn[k]})}));
vi.mock('@tanstack/react-router',()=>({Link:({to,hash,search,children,...props}:any)=><a href={to+(search?.type?'?type='+search.type:'')+(hash?'#'+hash:'')} {...props}>{children}</a>}));
afterEach(cleanup);
for(const journey of journeyPages)it(`renders ${journey.id} from shared data`,()=>{render(<JourneyPage id={journey.id}/>);expect(screen.getByRole('heading',{level:1}).textContent).toBe(websiteEn[journey.title]);expect(document.querySelectorAll('.page-team .daylight-tile')).toHaveLength(6);expect(document.querySelectorAll('.page-topic-grid>li,.page-topic-path>li')).toHaveLength(journey.id==='recovery'?9:journey.id==='everyday'?6:3);if(journey.id==='advocates')expect(screen.getAllByRole('link',{name:'I want to help someone'})[0]?.getAttribute('href')).toBe('/referral?type=advocate');});
