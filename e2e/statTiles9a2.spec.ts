import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bootTables } from "./helpers/staffTables8b2";

const shown = (n: number) => (n < 11 ? "<11" : String(n));

async function matrix(page: Page, selector: string, name: string) {
  const region = page.locator(selector).first();
  await expect(region).toBeVisible();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1800 });
    for (const mode of ["light", "dark"]) {
      await page.evaluate((m) => document.documentElement.classList.toggle("dark", m === "dark"), mode);
      const axe = await new AxeBuilder({ page }).include(selector).analyze();
      expect(axe.violations, `${name} ${width} ${mode}`).toEqual([]);
      if (process.env.PHASE9A2_SHOTS) await region.screenshot({ path: `${process.env.PHASE9A2_SHOTS}/${name}-${width}-${mode}.png` });
    }
  }
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 1280, height: 1800 });
}

test("9a-2 /admin tiles: parity, suppression, axe light/dark", async ({ page }) => {
  await bootTables(page, "s-admin1", "sys_admin", "/admin");
  const expected = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.stats().enrolled);
  await expect(page.getByTestId("admin-kpi-enrolled").locator("p.text-3xl")).toHaveText(shown(expected));
  await expect(page.getByTestId("admin-kpis").locator("[data-chart-status]")).toHaveCount(0);
  await matrix(page, '[data-testid="admin-kpis"]', "admin-kpis");
});

test("9a-2 /dashboards CalAIM and groups: axe light/dark, no amber", async ({ page }) => {
  await bootTables(page, "s-cc1", "clinical_coordinator", "/dashboards");
  const calaim = page.locator('section[aria-labelledby="calaim-heading"]');
  await expect(calaim).toBeVisible();
  expect(await calaim.innerHTML()).not.toMatch(/amber|emerald|text-navy/);
  await matrix(page, 'section[aria-labelledby="calaim-heading"]', "dashboards-calaim");
  await matrix(page, 'section[aria-labelledby="group-util-heading"]', "dashboards-groups");
});

test("9a-2 /reporting tiles: suppression, axe light/dark", async ({ page }) => {
  await bootTables(page, "s-cc1", "clinical_coordinator", "/reporting");
  const tiles = page.locator('[data-testid="timely-access-report"] [data-stat-tile]');
  await expect(tiles).toHaveCount(3);
  // Every rendered aggregate number on the converted tiles is either "<11",
  // a value of 11+, a percent/median, or "No live metric yet".
  for (const text of await page.locator('[data-testid="request-to-booked"] [data-stat-tile] p.text-3xl').allTextContents()) {
    expect(text === "<11" || Number(text) >= 11).toBe(true);
  }
  await matrix(page, '[data-testid="timely-access-report"]', "reporting-timely");
  await matrix(page, '[data-testid="request-to-booked"]', "reporting-request-to-booked");
});

test("9a-2 billing cannot see clinical tiles", async ({ page }) => {
  await bootTables(page, "s-bill1", "billing", "/billing");
  await expect(page.getByTestId("billing-workspace")).toBeVisible();
  for (const path of ["/dashboards", "/reporting", "/admin"]) {
    await page.evaluate((p) => (window as any).__adelante.go(p), path);
    await page.waitForTimeout(500);
    await expect(page.locator("[data-tile^='calaim'], [data-tile^='group-'], [data-testid='admin-kpis'], [data-testid='reporting-population-health'], [data-testid='request-to-booked']")).toHaveCount(0);
  }
});

test("9a-2 a non-Part-2 role sees no SUD tiles", async ({ page }) => {
  await bootTables(page, "s-cm1", "ecm_provider", "/reporting");
  await expect(page.getByTestId("timely-access-report")).toBeVisible();
  await expect(page.getByTestId("reporting-asam")).toHaveCount(0);
  await expect(page.locator("#caloms")).toHaveCount(0);
  await expect(page.getByTestId("pop-tile-levels")).toHaveCount(0);
});
