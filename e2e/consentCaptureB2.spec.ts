// §B2-2 — staff capture / paper upload (Simulated) / send for e-sign in the
// chart Consents section, and patient e-sign in Spanish at 390px. Axe on each.
import { openWithReason } from "./helpers/openWithReason";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type W = { __adelante: { AdelanteEHR: any; setActingStaff: (id: string, role?: string) => void; go: (to: string) => void; access: () => Promise<{ ra: { runAction: (...a: unknown[]) => { ok: boolean; reason?: string } } }> } };

async function boot(page: Page) {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
}
async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
async function enroll(page: Page, last: string, lang: "en" | "es") {
  return page.evaluate(([ln, l]) => {
    const app = (window as unknown as W).__adelante;
    app.setActingStaff("s-cm1", "ecm_provider");
    const e = app.AdelanteEHR;
    const r = e.createReferral({ firstName: "Prueba", lastName: ln, dob: "1990-01-01", phone: "5595550311", referringAgency: "Clinic", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization", consentToContact: true, channel: "staff" });
    const id = e.enrollReferral(r.id) as string;
    e.getPatient(id).preferredLanguage = l;
    return id;
  }, [last, lang] as const);
}
const succeeded = (page: Page, actionId: string) =>
  page.evaluate((a) => (window as unknown as W).__adelante.AdelanteEHR.listAuditEvents({}).filter((e: any) => e.action === "action.succeeded" && e.detail?.actionId === a).length, actionId);
const typed = (page: Page, pid: string) =>
  page.evaluate((id) => (window as unknown as W).__adelante.AdelanteEHR.listConsentRecords(id).filter((r: any) => r.consentType).map((r: any) => ({ type: r.consentType, method: r.signature?.method, status: r.status, witness: r.signature?.witness })), pid);
async function axe(page: Page, testId: string) {
  const r = await new AxeBuilder({ page }).include(`[data-testid="${testId}"]`).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}
async function fillTerms(page: Page, type: string) {
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Consent type").selectOption(type);
  await sheet.getByLabel("Recipient", { exact: true }).fill("Valley Clinic");
  await sheet.getByLabel("Purpose", { exact: true }).fill("Coordinate care");
  await sheet.getByLabel("Information covered").fill("visit summaries");
  await sheet.getByLabel("Ends on").fill("2027-10-21");
  return sheet;
}

test("B2-2 staff capture, Part 2 validation, paper upload and send for e-sign", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await boot(page);
  const pid = await enroll(page, "CaptureStaff", "en");
  await go(page, `/record/${pid}?section=consents`);
  await openWithReason(page, "scheduling_admin");
  const panel = page.getByTestId("consent-capture-panel");
  await expect(panel).toBeVisible();
  await axe(page, "consent-capture-panel");

  // In-person e-sign
  const n = await succeeded(page, "consent_record_capture");
  await panel.getByTestId("consent-capture").click();
  let sheet = await fillTerms(page, "hipaa_authorization");
  await sheet.getByRole("checkbox", { name: "Attestation" }).click();
  await axe(page, "consent-form-capture");
  await sheet.getByTestId("consent-form-submit").click();
  await expect(panel.getByTestId("consent-history-hipaa_authorization")).toContainText("Active");
  expect(await succeeded(page, "consent_record_capture")).toBe(n + 1);

  // Part 2 without the checklist is refused (no record written)
  await panel.getByTestId("consent-capture").click();
  sheet = await fillTerms(page, "part2_tpo_single");
  await expect(sheet.getByTestId("part2-checklist")).toBeVisible();
  await sheet.getByRole("checkbox", { name: "Attestation" }).click();
  await sheet.getByTestId("consent-form-submit").click();
  await expect(page.getByText(/missing required elements/)).toBeVisible();
  await page.keyboard.press("Escape");
  expect((await typed(page, pid)).some((r) => r.type === "part2_tpo_single")).toBe(false);

  // Paper upload — Simulated, with witness
  await panel.getByTestId("consent-upload").click();
  sheet = await fillTerms(page, "telehealth");
  await sheet.getByLabel("Date on the paper").fill("2026-10-20");
  await sheet.getByLabel("Scanned file").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fictional") });
  await sheet.getByLabel("Witness").fill("Front desk");
  await sheet.getByTestId("consent-form-submit").click();
  const row = panel.getByTestId("consent-history-telehealth");
  await expect(row).toContainText("Simulated");
  expect((await typed(page, pid)).find((r) => r.type === "telehealth")).toMatchObject({ method: "wet_sign_upload", witness: "Front desk" });
  const sim = await page.evaluate(() => (window as unknown as W).__adelante.AdelanteEHR.listAuditEvents({}).filter((e: any) => e.detail?.actionId === "consent_record_upload" && e.action === "action.succeeded").map((e: any) => e.detail.simulated));
  expect(sim).toEqual([true]);

  // History detail
  await row.getByRole("button").click();
  await expect(page.getByTestId("consent-record-detail")).toContainText("Paper upload");
  await expect(page.getByTestId("consent-linked-disclosures")).toHaveText("None linked yet");
  await page.keyboard.press("Escape");

  // Send for e-sign
  await panel.getByTestId("consent-send-esign").click();
  await fillTerms(page, "sms_reminder");
  await page.getByRole("dialog").getByTestId("consent-form-submit").click();
  await expect(panel.getByTestId("consent-esign-waiting")).toBeVisible();
  await axe(page, "consent-capture-panel");
});

test("B2-2 patient e-sign in Spanish at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1800 });
  await boot(page);
  const pid = "p1"; // seeded patient with intake completed; Spanish chosen with the member language toggle
  const sent = await page.evaluate(async (id) => {
    const app = (window as unknown as W).__adelante;
    const { ra } = await app.access();
    const p = app.AdelanteEHR.getPatient(id);
    const r = ra.runAction("consent_record_request_esign", { role: "ecm_provider", staffId: "s-cm1" }, p, { args: [{ draft: { patientId: id, consentType: "sms_reminder", recipients: [{ kind: "org", name: "Adelante" }], purpose: "Recordatorios de citas", items: ["citas"], expiresOn: "2027-10-21" }, actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] });
    app.AdelanteEHR.setCurrentPatientId(id);
    return r.ok;
  }, pid);
  expect(sent).toBe(true);
  await go(page, "/profile");
  await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
  const card = page.getByTestId("patient-consent-esign");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Formularios de consentimiento de tu equipo");
  const width = await card.evaluate((el) => el.getBoundingClientRect().right);
  expect(width).toBeLessThanOrEqual(390);
  await axe(page, "patient-consent-esign");
  const n = await succeeded(page, "consent_record_patient_sign");
  await card.getByLabel("Escribe tu nombre completo").fill("Paciente de Prueba");
  await card.getByRole("checkbox", { name: "Lo leí y estoy de acuerdo" }).click();
  await card.getByTestId("esign-submit").click();
  await expect(card).toBeHidden();
  expect(await succeeded(page, "consent_record_patient_sign")).toBe(n + 1);
  expect((await typed(page, pid)).find((r) => r.type === "sms_reminder")).toMatchObject({ method: "e_sign", status: "active" });
  await expect(page.getByTestId("my-consent-records")).toContainText("Mis formularios");
  await axe(page, "my-consent-records");
});
