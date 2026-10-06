// Faster Adel Brief — open the Brief as Dr. Bagga, a therapist and Luz (ECM) on
// the same SUD patient (Luis). One tab, no reloads; clock frozen.
import { test, expect, type Page } from "@playwright/test";
test.describe.configure({ timeout: 150_000 });
const SHOTS = "/tmp/adel-brief/shots";
const FROZEN = new Date("2026-09-29T15:00:00.000Z");
type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
const SUD = /substance|opioid|alcohol|asam|buprenorph|suboxone|methadone|naltrex|vivitrol|AUDIT|DAST|MAT continuity|Part 2/i;

async function openBrief(page: Page, staffId: string, role: string, pid: string, name: string) {
  await page.evaluate(([id, r]) => (window as unknown as W).__adelante.setActingStaff(id, r), [staffId, role]);
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), `/record/${pid}`);
  await page.waitForURL((u) => u.pathname === `/record/${pid}`);
  const btn = page.getByTestId("adel-brief-button");
  await btn.waitFor();
  const t0 = Date.now();
  await btn.click();
  await page.getByTestId("adel-brief-panel").getByTestId("brief-section-care_gaps").waitFor();
  const ms = Date.now() - t0;
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  const text = await page.getByTestId("adel-brief-panel").innerText();
  console.log(`BRIEF ${name} open=${ms}ms`);
  return { ms, text };
}
const close = (page: Page) => page.keyboard.press("Escape");

test("Brief: instant render, Part 2 masking per role, New after PHQ-9", async ({ page }) => {
  await page.clock.setFixedTime(FROZEN);
  await page.addInitScript(() => {
    window.localStorage.setItem("adelante.actingRole", "physician");
    window.localStorage.setItem("adelante.actingStaffId", "s-np1");
  });
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const pid = await page.evaluate(() => {
    const E = (window as unknown as W).__adelante.AdelanteEHR as unknown as { listPatients: () => { id: string; firstName: string }[] };
    return E.listPatients().find((p) => p.firstName === "Luis")!.id;
  });

  const doc = await openBrief(page, "s-np1", "physician", pid, "1-bagga");
  await close(page);
  const th = await openBrief(page, "s-th1", "therapist", pid, "2-therapist");
  await close(page);
  const ecm = await openBrief(page, "s-cm1", "ecm_provider", pid, "3-luz-ecm");
  expect(ecm.text).not.toMatch(SUD);
  for (const r of [doc, th, ecm]) expect(r.ms).toBeLessThan(1500);
  await close(page);

  // Add a PHQ-9 → physician reopens → "New" marker on the measure bullet.
  await page.evaluate((id) => {
    const E = (window as unknown as W).__adelante.AdelanteEHR as unknown as { recordScreener: (p: string, r: unknown) => void };
    E.recordScreener(id, { key: "phq-9", score: 5, severity: "mild", completedAt: new Date(Date.now() + 60_000).toISOString() });
  }, pid);
  await openBrief(page, "s-np1", "physician", pid, "4-bagga-after-phq9");
  await expect(page.getByTestId("adel-brief-panel").getByTestId("brief-new").first()).toBeVisible({ timeout: 5000 });
  await page.getByTestId("adel-summary-toggle").click();
  await expect(page.getByTestId("adel-summary")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/5-summary.png` });
});
