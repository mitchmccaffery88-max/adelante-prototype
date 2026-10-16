import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("shell New creates a real Cathy task with one standard action event", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
  await page.evaluate(() => (window as unknown as { __adelante: { setActingStaff: (id: string, role: string) => void } }).__adelante.setActingStaff("s-cc2", "clinical_coordinator"));
  await page.getByTestId("staff-new-slot").getByTestId("dashboard-new-button").click();
  await page.getByTestId("dashboard-add-menu").getByRole("button", { name: "Task for me / my team", exact: true }).click();
  const drawer = page.getByTestId("dashboard-action-drawer");
  await drawer.getByPlaceholder("What needs to be done?").fill("8a2 audit parity task");
  await drawer.getByPlaceholder("Search name, DOB or program ID").fill("Luis");
  await drawer.getByTestId("dashboard-patient-picker").getByRole("button").first().click();
  const before = await page.evaluate(() => (window as unknown as { __adelante: { AdelanteEHR: typeof import("../src/lib/ehr").AdelanteEHR } }).__adelante.AdelanteEHR.listAuditEvents({ category: "action" }).length);
  await drawer.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  const result = await page.evaluate((before) => {
    const ehr = (window as unknown as { __adelante: { AdelanteEHR: typeof import("../src/lib/ehr").AdelanteEHR } }).__adelante.AdelanteEHR;
    return { tasks: ehr.listCaseTasks().filter(t => t.title === "8a2 audit parity task").map(t => t.assignedTo), events: ehr.listAuditEvents({ category: "action" }).slice(0, ehr.listAuditEvents({ category: "action" }).length - before).map(e => ({ action: e.action, id: e.detail?.actionId, actor: e.actorId })) };
  }, before);
  expect(result.tasks).toEqual(["s-cc2"]);
  expect(result.events).toEqual([{ action: "action.succeeded", id: "dashboard_task", actor: "s-cc2" }]);
});

test("Cathy's My work order and crisis banner agree with authorized header count", async ({ page }) => {
  await page.goto("/my-work");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
  await page.evaluate(() => (window as unknown as { __adelante: { setActingStaff: (id: string, role: string) => void } }).__adelante.setActingStaff("s-cc2", "clinical_coordinator"));
  const groups = page.locator('[data-testid^="workspace-section-"]');
  await expect(groups).toHaveCount(3);
  expect(await groups.evaluateAll(els => els.map(el => el.getAttribute("aria-label")))).toEqual(["Needs you", "Waiting on others", "Today"]);
  const crisis = page.getByTestId("staff-shell-header").getByRole("link", { name: /open crisis escalations/ });
  if (await crisis.count()) {
    const label = await crisis.getAttribute("aria-label");
    const count = label?.split(" ")[0];
    await expect(page.getByTestId("my-work-crisis-banner")).toContainText(`${count} open crisis escalation`);
    await expect(page.getByTestId("my-work-crisis-banner").getByRole("button")).toHaveCount(0);
    await page.getByTestId("my-work-crisis-banner").getByRole("link").click();
    await expect(page.getByRole("heading", { name: "Escalations", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("my-work-crisis-banner")).toBeVisible();
  }
  const axe = await new AxeBuilder({ page }).include('[data-testid="my-work-crisis-banner"]').analyze();
  expect(axe.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});

for (const width of [390, 768]) {
  test(`coarse staff controls and content tabs fit ${width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 1024 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/admin-content");
    await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
    await page.evaluate(() => (window as unknown as { __adelante: { setActingStaff: (id: string, role: string) => void } }).__adelante.setActingStaff("s-cc2", "clinical_coordinator"));
    for (const name of ["Browse", "Manage", "Review", "Audit", "Legal & consent"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    const smallHeader = await page.getByTestId("staff-shell-header").evaluate(el => Array.from(el.querySelectorAll<HTMLElement>("button,a")).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 48 || r.height < 48); }).map(e => e.getAttribute("aria-label")));
    expect(smallHeader).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const clearance = await page.evaluate(() => {
      const demo = document.querySelector('[data-testid="demo-controls-bar"]');
      const header = document.querySelector('[data-testid="staff-shell-header"]');
      return !!demo && !!header && header.getBoundingClientRect().top >= demo.getBoundingClientRect().bottom;
    });
    expect(clearance).toBe(true);
    if (width === 390) await page.getByRole("button", { name: "Open staff navigation", exact: true }).click();
    const nav = width === 390 ? page.getByTestId("staff-navigation-sheet") : page.getByRole("complementary", { name: "Staff navigation" });
    const smallNav = await nav.evaluate(el => Array.from(el.querySelectorAll<HTMLElement>("a,button")).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 48 || r.height < 48); }).map(e => e.textContent));
    expect(smallNav).toEqual([]);
    await context.close();
  });
}