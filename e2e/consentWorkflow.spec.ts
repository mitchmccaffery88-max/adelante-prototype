// §Consent workflow walkthrough (Draft — pending counsel review).
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 240_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
const as = (page: Page, id: string, role: string) => page.evaluate(([i, r]) => (window as unknown as W).__adelante.setActingStaff(i, r), [id, role]);
const ehr = (page: Page, fn: string, ...args: unknown[]) => page.evaluate(([f, a]) => ((window as unknown as W).__adelante.AdelanteEHR[f as string]!)(...(a as unknown[])), [fn, args] as const);
const precheck = (page: Page, pid: string, serviceType: string) =>
  page.evaluate(async ([id, st]) => {
    const b = (await ((window as unknown as { __adelante: { avail: () => Promise<{ bf: typeof import("../src/lib/bookingFlow") }> } }).__adelante.avail())).bf;
    const e = (window as unknown as W).__adelante.AdelanteEHR as never as { getPatient: (i: string) => unknown; listClinicians: () => { id: string }[] };
    const r = b.precheckBooking({ actor: { role: "clinical_coordinator", staffId: "s-cc1" }, patient: e.getPatient(id) as never, serviceType: st as never, clinicianId: e.listClinicians()[0]!.id, modality: "in_person" });
    return r.ok ? "ok" : r.reason;
  }, [pid, serviceType] as const);

async function newPatient(page: Page, extra: Record<string, unknown>) {
  return (await page.evaluate(async (x) => {
    const e = (window as unknown as W).__adelante.AdelanteEHR as never as { createReferral: (i: unknown) => { id: string }; enrollReferral: (id: string) => string; getPatient: (i: string) => Record<string, unknown> };
    const r = e.createReferral({ dob: "1987-03-02", phone: "5595550171", referringAgency: "County Probation", referrerName: "Officer Diaz", referrerPhone: "5595550100", referralSource: "probation", justiceInvolved: "yes", consentToContact: true, channel: "staff", ...x });
    const id = e.enrollReferral(r.id);
    e.getPatient(id)["intakeCompletedAt"] = new Date().toISOString();
    (await import("/src/lib/flagJourneys.ts")).applyFlagJourneys(id);
    return id;
  }, extra)) as string;
}

