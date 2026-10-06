// Cross-role journeys — browser side (store-level coverage in
// src/lib/__tests__/crossRoleJourneys.test.ts). Demo seed ids are random per
// load, so each test finds the patient through the dev-only store hook and
// navigates in-app (no reload, which would re-seed).
import { test, expect, type Page } from "@playwright/test";
import { STAFF_ROSTER, type StaffRole } from "../src/lib/roles";

const SHOTS = "/tmp/cross-role/shots";
const SEEDED: Partial<Record<StaffRole, string>> = { nurse_rn: "s-rn1", lvn: "s-lvn1" };
const staffIdFor = (role: StaffRole) => SEEDED[role] ?? STAFF_ROSTER.find((s) => s.role === role)!.id;

async function actAs(page: Page, role: StaffRole) {
  await page.addInitScript(
    ([r, id]) => {
      window.localStorage.setItem("adelante.actingRole", r as string);
      window.localStorage.setItem("adelante.actingStaffId", id as string);
    },
    [role, staffIdFor(role)] as const,
  );
}

async function luisId(page: Page): Promise<string> {
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
  return page.evaluate(() => {
    const ehr = (window as unknown as { __adelante: { AdelanteEHR: { listPatients(): { id: string; firstName: string; lastName: string }[] } } }).__adelante.AdelanteEHR;
    return ehr.listPatients().find((p) => p.firstName === "Luis" && p.lastName === "Camacho")!.id;
  });
}

async function go(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.waitForTimeout(600);
}

// J7 — chart ASAM section per role, against the registry (roleSeesAsamSection).
const ASAM_SEES: Partial<Record<StaffRole, boolean>> = {
  physician: true, pmhnp: true, therapist: true, sud_counselor: true, nurse_rn: true,
  peer_specialist: false, billing: false, billing_coordinator: false, clinical_coordinator: false, sys_admin: false,
};
for (const [role, sees] of Object.entries(ASAM_SEES) as [StaffRole, boolean][]) {
  test(`J7 chart ASAM section — ${role} ${sees ? "sees" : "hidden"}`, async ({ page }) => {
    await actAs(page, role);
    await page.goto("/home");
    const id = await luisId(page);
    await go(page, `/record/${id}?section=asam`);
    await page.screenshot({ path: `${SHOTS}/j7-${role}.png` });
    const body = await page.locator("main").innerText().catch(() => "");
    if (sees) expect(body).toMatch(/ASAM/);
    else expect(body).not.toMatch(/ASAM|buprenorphine|naltrexone/i);
  });
}

// J4 — scribe entry on the chart: LVN, billing, admin never see it.
for (const role of ["lvn", "billing", "sys_admin"] as StaffRole[]) {
  test(`J4 no scribe entry — ${role}`, async ({ page }) => {
    await actAs(page, role);
    await page.goto("/home");
    const id = await luisId(page);
    await go(page, `/record/${id}?section=notes`);
    await page.screenshot({ path: `${SHOTS}/j4-${role}.png` });
    await expect(page.getByTestId("notes-start-scribe")).toHaveCount(0);
  });
}
