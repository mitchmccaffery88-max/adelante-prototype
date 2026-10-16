import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Quick-actions batch 3 — shared "+ New" on My work, Worklist, Case manager,
// Inbox and the content center. Opening any item writes no action audit.
type W = { __adelante: { AdelanteEHR: { listAuditEvents: (q: { category: string }) => unknown[] }; setActingStaff: (id: string, role: string) => void; go: (to: string) => void } };

async function actAs(page: Page, staffId: string, role: string, to: string) {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante);
  await page.evaluate(([s, r]) => (window as unknown as W).__adelante.setActingStaff(s, r), [staffId, role]);
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await expect(page).toHaveURL(new RegExp(to.replace("/", "\\/") + "$"));
}
const count = (page: Page) => page.evaluate(() => (window as unknown as W).__adelante.AdelanteEHR.listAuditEvents({ category: "action" }).length);
const slot = (page: Page) => page.getByTestId("staff-new-slot").getByRole("button");

async function axeMenu(page: Page, sel: string) {
  const axe = await new AxeBuilder({ page }).include(sel).analyze();
  expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
}

for (const path of ["/my-work", "/worklist", "/case-manager", "/inbox"]) {
  test(`therapist: ${path} + New opens the shared menu; patient actions ask for a patient`, async ({ page }) => {
    await actAs(page, "s-th1", "therapist", path);
    await expect(slot(page)).toHaveCount(1);
    await slot(page).click();
    const menu = page.getByTestId("dashboard-add-menu");
    await expect(menu.getByText("Quick actions")).toBeVisible();
    await expect(menu.getByRole("button", { name: "Medication order", exact: true })).toHaveCount(0);
    await axeMenu(page, '[data-testid="dashboard-add-menu"]');
    const before = await count(page);
    await menu.getByRole("button", { name: "Progress note", exact: true }).first().click();
    const drawer = page.getByTestId("dashboard-action-drawer");
    await expect(drawer.getByTestId("dashboard-patient-picker")).toBeVisible();
    expect(await count(page)).toBe(before);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });
}

test("billing: /inbox shows no + New (nothing permitted)", async ({ page }) => {
  await actAs(page, "s-bill1", "billing", "/inbox");
  await expect(page.getByTestId("staff-shell")).toBeVisible();
  await expect(slot(page)).toHaveCount(0);
});

test("clinical_coordinator: content center + New opens Manage without writing", async ({ page }) => {
  await actAs(page, "s-cc2", "clinical_coordinator", "/admin-content");
  await slot(page).click();
  const menu = page.getByTestId("content-add-menu");
  await expect(menu.getByTestId("content-item-consent_form_author")).toBeVisible();
  await axeMenu(page, '[data-testid="content-add-menu"]');
  const before = await count(page);
  await menu.getByTestId("content-item-content_create").click();
  await expect(page.getByTestId("new-content-id")).toBeFocused();
  expect(await count(page)).toBe(before);
});

test("therapist: content center + New hides consent form authoring", async ({ page }) => {
  await actAs(page, "s-th1", "therapist", "/admin-content");
  await slot(page).click();
  const menu = page.getByTestId("content-add-menu");
  await expect(menu.getByTestId("content-item-content_create")).toBeVisible();
  await expect(menu.getByTestId("content-item-consent_form_author")).toHaveCount(0);
});
