import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// R57 Draft — pending clinical sign-off. Real UI only: one sign-in per test,
// then in-app controls only (no page.goto/reload after sign-in, which would
// wipe in-memory records). No storage injection, dev hooks or store writes.
const evidence = resolve('docs/evidence/engagement-risk');
mkdirSync(evidence, { recursive: true });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const roleControl = (page: Page) => page.getByRole('button', { name: 'Demo control: staff role' });
async function ready(page: Page) {
  await expect(roleControl(page)).not.toContainText('loading', { timeout: 90_000 });
}

async function signInAs(page: Page, identity: string) {
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
  await roleControl(page).click();
  await page.getByRole('menuitemradio', { name: identity, exact: true }).click();
  await expect(roleControl(page)).toContainText(identity.split(' · ')[0]!);
  await expect(page).toHaveURL(/\/case-manager$/);
}

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Staff surfaces' }).getByRole('link', { name, exact: true }).click();

test('Rosa Watch is visible in the authorized member list', async ({ page }) => {
  await signInAs(page, 'Lupita Sanchez, MSW · ECM Provider');
  const flag = page.getByTestId('caseload-table').getByTestId('engagement-flag-p2');
  await expect(flag).toContainText('Engagement · Watch');
  await expect(flag).toContainText('coverage gap');
  await expect(flag).toContainText('Draft — pending clinical sign-off');
  await page.getByTestId('caseload-table').getByRole('row').filter({ hasText: 'ADL-2026-002' }).screenshot({ path: resolve(evidence, 'rosa-watch-member-list.png') });
});

test('Daniel reaches Elevated on the third logged attempt; Close picker; advocate and patient see nothing', async ({ page }) => {
  await signInAs(page, 'Lupita Sanchez, MSW · ECM Provider');
  const member = page.getByTestId('caseload-table').getByRole('row').filter({ hasText: 'ADL-2026-001' });
  await expect(member).toHaveCount(1);
  await expect(member.getByTestId('engagement-flag-p1')).toHaveCount(0);

  await nav(page, 'Weekly caseload review');
  await expect(page.getByRole('heading', { name: 'Weekly caseload review' })).toBeVisible();
  const row = page.getByTestId('caseload-list').getByRole('listitem').filter({ hasText: 'Attempts this week' }).filter({ hasText: 'Daniel M.' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Attempts this week: 0');
  for (const count of [1, 2, 3]) {
    await row.getByRole('button', { name: 'Log contact', exact: true }).click();
    await row.getByLabel('Contact type', { exact: true }).selectOption({ label: 'Attempted / no answer' });
    await row.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(row).toContainText(`Attempts this week: ${count}`);
  }

  await nav(page, 'Care Coordination');
  const flag = member.getByTestId('engagement-flag-p1');
  await expect(flag).toContainText('Engagement · Elevated');
  await expect(flag).toContainText('outreach not answered');
  await member.screenshot({ path: resolve(evidence, 'daniel-elevated-member-list.png') });

  await member.getByRole('button', { name: 'Open profile' }).click();
  const profile = page.getByRole('dialog', { name: 'Daniel M.' });
  await profile.getByRole('tab', { name: 'Tasks', exact: true }).click();
  const task = profile.getByTestId('task-work-row').filter({ hasText: 'Engagement check-in needed' });
  await expect(task).toHaveCount(1);
  await task.getByRole('button', { name: /^Engagement check-in needed/ }).click();
  await expect(task).toContainText('Assigned to s-cm2');
  await task.screenshot({ path: resolve(evidence, 'daniel-elevated-task.png') });

  await task.getByRole('button', { name: 'Close', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Close engagement check-in' });
  await expect(picker.getByRole('radio')).toHaveCount(4);
  await expect(picker.getByRole('button', { name: 'Close check-in', exact: true })).toBeDisabled();
  await picker.screenshot({ path: resolve(evidence, 'daniel-close-picker.png') });
  await picker.getByRole('radio', { name: 'Reached, re-engaged', exact: true }).check();
  await expect(picker.getByRole('button', { name: 'Close check-in', exact: true })).toBeEnabled();
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(task).toHaveCount(1);
  await expect(task.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(profile).toHaveCount(0);

  // Advocate for Daniel (existing 6a demo session, in-app navigation).
  await page.getByRole('button', { name: 'Demo control: QA scenario' }).click();
  await page.getByRole('menuitem', { name: /^6a · Advocate only/ }).click();
  await expect(page).toHaveURL(/\/advocate/);
  await expect(page.getByRole('main')).toBeVisible();
  for (const text of ['Engagement · Elevated', 'outreach not answered', 'Engagement check-in needed']) await expect(page.getByText(text)).toHaveCount(0);
  await expect(page.getByTestId('engagement-flag-p1')).toHaveCount(0);
  await page.screenshot({ path: resolve(evidence, 'daniel-advocate-no-engagement.png') });

  // Daniel's own patient session (existing demo record, in-app navigation).
  await page.getByRole('button', { name: 'Demo control: QA scenario' }).click();
  await page.getByRole('menuitem', { name: /^Daniel M\. — Post-release/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('main')).toBeVisible();
  for (const text of ['Engagement · Elevated', 'outreach not answered', 'Engagement check-in needed']) await expect(page.getByText(text)).toHaveCount(0);
  await expect(page.getByTestId('engagement-flag-p1')).toHaveCount(0);
  await page.screenshot({ path: resolve(evidence, 'daniel-patient-no-engagement.png') });
});
