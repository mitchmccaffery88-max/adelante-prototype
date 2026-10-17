import { expect, test } from "@playwright/test";
import { bootTables, phoneTable, rowIds, tableAxe } from "./helpers/staffTables8b2";
test.use({ viewport: { width: 1280, height: 1800 } });

test("staff roster matches rollback roster projection and denied role sees no placeholder rows", async ({ page }) => {
  await bootTables(page, "s-admin1", "sys_admin", "/admin-staff");
  const names = await page.evaluate(() => {
    const app = (window as any).__adelante;
    // Rollback used the same roster; identity lookup uses its existing shared instance.
    return ["s-cm1", "s-cm2", "s-th1", "s-th2", "s-admin1"].filter((id) => Boolean(app.j.getStaffMember(id)));
  });
  const ids = await rowIds(page, "staff-members-table");
  for (const id of names) expect(ids).toContain(id);
  expect(ids).toHaveLength(23);
  await tableAxe(page, "staff-members-table");
  await phoneTable(page, "staff-members-table");
  await page.evaluate(() => (window as any).__adelante.setActingStaff("s-th1", "therapist"));
  await expect(page.getByTestId("staff-members-table")).toHaveCount(0);
});

test("credential and enrollment IDs match unchanged all-file projections and own file excludes others", async ({ page }) => {
  await bootTables(page, "s-cred1", "credentialing_coordinator", "/admin-credentialing");
  const expected = await page.evaluate(async () => {
    const { ext } = await (window as any).__adelante.avail();
    return { credentials: ext.listAllCredentials().map((c: any) => c.id), enrollments: ext.listAllEnrollments().map((e: any) => e.id), own: ext.credentialsForClinician("c1").map((c: any) => c.id) };
  });
  expect(await rowIds(page, "credentials-table")).toEqual(expected.credentials);
  expect(await rowIds(page, "payer-enrollments-table")).toEqual(expected.enrollments);
  await tableAxe(page, "credentials-table");
  await phoneTable(page, "credentials-table");
  await phoneTable(page, "payer-enrollments-table");
  await page.evaluate(() => { const app = (window as any).__adelante; app.setActingStaff("s-th1", "therapist"); app.go("/clinician-credentials"); });
  expect(await rowIds(page, "own-credentials-table")).toEqual(expected.own);
  expect(expected.credentials.filter((id: string) => !expected.own.includes(id)).length).toBeGreaterThan(0);
  await phoneTable(page, "own-credentials-table");
});