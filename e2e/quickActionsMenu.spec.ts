import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Quick-actions batch 2 — the shared "+ New" menu on the three existing
// launchers: quick actions on top (the role's approved defaults), All
// actions with search below, and the registry's permission check as the
// only gate. No existing spec lines were changed for this batch.
type W = { __adelante: { setActingStaff: (id: string, role: string) => void; go: (to: string) => void; AdelanteEHR: { listPatients: () => { id: string }[] } } };

async function actAs(page: Page, staffId: string, role: string, to: string) {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante);
  await page.evaluate(([s, r]) => (window as unknown as W).__adelante.setActingStaff(s, r), [staffId, role]);
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
}
const slotButton = (page: Page) => page.getByTestId("staff-new-slot").getByRole("button").first();

test("therapist on /clinician: quick actions on top, prescriber actions hidden, search filters", async ({ page }) => {
  await actAs(page, "s-th1", "therapist", "/clinician");
  await slotButton(page).click();
  const menu = page.getByTestId("dashboard-add-menu");
  await expect(menu.getByText("Quick actions")).toBeVisible();
  await expect(menu.getByText("All actions")).toBeVisible();
  await expect(menu.getByRole("button", { name: "Progress note", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Book a visit", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Medication order", exact: true })).toHaveCount(0);
  // Search narrows All actions by the registry label.
  await menu.getByLabel("Search actions").fill("task");
  await expect(menu.getByRole("button", { name: "Task for me / my team", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Book a visit", exact: true })).toHaveCount(0);
});

test("billing on /billing: claims quick actions, no clinical actions", async ({ page }) => {
  await actAs(page, "s-bill1", "billing", "/billing");
  await slotButton(page).click();
  const menu = page.getByTestId("ops-add-menu");
  await expect(menu.getByText("Quick actions")).toBeVisible();
  await expect(menu.getByTestId("ops-item-claim_correct")).toBeVisible();
  await expect(menu.getByTestId("ops-item-eligibility_check")).toBeVisible();
  await expect(menu.getByRole("button", { name: "Progress note", exact: true })).toHaveCount(0);
});

test("clinical_coordinator on /admin: menu opens with permitted admin actions", async ({ page }) => {
  await actAs(page, "s-cc2", "clinical_coordinator", "/admin");
  await slotButton(page).click();
  const menu = page.getByTestId("ops-add-menu");
  await expect(menu.getByTestId("ops-item-review_matching")).toBeVisible();
  await expect(menu.getByTestId("ops-item-feature_flag_set")).toHaveCount(0);
});

test("medical_assistant on a chart: no Medication order, Escape closes and focus returns", async ({ page }) => {
  await actAs(page, "s-ma1", "medical_assistant", "/clinician");
  const patientId = await page.evaluate(() => (window as unknown as W).__adelante.AdelanteEHR.listPatients()[0]!.id);
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), `/record/${patientId}`);
  await slotButton(page).click();
  const menu = page.getByTestId("chart-add-menu");
  await expect(menu.getByTestId("chart-add-med_order")).toHaveCount(0);
  await expect(menu.getByText("All actions")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(slotButton(page)).toBeFocused();
});

test("menu has no serious axe violations", async ({ page }) => {
  await actAs(page, "s-th1", "therapist", "/clinician");
  await slotButton(page).click();
  await expect(page.getByTestId("dashboard-add-menu")).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[data-testid="dashboard-add-menu"]').analyze();
  expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
});
