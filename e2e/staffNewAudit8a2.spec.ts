import { expect, test, type Page } from "@playwright/test";

// §8a-2 — "+ New" everywhere the staff shell shows it: every option opens
// without writing, navigation-only options write one audited open, and each
// created item is attributed to the acting staff member with exactly ONE new
// action audit entry. Audit lists are newest-first.
type Ev = { action: string; id?: unknown; actor?: string };
type W = { __adelante: { AdelanteEHR: { listAuditEvents: (q: { category: string }) => { action: string; detail?: Record<string, unknown>; actorId?: string }[]; listCaseTasks: () => { title: string; assignedTo: string }[]; listPatients: () => { id: string; firstName: string }[] }; setActingStaff: (id: string, role: string) => void; go: (to: string) => void; access: () => Promise<{ st: { listThreadsFor: (v: { staffId: string; role: string }) => { subject: string; createdBy: string }[] } }> } };

const ROLES = [
  { staffId: "s-cc2", role: "clinical_coordinator", name: "Cathy" },
  { staffId: "s-th1", role: "therapist", name: "Marisol Reyes" },
] as const;

async function actAs(page: Page, staffId: string, role: string, to: string) {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante);
  await page.evaluate(([s, r]) => (window as unknown as W).__adelante.setActingStaff(s, r), [staffId, role]);
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
}
const count = (page: Page) => page.evaluate(() => (window as unknown as W).__adelante.AdelanteEHR.listAuditEvents({ category: "action" }).length);
const newest = (page: Page, before: number) => page.evaluate((b) => {
  const all = (window as unknown as W).__adelante.AdelanteEHR.listAuditEvents({ category: "action" });
  return all.slice(0, all.length - b).map((e) => ({ action: e.action, id: e.detail?.["actionId"], actor: e.actorId }));
}, before) as Promise<Ev[]>;
const slotButton = (page: Page) => page.getByTestId("staff-new-slot").getByRole("button").first();

