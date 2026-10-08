// §Access batch — Draft — pending exec RBAC review. Billing can't search or
// open charts; a Premier Visalia peer can; a restricted chart asks for a
// reason and lands with compliance; Anita's @mention shows under Mentions and
// a completed task clears its bell pointer; role broadcasts read per person.
import { expect, test, type Page } from "@playwright/test";

type Api = { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void; access: () => Promise<Record<string, Record<string, (...a: unknown[]) => unknown>>> };
type W = Window & { __adelante: Api };
test.describe.configure({ timeout: 180_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
const as = (page: Page, id: string, role: string) => page.evaluate(([i, r]) => (window as unknown as W).__adelante.setActingStaff(i, r), [id, role]);
const bell = (page: Page) => page.locator('button[aria-label^="Notifications"]:visible').first();

test("access model + per-person notifications", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const ids = await page.evaluate(() => {
    const e = (window as unknown as W).__adelante.AdelanteEHR as unknown as { listPatients: () => { id: string; firstName: string; lastName: string }[] };
    const ps = e.listPatients();
    return { luis: ps.find((p) => p.firstName === "Luis" && p.lastName === "Camacho")!.id, other: ps.find((p) => p.firstName !== "Luis")!.id, otherName: (() => { const o = ps.find((p) => p.firstName !== "Luis")!; return `${o.firstName} ${o.lastName}`; })() };
  });

  // 1. Billing: no search field; /record/<Luis> redirects.
  await as(page, "s-bill1", "billing");
  await go(page, "/billing");
  await expect(page.getByRole("combobox", { name: /search/i })).toHaveCount(0);
  await expect(page.getByPlaceholder(/search patients|find a client|search clients/i)).toHaveCount(0);
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), `/record/${ids.luis}`);
  await expect(page.getByText("This chart isn't available for your role").first()).toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(new RegExp(`/record/${ids.luis}`), { timeout: 15_000 });

  // 2. Peer at Premier Visalia: search finds Luis; chart opens; SUD sections hidden without consent.
  await as(page, "s-peer1", "peer_specialist");
  await go(page, "/clinician");
  const found = await page.evaluate(async (pid) => { const { ca } = await (window as unknown as W).__adelante.access(); return (ca.searchablePatientsFor("peer_specialist", "s-peer1") as { id: string }[]).some((p) => p.id === pid); }, ids.luis);
  expect(found).toBe(true);
  await go(page, `/record/${ids.luis}`);
  await expect(page.getByText("This chart isn't available").first()).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("ASAM Criteria");
  await page.screenshot({ path: "e2e/screenshots/access-peer-chart.png" });

  // 3. sys_admin marks a test patient restricted (Quality & compliance).
  await as(page, "s-admin1", "sys_admin");
  await go(page, "/quality-compliance");
  await page.getByRole("combobox", { name: "Client to restrict" }).click();
  await page.getByRole("option", { name: new RegExp(ids.otherName) }).first().click();
  await page.getByLabel("Restriction reason").fill("Staff member is also a client (test)");
  await page.getByTestId("restrict-record").getByRole("button").last().click();
  await expect.poll(() => page.evaluate(async (pid) => { const { ca } = await (window as unknown as W).__adelante.access(); return ca.isRestricted(pid); }, ids.other)).toBe(true);

  // 4. Coordinator off that care team: reason prompt, then the chart.
  await as(page, "s-cc2", "clinical_coordinator");
  await go(page, `/record/${ids.other}`);
  const gate = page.getByTestId("restricted-chart-gate");
  await expect(gate).toBeVisible({ timeout: 15_000 });
  await expect(gate.getByRole("button", { name: "Open chart" })).toBeDisabled();
  await gate.getByLabel("Reason for opening").fill("Covering an urgent call");
  await gate.getByRole("button", { name: "Open chart" }).click();
  await expect(gate).toHaveCount(0, { timeout: 15_000 });

  // ...credentialing coordinator sees the compliance item + outside-caseload report.
  await as(page, "s-cred1", "credentialing_coordinator");
  await go(page, "/quality-compliance");
  await expect(page.getByTestId("restricted-opens")).toContainText("Cathy", { timeout: 15_000 });
  await expect(page.getByTestId("outside-caseload-report")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/access-compliance.png" });

  // 5. Anita: @mention → Mentions filter; complete a task → its bell pointer clears.
  const taskId = await page.evaluate(async () => {
    const a = (window as unknown as W).__adelante;
    const { st, ra } = await a.access();
    const e = a.AdelanteEHR as unknown as { listPatients: () => { id: string; prescriberStaffId?: string; primaryClinicianId?: string }[]; getPatient: (i: string) => unknown; createCaseTask: (x: unknown) => { id: string } };
    void st;
    const p = e.listPatients().find((x) => x.prescriberStaffId === "s-th3" || x.primaryClinicianId === "c3")!;
    const coord = { role: "clinical_coordinator", staffId: "s-cc1", name: "Priya Raman" };
    const run = (id: string, ...args: unknown[]) => { const r = ra.runAction(id, coord, e.getPatient(p.id), { args }) as { ok: boolean; value: { id: string }; reason?: string }; if (!r.ok) throw new Error(r.reason); return r.value; };
    const t = run("message_team", { kind: "care_team", patientId: p.id, participantIds: ["s-th3"] }, coord);
    run("staff_thread_post", t.id, { body: "@Anita can you call back?" }, coord);
    return e.createCaseTask({ patientId: p.id, title: "Follow-up call", assignedTo: "Anita Brooks", dueDate: new Date().toISOString().slice(0, 10) }).id;
  });
  await as(page, "s-th3", "pmhnp");
  await go(page, "/clinician");
  await bell(page).click();
  await page.getByRole("group", { name: "Notification filter" }).getByRole("button", { name: "mentions" }).click();
  await expect(page.locator('[data-testid="bell-item"][data-kind="mention"]').first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("group", { name: "Notification filter" }).getByRole("button", { name: "tasks" }).click();
  await expect(page.locator('[data-testid="bell-item"][data-kind="task"]').filter({ hasText: "New task" }).first()).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/access-bell-anita.png" });
  await page.keyboard.press("Escape");
  const closed = await page.evaluate((id) => {
    const e = (window as unknown as W).__adelante.AdelanteEHR as unknown as { completeCaseTask: (i: string) => void; listNotifications: () => { taskKey?: string; closedAt?: string }[] };
    e.completeCaseTask(id);
    return e.listNotifications().filter((n) => n.taskKey === `task:${id}`).every((n) => !!n.closedAt);
  }, taskId);
  expect(closed).toBe(true);

  // 6. Two RNs: one reads a role broadcast; it stays unread for the other.
  const perPerson = await page.evaluate(async () => {
    const { AdelanteEHR: e } = (window as unknown as W).__adelante as unknown as { AdelanteEHR: { notify: (x: unknown) => { id: string }; markNotificationRead: (id: string, n: string, s: string) => void; listNotificationsFor: (n: string, r: string, s: string) => { id: string; readBy?: unknown; readAt?: string }[] } };
    const n = e.notify({ recipientRole: "nurse_rn", category: "task_assigned", subject: "Shift update", body: "Open the nurse desk.", linkRoute: "/nurse" });
    e.markNotificationRead(n.id, "RN One", "s-rn-a");
    const { isNotificationReadBy } = await import("/src/lib/ehr.ts" as string) as { isNotificationReadBy: (n: unknown, a: string, b: string) => boolean };
    const row = e.listNotificationsFor("RN Two", "nurse_rn", "s-rn-b").find((x) => x.id === n.id)!;
    return { one: isNotificationReadBy(row, "RN One", "s-rn-a"), two: isNotificationReadBy(row, "RN Two", "s-rn-b") };
  });
  expect(perPerson).toEqual({ one: true, two: false });
});
