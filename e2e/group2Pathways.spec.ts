// §Group 2 — pathway journeys at identification, Part 2 chip, onboarding
// contacts + advocate (EN then ES), read-only consent ledger. One page load;
// setup through real store functions, role switches through the dev hook.
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 180_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
const as = (page: Page, id: string, role: string) => page.evaluate(([i, r]) => (window as unknown as W).__adelante.setActingStaff(i, r), [id, role]);
const ehr = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => ((window as unknown as W).__adelante.AdelanteEHR[f as string]!)(...(a as unknown[])), [fn, args] as const);

test("correctional referral → re-entry journeys; SUD diagnosis → SUD journeys; Part 2 chip", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const pid = (await page.evaluate(async () => {
    const e = (window as unknown as W).__adelante.AdelanteEHR as never as { createReferral: (i: unknown) => { id: string }; enrollReferral: (id: string) => string };
    const r = e.createReferral({ firstName: "Reyes", lastName: "Walkthrough", dob: "1988-04-12", phone: "5595550161", referringAgency: "County Probation", referrerName: "Officer Diaz", referrerPhone: "5595550100", referralSource: "probation", justiceInvolved: "yes", consentToContact: true, channel: "staff" });
    const id = e.enrollReferral(r.id);
    const fj = await import("/src/lib/flagJourneys.ts");
    fj.applyFlagJourneys(id);
    return id;
  })) as string;

  await ehr(page, "setCurrentPatientId", pid);
  await go(page, "/journeys");
  await expect(page.getByText("Starting Strong").first()).toBeVisible();
  await expect(page.getByText(/Back on My Feet/).first()).toBeVisible();
  await expect(page.getByText("My First Days Out")).toHaveCount(0);

  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, `/record/${pid}`);
  await expect(page.getByTestId("pathway-chip").first()).toHaveText("Re-entry");

  await page.evaluate(async (id) => {
    const e = (window as unknown as W).__adelante.AdelanteEHR as never as { addProblem: (p: string, x: unknown) => void };
    e.addProblem(id, { description: "Opioid use disorder, moderate", icd10Code: "F11.20", category: "sud" });
    (await import("/src/lib/flagJourneys.ts")).applyFlagJourneys(id);
  }, pid);

  await as(page, "s-th3", "pmhnp");
  await go(page, `/record/${pid}`);
  await expect(page.getByTestId("pathway-chip").first()).toHaveText("Re-entry + SUD");
  await as(page, "s-peer1", "peer_specialist");
  await go(page, `/record/${pid}`);
  await expect(page.getByTestId("pathway-chip").first()).toHaveText("Re-entry");

  await ehr(page, "setCurrentPatientId", pid);
  await go(page, "/journeys");
  await expect(page.getByText("My First Days Out").first()).toBeVisible();
  await expect(page.getByText("Recovery Journey").first()).toBeVisible();
});

test("read-only role on the consent ledger has no toggles", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  await as(page, "s-th3", "pmhnp");
  await go(page, "/consent");
  await expect(page.getByTestId("ledger-read-only").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Grant|Revoke) / })).toHaveCount(0);
});
