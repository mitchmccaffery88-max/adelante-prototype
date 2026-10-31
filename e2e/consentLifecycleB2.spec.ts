// §B2-3 — staff revoke + renew in the chart Consents section, patient revoke
// in Spanish at 390px, and the missing/expiring worklist name policy. Axe on
// each surface. Enforcement stays OFF (B2-4); nothing here changes access.
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
/** Staff capture of a typed record through the registry (same path as the UI). */
async function capture(page: Page, pid: string, type: string, recipient: string, expiresOn = "2027-10-21") {
  return page.evaluate(async ([id, t, rec, exp]) => {
    const app = (window as unknown as W).__adelante;
    const { ra } = await app.access();
    const p = app.AdelanteEHR.getPatient(id);
    const r = ra.runAction("consent_record_capture", { role: "ecm_provider", staffId: "s-cm1" }, p, { args: [{ draft: { patientId: id, consentType: t, recipients: [{ kind: "org", name: rec }], purpose: "Coordinate care", items: ["visit summaries"], expiresOn: exp }, method: "e_sign", signer: "Test Signer", relationship: "patient", attested: true, actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] });
    return r.ok;
  }, [pid, type, recipient, expiresOn] as const);
}
const succeeded = (page: Page, actionId: string) =>
  page.evaluate((a) => (window as unknown as W).__adelante.AdelanteEHR.listAuditEvents({}).filter((e: any) => e.action === "action.succeeded" && e.detail?.actionId === a).length, actionId);
const typed = (page: Page, pid: string) =>
  page.evaluate((id) => (window as unknown as W).__adelante.AdelanteEHR.listConsentRecords(id).filter((r: any) => r.consentType).map((r: any) => ({ id: r.id, type: r.consentType, status: r.status, supersedesId: r.supersedesId, revocation: r.revocation })), pid);
async function axe(page: Page, testId: string) {
  const r = await new AxeBuilder({ page }).include(`[data-testid="${testId}"]`).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}

test("B2-3 staff revoke and renew in the chart Consents section", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await boot(page);
  const pid = await enroll(page, "LifecycleStaff", "en");
  expect(await capture(page, pid, "hipaa_authorization", "Valley Clinic")).toBe(true);
  expect(await capture(page, pid, "telehealth", "Valley Clinic")).toBe(true);
  await go(page, `/record/${pid}?section=consents`);
  await openWithReason(page, "scheduling_admin");
  const panel = page.getByTestId("consent-capture-panel");
  await expect(panel).toBeVisible();

  // Revoke the HIPAA record through the ConfirmDialog
  const hipaa = (await typed(page, pid)).find((r) => r.type === "hipaa_authorization")!;
  const nRev = await succeeded(page, "consent_record_revoke");
  await panel.getByTestId("consent-history-hipaa_authorization").getByRole("button").click();
  await page.getByTestId(`consent-revoke-${hipaa.id}`).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Revoke: HIPAA authorization");
  await dialog.getByLabel("Revocation method").selectOption("written");
  await dialog.getByRole("button", { name: "Revoke consent" }).click();
  await expect(panel.getByTestId(`consent-status-${hipaa.id}`)).toHaveText("Revoked");
  expect(await succeeded(page, "consent_record_revoke")).toBe(nRev + 1);
  const revoked = (await typed(page, pid)).find((r) => r.id === hipaa.id);
  expect(revoked?.revocation?.method).toBe("written");

  // Renew the telehealth record: old superseded, new active and linked
  const tele = (await typed(page, pid)).find((r) => r.type === "telehealth")!;
  const nRen = await succeeded(page, "consent_record_renew");
  await panel.getByTestId("consent-history-telehealth").getByRole("button").click();
  await page.getByTestId(`consent-renew-${tele.id}`).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("renew-terms")).toContainText("Telehealth");
  await sheet.getByLabel("Ends on").fill("2028-10-21");
  await sheet.getByRole("checkbox", { name: "Attestation" }).click();
  await sheet.getByTestId("consent-form-submit").click();
  expect(await succeeded(page, "consent_record_renew")).toBe(nRen + 1);
  const after = await typed(page, pid);
  const oldTele = after.find((r) => r.id === tele.id);
  const newTele = after.find((r) => r.supersedesId === tele.id);
  expect(oldTele?.status).toBe("superseded");
  expect(newTele?.status).toBe("active");
  await expect(panel.getByTestId(`consent-status-${tele.id}`)).toHaveText("Superseded");

  // The per-patient gap panel lists what is still missing
  const gaps = page.getByTestId("consent-gaps-panel");
  await expect(gaps.getByTestId("consent-gap-part2_tpo_single")).toContainText("Missing");
  await axe(page, "consent-capture-panel");
  await axe(page, "consent-gaps-panel");
});

