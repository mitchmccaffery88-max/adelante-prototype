import { expect, test } from "@playwright/test";
import { bootTables } from "./helpers/staffTables8b2";

test.use({ viewport: { width: 1280, height: 1800 } });

test("Group A #6: claim Move asks for a reason and writes one claim_status registry audit", async ({ page }) => {
  await bootTables(page, "s-bill1", "billing", "/admin-claims");
  const table = page.getByTestId("claims-table");
  await expect(table).toBeVisible();
  const snapshot = () => page.evaluate(async () => {
    const { ext } = await (window as any).__adelante.avail();
    return ext.listClaims().map((c: any) => [c.id, c.state, c.chargeCents ?? null]);
  });
  const registry = () => page.evaluate(() => (window as any).__adelante.AdelanteEHR.listAuditEvents({}).filter((e: any) => e.detail?.actionId === "claim_status").length);
  const moves = table.getByRole("button", { name: /^Move to / });
  const total = await moves.count();
  expect(total).toBeGreaterThan(0);
  let moved = false;
  for (let i = 0; i < Math.min(total, 8) && !moved; i++) {
    const move = moves.nth(i);
    const claimId = await move.locator("xpath=ancestor::tr[1]").getAttribute("data-row-key");
    const before = await snapshot();
    const auditsBefore = await registry();
    await move.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Reason (saved to the audit log)")).toBeVisible();
    // No reason → nothing moves and the dialog stays open.
    await dialog.getByRole("button", { name: /^Move to / }).click();
    await expect(dialog).toBeVisible();
    expect(await registry()).toBe(auditsBefore);
    await dialog.getByRole("textbox").fill("Coding reviewed");
    await dialog.getByRole("button", { name: /^Move to / }).click();
    await page.waitForTimeout(400);
    const after = await snapshot();
    // Money on every other claim is untouched (the moved claim is priced by the unchanged store transition).
    const byId = (xs: any[]) => xs.filter((x: any) => x[0] !== claimId).sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0])));
    expect(byId(after)).toEqual(byId(before));
    if (await dialog.isVisible()) {
      // Store refusal (e.g. duplicate review) is unchanged: claim stays put.
      expect(byId([...after]).length + 0).toBe(byId([...before]).length);
      expect([...after].sort()).toEqual([...before].sort());
      await dialog.getByRole("button", { name: "Keep claim" }).click();
      await expect(dialog).toBeHidden();
      continue;
    }
    const prev = new Map(before.map((b: any) => [b[0], b[1]]));
    expect(after.filter((a: any) => prev.get(a[0]) !== a[1]).map((c: any) => c[0])).toEqual([claimId]);
    expect(await registry()).toBe(auditsBefore + 1);
    moved = true;
  }
  expect(moved).toBe(true);
});

test("Group A #7: staff edit drawer resets when a different staff member is opened", async ({ page }) => {
  await bootTables(page, "s-admin1", "sys_admin", "/admin-staff");
  const table = page.getByTestId("staff-members-table");
  await expect(table).toBeVisible();
  const keys = await table.locator("[data-row-key]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-row-key")!));
  const open = async (id: string) => {
    // Keyboard path: menu → sheet is driven the way a keyboard user would.
    await page.getByRole("button", { name: `More: ${id}`, exact: true }).first().focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Change roles/sites" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
  };
  await open(keys[1]);
  const second = await page.getByRole("dialog").getByRole("textbox").first().inputValue();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await open(keys[0]);
  const sites = page.getByRole("dialog").getByRole("textbox").first();
  await sites.fill("typed-for-first");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await open(keys[1]);
  await expect(page.getByRole("dialog").getByRole("textbox").first()).toHaveValue(second);
});

test("Group A #1: notes queue omits rows billing could never open; a therapist still sees own drafts", async ({ page }) => {
  await bootTables(page, "s-th1", "therapist", "/notes-queue");
  await expect(page.getByRole("heading", { name: "Unsigned notes" })).toBeVisible();
  const expected = await page.evaluate(async () => {
    const { listUnsignedWork } = await import("/src/lib/unsignedWork.ts" as string);
    return listUnsignedWork({ viewer: { role: "therapist", staffId: "s-th1" } }).length;
  });
  expect(expected).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Everyone/ }).click();
  await expect(page.getByTestId("notes-queue-rows").locator("[data-row-key]")).toHaveCount(Math.min(expected, 50));
});
