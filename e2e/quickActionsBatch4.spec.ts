import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("personal quick actions stay disabled under another assigned role, switch safely and reset", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as any).__adelante);
  // Test-only multi-role identity via the real registry/store path; no roster mutation.
  const creation = await page.evaluate(async () => {
    const dev = (window as any).__adelante;
    const { ra } = await dev.access();
    const result = await ra.runAction("staff_add", { role: "sys_admin", staffId: "s-admin1" }, undefined, { via: "addStaffMemberWithReason", args: [
      { role: "sys_admin", staffId: "s-admin1" },
      { id: "s-batch4", name: "Batch four test staff", role: "therapist", roleAssignments: [{ role: "therapist" }, { role: "clinical_coordinator" }] },
      "Test-only multi-role fixture",
    ] });
    return { ok: result.ok, reason: result.ok ? undefined : result.reason };
  });
  expect(creation, creation.reason).toMatchObject({ ok: true });
  await page.evaluate(() => (window as any).__adelante.setActingStaff("s-batch4", "therapist"));
  await expect(page.getByTestId("acting-role-indicator")).toHaveText("Acting as: Therapist · Batch four test staff");
  await page.evaluate(() => (window as any).__adelante.go("/clinician-profile"));
  await expect(page.getByTestId("acting-role-indicator")).toHaveText("Acting as: Therapist · Batch four test staff");
  const section = page.getByTestId("quick-action-settings");
  await expect(section).toBeVisible();
  await expect(section.getByText("Prototype — Saved on this device only")).toBeVisible();
  const before = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listAuditEvents({ category: "action" }).length);
  await section.getByRole("combobox", { name: "Choose an action" }).click();
  await page.getByRole("option", { name: "Author consent form", exact: true }).click();
  await section.getByRole("button", { name: "Add quick action" }).click();
  await expect(section.getByTestId("pref-consent_form_author")).toBeVisible();
  await section.getByRole("button", { name: "Move Author consent form up", exact: true }).click();
  const axe = await new AxeBuilder({ page }).include('[data-testid="quick-action-settings"]').analyze();
  expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  expect(await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listAuditEvents({ category: "action" }).length)).toBe(before);
  await page.evaluate(() => (window as any).__adelante.go("/my-work"));
  await page.getByTestId("staff-new-slot").getByRole("button").click();
  const menu = page.getByTestId("new-action-menu");
  await expect(menu.getByRole("button", { name: /Author consent form/ })).toBeDisabled();
  await expect(menu.getByText("Switch to Clinical Coordinator to use this")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("staff-role-switcher").click();
  await page.getByTestId("switch-s-batch4-clinical_coordinator").click();
  await expect(page.getByTestId("acting-role-indicator")).toHaveText("Acting as: Clinical Coordinator · Batch four test staff");
  await page.getByTestId("staff-new-slot").getByRole("button").click();
  await expect(menu.getByRole("button", { name: "Author consent form", exact: true })).toBeEnabled();
  await menu.getByRole("button", { name: "Author consent form", exact: true }).click();
  await expect(page.getByTestId("dashboard-action-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as any).__adelante.go("/clinician-profile"));
  await expect(section).toBeVisible();
  await section.getByRole("button", { name: "Reset to role defaults" }).click();
  expect(await page.evaluate(() => localStorage.getItem("adelante.quickActions.s-batch4"))).toBeNull();
  await page.getByTestId("staff-role-switcher").click();
  await page.getByTestId("switch-s-batch4-therapist").click();
  await expect(page.getByTestId("acting-role-indicator")).toHaveText("Acting as: Therapist · Batch four test staff");
  await expect(section.getByTestId("pref-progress_note")).toBeVisible();
  await expect(section.getByTestId("pref-consent_form_author")).toHaveCount(0);
});