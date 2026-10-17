import { expect, test } from "@playwright/test";
import { bootTables, phoneTable, rowIds, tableAxe } from "./helpers/staffTables8b2";
test.use({ viewport: { width: 1280, height: 1800 } });

test("Cathy's inventory matches rollback source, preserves flags and hides content from denied role", async ({ page }) => {
  await bootTables(page, "s-cc2", "clinical_coordinator", "/admin-content");
  await page.getByRole("tab", { name: "Manage", exact: true }).click();
  const expected = await page.evaluate(async () => {
    const { cp, ct } = await (window as any).__adelante.content();
    const descriptor = ct.contentType("library_lesson");
    const entries = cp.listContent("library_lesson");
    for (const id of descriptor.baselineIds()) {
      if (!entries.some((e: any) => e.id === id)) {
        const body = descriptor.baselineBody(id);
        if (body) entries.push({ typeId: "library_lesson", id, body, status: "published", revisions: [] });
      }
    }
    return entries.map((e: any) => `${e.typeId}:${e.id}`);
  });
  const table = page.getByTestId("content-inventory-table");
  const actual: (string | null)[] = [];
  do {
    actual.push(...await rowIds(page, "content-inventory-table"));
    const next = table.locator("..").getByRole("button", { name: "Next page" });
    if (await next.isDisabled()) break;
    await next.click();
  } while (actual.length <= expected.length);
  expect(actual).toEqual(expected);
  await tableAxe(page, "content-inventory-table");
  await phoneTable(page, "content-inventory-table");
  await page.getByRole("combobox", { name: "Manage flags" }).click();
  await page.getByRole("option", { name: "Part 2", exact: true }).click();
  const filtered = await rowIds(page, "content-inventory-table");
  for (const id of filtered) expect(expected).toContain(id);
  await page.evaluate(() => (window as any).__adelante.setActingStaff("s-bill1", "billing"));
  await expect(page.getByTestId("content-inventory-table")).toHaveCount(0);
});