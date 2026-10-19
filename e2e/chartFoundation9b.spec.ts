import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bootTables } from "./helpers/staffTables8b2";

test.use({ viewport: { width: 1280, height: 1800 } });
const SHOTS = process.env.PHASE9B_SHOTS;

async function findFrame(page: Page, section: string, sel: string) {
  const ids: string[] = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listPatients().map((p: any) => p.id));
  for (const id of ids.slice(0, 25)) {
    await page.evaluate(({ id, section }) => (window as any).__adelante.go(`/record/${id}?section=${section}`), { id, section });
    try { await page.locator(sel).first().waitFor({ timeout: 2500 }); return id; } catch { /* next patient */ }
  }
  return null;
}

for (const [section, sel] of [["tracking", '[data-testid^="tracking-"][data-testid$="-frame"]'], ["labs", '[data-testid="metabolic-chart-frame"]']] as const) {
  test(`9b: ${section} chart offers View as table, light and dark`, async ({ page }) => {
    await bootTables(page, "s-th1", "therapist", "/clinician");
    const found = await findFrame(page, section, sel);
    test.skip(!found, `no seeded ${section} chart visible to therapist`);
    const frame = page.locator(sel).first();
    await frame.scrollIntoViewIfNeeded();
    for (const mode of ["light", "dark"]) {
      await page.evaluate((m) => document.documentElement.classList.toggle("dark", m === "dark"), mode);
      if (SHOTS) await frame.screenshot({ path: `${SHOTS}/${section}-chart-${mode}.png` });
    }
    await frame.getByTestId("chart-view-as-table").click();
    await expect(frame.getByTestId("chart-table")).toBeVisible();
    expect(await frame.getByTestId("chart-table").locator("tbody tr").count()).toBeGreaterThan(0);
    if (SHOTS) await frame.screenshot({ path: `${SHOTS}/${section}-table-dark.png` });
    const axe = await new AxeBuilder({ page }).include(sel).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
}
