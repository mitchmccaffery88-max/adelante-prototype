// §8c-2 — refill decline ConfirmDialog (+ axe) and the in-use frequency
// delete path (refusal reason shown, deactivate step opens).
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.describe.configure({ timeout: 150_000 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
async function start(page: Page, id: string, role: string) {
  await page.goto("/clinician");
  await page.waitForFunction(() => Boolean((window as W).__adelante));
  await page.evaluate(([i, r]) => (window as W).__adelante.setActingStaff(i, r), [id, role]);
}
async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to);
}
async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}
const dialog = (page: Page) => page.getByRole("alertdialog");
const actionCount = (page: Page) => page.evaluate(() => (window as W).__adelante.AdelanteEHR.listAuditEvents({ category: "action" }).length);

test("physician declines a refill through the confirmation with one action entry", async ({ page }) => {
  await start(page, "s-admin1", "sys_admin");
  await page.evaluate(() => (window as W).__adelante.setActingRole("physician"));
  const found = await page.evaluate(() => {
    const ehr = (window as W).__adelante.AdelanteEHR;
    for (const p of ehr.listPatients()) {
      const med = ehr.listMedications(p.id).find((m: W) => !/bupren|methadon|naltrex|suboxone/i.test(m.name ?? ""));
      if (!med) continue;
      const r = ehr.requestRefill({ patientId: p.id, medicationId: med.id, requestedBy: "patient" });
      if (r) return { pid: p.id, rid: r.id };
    }
    return null;
  });
  expect(found).not.toBeNull();
  await go(page, `/record/${found!.pid}`);
  await page.getByTestId("staff-new-slot").getByTestId("chart-new-button").click();
  await page.getByTestId("chart-add-menu").getByTestId("chart-add-refill_decision").click();
  const card = page.getByTestId("adel-refill-card").first();
  await card.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(dialog(page)).toHaveAccessibleName("Decline this refill?");
  await expect(dialog(page).getByRole("button", { name: "Keep pending" })).toBeFocused();
  await axe(page);
  const before = await actionCount(page);
  await dialog(page).getByRole("button", { name: "Keep pending" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await actionCount(page)).toBe(before);
  await card.getByRole("button", { name: "Deny", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Decline refill", exact: true }).click();
  await expect(dialog(page).getByRole("alert")).toBeVisible();
  expect(await actionCount(page)).toBe(before);
  await dialog(page).getByRole("textbox").fill("Needs a visit first");
  await dialog(page).getByRole("button", { name: "Decline refill", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  const result = await page.evaluate(([b, pid, rid]) => {
    const ehr = (window as W).__adelante.AdelanteEHR;
    const all = ehr.listAuditEvents({ category: "action" });
    return { added: all.slice(0, all.length - (b as number)).map((e: W) => e.detail?.actionId), status: ehr.listRefillRequests({ patientId: pid }).find((r: W) => r.id === rid)?.status };
  }, [before, found!.pid, found!.rid] as const);
  expect(result.added).toEqual(["refill_decision"]);
  expect(result.status).toBe("denied");
});

test("deleting an in-use frequency shows the in-use reason and opens the deactivate step", async ({ page }) => {
  await start(page, "s-admin1", "sys_admin");
  const code = await page.evaluate(() => {
    const ehr = (window as W).__adelante.AdelanteEHR;
    return ehr.listFrequencies().find((f: W) => ehr.frequencyUsage(f.code).count > 0)?.code ?? null;
  });
  expect(code).not.toBeNull();
  await go(page, "/admin-catalog-governance");
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: code!, exact: true }) }).first();
  await row.getByRole("button").last().click();
  await expect(dialog(page)).toHaveAccessibleName("Delete this frequency?");
  await dialog(page).getByRole("textbox").fill("Cleanup");
  await dialog(page).getByRole("button", { name: "Delete frequency", exact: true }).click();
  await expect(page.getByText(/is in use by \d+ signed or held order/).first()).toBeVisible();
  await expect(page.getByRole("dialog", { name: `Deactivate ${code}` })).toBeVisible();
});
