import { test, expect, type Page } from "@playwright/test";

async function openQueue(page: Page, role: string) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).__adelante));
  await page.evaluate((role) => {
    (window as any).__adelante.setActingRole(role);
    (window as any).__adelante.go(role === "intake_coordinator" ? "/intake-workspace" : "/referral-queue");
  }, role);
  await expect(page.getByRole("heading", { name: role === "intake_coordinator" ? "Intake workspace" : "Referrals", exact: true })).toBeVisible();
}

for (const role of ["clinical_coordinator", "intake_coordinator", "peer_specialist"]) {
  test(`${role} sends a staff referral and Intake receives it`, async ({ page }) => {
    await openQueue(page, role);
    await page.getByTestId("staff-submit-referral").click();
    const dialog = page.getByRole("dialog");
    const field = (label: string) => dialog.locator("label").filter({ hasText: label }).locator("..").locator("input").first();
    await field("Your name *").fill("Fictional Referrer");
    await field("First name *").fill("FictionalReferral");
    await field("Last name *").fill(`Browser-${role}`);
    await field("Date of birth (or Medi-Cal ID below) *").fill("1990-01-01");
    await page.getByTestId("referral-person-email").fill("fictional@example.invalid");
    await dialog.getByRole("button", { name: "No", exact: true }).click();
    await dialog.getByRole("checkbox", { name: /No reliable phone/ }).check();
    await dialog.getByRole("checkbox", { name: /not a robot/ }).check();
    await dialog.getByRole("button", { name: "Send referral", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await page.evaluate((role) => {
      const d = (window as any).__adelante;
      const r = d.AdelanteEHR.listReferrals().find((r: any) => r.lastName === `Browser-${role}`);
      const events = d.AdelanteEHR.listAuditEvents().filter((e: any) => e.detail?.referralId === r?.id || (e.detail?.actionId === "website_referral_submit" && e.actorRole === role));
      return { r, events };
    }, role);
    expect(saved.r.status).toBe("submitted");
    expect(saved.r.submittedBy.actor.role).toBe(role);
    expect(saved.events.find((e: any) => e.action === "action.succeeded")).toMatchObject({ actorId: saved.r.submittedBy.actor.staffId, detail: { actingRole: role } });
    expect(JSON.stringify(saved.events)).not.toMatch(/FictionalReferral|Fictional Referrer|fictional@example|Browser-/);
    await page.screenshot({ path: `/tmp/browser/referral-submit-${role}.png` });
    await page.evaluate(() => {
      const d = (window as any).__adelante;
      d.setActingRole("intake_coordinator");
      d.go("/intake-workspace");
    });
    await expect(page.getByText(`FictionalReferral Browser-${role}`, { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: `/tmp/browser/referral-submit-${role}-intake-readback.png` });
  });
}

for (const role of ["clinical_trainee"]) {
  test(`${role} sees explanation without a dead send control`, async ({ page }) => {
    await openQueue(page, role);
    await expect(page.getByTestId("staff-submit-referral")).toHaveCount(0);
    await expect(page.getByText("Referrals are sent by Intake, the clinical coordinator or a peer specialist.", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: `/tmp/browser/referral-submit-${role}.png` });
  });
}