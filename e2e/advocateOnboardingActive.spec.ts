// §F4 — onboarding to an ACTIVE advocate, end to end, with a fresh referral
// patient (never the established demo patient Luis Camacho):
// referral → enroll → intake (two contacts, second made advocate, "Family
// member or friend", separate phone + email) → patient signs the intake packet
// and the advocate consent form in Forms to sign → the advocate opens the
// invite, signs their attestation and completes sign-up → Active for both →
// the advocate sees only what their tier allows (no SUD content).
// EN runs the whole path; ES repeats the patient steps.
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; go: (to: string) => void } };
test.describe.configure({ timeout: 240_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
type Link = { id: string; advocateName: string; invitationCode: string; status: string; notificationSentAt?: string; expectedAuthorizationType?: string; contactId?: string; invitationSentTo: string };
const links = (page: Page, pid: string) => page.evaluate((id) => ((window as unknown as W).__adelante.AdelanteEHR as never as { listAdvocateLinks: (p: string) => Link[] }).listAdvocateLinks(id), pid);

async function patientSteps(page: Page, lang: "en" | "es") {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const last = lang === "es" ? "FreshwalkES" : "FreshwalkEN";
  const pid = (await page.evaluate(([l, ln]) => {
    const e = (window as unknown as W).__adelante.AdelanteEHR as never as { createReferral: (i: unknown) => { id: string }; enrollReferral: (id: string) => string; getPatient: (i: string) => { preferredLanguage?: string }; setCurrentPatientId: (i: string) => void };
    const r = e.createReferral({ firstName: "Elena", lastName: ln, dob: l === "es" ? "1994-07-08" : "1995-08-09", phone: l === "es" ? "5595550274" : "5595550273", referringAgency: "Clinic", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization", consentToContact: true, channel: "staff" });
    const id = e.enrollReferral(r.id);
    e.getPatient(id).preferredLanguage = l;
    e.setCurrentPatientId(id);
    return id;
  }, [lang, last] as const)) as string;

  // Intake: contacts, second contact becomes the advocate.
  await go(page, "/intake");
  if (lang === "es") await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
  const contacts = page.getByText(/Emergency contacts|Contactos de emergencia/).first();
  for (let i = 0; i < 12 && !(await contacts.isVisible()); i++) await page.getByRole("button", { name: /^(Next|Continue|Save & continue|Siguiente|Continuar|Guardar)/ }).last().click();
  await expect(contacts).toBeVisible();
  if ((await page.getByTestId("emergency-contact-row").count()) < 2) await page.getByRole("button", { name: /Add another contact/ }).click();
  const fill = async (i: number, name: string, phone: string, rel: string) => {
    await page.getByLabel(`Name — contact ${i}`).fill(name);
    await page.getByLabel(`Phone — contact ${i}`).fill(phone);
    await page.getByLabel(`Relationship — contact ${i}`).selectOption(rel);
  };
  await fill(1, "Marta Freshwalk", "5595550281", "parent");
  await fill(2, "Tomas Freshwalk", "5595550282", "sibling");
  await page.getByTestId("advocate-from-contact-1").click();
  await expect(page.getByTestId("advocate-name")).toHaveValue("Tomas Freshwalk");
  await page.getByTestId("advocate-type").selectOption("family"); // "Family member or friend"
  await expect(page.getByTestId("advocate-phone")).toHaveValue(/5595550282/);
  await page.getByTestId("advocate-email").fill("tomas.freshwalk@example.org");
  await expect(page.getByTestId("advocate-errors")).toHaveCount(0);
  const nextBtn = page.getByRole("button", { name: /^(Save & continue|Guardar y continuar|Next|Siguiente)/ }).last();
  for (let i = 0; i < 60; i++) {
    const submit = page.getByRole("button", { name: /^(Submit|Finish|Enviar|Terminar|Complete intake|Completar)/ });
    if (await submit.count()) { await submit.last().click(); break; }
    if (await nextBtn.isEnabled()) { await nextBtn.click(); continue; }
    const groups = page.getByRole("radiogroup");
    let acted = false;
    for (let g = 0; g < (await groups.count()); g++) {
      const grp = groups.nth(g);
      if ((await grp.getByRole("radio", { checked: true }).count()) === 0) { await grp.getByRole("radio").first().click(); acted = true; }
    }
    const box = page.getByRole("checkbox", { checked: false }).first();
    if (!acted && (await box.count())) await box.click();
  }
  await expect.poll(async () => (await links(page, pid)).find((l) => l.advocateName === "Tomas Freshwalk")?.expectedAuthorizationType).toBe("family_participation");
  const link = (await links(page, pid)).find((l) => l.advocateName === "Tomas Freshwalk")!;
  expect(link.contactId).toBeTruthy();
  expect(JSON.stringify(link)).not.toContain("notificationDelivery"); // held until the form is signed

  // Patient signs everything open in Forms to sign (packet + advocate form).
  await go(page, "/profile");
  const st = page.getByTestId("advocate-consent-status");
  await expect(st.getByTestId("advocate-form-status")).toHaveAttribute("data-status", "waiting");
  await st.getByTestId("advocate-review-sign").click();
  const forms = page.getByTestId("forms-to-sign").first();
  await expect(forms.getByTestId("form-card-advocate_patient")).toBeVisible();
  const boxes = forms.getByRole("checkbox", { checked: false });
  while (await boxes.count()) await boxes.first().click();
  const sig = forms.getByTestId("forms-signature");
  // The typed-name field only renders once the (typed-name) advocate form is checked;
  // wait for it by label instead of counting textboxes before React re-renders.
  await sig.getByLabel(lang === "es" ? "Su nombre completo" : "Your full name", { exact: true }).fill(`Elena ${last}`);
  await sig.getByLabel(lang === "es" ? "Escriba su nombre completo para firmar" : "Type your full name to sign").fill(`Elena ${last}`);
  await forms.getByTestId("forms-sign").click();
  await expect(st.getByTestId("advocate-form-status")).toHaveAttribute("data-status", "signed");
  await expect.poll(async () => JSON.stringify((await links(page, pid)).find((l) => l.id === link.id)), { timeout: 20_000 }).toContain("notificationDelivery"); // delivery attempted only after the form is signed (SMS is not configured in the sandbox)
  return { pid, link };
}

test("EN: referral → intake → forms signed → advocate attests and signs up → Active, tier-limited", async ({ page }) => {
  const { pid, link } = await patientSteps(page, "en");

  // The advocate opens the invite (no patient session — the self-claim guard).
  await page.evaluate(() => ((window as unknown as W).__adelante.AdelanteEHR as never as { setCurrentPatientId: (i: string) => void }).setCurrentPatientId(""));
  // Same app instance (SPA navigation): the in-memory store keeps the invitation.
  await go(page, `/advocate?code=${encodeURIComponent(link.invitationCode)}`);
  await expect(page.locator("#adv-code")).toHaveValue(link.invitationCode);
  await page.getByText("Family / support-person participation", { exact: true }).click();
  const docBoxes = page.getByRole("checkbox", { checked: false });
  while (await docBoxes.count()) await docBoxes.first().click();
  await page.locator("#adv-attest").fill("Tomas Freshwalk");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  // Attestation signed through the consent workflow; link active.
  const after = await page.evaluate(async ([p, id]) => {
    const w = window as unknown as { __adelante: { AdelanteEHR: { getAdvocateLink: (i: string) => { status: string } }; avail: () => Promise<{ cf: { listSignedCopies: (p: string) => { copy: { formKey: string; relationship: string } }[] } }> } };
    const { cf: consentForms } = await w.__adelante.avail();
    return { status: w.__adelante.AdelanteEHR.getAdvocateLink(id as string).status, copies: consentForms.listSignedCopies(p as string).map((c) => `${c.copy.formKey}:${c.copy.relationship}`) };
  }, [pid, link.id]);
  expect(after.status).toBe("active");
  expect(after.copies).toContain("advocate_attestation:advocate");
  expect(after.copies).toContain("advocate_patient:patient");

  // Tier: family participation without SUD disclosure → no SUD content anywhere on the advocate surface.
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/substance[- ]use (treatment|record|history)|Part 2 record|Recovery Journey|MOUD|buprenorphine/i);
  await page.screenshot({ path: "e2e/screenshots/advocate-active-en.png" });

  // Patient side reads Active too.
  await page.evaluate((p) => ((window as unknown as W).__adelante.AdelanteEHR as never as { setCurrentPatientId: (i: string) => void }).setCurrentPatientId(p), pid);
  await go(page, "/profile");
  await expect(page.getByTestId("advocate-consent-status").getByTestId("advocate-status").first()).toHaveText("Active");
});

test("ES: patient steps — intake, packet and advocate form signed in Spanish", async ({ page }) => {
  await patientSteps(page, "es");
  await expect(page.getByTestId("forms-to-sign").first()).toContainText("Formularios para firmar");
});
