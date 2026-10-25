import type { Page } from "@playwright/test";
/** Section reveals fade in once per visit; Axe must measure finished colors, not a mid-fade frame. */
export async function settleReveals(page: Page) {
 await page.evaluate(() => document.querySelectorAll<HTMLElement>("[data-reveal]").forEach(el => { el.dataset.reveal = "shown"; }));
 await page.waitForTimeout(450);
}