for (const { staffId, role, name } of ROLES) {
  test(`${role}: every /clinician + New option opens without a stray audit entry`, async ({ page }) => {
    await actAs(page, staffId, role, "/clinician");
    await expect(page).toHaveURL(/\/clinician$/);
    await slotButton(page).click();
    const menu = page.getByTestId("dashboard-add-menu");
    const labels = (await menu.getByRole("button").allInnerTexts()).map((t) => t.split("\n")[0].trim()).filter((t) => !t.startsWith("Search or add"));
    expect(labels.length).toBeGreaterThan(0);
    // Prescriber-only option stays hidden for both roles.
    expect(labels).not.toContain("Medication order");
    if (role === "clinical_coordinator") expect(labels).not.toContain("Progress note");
    await page.keyboard.press("Escape");
    for (const label of labels) {
      const before = await count(page);
      await slotButton(page).click();
      await page.getByTestId("dashboard-add-menu").getByRole("button", { name: label, exact: true }).first().click();
      const events = await newest(page, before);
      if (label === "Review patient matching") {
        expect(events, label).toEqual([{ action: "action.succeeded", id: "review_matching", actor: staffId }]);
      } else {
        expect(events, label).toEqual([]);
      }
      await page.keyboard.press("Escape");
      if (!/\/clinician$/.test(page.url())) await page.evaluate(() => (window as unknown as W).__adelante.go("/clinician"));
      await expect(page.getByTestId("dashboard-action-drawer")).toHaveCount(0);
    }
  });

  test(`${role}: /clinician + New creates a task with one action entry`, async ({ page }) => {
    await actAs(page, staffId, role, "/clinician");
    await slotButton(page).click();
    await page.getByTestId("dashboard-add-menu").getByRole("button", { name: "Task for me / my team", exact: true }).click();
    const drawer = page.getByTestId("dashboard-action-drawer");
    const title = `8a2 new audit ${role}`;
    await drawer.getByPlaceholder("What needs to be done?").fill(title);
    await drawer.getByPlaceholder("Search name, DOB or program ID").fill("Luis");
    await drawer.getByTestId("dashboard-patient-picker").getByRole("button").first().click();
    const before = await count(page);
    await drawer.getByRole("button", { name: "Create task", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    expect(await page.evaluate((t) => (window as unknown as W).__adelante.AdelanteEHR.listCaseTasks().filter((x) => x.title === t).map((x) => x.assignedTo), title)).toEqual([staffId]);
    expect(await newest(page, before)).toEqual([{ action: "action.succeeded", id: "dashboard_task", actor: staffId }]);
  });

  test(`${role}: patient chart + New creates a care team thread with one action entry`, async ({ page }) => {
    await actAs(page, staffId, role, "/clinician");
    const pid = await page.evaluate(() => (window as unknown as W).__adelante.AdelanteEHR.listPatients().find((p) => p.firstName === "Luis")!.id);
    await page.evaluate((p) => (window as unknown as W).__adelante.go(`/record/${p}`), pid);
    await expect(page).toHaveURL(new RegExp(`/record/${pid}`));
    await page.getByTestId("staff-new-slot").getByTestId("chart-new-button").click();
    const menu = page.getByTestId("chart-add-menu");
    await expect(menu.getByTestId("chart-add-med_order")).toHaveCount(0);
    await menu.getByTestId("chart-add-message_team").click();
    const subject = `8a2 chart thread ${role}`;
    await page.getByLabel("Thread subject").fill(subject);
    const before = await count(page);
    await page.getByTestId("new-team-thread").getByRole("button", { name: "Start thread", exact: true }).click();
    await expect(page).toHaveURL(/\/team-messages/);
    const threads = await page.evaluate(async ([s, r, subj]) => (await (window as unknown as W).__adelante.access()).st.listThreadsFor({ staffId: s, role: r }).filter((t) => t.subject === subj).map((t) => t.createdBy), [staffId, role, subject]);
    // Threads record their author by display name; the audit entry carries the staff id.
    expect(threads).toEqual([name]);
    expect(await newest(page, before)).toEqual([{ action: "action.succeeded", id: "message_team", actor: staffId }]);
  });
}

test("sys_admin: admin center + New toggles a flag with one action entry", async ({ page }) => {
  await actAs(page, "s-admin1", "sys_admin", "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await slotButton(page).click();
  const menu = page.getByTestId("ops-add-menu");
  await expect(menu.getByTestId("ops-item-claim_correct")).toHaveCount(0);
  await menu.getByTestId("ops-item-feature_flag_set").click();
  const panel = page.getByTestId("ops-flag-panel");
  await expect(panel).toContainText("Currently off");
  await panel.getByLabel("Reason (required)").fill("8a2 audit check");
  const before = await count(page);
  await panel.getByTestId("ops-flag-toggle").click();
  await expect(panel).toContainText("Currently on");
  expect(await newest(page, before)).toEqual([{ action: "action.succeeded", id: "feature_flag_set", actor: "s-admin1" }]);
  await page.keyboard.press("Escape");
  const beforeOpen = await count(page);
  await slotButton(page).click();
  await page.getByTestId("ops-add-menu").getByTestId("ops-item-open_permissions").click();
  await expect(page).toHaveURL(/\/admin-permissions/);
  expect(await newest(page, beforeOpen)).toEqual([{ action: "action.succeeded", id: "open_permissions", actor: "s-admin1" }]);
});

test("clinical_coordinator: admin center + New hides admin-only options", async ({ page }) => {
  await actAs(page, "s-cc2", "clinical_coordinator", "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await slotButton(page).click();
  const menu = page.getByTestId("ops-add-menu");
  await expect(menu.getByTestId("ops-item-review_matching")).toBeVisible();
  for (const id of ["feature_flag_set", "open_permissions", "claim_correct"]) await expect(menu.getByTestId(`ops-item-${id}`)).toHaveCount(0);
  const before = await count(page);
  await menu.getByTestId("ops-item-review_matching").click();
  await expect(page).toHaveURL(/\/data-exchange/);
  expect(await newest(page, before)).toEqual([{ action: "action.succeeded", id: "review_matching", actor: "s-cc2" }]);
});

for (const [staffId, role] of [["s-cc2", "clinical_coordinator"], ["s-admin1", "sys_admin"]] as const) {
  test(`${role}: content center shows no + New`, async ({ page }) => {
    await actAs(page, staffId, role, "/admin-content");
    await expect(page).toHaveURL(/\/admin-content/);
    await expect(page.getByTestId("staff-shell")).toBeVisible();
    await expect(page.getByTestId("staff-new-slot").locator("button")).toHaveCount(0);
  });
}
