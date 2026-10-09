// §Group 1 walkthrough (K1) — bookable roles, therapist profile (specialty,
// secondary site), group hours, blocked care type, multi-day time off, freeze,
// coordinator group booking offers matching slots only. Draft.
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 180_000 });
async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
const as = (page: Page, id: string, role: string) => page.evaluate(([i, r]) => (window as unknown as W).__adelante.setActingStaff(i, r), [id, role]);

test("Group 1 — profile, availability and coordinator group booking", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });

  // Bookable roles: therapist sees clinical availability; billing does not.
  await as(page, "s-th1", "therapist");
  await go(page, "/my-calendar");
  await expect(page.getByRole("heading", { name: /My clinical availability|My calendar/ }).first()).toBeVisible();
  const bookable = await page.evaluate(async () => {
    const sp = (await ((window as unknown as { __adelante: { avail: () => Promise<{ sp: typeof import("../src/lib/staffProfile") }> } }).__adelante.avail())).sp;
    return { therapist: sp.isBookableRole("therapist"), billing: sp.isBookableRole("billing_coordinator" as never), title: sp.availabilityPageTitle("billing_coordinator" as never) };
  });
  expect(bookable).toEqual({ therapist: true, billing: false, title: "My availability" });

  // Therapist profile: specialty tag + secondary site through the screen.
  await go(page, "/clinician-profile");
  const card = page.getByTestId("profile-card");
  await card.getByTestId("specialty-tags").getByRole("button", { name: "Group facilitation" }).click();
  const site = card.getByTestId("secondary-sites").getByRole("button").first();
  const siteName = (await site.textContent())?.trim() ?? "";
  await site.click();
  await card.getByRole("button", { name: "Save profile" }).click();
  await go(page, "/my-calendar");
  await go(page, "/clinician-profile");
  await expect(page.getByTestId("specialty-tags").getByRole("button", { name: "Group facilitation" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("secondary-sites").getByRole("button", { name: siteName })).toHaveAttribute("aria-pressed", "true");

  // Group hours, a blocked care type, multi-day time off, freeze — and what the coordinator is offered.
  const r = await page.evaluate(async () => {
    const m = await ((window as unknown as { __adelante: { avail: () => Promise<{ ext: unknown; av: typeof import("../src/lib/clinicianAvailability"); sp: typeof import("../src/lib/staffProfile") }> } }).__adelante.avail());
    const ext = m.ext as { upsertAvailabilityBlock: (b: unknown) => { id: string }; addAvailabilityException: (x: unknown) => { id: string } };
    const { av, sp } = m;
    const actor = { role: "clinical_coordinator", staffId: "s-cc1", name: "Coordinator" } as never;
    let k = 2;
    while (![2, 3, 4].includes(new Date(Date.now() + k * 86_400_000).getDay())) k++; // avoid weekends and Monday holidays
    const day = new Date(Date.now() + k * 86_400_000);
    const weekday = day.getDay() as never;
    ext.upsertAvailabilityBlock({ clinicianId: "c1", weekday, start: "07:00", end: "08:00", modality: "hybrid", siteId: "site-2", careTypes: ["therapy_group"] });
    ext.upsertAvailabilityBlock({ clinicianId: "c1", weekday, start: "19:00", end: "20:00", modality: "hybrid", siteId: "site-2", careTypes: ["therapy_individual"] });
    const hour = (s: string) => new Date(s).getHours();
    const group = av.availableSlots("c1", { serviceType: "therapy_group", days: 14 });
    const groupOutsideBlocks = group.filter((s) => !av.isWithinAvailability("c1", s, { serviceType: "therapy_group" }));
    const groupInIndividualOnly = group.filter((s) => new Date(s).getDay() === day.getDay() && hour(s) === 19);
    // Multi-day time off covering the next 3 days.
    const from = new Date(Date.now() + (k - 1) * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + (k + 1) * 86_400_000).toISOString().slice(0, 10);
    ext.addAvailabilityException({ clinicianId: "c1", date: from, endDate: to, kind: "off", timeOffType: "vacation" });
    const afterOff = av.availableSlots("c1", { serviceType: "therapy_group", days: 14 }).filter((s) => s.slice(0, 10) >= from && s.slice(0, 10) <= to);
    sp.setBookingsFrozen(actor, { clinicianId: "c1", frozen: true, reason: "Walkthrough freeze" });
    const frozen = av.availableSlots("c1", { serviceType: "therapy_group", days: 14 }).length;
    sp.setBookingsFrozen(actor, { clinicianId: "c1", frozen: false, reason: "Walkthrough unfreeze" });
    const unfrozen = av.availableSlots("c1", { serviceType: "therapy_group", days: 14 }).length;
    return { group: group.length, groupOutsideBlocks: groupOutsideBlocks.length, groupInIndividualOnly: groupInIndividualOnly.length, afterOff: afterOff.length, frozen, unfrozen };
  });
  expect(r.group).toBeGreaterThan(0);
  expect(r.groupOutsideBlocks).toBe(0);
  expect(r.groupInIndividualOnly).toBe(0);
  expect(r.afterOff).toBe(0);
  expect(r.frozen, JSON.stringify(r)).toBe(0);
  expect(r.unfrozen, JSON.stringify(r)).toBeGreaterThan(0);

  // Coordinator's booking precheck sees the same calendar.
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, "/my-calendar");
});
