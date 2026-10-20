// Privacy P2 — live coordinator emergency unlock: reason + reference, banner,
// B items visible, counseling notes hidden, one audit + disclosure-log +
// compliance review entries. New file only; no existing spec changes.
import { expect, test, type Page } from "@playwright/test";

type Api = { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void; access: () => Promise<Record<string, Record<string, (...a: unknown[]) => unknown>>> };
type W = Window & { __adelante: Api };
test.describe.configure({ timeout: 180_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}
const as = (page: Page, id: string, role: string) => page.evaluate(([i, r]) => (window as unknown as W).__adelante.setActingStaff(i, r), [id, role]);

test("coordinator emergency unlock: gated, audited, time-limited, counseling stays hidden", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });

  // A coordinator with a chart-enterable patient who has no SUD consent or release.
  const staffId = "s-cc1"; // Priya Raman, clinical_coordinator
  await as(page, staffId, "clinical_coordinator");
  const patientId = await page.evaluate(async (sid) => {
    const w = window as unknown as W;
    const e = w.__adelante.AdelanteEHR as unknown as { listPatients: () => { id: string; sudCoordinationConsent?: string; sudCounselingNotesRelease?: boolean }[] };
    const { ca } = await w.__adelante.access();
    const p = e.listPatients().find((x) => !x.sudCoordinationConsent && !x.sudCounselingNotesRelease && (ca.chartEntryFor("clinical_coordinator", sid, x.id) as { ok: boolean }).ok);
    if (!p) throw new Error("No consent-free chart-enterable patient fixture");
    return p.id;
  }, staffId);

  await go(page, `/record/${patientId}`);
  const panel = page.getByTestId("coordinator-sud-panel");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // No consent: nothing shown, not even a placeholder list.
  await expect(page.getByText("SUD care — minimum necessary")).toHaveCount(0);
  await expect(page.getByTestId("emergency-access-banner")).toHaveCount(0);

  // Break-glass: court order requires a reference; detail is required.
  await panel.getByRole("button", { name: "Emergency access" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Allowed reason").click();
  await page.getByRole("option", { name: "Part 2 court order" }).click();
  await dialog.getByLabel("Reference").fill("CO-2026-1042");
  await dialog.getByLabel("Free-text detail").fill("Court order received; records needed for today’s hearing");
  await dialog.getByRole("button", { name: "Unlock for 4 hours" }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });

  // Banner + B items visible; counseling notes section never renders.
  await expect(page.getByTestId("emergency-access-banner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("emergency-access-banner")).toContainText("reviewed by compliance");
  await expect(page.getByText("SUD care — minimum necessary")).toBeVisible();
  for (const heading of ["SUD diagnoses", "SUD treatment plans", "MAT/MOUD doses", "MAT/MOUD adherence", "Labs & toxicology", "Appointment attendance", "Discharge summaries", "Standard SUD progress notes"]) {
    await expect(panel.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(panel.getByRole("heading", { name: "Released counseling notes" })).toHaveCount(0);
  await page.screenshot({ path: "e2e/screenshots/p2-emergency-unlock.png" });

  // Exactly one audit entry, one disclosure-log entry pending compliance review,
  // one compliance follow-up item.
  const records = await page.evaluate(async (pid) => {
    const w = window as unknown as W;
    const e = w.__adelante.AdelanteEHR as unknown as { listAuditEvents: (f?: unknown) => { action: string; patientId?: string; detail?: Record<string, unknown> }[] };
    const { ca, pd } = await w.__adelante.access();
    const listDisclosureLog = pd.listDisclosureLog as (f: { patientId: string; emergencyOnly?: boolean }) => { id: string; emergencyReason?: string; complianceReview?: string; accessEnd?: string }[];
    const listRestrictedOpenItems = ca.listRestrictedOpenItems as () => { disclosureId?: string; medicalFollowUp?: boolean }[];
    const audits = e.listAuditEvents({ patientId: pid }).filter((x) => x.action === "part2_emergency_disclosure");
    const disclosures = listDisclosureLog({ patientId: pid, emergencyOnly: true });
    const items = listRestrictedOpenItems().filter((i) => disclosures.some((d) => d.id === i.disclosureId));
    return { audits: audits.length, disclosures, items };
  }, patientId);
  expect(records.audits).toBe(1);
  expect(records.disclosures).toHaveLength(1);
  expect(records.disclosures[0].emergencyReason).toBe("court_order");
  expect(records.disclosures[0].complianceReview).toBe("pending");
  expect(records.disclosures[0].accessEnd).toBeTruthy();
  expect(records.items.length).toBeGreaterThan(0);

  // The same grant is visible to the gate: B items readable, counseling not.
  const gates = await page.evaluate(async ({ pid, sid }) => {
    const w = window as unknown as W;
    const { cs } = await w.__adelante.access();
    const coordinatorSudCanRead = cs.coordinatorSudCanRead as (v: unknown, p: unknown, item: string) => boolean;
    const e = w.__adelante.AdelanteEHR as unknown as { getPatient: (i: string) => unknown };
    const viewer = { role: "clinical_coordinator", staffId: sid };
    const p = e.getPatient(pid);
    return { b: coordinatorSudCanRead(viewer, p, "diagnoses"), counseling: coordinatorSudCanRead(viewer, p, "counseling_notes") };
  }, { pid: patientId, sid: staffId });
  expect(gates).toEqual({ b: true, counseling: false });
});