test("B2-3 patient revoke and sign-again in Spanish at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1800 });
  await boot(page);
  const pid = "p1";
  await page.evaluate(async (id) => {
    const app = (window as unknown as W).__adelante;
    const { ra } = await app.access();
    const p = app.AdelanteEHR.getPatient(id);
    ra.runAction("consent_record_capture", { role: "ecm_provider", staffId: "s-cm1" }, p, { args: [{ draft: { patientId: id, consentType: "sms_reminder", recipients: [{ kind: "org", name: "Adelante" }], purpose: "Recordatorios de citas", items: ["citas"], expiresOn: "2027-10-21" }, method: "e_sign", signer: "Paciente de Prueba", relationship: "patient", attested: true, actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] });
    // An expired record for the sign-again path
    ra.runAction("consent_record_capture", { role: "ecm_provider", staffId: "s-cm1" }, p, { args: [{ draft: { patientId: id, consentType: "portal_reminder", recipients: [{ kind: "org", name: "Adelante" }], purpose: "Avisos del portal", items: ["mensajes"], expiresOn: "2026-01-01" }, method: "e_sign", signer: "Paciente de Prueba", relationship: "patient", attested: true, actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] });
    app.AdelanteEHR.setCurrentPatientId(id);
  }, pid);
  await go(page, "/profile");
  await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
  const mine = page.getByTestId("my-consent-records");
  await expect(mine).toBeVisible();

  // Revoke the active sms record
  const sms = (await typed(page, pid)).find((r) => r.type === "sms_reminder")!;
  const nRev = await succeeded(page, "consent_record_patient_revoke");
  await mine.getByTestId(`my-consent-revoke-${sms.id}`).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("¿Revocar este consentimiento?");
  await dialog.getByRole("button", { name: "Sí, revocar" }).click();
  expect(await succeeded(page, "consent_record_patient_revoke")).toBe(nRev + 1);
  expect((await typed(page, pid)).find((r) => r.id === sms.id)?.status).toBe("revoked");

  // Sign again on the expired portal record
  const portal = (await typed(page, pid)).find((r) => r.type === "portal_reminder")!;
  await mine.getByTestId(`my-consent-sign-again-${portal.id}`).click();
  const card = page.getByTestId("patient-consent-esign");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Recordatorios del portal");
  const width = await card.evaluate((el) => el.getBoundingClientRect().right);
  expect(width).toBeLessThanOrEqual(390);
  await axe(page, "my-consent-records");
  await axe(page, "patient-consent-esign");
});

test("B2-3 missing/expiring worklist shows program ID without chart access", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await boot(page);
  const pid = await enroll(page, "WorklistPolicy", "en");
  // Restrict the record so a chart-entry role off the care team can't open it.
  const restricted = await page.evaluate(async (id) => {
    const app = (window as unknown as W).__adelante;
    const { ra } = await app.access();
    const p = app.AdelanteEHR.getPatient(id);
    const r = ra.runAction("chart_restrict", { role: "sys_admin", staffId: "s-admin" }, p, { args: [{ patientId: id, restricted: true, reason: "B2-3 name-policy check", actor: { role: "sys_admin", staffId: "s-admin", name: "Admin" } }] });
    return r.ok && p.programId;
  }, pid);
  expect(restricted).toBeTruthy();
  const programId = await page.evaluate((id) => (window as unknown as W).__adelante.AdelanteEHR.getPatient(id).programId, pid);
  // A chart-entry role that is NOT on this patient's care team.
  await page.evaluate(() => (window as unknown as W).__adelante.setActingStaff("s-th1", "therapist"));
  await go(page, "/consent");
  const list = page.getByTestId("consent-gap-worklist");
  await expect(list).toBeVisible();
  await expect(list.getByTestId("consent-gap-counts")).toContainText("<11");
  const row = list.getByTestId("consent-gap-row").filter({ hasText: programId }).first();
  await expect(row).toBeVisible();
  await expect(row.getByTestId("consent-gap-label")).toHaveText(programId);
  await expect(row).not.toContainText("Prueba");
  await axe(page, "consent-gap-worklist");
});
