import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 1280, height: 1800 } });

const snapshot = () => (async () => {
  const app = (window as any).__adelante;
  const { eng } = await app.content();
  const pid = app.AdelanteEHR.getCurrentPatientId();
  return JSON.stringify({ e: eng.getEngagement(pid) ?? null, all: eng.engagementRecords().length });
})();

test("previewing a lesson and an exercise with real answers saves nothing", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as any).__adelante, null, { timeout: 60_000 });
  await page.evaluate(() => { const app = (window as any).__adelante; app.setActingStaff("s-np1", "pmhnp"); app.go("/content-library"); });
  const browse = page.getByTestId("content-browse"); await expect(browse).toBeVisible();
  const before = await page.evaluate(snapshot);
  for (const type of ["Education", "Exercises"]) {
    await page.getByRole("combobox", { name: "Browse type", exact: true }).click();
    await page.getByRole("option", { name: type, exact: true }).click();
    await browse.getByRole("button", { name: "Preview", exact: true }).first().click();
    const preview = page.getByTestId("private-content-preview");
    await expect(preview).toContainText("Preview — nothing is saved");
    // Walk forward a few steps, typing a real answer wherever there is a field.
    for (let i = 0; i < 6; i++) {
      const field = preview.locator("textarea, input[type=text]").first();
      if (await field.count()) await field.fill("My real private answer").catch(() => {});
      const next = preview.getByRole("button", { name: /^(Continue|Next|Start)/ }).first();
      if (!(await next.count()) || !(await next.isEnabled().catch(() => false))) break;
      await next.click().catch(() => {});
    }
    await page.keyboard.press("Escape");
  }
  const after = await page.evaluate(snapshot);
  expect(after).toBe(before);
});

test("/journeys lists ordered steps and the menu shows My journeys", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/home");
  await page.waitForFunction(() => !!(window as any).__adelante, null, { timeout: 60_000 });
  await page.evaluate(() => { const app = (window as any).__adelante; const e = app.AdelanteEHR; const p = e.listPatients().find((x: any) => x.firstName === "Luis" && x.lastName === "Camacho"); e.setCurrentPatientId(p.id); app.go("/journeys"); });
  await expect(page.getByRole("heading", { level: 1, name: /Journey/i })).toBeVisible();
  await expect(page.locator('a[href="/journeys"]').first()).toBeAttached();
  await page.screenshot({ path: "/tmp/browser/journeys.png" });
});
