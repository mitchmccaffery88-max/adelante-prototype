// §B2-6 — staff capture → Part 2 disclosure → the record detail lists the
// link; a consent-ledger viewer without chart access (billing) sees the program
// ID, not the name, on the consent audit view. Axe on both surfaces. The link
// is read-only: enforcement stays OFF (B2-4).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type W = { __adelante: { AdelanteEHR: any; setActingStaff: (id: string, role?: string) => void; go: (to: string) => void; access: () => Promise<{ ra: { runAction: (...a: unknown[]) => { ok: boolean; reason?: string } }; pd: { disclose: (r: unknown) => { ok: boolean; reason?: string; entry?: { id: string; consentRecordId: string | null } } } }> } };

async function boot(page: Page) {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
}
async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
async function axe(page: Page, testId: string) {
  const r = await new AxeBuilder({ page }).include(`[data-testid="${testId}"]`).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}

test("B2-6 capture → disclosure → record detail and consent audit list the link", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await boot(page);
  const setup = await page.evaluate(async () => {
    const app = (window as unknown as W).__adelante;
    app.setActingStaff("s-cm1", "ecm_provider");
    const e = app.AdelanteEHR;
    const r = e.createReferral({ firstName: "Prueba", lastName: "AuditLinkB26", dob: "1990-01-01", phone: "5595550311", referringAgency: "Clinic", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization", consentToContact: true, channel: "staff" });
    const pid = e.enrollReferral(r.id) as string;
    // Existing (legacy) consent that already allows this disclosure — the decision does not depend on the link.
    e.createConsentRecord({ patientId: pid, formType: "NonAB133", source: "test", signedByName: "Prueba AuditLinkB26", attested: true, effectiveDate: "2026-09-01", sections: [{ category: "information_sharing_disclosure", authorized: true }], capturedBy: { staffName: "Luz Herrera", role: "ecm_provider" } });
    const { ra, pd } = await app.access();
    const p = e.getPatient(pid);
    const elements = Object.fromEntries(["patientName", "recipients", "amountAndKind", "purpose", "rightToRevoke", "expiration", "signatureAndDate", "redisclosureNotice"].map((k) => [k, true]));
    const cap = ra.runAction("consent_record_capture", { role: "ecm_provider", staffId: "s-cm1" }, p, { args: [{ draft: { patientId: pid, consentType: "part2_specific_written", recipients: [{ kind: "org", name: "Outside Clinic" }], purpose: "Referral for treatment", items: ["SUD treatment notes"], expiresOn: "2027-10-21", part2Elements: elements }, method: "e_sign", signer: "Prueba AuditLinkB26", relationship: "patient", attested: true, actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" } }] });
    const rec = e.listConsentRecords(pid).find((x: any) => x.consentType === "part2_specific_written");
    const d = pd.disclose({ patientId: pid, actor: { name: "Luz Herrera", role: "ecm_provider", staffId: "s-cm1" }, recipient: { name: "Outside Clinic", type: "provider" }, purpose: "Referral for treatment", channel: "referral_out", recordClasses: ["SUD referral information"] });
    const audit = e.listAuditEvents({ patientId: pid }).find((x: any) => x.detail?.disclosureLogId === d.entry?.id);
    return { pid, programId: p.programId as string, capOk: cap.ok, recordId: rec?.id as string, disclosure: d, auditId: audit?.id as string };
  });
  expect(setup.capOk).toBe(true);
  expect(setup.disclosure.ok).toBe(true);
  expect(setup.disclosure.entry!.consentRecordId).toBe(setup.recordId);

  // Record detail (chart) lists the linked disclosure
  await go(page, `/record/${setup.pid}?section=consents`);
  const panel = page.getByTestId("consent-capture-panel");
  await expect(panel).toBeVisible();
  await panel.getByTestId("consent-history-part2_specific_written").getByRole("button").click();
  const detail = page.getByTestId("consent-record-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId(`consent-linked-disclosure-${setup.disclosure.entry!.id}`)).toBeVisible();
  await axe(page, "consent-record-detail");
  await page.keyboard.press("Escape");

  // Billing reads the consent ledger but cannot open this chart: program ID only
  await page.evaluate(() => (window as unknown as W).__adelante.setActingStaff("s-bill1", "billing"));
  await go(page, "/consent-audit");
  const table = page.getByTestId("consent-audit-table");
  await expect(table).toBeVisible();
  const row = table.locator(`[data-row-id="${setup.auditId}"]`);
  await expect(row).toBeVisible();
  const cell = row.getByTestId("consent-audit-link-cell");
  await expect(cell).toContainText(setup.programId);
  await expect(cell).toContainText(`Consent record ${setup.recordId}`);
  await expect(cell).not.toContainText("AuditLinkB26");
  await expect(cell).not.toContainText("Prueba");
  await axe(page, "consent-audit-table");
});
