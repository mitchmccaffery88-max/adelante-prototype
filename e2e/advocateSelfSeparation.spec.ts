// §Quality pass Group D item 3 — advocate-as-patient separation, through the
// REAL rendered UI.
//
// Phase 4's unit tests prove `selfPatientId` and `link.patientId` never cross
// in the data layer. That is not the same claim as "the screens never leak":
// these tests drive one person through both surfaces and assert on what is
// actually painted.
//
// Everything happens in ONE page load on purpose — the prototype store is
// in-memory, so a hard reload would wipe the invitation and the self record.
// Route changes therefore go through the client router.
import { expect, test, type Page } from "@playwright/test";

const SELF_FIRST = "Marisol";
const SELF_LAST = "Quintanilla";
const SELF_NAME = `${SELF_FIRST} ${SELF_LAST}`;

/** Client-side route change — TanStack Router picks up the popstate. */
async function spaGoto(page: Page, to: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path as string);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, to);
}

test("Patient A's data never appears in the advocate's own care view, and vice versa", async ({
  page,
}) => {
  await page.goto("/home");

  // ---- who is Patient A, as the UI itself names them --------------------
  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();
  const patientAName = (await heading.innerText()).replace(/^Hi,?\s*/i, "").replace(/[!,]/g, "")
    .trim();
  expect(patientAName.length).toBeGreaterThan(1);

  // ---- Patient A invites an advocate ------------------------------------
  await page.getByLabel("Their name").fill(SELF_NAME);
  await page.getByLabel("Relationship (optional)").fill("Sister");
  await page.getByLabel(/email|contact|send/i).first().fill("marisol@example.org");
  await page.getByRole("button", { name: /send invitation/i }).click();

  const code = await page.getByText(/ADV-[A-Z0-9-]+/).first().innerText();
  expect(code).toMatch(/ADV-/);

  // ---- the advocate connects --------------------------------------------
  await spaGoto(page, "/advocate");
  await expect(page.getByRole("heading", { name: "Advocate access" })).toBeVisible();
  await page.getByLabel("Invitation code").fill(code.trim());
  await page.getByRole("radio").first().check();
  await page.getByLabel(/type your full name/i).fill(SELF_NAME);
  await page.getByRole("button", { name: "Connect" }).click();

  // Direction 1: the advocate view shows Patient A and NOT the advocate's
  // own (not-yet-existing) record.
  await expect(page.getByText(new RegExp(patientAName, "i")).first()).toBeVisible();

  // ---- the advocate opens their own care --------------------------------
  await page.getByRole("button", { name: /support for me too/i }).click();
  await page.getByLabel("First name").fill(SELF_FIRST);
  await page.getByLabel("Last name").fill(SELF_LAST);
  await page.getByRole("button", { name: "Start my intake" }).click();

  // Now on their OWN record. Patient A must be nowhere on this screen.
  await expect(page).toHaveURL(/\/intake/);
  await expect(page.getByText(new RegExp(patientAName, "i"))).toHaveCount(0);

  await spaGoto(page, "/home");
  await expect(page.locator("h1").first()).toContainText(SELF_FIRST);
  const selfBody = await page.locator("body").innerText();
  expect(selfBody).not.toContain(patientAName);

  // Direction 2: back on the advocate surface, the advocate's OWN patient
  // record must not bleed into the advocated-for view. Their name legitimately
  // appears as the signed-in advocate, so assert on the patient identity that
  // the view is scoped to instead.
  await spaGoto(page, "/advocate");
  await expect(page.getByText(new RegExp(patientAName, "i")).first()).toBeVisible();
  const advocateBody = await page.locator("body").innerText();
  expect(advocateBody).not.toContain("Your appointments");
});
