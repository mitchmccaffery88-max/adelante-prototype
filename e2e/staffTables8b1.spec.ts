import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function actAs(page: Page, id: string, role: string, name: string) {
  await page.goto("/clinician");
  await page.waitForFunction(() => Boolean((window as any).__adelante));
  await page.evaluate(([id, role]) => (window as any).__adelante.setActingStaff(id, role), [id, role]);
  await expect(page.getByTestId("acting-role-indicator")).toContainText(name);
}
async function go(page: Page, path: string) {
  await page.evaluate((path) => (window as any).__adelante.go(path), path);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}
const pilots = [
  { path: "/case-manager", table: "caseload-table", actor: "s-cm2", role: "ecm_provider", name: "Lupita Sanchez", sort: "Patient ID" },
  { path: "/eligibility-worklist", table: "coverage-worklist-table", actor: "s-th1", role: "therapist", name: "Marisol Reyes", sort: "Patient" },
  { path: "/notes-queue", table: "notes-queue-rows", actor: "s-th1", role: "therapist", name: "Marisol Reyes", sort: "Patient" },
  { path: "/worklist", table: "task-worklist-table", actor: "s-th1", role: "therapist", name: "Marisol Reyes", sort: "Task" },
];
for (const width of [1280, 390]) for (const pilot of pilots) {
  test(`${pilot.path} shared table keyboard, parity and axe at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1800 });
    await actAs(page, pilot.actor, pilot.role, pilot.name);
    await go(page, pilot.path);
    const table = page.getByTestId(pilot.table);
    await expect(table).toBeVisible();
    if (pilot.path === "/notes-queue") await page.getByRole("button", { name: /^Everyone \(/ }).click();
    if (pilot.path === "/worklist") await page.getByRole("button", { name: /^Current view \(/ }).click();
    const rows = table.locator("tbody > tr");
    if (pilot.path === "/case-manager") {
      // Rollback capture: 7 assigned rows, stable program IDs (runtime seed IDs vary).
      await expect(rows).toHaveCount(7);
      expect(await rows.locator('td[data-label="Patient ID"]').allTextContents()).toEqual([
        "ADL-2026-001", "ADL-2026-002", "ADL-2026-900", "ADL-2026-901", "ADL-2026-902", "ADL-2026-010", "ADL-2026-013",
      ]);
      await expect(table).not.toContainText("Daniel M.");
      await expect(table).not.toContainText("Rosa T.");
    }
    if (pilot.path === "/eligibility-worklist") await expect(rows).toHaveCount(20);
    if (pilot.path === "/notes-queue") await expect(rows).toHaveCount(7);
    if (pilot.path === "/worklist") {
      // The rollback discipline predicate: PMHNP-only rows are absent, not locked placeholders.
      const denied = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listCaseTasks().filter((t: any) => t.allowedRoles?.length && !t.allowedRoles.includes("therapist")).map((t: any) => t.id));
      expect(denied.length).toBeGreaterThan(0);
      for (const id of denied) await expect(table.locator(`[data-row-key="${id}"]`)).toHaveCount(0);
      const stat = Number(await page.locator('[data-stat="Total"]').textContent());
      await expect(rows).toHaveCount(Math.min(50, stat));
    }
    const sort = table.getByRole("button", { name: pilot.sort, exact: true });
    await sort.focus(); await page.keyboard.press("Enter");
    await expect(table.getByRole("columnheader", { name: pilot.sort, exact: true })).toHaveAttribute("aria-sort", "ascending");
    await page.keyboard.press("Enter");
    await expect(table.getByRole("columnheader", { name: pilot.sort, exact: true })).toHaveAttribute("aria-sort", "descending");
    const axe = await new AxeBuilder({ page }).include(`[data-testid="${pilot.table}"]`).analyze();
    expect(axe.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
test("billing retains rollback denial of clinical note rows, never lock placeholders", async ({ page }) => {
  await actAs(page, "s-bill1", "billing", "Tonya Price");
  await page.evaluate(() => (window as any).__adelante.go("/notes-queue"));
  await expect(page.getByText("Unsigned notes isn't available for your role")).toBeVisible();
  await expect(page.getByTestId("notes-queue-rows")).toHaveCount(0);
  await expect(page.locator('[data-row-key]')).toHaveCount(0);
});