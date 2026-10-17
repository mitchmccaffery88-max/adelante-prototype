import { expect, test } from "@playwright/test";
import { bootTables, phoneTable, rowIds, tableAxe } from "./helpers/staffTables8b2";
test.use({ viewport: { width: 1280, height: 1800 } });

test("provider views match rollback owner/open/last-five projections, excluding another owner's claims", async ({ page }) => {
  await bootTables(page, "s-th1", "therapist", "/inbox");
  await page.getByRole("tab", { name: "Requests", exact: true }).click();
  const baseline = await page.evaluate(() => {
    const app = (window as any).__adelante;
    const rows = app.AdelanteEHR.listProviderRequests();
    const mine = rows.filter((r: any) => r.status === "claimed" && r.assignedTo === "Marisol Reyes");
    const open = rows.filter((r: any) => r.status === "open");
    const done = rows.filter((r: any) => r.status === "done").slice(-5);
    return { mine: mine.map((r: any) => r.id), all: [...mine, ...open, ...done].map((r: any) => r.id), excluded: rows.filter((r: any) => r.status === "claimed" && r.assignedTo !== "Marisol Reyes").map((r: any) => r.id) };
  });
  expect(await rowIds(page, "provider-requests-table")).toEqual(baseline.mine);
  await page.getByRole("button", { name: /^Current view \(/ }).click();
  expect(await rowIds(page, "provider-requests-table")).toEqual(baseline.all);
  for (const id of baseline.excluded) expect(await rowIds(page, "provider-requests-table")).not.toContain(id);
  await tableAxe(page, "provider-requests-table");
  await phoneTable(page, "provider-requests-table");
  await page.evaluate(() => (window as any).__adelante.setActingStaff("s-bill1", "billing"));
  await expect(page.getByTestId("provider-requests-table")).toHaveCount(0);
});

test("document queues keep mine/all rollback projection and advocate denied role hides entire rows", async ({ page }) => {
  await bootTables(page, "s-cm2", "ecm_provider", "/inbox");
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  const baseline = await page.evaluate(() => {
    const ehr = (window as any).__adelante.AdelanteEHR;
    return { mine: ehr.documentVerifyQueue("ecm_provider").map((r: any) => r.document.id), all: ehr.documentVerifyQueue().map((r: any) => r.document.id) };
  });
  expect(await rowIds(page, "document-verification-table")).toEqual(baseline.mine);
  await page.getByRole("button", { name: "Show all queues" }).click();
  expect(await rowIds(page, "document-verification-table")).toEqual(baseline.all);
  await phoneTable(page, "document-verification-table");
  await page.getByRole("tab", { name: "Advocate", exact: true }).click();
  const advocate = await page.evaluate(() => {
    const ehr = (window as any).__adelante.AdelanteEHR;
    return { contributions: ehr.advocateContributionQueue({ status: "pending" }).map((r: any) => r.id), attestations: ehr.advocateEligibilityAttestationQueue({ status: "pending" }).map((r: any) => r.id) };
  });
  expect(await rowIds(page, "advocate-contributions-table")).toEqual(advocate.contributions);
  expect(await rowIds(page, "advocate-attestations-table")).toEqual(advocate.attestations);
  await phoneTable(page, "advocate-contributions-table");
  await page.evaluate(() => (window as any).__adelante.setActingStaff("s-th1", "therapist"));
  await expect(page.getByTestId("advocate-contributions-table")).toHaveCount(0);
  await expect(page.getByTestId("advocate-attestations-table")).toHaveCount(0);
});

test("nursing and messages preserve existing role projections at desktop and phone", async ({ page }) => {
  await bootTables(page, "s-rn1", "nurse_rn", "/nurse");
  const expected = await page.evaluate(() => (window as any).__adelante.j.nurseQueue({ role: "nurse_rn", staffId: "s-rn1" }).map((r: any) => r.id));
  expect(await rowIds(page, "nurse-queue")).toEqual(expected);
  await tableAxe(page, "nurse-queue");
  await phoneTable(page, "nurse-queue");
  await page.evaluate(() => { const app = (window as any).__adelante; app.setActingStaff("s-th1", "therapist"); app.go("/message-queue"); });
  const messages = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listUnreadMessageThreads().map((r: any) => r.patient.id));
  expect(await rowIds(page, "patient-messages-table")).toEqual(messages);
  await phoneTable(page, "patient-messages-table");
  await page.evaluate(() => (window as any).__adelante.setActingStaff("s-bill1", "billing"));
  await expect(page.getByTestId("patient-messages-table")).toHaveCount(0);
});