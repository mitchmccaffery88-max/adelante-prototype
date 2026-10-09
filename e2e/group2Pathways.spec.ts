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
    // The walkthrough looks at the portal after onboarding; intake itself is covered below.
    (e as never as { getPatient: (i: string) => { intakeCompletedAt?: string } }).getPatient(id).intakeCompletedAt = new Date().toISOString();
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

for (const lang of ["en", "es"] as const) {
  test(`onboarding as Luis (${lang}): two contacts, second made advocate, consent signed`, async ({ page }) => {
    await page.goto("/clinician");
    await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
    // Seeded Luis Camacho already finished intake (re-runs show "Let's catch up", which never names
    // an advocate), so a fresh, not-yet-onboarded Luis comes in through the real referral path.
    const luisId = (await page.evaluate((l) => {
      const e = (window as unknown as W).__adelante.AdelanteEHR as never as { createReferral: (i: unknown) => { id: string }; enrollReferral: (id: string) => string; getPatient: (i: string) => { preferredLanguage?: string }; setCurrentPatientId: (i: string) => void };
      const r = e.createReferral({ firstName: "Luis", lastName: `Onboard${l.toUpperCase()}`, dob: l === "es" ? "1993-05-06" : "1992-03-04", phone: l === "es" ? "5595550172" : "5595550171", referringAgency: "Clinic", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization", consentToContact: true, channel: "staff" });
      const id = e.enrollReferral(r.id);
      e.getPatient(id).preferredLanguage = l;
      e.setCurrentPatientId(id);
      return id;
    }, lang)) as string;
    if (lang === "es") await page.evaluate(() => localStorage.setItem("adelante.lang", "es"));
    await go(page, "/intake");
    const contacts = page.getByText(lang === "es" ? /Emergency contacts|Contactos de emergencia/ : "Emergency contacts").first();
    for (let i = 0; i < 12 && !(await contacts.isVisible()); i++) {
      await page.getByRole("button", { name: /^(Next|Continue|Save & continue|Siguiente|Continuar|Guardar)/ }).last().click();
    }
    await expect(contacts).toBeVisible();
    const rows = page.getByTestId("emergency-contact-row");
    if ((await rows.count()) < 2) await page.getByRole("button", { name: /Add another contact/ }).click();
    const fill = async (i: number, name: string, phone: string, rel: string) => {
      await page.getByLabel(`Name — contact ${i}`).fill(name);
      await page.getByLabel(`Phone — contact ${i}`).fill(phone);
      await page.getByLabel(`Relationship — contact ${i}`).selectOption(rel);
    };
    await fill(1, "Rosa Camacho", "5595550181", "parent");
    await fill(2, "Diego Camacho", "5595550182", "sibling");
    await page.getByTestId("advocate-from-contact-1").click();
    await expect(page.getByTestId("advocate-linked")).toBeVisible();
    await expect(page.getByTestId("advocate-name")).toHaveValue("Diego Camacho");
    await page.getByTestId("advocate-type").selectOption("family");
    await page.getByTestId("advocate-email").fill("diego@example.org");
    await page.getByTestId("advocate-sign-now").click();
    await page.getByTestId("advocate-sign-name").fill("Luis Camacho");
    await page.getByTestId("advocate-sign-agree").click();
    await expect(page.getByTestId("advocate-errors")).toHaveCount(0);

    // Submit through the same store path the final step uses, then check status on My care.
    for (let i = 0; i < 15; i++) {
      const submit = page.getByRole("button", { name: /^(Submit|Finish|Enviar|Terminar)/ });
      if (await submit.count()) { await submit.last().click(); break; }
      await page.getByRole("button", { name: /^(Next|Continue|Save & continue|Siguiente|Continuar|Guardar)/ }).last().click();
    }
    await expect.poll(() => page.evaluate((id) => ((window as unknown as W).__adelante.AdelanteEHR as never as { listAdvocateLinks: (p: string) => { advocateName: string; expectedAuthorizationType?: string }[] }).listAdvocateLinks(id).find((l) => l.advocateName === "Diego Camacho")?.expectedAuthorizationType, luisId)).toBe("family_participation");
    await go(page, "/profile");
    await expect(page.getByTestId("advocate-status").first()).toHaveText(lang === "es" ? "Esperando su registro" : "Waiting for their sign-up");
  });
}
