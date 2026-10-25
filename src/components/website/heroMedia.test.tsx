// @vitest-environment jsdom
import { describe,it,expect,vi } from 'vitest';
import { render,screen,cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { HeroMedia } from './HeroMedia';
import { websiteEn } from '@/lib/i18n.website';
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(key:keyof typeof websiteEn)=>websiteEn[key]})}));
afterEach(cleanup);
describe('alternate hero media setting',()=>{it('video setting uses the existing poster until a video is supplied',()=>{render(<HeroMedia mode="video"/>);expect(screen.getByTestId('hero-media').getAttribute('data-mode')).toBe('video');expect(screen.getByRole('img').getAttribute('alt')).toBe('A person standing on a quiet road at sunrise, looking toward an open path');expect(screen.getByRole('img').getAttribute('src')).toContain('hero-sunrise');expect(screen.getByRole('button',{name:'Pause animation'})).toBeTruthy();});});
