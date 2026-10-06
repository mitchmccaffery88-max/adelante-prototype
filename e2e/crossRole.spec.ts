// Cross-role journeys — browser side (store-level coverage in
// src/lib/__tests__/crossRoleJourneys.test.ts). Demo seed ids are random per
// load, so each test finds the patient through the dev-only store hook and
// navigates in-app (no reload, which would re-seed).
import { test, expect, type Page } from "@playwright/test";
test.describe.configure({ timeout: 120_000 });
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

/** DOB of the Luis Camacho who has signed ASAM data (there is a near-duplicate for matching demos). */
async function luisId(page: Page): Promise<string> {
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante, null, { timeout: 60_000 });
  return page.evaluate(() => {
    const ehr = (window as unknown as { __adelante: { AdelanteEHR: { listPatients(): { id: string; firstName: string; lastName: string }[] } } }).__adelante.AdelanteEHR;
    const all = ehr.listPatients() as unknown as { id: string; firstName: string; lastName: string; dob: string; asamAssessments?: unknown[] }[];
    return all.find((p) => p.firstName === "Luis" && p.lastName === "Camacho" && (p.asamAssessments ?? []).length > 0)!.dob;
  });
}

/** Opens Luis's chart through the top-bar patient search (in-app, no reload), then a tab. */
/** Returns false when the role can't reach the chart at all (no search hit / no chart). */
async function openChartTab(page: Page, tab: RegExp, dob: string): Promise<boolean> {
  const box = page.getByPlaceholder(/Search patients/);
  await box.click();
  await box.fill("Camacho");
  const opt = page.getByRole("option").filter({ hasText: dob }).first();
  if (!(await opt.isVisible({ timeout: 8_000 }).catch(() => false))) return false;
  await opt.click();
  await expect(page).toHaveURL(/\/record\//, { timeout: 30_000 });
  const t = page.getByRole("tab", { name: tab }).first();
  if (!(await t.isVisible({ timeout: 8_000 }).catch(() => false))) return true;
  // The chart hydrates after the URL changes; retry until the tab is selected.
  await expect(async () => {
    await t.click();
    await expect(t).toHaveAttribute("aria-selected", "true", { timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await page.waitForTimeout(500);
  return true;
}

// J7 — chart ASAM section per role, against the registry (roleSeesAsamSection).
const ASAM_SEES: Partial<Record<StaffRole, boolean>> = {
  physician: true, pmhnp: true, therapist: true, sud_counselor: true, nurse_rn: true,
  peer_specialist: false, billing: false, billing_coordinator: false, clinical_coordinator: false, sys_admin: false,
};
for (const [role, seesDefault] of Object.entries(ASAM_SEES) as [StaffRole, boolean][]) {
  test(`J7 chart ASAM section — ${role} ${seesDefault ? "sees" : "hidden"}`, async ({ page }) => {
    let sees = seesDefault;
    await actAs(page, role);
    await page.goto("/clinician");
    const dob = await luisId(page);
    // Consent-gated roles (peer) see ASAM only when this load's Luis has a Part 2 consent — same rule as the registry.
    const consented = await page.evaluate((d) => {
      const ehr = (window as unknown as { __adelante: { AdelanteEHR: { listPatients(): { id: string; dob: string; firstName: string }[]; getConsentState(id: string): { part2Sud?: boolean } } } }).__adelante.AdelanteEHR;
      const p = ehr.listPatients().find((x) => x.firstName === "Luis" && x.dob === d)!;
      return !!ehr.getConsentState(p.id).part2Sud;
    }, dob);
    if (role === "peer_specialist") sees = consented;
    const reached = await openChartTab(page, /^Measures/, dob);
    await page.screenshot({ path: `${SHOTS}/j7-${role}.png` });
    const chip = page.getByRole("button", { name: /^ASAM$/ });
    if (sees) {
      expect(reached).toBe(true);
      await expect(chip).toBeVisible();
    } else {
      await expect(chip).toHaveCount(0);
      expect(await page.locator("body").innerText()).not.toMatch(/buprenorphine|naltrexone|ASAM level/i);
    }
  });
}

// J4 — scribe entry on the chart: LVN, billing, admin never see it.
for (const role of ["lvn", "billing", "sys_admin"] as StaffRole[]) {
  test(`J4 no scribe entry — ${role}`, async ({ page }) => {
    await actAs(page, role);
    await page.goto("/clinician");
    await openChartTab(page, /^Notes & Documents/, await luisId(page));
    await page.screenshot({ path: `${SHOTS}/j4-${role}.png` });
    await expect(page.getByTestId("notes-start-scribe")).toHaveCount(0);
  });
}
