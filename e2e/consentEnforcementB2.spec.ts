// §B2-4 — enforcement: a typed Part 2 record to the care-coordination team
// opens the coordinator's minimum-necessary view; revoking it locks the view
// at read time; an external-recipient record never opens it. Axe on the panel.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type W = { __adelante: { AdelanteEHR: any; setActingStaff: (id: string, role?: string) => void; go: (to: string) => void; access: () => Promise<any> } };
test.describe.configure({ timeout: 180_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}

test("B2-4 typed coordinator consent opens, revocation locks, external recipient never opens", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const setup = await page.evaluate(async () => {
    const app = (window as unknown as W).__adelante;
    const e = app.AdelanteEHR;
    const { ra, ca } = await app.access();
    const p = e.listPatients().find((x: any) => !x.sudCoordinationConsent && !x.sudCounselingNotesRelease && ca.chartEntryFor("clinical_coordinator", "s-cc1", x.id).ok);
    const els = Object.fromEntries(["patientName", "recipients", "amountAndKind", "purpose", "rightToRevoke", "expiration", "signatureAndDate", "redisclosureNotice"].map((k) => [k, true]));
    const cap = (recipient: string) => ra.runAction("consent_record_capture", { role: "ecm_provider", staffId: "s-cm1" }, p, { args: [{ draft: { patientId: p.id, consentType: "part2_tpo_single", recipients: [{ kind: "org", name: recipient }], purpose: "care_coordination", purposeCode: "care_coordination", items: ["diagnoses"], expiresOn: "2027-10-21", part2Elements: els }, method: "e_sign", signer: "Prueba B24", relationship: "patient", attested: true, actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] }).ok;
    const external = cap("Valley Clinic");
    return { pid: p.id as string, external };
  });
  expect(setup.external).toBe(true);

  await page.evaluate(() => (window as unknown as W).__adelante.setActingStaff("s-cc1", "clinical_coordinator"));
  await go(page, `/record/${setup.pid}`);
  const panel = page.getByTestId("coordinator-sud-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // External recipient: still locked.
  await expect(page.getByText("SUD care — minimum necessary")).toHaveCount(0);

  const recordId = await page.evaluate(async (pid) => {
    const app = (window as unknown as W).__adelante;
    const { ra } = await app.access();
    const e = app.AdelanteEHR;
    const els = Object.fromEntries(["patientName", "recipients", "amountAndKind", "purpose", "rightToRevoke", "expiration", "signatureAndDate", "redisclosureNotice"].map((k) => [k, true]));
    const r = ra.runAction("consent_record_capture", { role: "ecm_provider", staffId: "s-cm1" }, e.getPatient(pid), { args: [{ draft: { patientId: pid, consentType: "part2_tpo_single", recipients: [{ kind: "org", name: "Adelante care coordination team" }], purpose: "care_coordination", purposeCode: "care_coordination", items: ["diagnoses"], expiresOn: "2027-10-21", part2Elements: els }, method: "e_sign", signer: "Prueba B24", relationship: "patient", attested: true, actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] });
    if (!r.ok) throw new Error(r.reason);
    return e.listConsentRecords(pid).find((x: any) => x.consentType === "part2_tpo_single" && x.status === "active" && x.recipients[0].name === "Adelante care coordination team").id as string;
  }, setup.pid);
  await expect(page.getByText("SUD care — minimum necessary")).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByRole("heading", { name: "Released counseling notes" })).toHaveCount(0);
  const r = await new AxeBuilder({ page }).include('[data-testid="coordinator-sud-panel"]').analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  const revoked = await page.evaluate(async ([pid, id]) => {
    const app = (window as unknown as W).__adelante;
    const { ra } = await app.access();
    return ra.runAction("consent_record_revoke", { role: "ecm_provider", staffId: "s-cm1" }, app.AdelanteEHR.getPatient(pid), { args: [{ recordId: id, method: "in_person", note: "Patient asked", actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] }).ok;
  }, [setup.pid, recordId]);
  expect(revoked).toBe(true);
  await expect(page.getByText("SUD care — minimum necessary")).toHaveCount(0, { timeout: 15_000 });
});
