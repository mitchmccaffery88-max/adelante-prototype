import { expect, test } from '@playwright/test';
import { bootTables, phoneTable, rowIds } from './helpers/staffTables8b2';
test.use({ viewport: { width: 1280, height: 1800 } });

test('cosign ownership partitions and metadata routing match rollback with restricted rows absent', async ({ page }) => {
  await bootTables(page, 's-th1', 'therapist', '/cosign-inbox');
  const baseline = await page.evaluate(async () => {
    const app = (window as any).__adelante;
    const e = await import(/* @vite-ignore */ '/src/lib/ehr.ts');
    const n = await import(/* @vite-ignore */ '/src/lib/notes.ts');
    const actor = { role: 'therapist', staffName: 'Marisol Reyes', staffId: 's-th1', clinicianId: 'c1' };
    const rows = app.AdelanteEHR.listNotesAwaitingCosign();
    const mine = rows.filter((r: any) => n.isMyCosign(r.note, actor));
    const pool = rows.filter((r: any) => !n.isMyCosign(r.note, actor) && e.noteCosignOwnership(r.note).kind === 'pool');
    return { mine: mine.map((r: any) => r.note.id), pool: pool.map((r: any) => r.note.id), excluded: rows.filter((r: any) => !mine.includes(r) && !pool.includes(r)).map((r: any) => r.note.id) };
  });
  expect(await rowIds(page, 'my-cosigns-table')).toEqual(baseline.mine);
  expect(await rowIds(page, 'pool-cosigns-table')).toEqual(baseline.pool);
  expect(baseline.excluded.length).toBeGreaterThan(0);
  for (const id of baseline.excluded) expect([...(await rowIds(page, 'my-cosigns-table')), ...(await rowIds(page, 'pool-cosigns-table'))]).not.toContain(id);
  for (const tid of ['my-cosigns-table', 'pool-cosigns-table']) await phoneTable(page, tid);
  await page.evaluate(() => (window as any).__adelante.setActingStaff('s-th3', 'pmhnp'));
  const asams = await page.evaluate(async () => {
    const e = await import(/* @vite-ignore */ '/src/lib/ehr.ts');
    return (window as any).__adelante.AdelanteEHR.listAsamAwaitingCosign().filter((r: any) => { const own = e.asamCosignOwnership(r.asam); return own.kind === 'pool' || e.isCosignOwner(own, ['s-th3', 'c3']); }).map((r: any) => r.asam.id);
  });
  await expect.poll(() => rowIds(page, 'asam-cosigns-table')).toEqual(asams);
  await phoneTable(page, 'asam-cosigns-table');
  await page.evaluate(() => (window as any).__adelante.setActingStaff('s-cc2', 'clinical_coordinator'));
  const routing = await page.evaluate(async () => {
    const e = await import(/* @vite-ignore */ '/src/lib/ehr.ts'); const app = (window as any).__adelante;
    return [...app.AdelanteEHR.listNotesAwaitingCosign().map((r: any) => ({ id: r.note.id, own: e.noteCosignOwnership(r.note) })), ...app.AdelanteEHR.listAsamAwaitingCosign().map((r: any) => ({ id: r.asam.id, own: e.asamCosignOwnership(r.asam) }))].sort((a, b) => Number(b.own.kind === 'needs_supervisor') - Number(a.own.kind === 'needs_supervisor')).map((r) => r.id);
  });
  await expect.poll(() => rowIds(page, 'cosign-routing-table')).toEqual(routing);
  await phoneTable(page, 'cosign-routing-table');
  await expect(page.getByTestId('my-cosigns-table')).toHaveCount(0);
  await page.evaluate(() => (window as any).__adelante.setActingStaff('s-bill1', 'billing'));
  await expect(page.getByTestId('cosign-routing-table')).toHaveCount(0);
});

test('crisis views match rollback lanes while peers see only personally raised flags', async ({ page }) => {
  await bootTables(page, 's-cc2', 'clinical_coordinator', '/escalations?view=all&type=crisis');
  const baseline = await page.evaluate(async () => {
    const app = (window as any).__adelante; const e = await import(/* @vite-ignore */ '/src/lib/escalations.ts');
    const viewer = { role: 'clinical_coordinator', staffId: 's-cc2' };
    return { list: e.filterEscalations(e.listEscalations(viewer), viewer, { view: 'all', type: 'crisis', overdueOnly: false }).map((r: any) => r.key), details: app.AdelanteEHR.listOpenCrisisEscalations().filter((r: any) => r.escalation.category !== 'sdoh').map((r: any) => r.escalation.id), anonymous: app.AdelanteEHR.listAnonymousCrisisAlerts().map((r: any) => r.id) };
  });
  expect(await rowIds(page, 'escalation-list')).toEqual(baseline.list);
  expect(await rowIds(page, 'crisis-resolution-table')).toEqual(baseline.details);
  expect(await rowIds(page, 'anonymous-crises-table')).toEqual(baseline.anonymous);
  for (const tid of ['escalation-list', 'crisis-resolution-table', 'anonymous-crises-table']) await phoneTable(page, tid);
  const personal = await page.evaluate(() => {
    const app = (window as any).__adelante; app.setActingStaff('s-peer1', 'peer_specialist');
    const p = app.AdelanteEHR.listPatients()[0]; const actor = { staffId: 's-peer1', name: app.j.getStaffMember('s-peer1').name, role: 'peer_specialist' };
    const result = app.j.runAction('crisis_flag', actor, p, { args: [p.id, actor.name, 'Draft verification — urgent support requested'] });
    if (!result.ok) throw Error(result.reason);
    return app.AdelanteEHR.listCrisisEscalationsFlaggedBy(actor.name).map((r: any) => r.escalation.id);
  });
  await expect(page.getByTestId('crisis-resolution-table')).toHaveCount(0);
  await expect(page.getByTestId('anonymous-crises-table')).toHaveCount(0);
  expect(await rowIds(page, 'my-flagged-crises-table')).toEqual(personal);
  await phoneTable(page, 'my-flagged-crises-table');
  expect(baseline.details.some((id: string) => !personal.includes(id))).toBe(true);
});

