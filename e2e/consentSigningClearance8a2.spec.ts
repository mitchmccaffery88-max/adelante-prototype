import { expect, test, type Locator, type Page } from "@playwright/test";

type App = {
  AdelanteEHR: typeof import("../src/lib/ehr").AdelanteEHR;
  setActingStaff: (id: string, role?: string) => void;
  go: (path: string) => void;
  avail: () => Promise<{ cf: typeof import("../src/lib/consentForms") }>;
};

async function clearance(page: Page, control: Locator, label: string) {
  await control.scrollIntoViewIfNeeded();
  const evidence = await control.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const points = [[rect.left + rect.width / 2, rect.top + rect.height / 2], [rect.left + rect.width / 2, rect.top + 4], [rect.left + rect.width / 2, rect.bottom - 4]];
    return {
      rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      clear: points.every(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit === el || !!hit && el.contains(hit); }),
      layers: Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((node) => {
        const s = getComputedStyle(node); const r = node.getBoundingClientRect();
        return ["fixed", "sticky"].includes(s.position) && r.width > 0 && r.height > 0;
      }).map((node) => ({ name: node.dataset.testid ?? node.getAttribute("aria-label") ?? node.tagName, position: getComputedStyle(node).position, top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom, z: getComputedStyle(node).zIndex })),
    };
  });
  await test.info().attach(label, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  await test.info().attach(`${label}-screen`, { body: await page.screenshot(), contentType: "image/png" });
  expect.soft(evidence.clear, `${label} must receive an ordinary pointer click`).toBe(true);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
  test(`real signed consent clearance at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/clinician");
    await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
    const pid = await page.evaluate(() => {
      const app = (window as unknown as { __adelante: App }).__adelante;
      app.setActingStaff("s-cc2", "clinical_coordinator");
      const ref = app.AdelanteEHR.createReferral({ firstName: "Consent", lastName: "Clearance", dob: "1984-04-14", phone: "5595550139", referrerName: "Test coordinator", referringAgency: "Test clinic", referrerPhone: "5595550140", referralSource: "community_based_organization", consentToContact: true, channel: "staff" });
      return app.AdelanteEHR.enrollReferral(ref.id);
    });
    await page.evaluate((id) => (window as unknown as { __adelante: App }).__adelante.go(`/record/${id}?section=consents`), pid);
    await expect(page.getByRole("button", { name: "Send a form", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Send a form", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: /Telehealth/ }).click();
    await dialog.getByRole("button", { name: /^Send/ }).click();
    await expect(page.getByTestId("form-status-telehealth")).toHaveText("Sent");
    await page.getByTestId("sign-in-person").click();
    const tablet = page.getByTestId("in-person-mode");
    await tablet.getByRole("checkbox", { name: "I agree to this form: Telehealth" }).click();
    const sign = tablet.getByTestId("forms-sign");
    await clearance(page, sign, "before-sign");
    await sign.click();
    await expect(tablet.getByTestId("forms-progress")).toHaveText("1 of 1 done");
    const copies = await page.evaluate(async (id) => {
      const app = (window as unknown as { __adelante: App }).__adelante;
      return (await app.avail()).cf.listSignedCopies(id).map(({ copy }) => ({ formKey: copy.formKey, version: copy.version }));
    }, pid);
    expect(copies).toContainEqual({ formKey: "telehealth", version: 1 });
    const done = tablet.getByRole("button", { name: "I'm done", exact: true });
    await tablet.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await clearance(page, done, "signed-at-scroll-end");
    const support = page.getByRole("region", { name: "Crisis support", exact: true });
    await expect(support.getByRole("link", { name: "988", exact: true })).toHaveAttribute("href", "tel:988");
    await clearance(page, support.getByRole("link", { name: "988", exact: true }), "988-while-signing");
    await done.click();
    await expect(page.getByTestId("in-person-locked")).toBeVisible();
    await page.getByRole("button", { name: "Staff: unlock", exact: true }).click();
    await expect(page.getByTestId("form-status-telehealth")).toHaveText("Signed");
  });
}