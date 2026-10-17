import { expect, test } from "@playwright/test";
import { bootTables, rowIds, tableAxe, phoneTable } from "./helpers/staffTables8b2";
test.use({ viewport: { width: 1280, height: 1800 } });

// devJourneys exposes runAction and canAccess, not redactAuditEvents; read IDs
// from the exposed store and mirror only the unchanged caller-side predicates.
for (const [route, id, category] of [
  ["/admin-audit", "admin-audit-table", "all"],
  ["/admin-documents-audit", "documents-audit-table", "documents"],
  ["/consent-audit", "consent-audit-table", "consent"],
  ["/admin-permissions", "action-audit-feed", "action"],
] as const) {
  test(`${id} matches in-page store projection, axe and 390px`, async ({ page }) => {
    await bootTables(page, "s-admin1", "sys_admin", route);
    await page.waitForTimeout(2000);
    const rendered = (await page.getByTestId(id).count()) ? await rowIds(page, id) : [];
    const all = await page.evaluate(({ category }) => {
      const app = (window as any).__adelante;
      const opts = category === "all" ? { limit: 400 } : category === "action" ? { category: "action", limit: 600 } : category === "documents" ? { category: ["clinical", "advocate"] } : { category: ["consent", "disclosure", "advocate"] };
      return app.AdelanteEHR.listAuditEvents(opts).filter((e: any) => category !== "documents" || ["document_uploaded", "document_upload_rejected", "document_verified", "document_rejected", "document_downloaded", "document_download_denied", "advocate_document_uploaded", "advocate_document_upload_rejected", "advocate_documents_viewed", "advocate_document_downloaded", "advocate_document_download_denied", "advocate_document_verified_notified"].includes(e.action)).map((e: any) => e.id);
    }, { category });
    if (rendered.length === 0) { expect(all).toEqual([]); return; }
    // Viewing the page appends access events after render; parity is the
    // contiguous source window starting at the first rendered row.
    const start = all.indexOf(rendered[0]);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(rendered).toEqual(all.slice(start, start + rendered.length));
    expect(rendered.length).toBe(Math.min(50, all.length - start));
    await tableAxe(page, id);
    await phoneTable(page, id);
  });
}
test("clinical coordinator audit retains masked subjects and cannot gain brief rows; billing is denied", async ({ page }) => {
  await bootTables(page, "s-bill1", "billing", "/admin-audit");
  await expect(page.getByTestId("admin-audit-table")).toHaveCount(0);
  await bootTables(page, "s-cc1", "clinical_coordinator", "/admin-audit");
  await expect(page.getByTestId("admin-audit-table")).toBeVisible();
  const shown = await rowIds(page, "admin-audit-table");
  const expected = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listAuditEvents({ limit: 200 }).filter((e: any) => !e.action.startsWith("brief.")).map((e: any) => e.id));
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.every((id) => expected.includes(id as string))).toBe(true);
  await page.getByRole("group", { name: "Saved views" }).getByRole("button", { name: /^Redacted/ }).click();
  const narrowed = await rowIds(page, "admin-audit-table");
  const allowed = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listAuditEvents({ limit: 200 }).filter((e: any) => !e.action.startsWith("brief.")).map((e: any) => e.id));
  expect(narrowed.every((id) => allowed.includes(id))).toBe(true);
  await expect(page.getByTestId("admin-audit-table").getByRole("img").first()).toBeVisible();
  await phoneTable(page, "admin-audit-table");
});
test("billing is denied disclosure and compliance routes", async ({ page }) => {
  await bootTables(page, "s-bill1", "billing", "/disclosure-log");
  await expect(page.getByTestId("disclosure-log-table")).toHaveCount(0);
  await page.evaluate(() => (window as any).__adelante.go("/quality-compliance"));
  await expect(page.getByTestId("outside-caseload-report")).toHaveCount(0);
});
