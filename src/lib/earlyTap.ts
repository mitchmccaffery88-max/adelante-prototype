import { useEffect } from "react";

/**
 * Public website only: a tap on a marked button that lands before the page is
 * interactive is remembered once and replayed after hydration. Only <button>
 * elements carrying data-early-tap are touched; links (including tel:988) are
 * never intercepted and keep working as plain links.
 */
export const EARLY_TAP_SCRIPT = `(function(){document.addEventListener("click",function(e){if(window.__adelHydrated)return;var t=e.target&&e.target.closest&&e.target.closest("button[data-early-tap]");if(!t)return;e.preventDefault();window.__adelEarlyTap=t.getAttribute("data-early-tap");},true);})();`;

type EarlyWindow = Window & { __adelHydrated?: boolean; __adelEarlyTap?: string | null };

export function useEarlyTapReplay() {
  useEffect(() => {
    const w = window as EarlyWindow;
    w.__adelHydrated = true;
    const id = w.__adelEarlyTap;
    w.__adelEarlyTap = null;
    if (!id) return;
    const timer = window.setTimeout(() => {
      const el = Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-early-tap]")).find((b) => b.dataset.earlyTap === id && b.offsetParent !== null);
      el?.click();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
}
