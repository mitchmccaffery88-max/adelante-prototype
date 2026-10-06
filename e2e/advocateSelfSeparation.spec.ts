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

/** Pre-release is an in-facility surface (off by default). Turn the flag on
 *  in-memory for this page load only, then route client-side to it. */
async function openPreRelease(page: Page) {
  await page.goto("/case-manager");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const a = (window as unknown as { __adelante: { setInFacilityEnabled: (on: boolean) => void; go: (to: string) => void } }).__adelante;
    a.setInFacilityEnabled(true);
    a.go("/pre-release");
  });
}

async function pickOption(page: Page, comboIndex: number, label: RegExp) {
  // Scoped to the episode form: the staff header also has a patient-search combobox.
  const combo = page.getByTestId("open-episode-form").getByRole("combobox").nth(comboIndex);
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
  await openPreRelease(page);
  await expect(page.getByRole("heading", { name: "Pre-release list" })).toBeVisible();
  // "New person in custody" is the intended default; these journeys use a seeded record.
  await page.getByTestId("episode-mode-existing").click();
  await pickOption(page, 0, /^Daniel M\./);
  await pickOption(page, 1, /Darnell Pope/);
  await page.getByTestId("open-episode-form").locator('input[type="date"]').fill("2026-12-01");
  await page.getByRole("button", { name: "Open episode" }).click();
  await expect(page.getByText("Anticipated release 2026-12-01")).toBeVisible();

  await page.getByLabel("Their name").fill(ADVOCATE_NAME);
  await page.getByLabel("Relationship (optional)").fill("Sister");
  await page.getByLabel("Their email or mobile number").fill("marisol@example.org");
  await page.getByRole("button", { name: /send invitation/i }).click();

  // Since the advocate-access redesign the code goes straight to the advocate
  // (after consent) and is never painted on the staff screen. Assert that,
  // then read the code the advocate received from the in-memory store.
  await expect(page.getByText(/invitation pending/i).first()).toBeVisible();
  await expect(page.getByText(/ADV-[A-Z0-9]{4}-/)).toHaveCount(0);
  const code = await page.evaluate((name) => {
    const ehr = (window as unknown as { __adelante: { AdelanteEHR: { listAdvocateLinks: () => { advocateName: string; invitationCode: string }[] } } }).__adelante.AdelanteEHR;
    return ehr.listAdvocateLinks().filter((l) => l.advocateName === name).at(-1)!.invitationCode;
  }, ADVOCATE_NAME);
  expect(code).toMatch(/^ADV-/);

  // ---- the advocate connects on their own surface ------------------------
  await spaGoto(page, "/advocate");
  await expect(page.getByRole("heading", { name: "Advocate access" })).toBeVisible();
  await page.getByLabel("Invitation code").fill(code);
  await page.getByRole("radio", { name: /HIPAA/i }).first().check();
  await page.getByLabel(/type your full name/i).fill(ADVOCATE_NAME);
  await page.getByRole("button", { name: "Connect" }).click();

  // Direction 1 — the advocate view is scoped to Patient A.
  // The advocate home is now a summary ("Supporting <first name>"); the full
  // schedule lives on /advocate/appointments since the advocate redesign.
  await expect(page.getByRole("heading", { name: /^Supporting / })).toBeVisible();
  await spaGoto(page, "/advocate/appointments");
  await expect(page.getByTestId("advocate-upcoming")).toBeVisible();
  // The advocate surface deliberately never prints the patient's name, so
  // "scoped to Patient A" is asserted on the schedule the data layer returned
  // for that link — captured here and compared again after the round trip.
  const upcomingBefore = await page.getByTestId("advocate-upcoming").innerText();

  // ---- the same person opens care of their OWN ---------------------------
  // The self-care offer has its own page since the advocate redesign.
  await spaGoto(page, "/advocate/support-for-myself");
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
  await spaGoto(page, "/advocate/appointments");
  await expect(page.getByTestId("advocate-upcoming")).toBeVisible();
  expect(await page.getByTestId("advocate-upcoming").innerText()).toBe(upcomingBefore);
  for (const path of ["/advocate/appointments", "/advocate"]) {
    await spaGoto(page, path);
    await page.waitForTimeout(300);
    const advocateBody = await page.locator("body").innerText();
    expect(advocateBody).not.toContain(SELF_FIRST);
    expect(advocateBody).not.toContain(SELF_LAST);
  }
});
