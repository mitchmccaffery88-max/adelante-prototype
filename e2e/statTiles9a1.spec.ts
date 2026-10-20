import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bootTables } from "./helpers/staffTables8b2";

test("9a-1 KPI scalar parity, dialog drill-down, accessible light/dark matrix", async ({ page }) => {
  await bootTables(page, "s-cc1", "clinical_coordinator", "/dashboards");
  const section = page.getByTestId("kpi-vs-target");
  await expect(section).toBeVisible();
  // Backlog scalars are the unchanged rollback formulas (draft note count
  // and open past-due tasks); display-only <11 masking is explicit.
  const expected = await page.evaluate(() => {
    const store = (window as any).__adelante.AdelanteEHR;
    const patients = store.listPatients();
    const notes = patients.flatMap((p: any) => p.progressNotes ?? []).filter((n: any) => !n.status || n.status === "draft").length;
    const now = Date.now();
    const tasks = store.listCaseTasks().filter((t: any) => t.status !== "done" && !(t.status === "snoozed" && t.snoozedUntil && Date.parse(t.snoozedUntil) > now) && Date.parse(t.dueDate) < now).length;
    return { unsigned_notes_count: notes, overdue_task_count: tasks };
  });
  for (const [key, value] of Object.entries(expected)) {
    await expect(section.getByTestId(`metric-${key}`)).toHaveText(value < 11 ? "<11" : String(value));
  }
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1800 });
    for (const mode of ["light", "dark"]) {
      await page.evaluate((m) => document.documentElement.classList.toggle("dark", m === "dark"), mode);
      const bounds = await section.evaluate((el) => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth }));
      expect(bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.scroll).toBeLessThanOrEqual(Math.ceil(bounds.width));
      const axe = await new AxeBuilder({ page }).include('[data-testid="kpi-vs-target"]').analyze();
      expect(axe.violations).toEqual([]);
      if (process.env.PHASE9A1_SHOTS) await section.screenshot({ path: `${process.env.PHASE9A1_SHOTS}/kpi-${width}-${mode}.png` });
    }
  }
  await section.locator('[data-metric-key="unsigned_notes_count"]').getByRole("button", { name: "Details" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboards/);
});

test("9a-1 billing cannot see the KPI section", async ({ page }) => {
  await bootTables(page, "s-bill1", "billing", "/billing");
  await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__adelante.go("/dashboards"));
  await expect(page.getByTestId("kpi-vs-target")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/dashboards$/);
});