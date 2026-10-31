import { expect, type Page } from "@playwright/test";

// Mitch approved 30 Oct. Draft — pending clinical sign-off.
// Use only the existing chart-entry UI; never create relationships or Part 2 grants.
const reasons = {
  covering_consult: "Covering or consult",
  scheduling_admin: "Scheduling or admin need",
  clinical_supervision: "Clinical supervision",
  crisis_safety: "Crisis or safety",
} as const;

export async function openWithReason(page: Page, reason: keyof typeof reasons) {
  // A chart can already be open for this actor. Wait for the actual gate or
  // chart content, not merely a changed URL or an unhydrated shell.
  const gate = page.getByTestId("chart-access-gate");
  await expect(gate.or(page.getByRole("tablist"))).toBeVisible();
  if (!(await gate.isVisible())) return;
  await gate.getByRole("radio", { name: reasons[reason], exact: true }).check();
  await gate.getByRole("button", { name: "Open chart", exact: true }).click();
  await expect(gate).toHaveCount(0);
}