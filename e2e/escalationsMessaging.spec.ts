// §U1/U2 — coordinator hands a crisis to Anita, discusses it with an
// @mention; Anita sees both in Needs my action and replies. One page load;
// role switches go through the in-app switcher, routes through the router.
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 120_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 10_000 });
}

test("coordinator → hand crisis to Anita → Discuss @mention → Anita replies", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("adelante.actingRole", "clinical_coordinator");
    window.localStorage.setItem("adelante.actingStaffId", "s-cc1");
  });
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const name = await page.evaluate(() => {
    const ehr = (window as unknown as W).__adelante.AdelanteEHR as unknown as {
      listPatients: () => { id: string; firstName: string; lastName: string; crisisEscalations?: { status: string }[] }[];
      flagCrisis: (id: string, by: string, reason: string) => unknown;
    };
    const p = ehr.listPatients().find((x) => !(x.crisisEscalations ?? []).some((e) => e.status === "open"))!;
    ehr.flagCrisis(p.id, "Priya Raman", "Unsafe statement during phone check-in");
    return `${p.firstName} ${p.lastName}`;
  });

  await go(page, "/escalations?view=all&type=crisis");
  await expect(page.getByRole("heading", { name: "Escalations" })).toBeVisible();
  const row = page.getByTestId("escalation-row-crisis").filter({ hasText: name }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "More escalation actions" }).click();
  await page.getByRole("menuitem", { name: "Hand off" }).click();
  await page.getByLabel("New owner").selectOption({ label: "Anita Brooks" });
  await page.getByLabel("Handoff reason").fill("Prescriber follow-up today");
  await page.getByRole("dialog").getByRole("button", { name: "Hand off" }).click();
  await expect(row.getByTestId("escalation-owner")).toHaveText("Anita Brooks");
  await expect(row).toContainText("Handed off");

  await row.getByRole("button", { name: /Discuss/ }).click();
  await expect(page).toHaveURL(/\/team-messages\?thread=/);
  await expect(page.getByTestId("team-thread")).toContainText("Linked escalation");
  await page.getByLabel("Team message").fill("@Anita can you call today and update the plan?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("team-message")).toHaveCount(1);
  await page.screenshot({ path: "e2e/screenshots/u2-coordinator-thread.png" });

  // ---- Anita ---------------------------------------------------------------
  await page.evaluate(() => (window as unknown as W).__adelante.setActingStaff("s-th3", "pmhnp"));
  await go(page, "/clinician");
  await expect(page.getByTestId("needs-action-escalations-link")).toBeVisible({ timeout: 15_000 });
  const crisisRow = page.getByTestId("action-row-crisis").filter({ hasText: name }).first();
  await expect(crisisRow).toContainText("yours");
  const reply = page.getByTestId("action-row-reply").first();
  await expect(reply).toContainText("Reply needed");
  await page.screenshot({ path: "e2e/screenshots/u2-anita-needs-action.png" });
  await reply.getByRole("button", { name: "Reply" }).click();
  await expect(page).toHaveURL(/\/team-messages\?thread=/);
  await expect(page.getByText("You were mentioned")).toBeVisible();
  await page.getByLabel("Team message").fill("Called — following up this afternoon.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("team-message")).toHaveCount(2);
  await expect(page.getByText("You were mentioned")).toHaveCount(0);
  await go(page, "/clinician");
  await expect(page.getByTestId("action-row-reply")).toHaveCount(0);
});
