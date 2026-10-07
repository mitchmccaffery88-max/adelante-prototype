// §Calendars — sys_admin adds a one-off closure; Marisol enters vacation; her
// open note's due date moves and the coordinator sees "Author out"; the
// coordinator sees "Reschedule needed"; Luis sees the closed day in EN and ES.
// One page load; role switches through the dev hook.
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 150_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 10_000 });
}
const as = (page: Page, id: string, role: string) => page.evaluate(([i, r]) => (window as unknown as W).__adelante.setActingStaff(i, r), [id, role]);

test("location + staff calendars drive closures, note clock and patient schedule", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });

  // Setup through real store functions: Luis's in-person visit with Marisol and an open note of hers.
  const setup = await page.evaluate(async () => {
    const ehr = (window as unknown as W).__adelante.AdelanteEHR as never as {
      listPatients: () => { id: string; firstName: string; lastName: string }[];
      bookAppointment: (i: unknown) => { id: string; start: string };
      addProgressNote: (pid: string, n: unknown) => { id: string; date: string; clinicianId: string };
    };
    const { availableSlots } = await import("/src/lib/clinicianAvailability.ts");
    const { facilityDateKey } = await import("/src/lib/facilityTime.ts");
    const { standardNoteDue } = await import("/src/lib/noteClock.ts");
    const luis = ehr.listPatients().find((p) => p.firstName === "Luis" && p.lastName === "Camacho")!;
    const slot = (availableSlots("c1", { days: 10, modality: "in_person", serviceType: "therapy_individual" }) as string[])[0]!;
    ehr.bookAppointment({ patientId: luis.id, clinicianId: "c1", start: slot, durationMin: 50, serviceType: "therapy_individual", modality: "in_person", locationId: "loc-visalia", bookedBy: { id: "s-cc1", role: "clinical_coordinator" } });
    const note = ehr.addProgressNote(luis.id, { clinicianId: "c1", date: new Date().toISOString(), sessionType: "individual", subjective: "", objective: "", assessment: "", plan: "", serviceType: "therapy_individual" });
    (window as never as { __note: unknown }).__note = note;
    return { luisId: luis.id, closeDate: facilityDateKey(new Date(slot)), dueBefore: standardNoteDue(note).toISOString() };
  });

  // 1. sys_admin adds a one-off closure at Premier Visalia.
  await as(page, "s-admin1", "sys_admin");
  await go(page, "/location-calendars");
  await page.getByRole("button", { name: "Closed days" }).first().click();
  await page.locator("#cd-date").fill(setup.closeDate);
  await page.locator("#cd-name").fill("Staff training day");
  await page.locator("#cd-reason").fill("All-staff training");
  await page.getByRole("button", { name: "Add closed day" }).click();
  await expect(page.getByText(/Closed day added — 1 visit/)).toBeVisible();
  await page.keyboard.press("Escape");

  // 2. Marisol enters vacation (the next week).
  await as(page, "s-th1", "therapist");
  await go(page, "/my-calendar");
  const range = await page.evaluate(async () => {
    const { facilityDateKey } = await import("/src/lib/facilityTime.ts");
    const d = (n: number) => facilityDateKey(new Date(Date.now() + n * 86400000));
    return { start: d(1), end: d(7) };
  });
  await page.getByRole("button", { name: "Enter time off" }).click();
  await page.locator("#off-start").fill(range.start);
  await page.locator("#off-end").fill(range.end);
  await page.getByRole("button", { name: "Save time off" }).click();
  await expect(page.getByTestId("time-off-row").first()).toContainText("Vacation");

  // 3. Her open note's due date moved.
  const dueAfter = await page.evaluate(async () => {
    const { standardNoteDue } = await import("/src/lib/noteClock.ts");
    return standardNoteDue((window as never as { __note: never }).__note).toISOString();
  });
  expect(dueAfter > setup.dueBefore).toBe(true);

  // 4. Coordinator: "Author out" and "Reschedule needed" in Needs my action; type hidden from nobody-else views.
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, "/clinician");
  await expect(page.getByText(/Author out — notes waiting/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Reschedule needed — clinic closed/).first()).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/calendars-coordinator.png" });
  await go(page, "/team-calendar");
  await expect(page.getByTestId("reschedule-list")).toContainText("Luis");

  // Another staff member sees only "Out".
  await as(page, "s-peer2", "peer_specialist");
  const peerView = await page.evaluate(async () => {
    const { timeOffView } = await import("/src/lib/workingCalendar.ts");
    return timeOffView({ role: "peer_specialist", staffId: "s-peer2" }, "c1").map((v: { label: string }) => v.label);
  });
  expect(peerView.every((l: string) => l === "Out")).toBe(true);

  // 5. Luis sees the closed day on his schedule, EN then ES.
  await page.evaluate((id) => ((window as unknown as W).__adelante.AdelanteEHR as never as { setCurrentPatientId: (i: string) => void }).setCurrentPatientId(id), setup.luisId);
  await go(page, "/schedule");
  await expect(page.getByTestId("clinic-closed-notice").filter({ hasText: "Clinic closed — Staff training day" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
  await expect(page.getByTestId("clinic-closed-notice").filter({ hasText: "Clínica cerrada — Staff training day" })).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/calendars-luis-es.png" });
  await page.getByRole("button", { name: "Switch language to English" }).click();
});
