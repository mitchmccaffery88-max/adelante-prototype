// §Quality pass Group D item 3 — advocate-as-patient separation, through the
// REAL rendered UI.
//
// Phase 4's unit tests prove `selfPatientId` and `link.patientId` never cross
// in the data layer. That is not the same claim as "the screens never leak":
// this test drives ONE person through both surfaces and asserts on what is
// actually painted, in both directions.
//
// Everything happens in ONE page load on purpose — the prototype store is
// in-memory, so a hard reload would wipe the invitation and the self record.
// Route changes therefore go through the client router.
import { expect, test, type Page } from "@playwright/test";

const ECM_STAFF_ID = "s-cm1";
const PATIENT_A = "Daniel"; // seeded pre-release member
const ADVOCATE_NAME = "Marisol Quintanilla";
// Deliberately DIFFERENT from the advocate's own display name: the advocate's
// name legitimately appears on the advocate surface, so the self record needs
// its own distinct string for the leak assertions to mean anything.
const SELF_FIRST = "Alba";
const SELF_LAST = "Ferreira";

async function spaGoto(page: Page, to: string) {
  await page.evaluate((path) => {
    window.history.pushState({}, "", path as string);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, to);
}

async function pickOption(page: Page, comboIndex: number, label: RegExp) {
  const combo = page.getByRole("combobox").nth(comboIndex);
  const option = page.getByRole("option", { name: label }).first();
  await expect(async () => {
    await combo.press("Enter");
    await expect(option).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
  await option.click();
}

test("Patient A's data never appears in the advocate's own care view, and vice versa", async ({
  page,
}) => {
  await page.addInitScript((id) => {
    window.localStorage.setItem("adelante.actingRole", "ecm_provider");
    window.localStorage.setItem("adelante.actingStaffId", id as string);
  }, ECM_STAFF_ID);

  // ---- the care team designates an advocate for Patient A ---------------
  await page.goto("/pre-release");
  await expect(page.getByRole("heading", { name: "Pre-release list" })).toBeVisible();
  await pickOption(page, 0, /^Daniel M\./);
  await pickOption(page, 1, /Darnell Pope/);
  await page.locator('input[type="date"]').fill("2026-12-01");
  await page.getByRole("button", { name: "Open episode" }).click();
  await expect(page.getByText("Anticipated release 2026-12-01")).toBeVisible();

  await page.getByLabel("Their name").fill(ADVOCATE_NAME);
  await page.getByLabel("Relationship (optional)").fill("Sister");
  await page.getByLabel(/how should we reach them/i).fill("marisol@example.org");
  await page.getByRole("button", { name: /send invitation/i }).click();

  const code = (await page.getByText(/ADV-[A-Z0-9-]+/).first().innerText()).trim();
  expect(code).toMatch(/^ADV-/);

  // ---- the advocate connects on their own surface ------------------------
  await spaGoto(page, "/advocate");
  await expect(page.getByRole("heading", { name: "Advocate access" })).toBeVisible();
  await page.getByLabel("Invitation code").fill(code);
  await page.getByRole("radio").first().check();
  await page.getByLabel(/type your full name/i).fill(ADVOCATE_NAME);
  await page.getByRole("button", { name: "Connect" }).click();

  // Direction 1 — the advocate view is scoped to Patient A.
  await expect(page.getByText(new RegExp(PATIENT_A, "i")).first()).toBeVisible();

  // ---- the same person opens care of their OWN ---------------------------
  await page.getByRole("button", { name: /support for me too/i }).click();
  await page.getByLabel("First name").fill(SELF_FIRST);
  await page.getByLabel("Last name").fill(SELF_LAST);
  await page.getByRole("button", { name: "Start my intake" }).click();
  await expect(page).toHaveURL(/\/intake/);

  await spaGoto(page, "/home");
  await expect(page.locator("h1").first()).toContainText(SELF_FIRST);
  const selfBody = await page.locator("body").innerText();
  // Patient A does not exist on the advocate's own care screen.
  expect(selfBody).not.toContain(PATIENT_A);

  // Direction 2 — back on the advocate surface, nothing from their own record
  // bleeds in.
  await spaGoto(page, "/advocate");
  await expect(page.getByText(new RegExp(PATIENT_A, "i")).first()).toBeVisible();
  const advocateBody = await page.locator("body").innerText();
  expect(advocateBody).not.toContain(SELF_FIRST);
  expect(advocateBody).not.toContain(SELF_LAST);
});
