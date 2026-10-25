/** Shared public-website motion helpers. One reduced-motion check for every layer. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
export const REVEAL_SELECTOR = ".daylight-band > .daylight-container, .website-page .page-header > .daylight-container";
export const MAGNETIC_SELECTOR = "[data-magnetic]";
export const MAGNETIC_RATIO = 0.15;
export const MAGNETIC_MAX = 4;
export const COUNT_DURATION = 1200;
export const SHUFFLE_DURATION = 350;
/** Ray pulses: 11s cycle, each ray 3.7s after the previous (mod 11s). */
export const PULSE_CYCLE = 11;
export const PULSE_STEP = 3.7;

const matches = (query: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
export function prefersReducedMotion(): boolean { return matches(REDUCED_MOTION_QUERY); }
/** Reveal/count layers only hide content after JS confirms observer support and motion is allowed. */
export function motionAllowed(): boolean { return typeof window !== "undefined" && typeof window.IntersectionObserver === "function" && !prefersReducedMotion(); }
export function magneticAllowed(): boolean { return !prefersReducedMotion() && matches(FINE_POINTER_QUERY); }

export function magneticOffset(pointer: number, center: number): number {
 const v = (pointer - center) * MAGNETIC_RATIO;
 return Math.max(-MAGNETIC_MAX, Math.min(MAGNETIC_MAX, Math.round(v * 100) / 100)) || 0;
}
export function pulseDelay(index: number): number { return Math.round(((index * PULSE_STEP) % PULSE_CYCLE) * 100) / 100; }
/** Ease-out count value at elapsed ms. */
export function countValue(target: number, elapsed: number, duration = COUNT_DURATION): number {
 if (elapsed >= duration) return target;
 const p = Math.max(0, elapsed / duration);
 return Math.round(target * (1 - Math.pow(1 - p, 3)));
}

/** Section reveals: once per visit; focus inside a pending section reveals it at once. Returns cleanup. */
export function installReveals(root: ParentNode = document): () => void {
 if (!motionAllowed()) return () => {};
 const observer = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) { show(e.target as HTMLElement); } }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
 const show = (el: HTMLElement) => { el.dataset.reveal = "shown"; observer.unobserve(el); };
 const scan = () => root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(el => { if (el.dataset.reveal) return; el.dataset.reveal = "pending"; observer.observe(el); });
 const onFocus = (event: Event) => { const pending = (event.target as Element | null)?.closest?.<HTMLElement>('[data-reveal="pending"]'); if (pending) show(pending); };
 scan();
 const mutations = new MutationObserver(scan); mutations.observe(root as Node, { childList: true, subtree: true });
 document.addEventListener("focusin", onFocus, true);
 return () => { observer.disconnect(); mutations.disconnect(); document.removeEventListener("focusin", onFocus, true); };
}

/** Magnetic Sign in / Get started: fine pointers only; translate is clamped so the hit area barely moves. */
export function installMagnetic(root: Document = document): () => void {
 if (!magneticAllowed()) return () => {};
 let active: HTMLElement | null = null; let base: DOMRect | null = null;
 const reset = () => { if (active) { active.style.translate = ""; active.removeAttribute("data-magnetic-active"); } active = null; base = null; };
 const move = (event: PointerEvent) => {
  if (event.pointerType !== "mouse") return;
  const el = (event.target as Element | null)?.closest?.<HTMLElement>(MAGNETIC_SELECTOR) ?? null;
  if (el !== active) reset();
  if (!el) return;
  if (!base) base = el.getBoundingClientRect();
  active = el; el.setAttribute("data-magnetic-active", "");
  const r = base;
  el.style.translate = `${magneticOffset(event.clientX, r.left + r.width / 2)}px ${magneticOffset(event.clientY, r.top + r.height / 2)}px`;
 };
 root.addEventListener("pointermove", move, { passive: true }); window.addEventListener("scroll", reset, { passive: true });
 return () => { root.removeEventListener("pointermove", move); window.removeEventListener("scroll", reset); reset(); };
}
