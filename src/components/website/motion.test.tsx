// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { websiteEn } from '@/lib/i18n.website';
import { countValue, installMagnetic, installReveals, magneticOffset, motionAllowed, pulseDelay } from '@/lib/website/motion';
import { HeroMedia } from './HeroMedia';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (key: keyof typeof websiteEn) => websiteEn[key], lang: 'en' }) }));
const setMedia = (reduced: boolean, fine = true) => { window.matchMedia = ((q: string) => ({ matches: q.includes('reduce') ? reduced : fine, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia; };
const observed: Element[] = [];
beforeEach(() => { observed.length = 0; (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class { constructor(_cb: unknown) {} observe(el: Element) { observed.push(el); } unobserve() {} disconnect() {} }; });
afterEach(cleanup);

describe('reduced motion paths', () => {
 it('reduced motion never adds a hidden reveal state', () => {
  setMedia(true);
  document.body.innerHTML = '<main><section class="daylight-band"><div class="daylight-container"><a href="#">x</a></div></section></main>';
  expect(motionAllowed()).toBe(false);
  installReveals(document.querySelector('main')!);
  expect(document.querySelector('[data-reveal]')).toBeNull();
 });
 it('without IntersectionObserver content stays visible', () => {
  setMedia(false); delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
  document.body.innerHTML = '<main><section class="daylight-band"><div class="daylight-container">x</div></section></main>';
  installReveals(document.querySelector('main')!);
  expect(document.querySelector('[data-reveal]')).toBeNull();
 });
 it('motion allowed: section starts pending and focus reveals it at once', () => {
  setMedia(false);
  document.body.innerHTML = '<main><section class="daylight-band"><div class="daylight-container"><a href="#" id="l">x</a></div></section></main>';
  const stop = installReveals(document.querySelector('main')!);
  const box = document.querySelector<HTMLElement>('.daylight-container')!;
  expect(box.dataset.reveal).toBe('pending');
  document.getElementById('l')!.focus();
  expect(box.dataset.reveal).toBe('shown');
  stop();
 });
 it('magnetic is off with reduced motion and on touch-only devices', () => {
  document.body.innerHTML = '<a data-magnetic href="#">Get started</a>';
  const a = document.querySelector<HTMLElement>('a')!;
  for (const [reduced, fine] of [[true, true], [false, false]]) {
   setMedia(reduced, fine); const stop = installMagnetic();
   a.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 500, clientY: 500, pointerType: 'mouse' }));
   expect(a.style.translate).toBe(''); stop();
  }
 });
 it('magnetic offset is 15% of pointer offset, clamped to 4px', () => {
  expect(magneticOffset(110, 100)).toBe(1.5);
  expect(magneticOffset(200, 100)).toBe(4);
  expect(magneticOffset(0, 100)).toBe(-4);
 });
 it('counter reaches final number at 1.2s; ray pulses start 3.7s apart mod 11s', () => {
  expect(countValue(12, 1200)).toBe(12); expect(countValue(12, 0)).toBe(0);
  expect([0, 1, 2, 3].map(pulseDelay)).toEqual([0, 3.7, 7.4, 0.1]);
 });
});

describe('hero pause control', () => {
 it('toggles label and aria-pressed between Pause and Play, and reports state', () => {
  const change = vi.fn();
  render(<HeroMedia mode="sunrise" onPausedChange={change} />);
  const btn = screen.getByRole('button', { name: 'Pause animation' });
  expect(btn.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(btn);
  const play = screen.getByRole('button', { name: 'Play animation' });
  expect(play.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('hero-media').className).toContain('hero-paused');
  expect(change).toHaveBeenLastCalledWith(true);
 });
 it('Spanish play label is Reproducir animación', async () => {
  const { websiteEs } = await import('@/lib/i18n.website');
  expect(websiteEs['website.v2.resume']).toBe('Reproducir animación');
 });
});
