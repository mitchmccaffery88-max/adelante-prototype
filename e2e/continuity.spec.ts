// §Benchmark follow-up — Anita sees the MAT refill item; the coordinator sees
// "Coverage at release" with one overdue reactivation; sys_admin deactivates a
// seeded clinician and the coordinator sees "Reassign needed"; /admin shows the
// real intake median; Luis starts a PHQ-9, leaves, and resumes in Spanish.
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 150_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 10_000 });
}
const as = (page: Page, id: string, role: string) => page.evaluate(([i, r]) => (window as unknown as W).__adelante.setActingStaff(i, r), [id, role]);

test("MAT continuity, coverage at release, deactivation, intake median, screener resume", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });

  // 1. Anita (prescriber) — MAT refill needed for the seeded patient at 4 days.
  await as(page, "s-th3", "pmhnp");
  await go(page, "/clinician");
  await expect(page.getByText("MAT refill needed").first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "e2e/screenshots/continuity-anita.png" });

  // 2. Coordinator — Coverage at release, one overdue reactivation.
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, "/coverage-release");
  const panel = page.getByTestId("coverage-at-release");
  await expect(panel).toContainText("1 overdue reactivation", { timeout: 15_000 });
  await expect(panel).toContainText("Elena Vargas");
  await expect(panel).toContainText("4 days after release");
  await expect(panel).toContainText("Jordan Vega");
  await page.screenshot({ path: "e2e/screenshots/continuity-coverage.png" });

  // 3. sys_admin deactivates James Okafor; coordinator sees "Reassign needed".
  await as(page, "s-admin1", "sys_admin");
  await go(page, "/admin-staff");
  await page.getByRole("button", { name: "Deactivate James Okafor" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Left the practice today");
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Staff member deactivated")).toBeVisible();
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, "/clinician");
  await expect(page.getByText(/Reassign needed —/).first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "e2e/screenshots/continuity-reassign.png" });

  // 4. /admin — real intake median, not 2.4.
  await as(page, "s-admin1", "sys_admin");
  await go(page, "/admin");
  const expected = await page.evaluate(async () => {
    const { intakeVelocityMedian } = await import("/src/lib/referralFunnel.ts");
    return intakeVelocityMedian({}) as { medianDays?: number; belowMinimumCohort: boolean; n: number };
  });
  await expect(page.getByText(expected.belowMinimumCohort ? "Too few referrals to report" : `${expected.medianDays ?? "—"}d median`).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("2.4d")).toHaveCount(0);

  // 5. Luis starts a PHQ-9, leaves, resumes in Spanish.
  const luisId = await page.evaluate(() => {
    const ehr = (window as unknown as W).__adelante.AdelanteEHR as never as { listPatients: () => { id: string; firstName: string; lastName: string }[]; setCurrentPatientId: (i: string) => void };
    const l = ehr.listPatients().find((p) => p.firstName === "Luis" && p.lastName === "Camacho")!;
    ehr.setCurrentPatientId(l.id);
    return l.id;
  });
  await go(page, "/rescreen/phq-9");
  for (const [q, name] of [[0, "Not at all"], [1, "Several days"]] as const) {
    const radio = page.getByTestId(`rescreen-q-${q}`).getByRole("radio", { name });
    await expect(async () => { await radio.click(); await expect(radio).toHaveAttribute("aria-checked", "true", { timeout: 1000 }); }).toPass({ timeout: 15_000 });
  }
  // Leave, then come back: the two answers must still be there (checked via the UI;
  // importing the module from the test can hit a different HMR instance).
  await go(page, "/home");
  await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
  await go(page, "/rescreen/phq-9");
  await expect(page.getByTestId("screener-draft-resume-banner")).toContainText("Continúa donde lo dejaste", { timeout: 15_000 });
  await expect(page.locator('[data-testid^="rescreen-q-"] [role="radio"][aria-checked="true"]')).toHaveCount(2);
  await page.screenshot({ path: "e2e/screenshots/continuity-luis-es.png" });
  await page.getByRole("button", { name: "Switch language to English" }).click();
});
