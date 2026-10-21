import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bootTables, tableAxe } from "./helpers/staffTables8b2";

type Branch = { claimId: string; encounterId: string; patientId: string; programId: string; noteId: string };
type Scenario = Record<string, Branch>;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const rowFor = (page: Page, branch: Branch) => page.locator(`[data-testid="billing-row"][data-encounter="${branch.encounterId}"]`);

async function claim(page: Page, branch: Branch) {
  return page.evaluate(async id => {
    const { ext } = await (window as any).__adelante.avail();
    const c = ext.listClaims().find((c: any) => c.id === id);
    return { state: c.state, charge: c.chargeCents, rate: c.rateCentsPerUnit, units: c.units, balance: c.patientBalanceCents, paid: c.patientPaidCents };
  }, branch.claimId);
}

async function counts(page: Page, branch: Branch) {
  return page.evaluate(id => {
    const events = (window as any).__adelante.AdelanteEHR.listAuditEvents({});
    return {
      registry: events.filter((e: any) => e.action === "action.succeeded" && e.detail?.actionId === "claim_status").length,
      lifecycle: events.filter((e: any) => e.action === "claim_status_changed" && e.detail?.claimId === id).length,
    };
  }, branch.claimId);
}

async function move(page: Page, branch: Branch, button: string, state: string, reason?: string) {
  const before = await counts(page, branch);
  await rowFor(page, branch).getByRole("button", { name: button, exact: true }).click();
  if (reason) {
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const confirm = button === "Deny" ? "Deny claim" : button === "Write off" ? "Write off claim" : button;
    await dialog.getByRole("button", { name: confirm, exact: true }).click();
    expect(await counts(page, branch)).toEqual(before);
    await dialog.getByRole("textbox").fill(reason);
    await dialog.getByRole("button", { name: confirm, exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  await expect.poll(async () => (await claim(page, branch)).state).toBe(state);
  expect(await counts(page, branch)).toEqual({ registry: before.registry + 1, lifecycle: before.lifecycle + 1 });
}

async function receipt(page: Page, branch: Branch, amount: number) {
  const before = await claim(page, branch);
  await rowFor(page, branch).getByTestId("record-payment").click();
  await page.getByTestId("payment-amount").fill((amount / 100).toFixed(2));
  await page.getByTestId("save-payment").click();
  await expect.poll(async () => (await claim(page, branch)).balance).toBe(before.balance - amount);
  expect((await claim(page, branch)).state).toBe(before.state);
  await expect(rowFor(page, branch).getByTestId("patient-owes")).toContainText(money(before.balance - amount));
}

for (const [staff, role] of [["s-bill1", "billing"], ["s-bc1", "billing_coordinator"]]) {
  test(`B3b ${role}: full claim lifecycle, amounts, dual audits and unchanged exports`, async ({ page }) => {
    test.setTimeout(180000);
    await bootTables(page, staff, role, "/billing");
    await expect(page.getByTestId("billing-table")).toBeVisible();
    // The default seed has no group claims. Add a fictional fixture through
    // existing public group stores; no IDs are injected or records patched.
    const groupFixture = await page.evaluate(async () => {
      const app = (window as any).__adelante;
      const scenario = await app.billingScenario();
      const { ext } = await app.avail();
      const store = app.AdelanteEHR;
      app.setActingStaff("s-th1", "therapist");
      const start = new Date(Date.now() - 86400000).toISOString();
      const topic = "Fictional private group topic — Draft — pending clinical sign-off";
      const group = store.createGroupSession({ topic, facilitatorId: "c1", serviceType: "therapy_group", category: "skills_education", modality: "in_person", start, durationMin: 60, capacity: 8, recurrence: { kind: "weekly", daysOfWeek: [new Date(start).getDay()] }, createdBy: "Simulated QA" });
      const ids = [scenario.paid.patientId, scenario.denied.patientId];
      store.recordGroupAttendance(group.id, start, ids.map(patientId => ({ patientId, status: "present" })), "Simulated QA");
      store.documentGroupOccurrence({ sessionId: group.id, occurrenceStart: start, facilitatorId: "c1", topicCovered: topic, groupProcess: "Simulated QA", perAttendee: Object.fromEntries(ids.map(id => [id, "Fictional private participation — Draft — pending clinical sign-off"])), actor: "Simulated QA" });
      const occurrence = store.getGroupOccurrence(group.id, start);
      const claim = ext.upsertClaimFromGroupAttendee({ sessionId: group.id, occurrenceStart: start, patientId: ids[0], facilitatorId: "c1", noteId: occurrence.attendeeNoteIds[ids[0]] });
      if (!claim) throw new Error("Public group claim fixture refused");
      return { topic, otherId: ids[1], otherProgramId: scenario.denied.programId };
    });
    await page.evaluate(({ staff, role }) => (window as any).__adelante.setActingStaff(staff, role), { staff, role });
    await page.evaluate(() => (window as any).__adelante.go("/admin-claims"));
    await expect(page.getByTestId("claims-table")).toBeVisible();
    const group = page.getByTestId("claims-table").getByRole("button", { name: "Group", exact: true }).first();
    while (await group.count() === 0) {
      const next = page.getByRole("button", { name: "Next page", exact: true }).first();
      expect(await next.isEnabled()).toBe(true);
      await next.click();
    }
    await group.click();
    const reference = page.getByTestId("billing-group-reference");
    await expect(reference).toBeVisible();
    await expect(reference).toContainText("Group-sourced claim");
    const popover = reference.locator("..");
    await expect(popover).not.toContainText("Others present");
    await expect(popover).not.toContainText(groupFixture.topic);
    await expect(popover).not.toContainText(groupFixture.otherId);
    await expect(popover).not.toContainText(groupFixture.otherProgramId);
    await expect(popover.locator("li")).toHaveCount(0);
    await page.screenshot({ path: `/tmp/browser/b3b-group-${role}.png` });
    await page.keyboard.press("Escape");
    await page.evaluate(() => (window as any).__adelante.go("/billing"));
    await expect(page.getByTestId("billing-table")).toBeVisible();
    await page.getByTestId("demo-state-switcher").click();
    await page.getByRole("menuitem", { name: /^Billing: full claim lifecycle/ }).click();
    const seeded: Scenario = await page.evaluate(() => (window as any).__adelante.billingScenario());
    expect(Object.keys(seeded)).toEqual(["paid", "receipt_balance", "denied", "writeoff_reversed", "blocked", "sliding_fee", "dmc_ods"]);
    expect((await claim(page, seeded.paid)).state).toBe("paid");
    expect((await claim(page, seeded.denied)).state).toBe("denied");
    expect((await claim(page, seeded.receipt_balance)).balance).toBe(8250);
    const scenario: Scenario = await page.evaluate(() => (window as any).__adelante.billingScenario(true));
    await page.evaluate(({ staff, role }) => (window as any).__adelante.setActingStaff(staff, role), { staff, role });
    for (const [key, branch] of Object.entries(scenario)) {
      const row = rowFor(page, branch);
      const previous = page.getByRole("button", { name: "Previous page", exact: true }).first();
      while (await previous.isEnabled()) await previous.click();
      while (await row.count() === 0) {
        const next = page.getByRole("button", { name: "Next page", exact: true }).first();
        expect(await next.isEnabled()).toBe(true);
        await next.click();
      }
      await expect(row).toBeVisible();
      await expect(row.locator('[data-testid="claim-signature"] a')).toHaveCount(0);
      await expect(row).not.toContainText(branch.noteId);
      if (key !== "blocked") {
        await expect(row.getByTestId("claim-signature")).toContainText(/^(Signed|Cosigned) by .+ on /);
      }
      const value = await claim(page, branch);
      expect(value.charge).toBe(value.rate * value.units);
      expect(value.charge).toBeGreaterThan(0);
      await expect(row.getByTestId("billing-row-charge")).toContainText(money(value.charge));
      if (key === "blocked") {
        await expect(row).toContainText("Awaiting note signature");
        await expect(row.getByRole("button", { name: "Mark ready", exact: true })).toHaveCount(0);
        const before = await counts(page, branch);
        const refusal = await page.evaluate(async ({ b, staff, role }) => {
          const app = (window as any).__adelante;
          const { ra } = await app.access();
          return ra.runAction("claim_status", { staffId: staff, role }, app.AdelanteEHR.getPatient(b.patientId), { via: "transitionClaim", args: [b.claimId, "generated"] });
        }, { b: branch, staff, role });
        expect(refusal.ok).toBe(false);
        expect(refusal.event.action).toBe("action.blocked");
        expect(await counts(page, branch)).toEqual(before);
        expect((await claim(page, branch)).state).toBe("documented");
        continue;
      }
      await move(page, branch, "Mark coded", "coded");
      await move(page, branch, "Mark ready", "generated");
      if (key === "sliding_fee" || key === "dmc_ods") {
        if (key === "sliding_fee") expect(value.charge).toBe(8250);
        else {
          expect(value.units).toBe(3);
          expect(value.charge).toBe(12375);
          await expect(row).not.toContainText("F15.20");
          await expect(row).not.toContainText("Fictional QA documentation");
          await expect(row).not.toContainText("ASAM");
        }
        continue;
      }
      await move(page, branch, "Send claim", "submitted");
      if (key === "paid") {
        await receipt(page, branch, value.balance);
        await move(page, branch, "Mark paid", "paid");
      } else if (key === "receipt_balance") {
        await receipt(page, branch, 8250);
      } else {
        await move(page, branch, "Deny", "denied", "Simulated QA coding review");
        if (key === "denied") {
          const denied = row.getByTestId("billing-row-status").getByText("Denied", { exact: true });
          expect(await denied.getAttribute("class")).toBe("text-[10px] rounded-full px-2 py-0.5 bg-destructive/10 text-destructive");
        } else {
          await move(page, branch, "Write off", "written_off", "Simulated QA reconciliation");
          await move(page, branch, "Reverse write-off", "generated", "Simulated QA corrected reconciliation");
        }
      }
    }
    await tableAxe(page, "billing-table");
    await page.screenshot({ path: `/tmp/browser/b3b-${role}.png` });
    await page.evaluate(() => (window as any).__adelante.go("/admin-claims"));
    await expect(page.getByTestId("claims-table")).toBeVisible();
    await tableAxe(page, "claims-table");
    const patients = await page.evaluate(() => (window as any).__adelante.AdelanteEHR.listPatients().map((p: any) => ({ id: p.id, programId: p.programId, name: `${p.firstName} ${p.lastName}` })));
    const allClaims = await page.evaluate(async () => (await (window as any).__adelante.avail()).ext.listClaims().map((c: any) => ({ id: c.id, patientId: c.patientId })));
    for (const row of await page.getByTestId("claim-row").all()) {
      const id = await row.getAttribute("data-row-key");
      const c = allClaims.find((c: any) => c.id === id);
      const p = patients.find((p: any) => p.id === c?.patientId);
      expect(p).toBeTruthy();
      await expect(row.locator('[data-cell="patient"]')).toContainText(p.programId);
      await expect(row.locator('[data-cell="patient"]')).not.toContainText(p.name);
      await expect(row.locator('[data-testid="claim-signature"] a')).toHaveCount(0);
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("claims-export-csv").click();
    const download = await downloadPromise;
    const path = await download.path();
    if (!path) throw new Error("Missing CSV download");
    const csv = await readFile(path, "utf8");
    expect(csv.split("\n")[0]).toBe('"Program ID","Clinician","State","Code","Units","Unit basis","Charge (USD)","Denial reason","Group-sourced","Group session ID","Occurrence start"');
    expect(csv).not.toContain("F15.20");
    expect(csv).not.toContain("Fictional QA documentation");
    await page.getByTestId("ops-new-button").click();
    await page.getByTestId("ops-item-claims_export").click();
    const opsDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Claims export (CSV)", exact: true }).click();
    const opsPath = await (await opsDownloadPromise).path();
    if (!opsPath) throw new Error("Missing operations claims download");
    const opsCsv = await readFile(opsPath, "utf8");
    expect(opsCsv.split("\n")[0]).toBe('"claim_id","patient_program_id","service_date","service_code","units","program","status","charge_cents"');
    expect(opsCsv).toContain(scenario.paid.programId);
    expect(opsCsv).not.toContain("F15.20");
    expect(opsCsv).not.toContain("Fictional QA documentation");
  });
}

test("B3b peer cannot reach billing", async ({ page }) => {
  await bootTables(page, "s-peer1", "peer_specialist", "/billing");
  await expect(page.getByTestId("billing-table")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/billing$/);
});