test("intake packet → sign 5, decline group → group gate → sign from prompt → revoke SMS → new HIPAA version", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const pid = await newPatient(page, { firstName: "Marisol", lastName: "Consentwalk", substanceUseNeed: true });

  // Coordinator sends the intake packet from the chart.
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, `/record/${pid}?section=consents`);
  await page.getByTestId("send-intake-packet").click();
  await expect(page.getByTestId("form-status-hipaa")).toHaveText("Sent");

  // Patient signs 5 with checkboxes, declines Group.
  await ehr(page, "setCurrentPatientId", pid);
  await go(page, "/patient");
  const forms = page.getByTestId("forms-to-sign").first();
  await expect(forms.getByTestId("forms-progress")).toHaveText("0 of 7 done");
  for (const t of ["HIPAA authorization", "Telehealth", "Patient portal", "Text reminders", "Sharing substance-use information (Part 2)"])
    await forms.getByRole("checkbox", { name: `I agree to this form: ${t}` }).click();
  await expect(forms.getByTestId("part2-card")).toBeVisible();
  await forms.getByRole("button", { name: "No thanks: Group participation" }).click();
  await forms.getByLabel("Your full name", { exact: true }).fill("Marisol Consentwalk");
  await forms.getByLabel("Type your full name to sign").fill("Marisol Consentwalk");
  await forms.getByTestId("forms-sign").click();
  await expect(forms.getByTestId("forms-progress")).toHaveText("6 of 7 done");

  // Chart status updates.
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, `/record/${pid}?section=consents`);
  await expect(page.getByTestId("form-status-hipaa")).toHaveText("Signed");
  await expect(page.getByTestId("form-status-group")).toHaveText("Declined");
  await expect(page.getByTestId("group-consent-needed")).toBeVisible();

  // Group booking blocked; individual + MAT not blocked by group consent.
  expect(await precheck(page, pid, "therapy_group")).toBe("Group consent needed");
  expect(await precheck(page, pid, "therapy_individual")).not.toBe("Group consent needed");
  expect(await precheck(page, pid, "med_management")).not.toBe("Group consent needed");

  // Patient signs Group from the one-card prompt.
  await ehr(page, "setCurrentPatientId", pid);
  await go(page, "/patient");
  const prompt = page.getByTestId("group-consent-prompt");
  await prompt.getByRole("button", { name: "Review the form" }).click();
  await prompt.getByRole("checkbox", { name: "I agree to this form: Group participation" }).click();
  await prompt.getByLabel("Your full name", { exact: true }).fill("Marisol Consentwalk");
  await prompt.getByTestId("forms-sign").click();
  await expect(page.getByTestId("group-consent-prompt")).toHaveCount(0);
  expect(await precheck(page, pid, "therapy_group")).not.toBe("Group consent needed");

  // Patient revokes SMS through the confirm step.
  await go(page, "/profile");
  await page.getByRole("button", { name: "Stop sharing: Text reminders" }).click();
  await expect(page.getByTestId("stop-sharing-confirm")).toContainText("text reminders");
  await page.getByRole("button", { name: "Yes, stop sharing" }).click();

  // Ledger shows the revocation; the signed copy stays readable.
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, `/record/${pid}?section=consents`);
  const copies = page.getByTestId("signed-copies");
  await expect(copies.getByText(/revoked · keep until/)).toBeVisible();
  await copies.getByRole("button", { name: /Text reminders · v1/ }).click();
  await expect(page.getByTestId("signed-copy-detail")).toContainText("fnv1a:");
  await page.keyboard.press("Escape");

  // sys_admin publishes HIPAA v2; the earlier copy still shows v1.
  await as(page, "s-admin1", "sys_admin");
  await go(page, "/admin-content");
  await page.getByRole("tab", { name: "Legal & consent" }).click();
  const row = page.getByTestId("consent-form-hipaa");
  await row.getByRole("button", { name: "New version" }).click();
  await page.getByRole("button", { name: "Save as draft" }).click();
  await row.getByRole("button", { name: "Send to legal review" }).click();
  await row.getByRole("button", { name: "Approve (Counsel: pending)" }).click();
  await row.getByRole("button", { name: "Publish" }).click();
  await expect(row).toContainText("published v2");
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, `/record/${pid}?section=consents`);
  await expect(page.getByTestId("signed-copies").getByRole("button", { name: /HIPAA authorization · v1/ })).toBeVisible();
});

test("in-person tablet mode — Spanish patient signs Telehealth, then the screen locks", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const pid = await newPatient(page, { firstName: "Rosa", lastName: "Tableta", preferredLanguage: "es" });
  await page.evaluate(async (id) => {
    const e = (window as unknown as W).__adelante.AdelanteEHR as never as { getPatient: (i: string) => Record<string, unknown> };
    e.getPatient(id)["preferredLanguage"] = "es";
    (await import("/src/lib/languagePreference.ts")).writePreferredLanguage("es", id);
  }, pid);
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, `/record/${pid}?section=consents`);
  await page.getByRole("button", { name: "Send a form" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: /Telehealth/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Send/ }).click();
  await expect(page.getByTestId("form-status-telehealth")).toHaveText("Sent");
  await page.getByTestId("sign-in-person").click();
  const tablet = page.getByTestId("in-person-mode");
  await expect(tablet.getByText("Formularios para firmar")).toBeVisible();
  await tablet.getByRole("checkbox", { name: "Acepto este formulario: Telesalud" }).click();
  await tablet.getByLabel("Firma por el paciente como").selectOption("patient");
  await tablet.getByTestId("forms-sign").click();
  await tablet.getByRole("button", { name: "Terminé" }).click();
  await expect(page.getByTestId("in-person-locked")).toBeVisible();
  await page.getByRole("button", { name: "Staff: unlock" }).click();
  await expect(page.getByTestId("form-status-telehealth")).toHaveText("Signed");
  await expect(page.getByTestId("signed-copies")).toContainText("Telesalud · v1 · ES");
});
