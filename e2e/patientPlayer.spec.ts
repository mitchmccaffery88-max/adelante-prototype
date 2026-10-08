/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 150_000 });
async function ready(page: Page) {
  await page.goto("/library?item=ss-calming-my-mind");
  await page.waitForFunction(() => !!(window as any).__adelante?.content, null, { timeout: 60_000 });
  return page.evaluate(() => {
    const e = (window as any).__adelante.AdelanteEHR;
    const patient = e.listPatients().find((p: any) => p.firstName === "Luis" && p.lastName === "Camacho");
    e.setCurrentPatientId(patient.id);
    (window as any).__adelante.go("/library?item=ss-calming-my-mind");
    return patient.id as string;
  });
}
async function go(page: Page, path: string) {
  await page.evaluate(p => (window as any).__adelante.go(p), path);
  await page.waitForURL(u => u.pathname === path.split("?")[0]);
}

test("Luis listens twice, breathes, saves practice, resumes, answers Adel and confirms exact toolkit", async ({ page }) => {
  const patientId = await ready(page);
  await page.getByRole("button", { name: "Listen", exact: true }).first().click();
  await page.getByRole("button", { name: "Replay", exact: true }).first().click();
  await page.getByRole("button", { name: "Stop", exact: true }).first().click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continue", exact: true }).last().click();
  await expect(page.getByTestId("breath-shape")).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("timer")).not.toHaveText("4");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).last().click();
  await page.getByRole("button", { name: "Save to My Toolkit", exact: true }).click();
  await page.getByRole("tab", { name: /Part B/ }).click();
  await page.getByRole("button", { name: /Set one alarm for tonight/ }).click();
  await go(page, "/home");
  await expect(page.getByTestId("lesson-resume")).toContainText("Calming My Mind");
  await expect(page.getByTestId("today-action")).toContainText("Set one alarm");
  await page.getByTestId("lesson-resume").getByRole("link").click();
  await expect(page.getByRole("tab", { name: /Part B/ })).toHaveAttribute("aria-selected", "true");
  for (let i = 0; i < 8; i++) {
    if (await page.getByTestId("adel-conversation").count()) {
      for (let q = 0; q < 3; q++) {
        await page.getByRole("textbox").fill("One private small step.");
        await page.getByRole("button", { name: "Share answer", exact: true }).click();
      }
      await expect(page.getByText("Keep talking with Adel")).toBeVisible();
    }
    if (await page.getByTestId("toolkit-preview").count()) break;
    await page.getByRole("button", { name: "Continue", exact: true }).last().click();
  }
  await page.getByRole("textbox", { name: "Who or what could support your next step?" }).fill("Private friend");
  await page.getByRole("button", { name: "Later today", exact: true }).click();
  await expect(page.getByTestId("toolkit-preview")).toContainText("Private friend");
  await page.getByRole("button", { name: "Finish and save to My Toolkit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lesson complete", exact: true })).toBeVisible();
  const saved = await page.evaluate(async pid => {
    const { eng } = await (window as any).__adelante.content();
    const response = eng.lessonResponse(pid, "library", "ss-calming-my-mind");
    return { preview: response.text.toolkitPreview, label: eng.savedToolkitItems(pid).find((t: any) => t.id === "ss-calming-my-mind").label, derived: JSON.stringify(eng.engagementRecords([pid])) };
  }, patientId);
  expect(saved.label).toBe(saved.preview);
  expect(saved.derived).not.toMatch(/Private friend|One private small step/);
});

test("Spanish lesson controls and protected advocate progress contain no private answer or title", async ({ page }) => {
  const patientId = await ready(page);
  await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
  await go(page, "/recovery-journey?lesson=fdo-first-72-hours");
  await expect(page.getByText(/voz simulada/).first()).toBeVisible();
  await expect(page.getByText(/Borrador/).first()).toBeVisible();
  await page.getByRole("button", { name: "Escuchar", exact: true }).click();
  await page.getByRole("button", { name: "Detener", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).last().click();
  const privacy = await page.evaluate(async pid => {
    const { eng } = await (window as any).__adelante.content();
    const e = (window as any).__adelante.AdelanteEHR;
    eng.saveLessonResponse(pid, "recovery", "fdo-first-72-hours", { text: { support: "Secret support" }, todayAction: "Private action" });
    eng.completeRecoveryLesson(pid, "fdo-first-72-hours", {});
    const link = e.createAdvocateInvitation({ patientId: pid, advocateName: "Player Test Advocate", invitationSentTo: "player-advocate@example.org", invitationChannel: "email", designatedBy: { actor: "patient", name: "Luis Camacho" } });
    e.claimAdvocateInvitation({ code: link.invitationCode, authorizationType: "hipaa_authorization", attestedName: "Player Test Advocate" });
    const progress = e.advocateLibraryProgress(link.id);
    return { cohort: JSON.stringify(eng.engagementRecords([pid])), progress: JSON.stringify(progress), allowed: progress.allowed };
  }, patientId);
  expect(privacy.cohort).not.toMatch(/Secret support|Private action|fdo-first-72-hours/);
  expect(privacy.progress).not.toBeNull();
  expect(privacy.allowed).toBe(true);
  expect(privacy.progress).not.toMatch(/Secret support|Private action|fdo-first-72-hours/);
});