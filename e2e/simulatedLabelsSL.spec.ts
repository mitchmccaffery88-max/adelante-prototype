import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bootTables } from "./helpers/staffTables8b2";

test.use({ viewport: { width: 390, height: 1800 } });
for (const [route, selector, text] of [
  ["/clinician", "[data-testid='refill-card']", "Simulated — not sent to a pharmacy"],
  ["/billing", "[data-testid='billing-workspace']", "Simulated — no payment processed or claim transmitted"],
  ["/admin-vendors", "[data-simulated-flag='erx_simulated']", "Simulated — not sent to a pharmacy"],
] as const) {
  test(`SL 390px ${route}: integration label and axe`, async ({ page }) => {
    await bootTables(page, "s-admin1", "sys_admin", route);
    const surface = page.locator(selector).first();
    await expect(surface).toBeVisible();
    await expect(surface).toContainText(text);
    expect(await surface.evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(390);
    const result = await new AxeBuilder({ page }).include(selector).analyze();
    expect(result.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
}
test("SL 390px Spanish medication: pharmacy disclaimer, single review notice and axe", async ({ page }) => {
  await bootTables(page, "s-admin1", "sys_admin", "/clinician");
  await page.evaluate(() => {
    const app = (window as any).__adelante;
    const p = app.AdelanteEHR.listPatients().find((p: any) => p.firstName === "Luis");
    if (!p) throw new Error("Missing Luis");
    app.AdelanteEHR.setCurrentPatientId(p.id);
    app.go("/medications");
  });
  const card = page.getByTestId("my-medications-card");
  await expect(card).toBeVisible();
  const switcher = page.getByRole("button", { name: "Switch language to Spanish" });
  if (await switcher.count()) await switcher.click();
  await expect(card).toContainText("Simulado — no se envía a una farmacia");
  await expect(page.getByText("Borrador — pendiente de revisión de traducción", { exact: true })).toHaveCount(1);
  expect(await card.evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(390);
  const result = await new AxeBuilder({ page }).include("[data-testid='my-medications-card']").analyze();
  expect(result.violations.filter(v => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});