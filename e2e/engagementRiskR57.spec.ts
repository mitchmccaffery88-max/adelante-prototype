import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Option C: real UI only. No browser storage injection, dev hooks, store
// inspection/writes, seeds, clock substitution or persistence activation.
const evidence = resolve('docs/evidence/engagement-risk');
mkdirSync(evidence, { recursive: true });
test.describe.configure({ mode: 'serial', timeout: 120_000 });

async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Demo control: staff role' }))
    .not.toContainText('loading', { timeout: 90_000 });
}

async function staff(page: Page, identity: string) {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  const panel = page.locator('.auth-demo-panel');
  await expect(panel).toBeVisible();
  await panel.getByRole('combobox').filter({ hasText: 'Therapist' }).click();
  await page.getByRole('option', { name: 'ECM Provider', exact: true }).click();
  await panel.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/case-manager$/);
  await ready(page);
  await page.getByRole('button', { name: 'Demo control: staff role' }).click();
  await page.getByRole('menuitemradio', { name: identity, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Demo control: staff role' })).toContainText(identity.split(' · ')[0]);
  await expect(page).toHaveURL(/\/my-work$/);
}

test('Rosa Watch is visible in the authorized caseload tile and member list', async ({ page }) => {
  await staff(page, 'Lupita Sanchez, MSW · ECM Provider');
  await page.goto('/clinician', { waitUntil: 'domcontentloaded' });
  const tile = page.getByTestId('workspace-tile-caseload');
  await expect(tile).toBeVisible();
  await tile.getByRole('button', { name: /^My caseload/ }).click();
  const tileFlag = tile.getByTestId('engagement-flag-p2');
  await expect(tileFlag).toContainText('Engagement · Watch');
  await expect(tileFlag).toContainText('coverage gap');
  await expect(tileFlag).toContainText('Draft — pending clinical sign-off');
  await tile.screenshot({ path: resolve(evidence, 'rosa-watch-tile.png') });
  await page.goto('/case-manager', { waitUntil: 'domcontentloaded' });
  const flag = page.getByTestId('caseload-table').getByTestId('engagement-flag-p2');
  await expect(flag).toContainText('Engagement · Watch');
  await expect(flag).toContainText('coverage gap');
  await flag.getByText('coverage gap', { exact: true }).screenshot({ path: resolve(evidence, 'rosa-watch-reason.png') });
  await page.getByTestId('caseload-table').getByRole('row').filter({ has: flag }).screenshot({ path: resolve(evidence, 'rosa-watch-member-list.png') });
});

test('Tomás live attempts survive the required reload, then Elevated task and Close picker remain private', async ({ page }) => {
  await staff(page, 'Luz Herrera · ECM Provider');
  await page.goto('/caseload-review', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Weekly caseload review' })).toBeVisible();
  const row = page.getByTestId('caseload-list').getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Log contact', exact: true }) }).filter({ hasText: 'ADL-2026-008' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Attempted / no answer');
  for (const count of [1, 2]) {
    await row.getByRole('button', { name: 'Log contact', exact: true }).click();
    await row.getByLabel('Contact type', { exact: true }).selectOption({ label: 'Attempted / no answer' });
    await row.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Log contact', exact: true })).toBeVisible();
    await expect(row).toContainText(`Attempts this week: ${count}`);
  }
  await row.screenshot({ path: resolve(evidence, 'tomas-two-live-attempts-before-reload.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await expect(row).toContainText('Attempts this week: 2');
  // Never replace this hard reload with SPA navigation, a timer, or an
  // automation/dev call: losing the contacts is an option-C stop condition.
  await page.goto('/case-manager', { waitUntil: 'domcontentloaded' });
  const member = page.getByTestId('caseload-table').getByRole('row').filter({ hasText: 'ADL-2026-008' });
  await expect(member).toContainText('Engagement · Elevated');
  await expect(member).toContainText('outreach not answered');
  await member.screenshot({ path: resolve(evidence, 'tomas-elevated.png') });
  await page.goto('/worklist', { waitUntil: 'domcontentloaded' });
  const task = page.getByTestId('task-work-row').filter({ hasText: 'Engagement check-in needed' }).filter({ hasText: 'ADL-2026-008' });
  await expect(task).toHaveCount(1);
  await task.getByRole('button', { name: /^Engagement check-in needed/ }).click();
  await expect(task).toContainText('Assigned to s-cm1');
  await task.screenshot({ path: resolve(evidence, 'tomas-elevated-task.png') });
  await task.getByRole('button', { name: 'Close', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Close engagement check-in' });
  await expect(picker.getByRole('button', { name: 'Close check-in', exact: true })).toBeDisabled();
  await expect(picker.getByRole('radio')).toHaveCount(4);
  await picker.screenshot({ path: resolve(evidence, 'tomas-close-picker.png') });
  await picker.getByRole('radio', { name: 'Reached, re-engaged', exact: true }).check();
  await expect(picker.getByRole('button', { name: 'Close check-in', exact: true })).toBeEnabled();
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(picker).toHaveCount(0);
  // Member/advocate checks must use an actual Tomás session established
  // through existing UI, not a signed-out page or Daniel's advocate demo.
  // Their UI-session prerequisite is deliberately not bypassed here.
  await page.getByRole('button', { name: 'Demo control: QA scenario' }).click();
  await page.getByRole('menuitem', { name: /^Tomás Reyna/ }).click();
  await expect(page).toHaveURL(/\/(home|intake)$/);
  await expect(page.getByTestId('engagement-flag-p8')).toHaveCount(0);
  await expect(page.getByText('outreach not answered', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Engagement check-in needed', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(evidence, 'tomas-patient-no-engagement.png') });
  test.info().annotations.push({ type: 'prerequisite', description: 'Tomás advocate session must be established through existing invitation UI; Daniel advocate demo is not valid evidence.' });
});