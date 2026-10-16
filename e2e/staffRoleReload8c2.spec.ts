// 8c-2 Option B — staff routes render a neutral loading screen until the
// acting role is known from browser storage after hydration. A full reload
// with a saved non-default role must produce no hydration warnings, no
// redirect and no audit entries under the default role. Patient and public
// shells are not gated.
import { test, expect, type Page } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;

function collect(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) errors.push(e.message); });
  return errors;
}

async function saveCathy(page: Page) {
  await page.goto("/clinician");
  await page.waitForFunction(() => Boolean((window as W).__adelante));
  await page.evaluate(() => (window as W).__adelante.setActingStaff("s-cc2", "clinical_coordinator"));
}

for (const path of ["/clinician", "/admin", "/my-work"]) {
  test(`reload with Cathy saved on ${path}: no hydration warnings, no default-role audit, no redirect`, async ({ page }) => {
    const errors = collect(page);
    await saveCathy(page);
    // Full reload — the audit store is in-memory, so anything present after
    // this load was written during it.
    await page.goto(path);
    await page.waitForFunction(() => Boolean((window as W).__adelante));
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain(path);
    // The real shell renders for the saved role once known.
    await expect(page.getByTestId("acting-role-indicator")).toContainText("Clinical coordinator");
    await expect(page.getByTestId("acting-role-indicator")).toContainText("Cathy");
    await expect(page.getByTestId("staff-loading-screen")).toHaveCount(0);
    // Nothing audited during load — no nav denial under the default role.
    const audits = await page.evaluate(() => (window as W).__adelante.AdelanteEHR.listAuditEvents({}));
    expect(audits.filter((a: W) => a.action === "nav_access_denied")).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("patient Home renders without the staff loading gate", async ({ page }) => {
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("staff-loading-screen")).toHaveCount(0);
  // The patient Get Help Now path stays immediately available.
  await expect(page.getByRole("button", { name: /get help now/i }).first()).toBeVisible();
});

test("public homepage renders without the staff loading gate and 988 is a plain link", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("staff-loading-screen")).toHaveCount(0);
  const help = page.getByRole("link", { name: /988/i }).first();
  await expect(help).toBeVisible();
  await expect(help).toHaveAttribute("href", /tel:988/);
});