test('referral and chase queues retain rollback limits, ordering and denied-role boundaries', async ({ page }) => {
  await bootTables(page, 's-cc2', 'clinical_coordinator', '/referral-queue');
  const baseline = await page.evaluate(async () => {
    const ehr = (window as any).__adelante.AdelanteEHR;
    const chase = await import(/* @vite-ignore */ '/src/lib/referralChase.ts'); const setup = await import(/* @vite-ignore */ '/src/lib/postEnrollment.ts');
    const refs = ehr.listReferrals();
    return { referrals: refs.slice(0, 100).map((r: any) => r.id), chase: chase.listChaseTasks().filter((r: any) => r.status === 'open').slice(0, 12).filter((r: any) => refs.some((x: any) => x.id === r.referralId)).map((r: any) => r.id), setup: setup.patientsNeedingSetup(ehr.listPatients()).map((p: any) => ({ p, stale: setup.postEnrollmentStaleness(p) })).sort((a: any, b: any) => (b.stale?.days ?? -1) - (a.stale?.days ?? -1)).slice(0, 5).map((r: any) => r.p.id) };
  });
  expect(await rowIds(page, 'referral-queue-table')).toEqual(baseline.referrals);
  expect(await rowIds(page, 'referral-chase-table')).toEqual(baseline.chase);
  expect(await rowIds(page, 'enrollment-setup-table')).toEqual(baseline.setup);
  for (const tid of ['referral-queue-table', 'referral-chase-table', 'enrollment-setup-table']) await phoneTable(page, tid);
  await page.evaluate(() => (window as any).__adelante.setActingStaff('s-bill1', 'billing'));
  for (const tid of ['referral-queue-table', 'referral-chase-table', 'enrollment-setup-table']) await expect(page.getByTestId(tid)).toHaveCount(0);
});

test('unsigned, void, community and addressed inbox queues retain rollback projections and row menus', async ({ page }) => {
  await bootTables(page, 's-th1', 'therapist', '/inbox');
  await page.getByRole('tab', { name: 'Unsigned', exact: true }).click();
  const unsigned = await page.evaluate(async () => (await import(/* @vite-ignore */ '/src/lib/unsignedWork.ts')).listUnsignedWork({ authorId: 'c1' }).map((r: any) => r.id));
  expect(await rowIds(page, 'inbox-unsigned-table')).toEqual(unsigned);
  await phoneTable(page, 'inbox-unsigned-table');
  await page.evaluate(() => (window as any).__adelante.setActingStaff('s-cc2', 'clinical_coordinator'));
  await page.getByRole('tab', { name: 'Queue', exact: true }).click();
  const baseline = await page.evaluate(async () => {
    const app = (window as any).__adelante; const actor = { id: 's-cc2', name: app.j.getStaffMember('s-cc2').name, role: 'clinical_coordinator' };
    const inbox = await import(/* @vite-ignore */ '/src/lib/inboxActions.ts');
    return { inbox: inbox.listInboxRows(actor).filter((r: any) => r.state.status === 'open').map((r: any) => r.key), voids: app.AdelanteEHR.listPendingNoteVoids({ staffId: actor.id, name: actor.name, role: actor.role }).map((r: any) => r.noteId), community: app.AdelanteEHR.listCommunityInquiries({ includeResolved: true }).filter((r: any) => r.status !== 'resolved').sort((a: any, b: any) => a.crisisFlagged !== b.crisisFlagged ? a.crisisFlagged ? -1 : 1 : b.createdAt.localeCompare(a.createdAt)).map((r: any) => r.id) };
  });
  expect(await rowIds(page, 'inbox-items-table')).toEqual(baseline.inbox);
  expect(await rowIds(page, 'void-requests-table')).toEqual(baseline.voids);
  await phoneTable(page, 'inbox-items-table'); await phoneTable(page, 'void-requests-table');
  const row = page.getByTestId('inbox-items-table').locator('[data-row-key]').first();
  await row.getByRole('button', { name: /^More:/ }).click();
  await page.getByRole('button', { name: 'Assign to…', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(row.getByRole('combobox', { name: 'Assign to', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Community', exact: true }).click();
  expect(await rowIds(page, 'community-inquiries-table')).toEqual(baseline.community);
  await phoneTable(page, 'community-inquiries-table');
  await page.evaluate(() => (window as any).__adelante.setActingStaff('s-bill1', 'billing'));
  await expect(page.getByTestId('community-inquiries-table')).toHaveCount(0);
});
