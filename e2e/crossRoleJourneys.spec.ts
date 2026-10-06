// Cross-role journeys J1, J2, J3, J5, J6 in the browser. One tab, no reloads
// (a reload re-seeds the demo). Steps run the same real store functions and
// registry (runAction) the unit journeys use, through the dev-only
// window.__adelante.j bundle, AS the acting staff member; each hand-off then
// switches the acting person and opens the next person's screen in-app.
// Clock frozen at Tue 29 Sep 2026 08:00 Pacific with page.clock.
import { test, expect, type Page } from "@playwright/test";
test.describe.configure({ timeout: 150_000 });

const SHOTS = "/tmp/cross-role/shots";
const FROZEN = new Date("2026-09-29T15:00:00.000Z");

type W = Window & { __adelante: { j: Record<string, (...a: unknown[]) => unknown>; AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };

async function boot(page: Page, staffId: string, role: string) {
  await page.clock.setFixedTime(FROZEN);
  await page.addInitScript(([r, id]) => {
    window.localStorage.setItem("adelante.actingRole", r as string);
    window.localStorage.setItem("adelante.actingStaffId", id as string);
  }, [role, staffId] as const);
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.j, null, { timeout: 60_000 });
}
async function as(page: Page, staffId: string, role: string) {
  await page.evaluate(([id, r]) => (window as unknown as W).__adelante.setActingStaff(id, r), [staffId, role]);
}
async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 8_000 }).catch(() => console.log("GO", to, "landed", page.url()));
  await page.waitForTimeout(800);
}
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus) await page.screenshot({ path: `${SHOTS}/fail-${info.title.slice(0, 2)}.png` }); });
async function openCrisis(page: Page) {
  await page.getByTestId("today-strip").getByRole("button", { name: /Crisis/ }).click();
  await page.waitForTimeout(600);
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png` });

test("J1 referral → chase task → peer fill → coordinator books on Anita → attended → timely-access line", async ({ page }) => {
  await boot(page, "s-cc1", "clinical_coordinator");
  const last = `Onebr${Date.now().toString(36).slice(-4)}`;
  const r = await page.evaluate((lastName) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const ref = AdelanteEHR.createReferral({ firstName: "Journey", lastName, dob: "1991-02-03", phone: "5595550111", referringAgency: "County Probation", referrerName: "Officer Diaz", referrerPhone: "5595550100", referralSource: "probation", consentToContact: true, channel: "public" }) as { id: string };
    const t = j.chaseTaskFor(ref.id) as { missing: string[]; status: string };
    const coord = { role: "clinical_coordinator", staffId: "s-cc1", name: "Priya Raman" };
    const inPool = (j.chaseRowsFor(coord) as { referral: { id: string }; lane: string }[]).some((x) => x.referral.id === ref.id && x.lane === "pool");
    return { id: ref.id, before: t.missing.length, open: t.status, inPool };
  }, last);
  expect(r.open).toBe("open");
  expect(r.inPool).toBe(true);
  await go(page, "/referral-queue");
  await expect(page.getByText(last).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j1-1-coordinator-pool");

  // Peer fills the language.
  await as(page, "s-peer1", "peer_specialist");
  const after = await page.evaluate((id) => {
    const { j } = (window as unknown as W).__adelante;
    const peer = { role: "peer_specialist", staffId: "s-peer1", name: "Trey Wilson" };
    const res = j.runAction("referral_chase_fill", peer, undefined, { args: [peer, id, { preferredLanguage: "Spanish" }] }) as { ok: boolean };
    return { ok: res.ok, missing: (j.chaseTaskFor(id) as { missing: string[] }).missing.length };
  }, r.id);
  expect(after.ok).toBe(true);
  expect(after.missing).toBe(r.before - 1);

  // Two days later the coordinator enrolls and books on Anita's real availability.
  await page.clock.setFixedTime(new Date(+FROZEN + 2 * 86400000));
  await as(page, "s-cc1", "clinical_coordinator");
  const b = await page.evaluate((id) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const pid = AdelanteEHR.enrollReferral(id) as string;
    const p = AdelanteEHR.getPatient(pid);
    const slot = (j.availableSlots("c3", { serviceType: "med_management", modality: "in_person" }) as string[])[0];
    const loc = (AdelanteEHR.listLocations() as { id: string }[])[0].id;
    const res = j.runAction("dashboard_book", { role: "clinical_coordinator", staffId: "s-cc1", name: "Priya Raman" }, p, {
      args: [{ patientId: pid, clinicianId: "c3", start: slot, durationMin: 60, serviceType: "med_management", modality: "in_person", locationId: loc, bookedBy: { id: "s-cc1", role: "clinical_coordinator" } }],
    }) as { ok: boolean; value?: { id: string }; reason?: string };
    const notified = (AdelanteEHR.listMemberNotifications("patient", pid) as { dedupeKey?: string }[]).some((n) => n.dedupeKey === `booked-patient:${res.value?.id}`);
    return { pid, slot, ok: res.ok, reason: res.reason, apptId: res.value?.id, notified };
  }, r.id);
  expect(b.ok, b.reason).toBe(true);
  expect(b.notified).toBe(true);

  // Anita marks it attended 10 minutes after the start.
  await page.clock.setFixedTime(new Date(+new Date(b.slot) + 10 * 60000));
  await as(page, "s-th3", "pmhnp");
  const att = await page.evaluate(([pid, apptId]) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    return (j.runAction("visit_attended", { role: "pmhnp", staffId: "s-th3", name: "Anita Bagga", clinicianId: "c3" }, AdelanteEHR.getPatient(pid), { args: [apptId, { name: "Anita Bagga", role: "pmhnp", id: "s-th3" }] }) as { ok: boolean }).ok;
  }, [b.pid, b.apptId!]);
  expect(att).toBe(true);

  const kept = Math.floor((+new Date(b.slot) + 10 * 60000 - +FROZEN) / 86400000);
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, `/record/${b.pid}?section=eligibility`);
  const line = page.getByTestId("timely-access");
  await line.scrollIntoViewIfNeeded({ timeout: 20_000 });
  await expect(line).toContainText(new RegExp(`First offered .*\\(2d\\).*First kept .*\\(${kept}d\\)`));
  await shot(page, "j1-2-timely-line");
});

test("J2 Dr. Bagga order → RN review → LVN gives → RN cosign; each step in Needs my action; LVN can't review", async ({ page }) => {
  const DR = { role: "physician", staffId: "s-np1", name: "" };
  await boot(page, "s-np1", "physician");
  const o = await page.evaluate((dr) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const m = j.getStaffMember(dr.staffId) as { name: string; role: string; clinicianId?: string };
    const actor = { ...dr, name: m.name, role: m.role, clinicianId: m.clinicianId };
    const p = (AdelanteEHR.listPatients() as { id: string; firstName: string; lastName: string }[])[1];
    const res = j.runAction("clinic_med_order", actor, p, { args: [{ patientId: p.id, drugName: "Hydroxyzine 25 MG Oral Tablet", dose: "25 mg", route: "PO", actor, enforceSafety: false }] }) as { ok: boolean; value: { id: string } };
    return { ok: res.ok, orderId: res.value.id, pid: p.id, name: `${p.firstName} ${p.lastName}` };
  }, DR);
  expect(o.ok).toBe(true);

  // RN Marisol: review appears in her queue on the Nurse workspace.
  await as(page, "s-rn1", "nurse_rn");
  await go(page, "/nurse");
  await expect(page.getByText(/Hydroxyzine/).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j2-1-rn-review-queue");

  // LVN can't review.
  await as(page, "s-lvn1", "lvn");
  const lvnReview = await page.evaluate(([pid, orderId]) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const lvn = { role: "lvn", staffId: "s-lvn1", name: "Kevin" };
    return (j.runAction("nurse_review", lvn, AdelanteEHR.getPatient(pid), { args: [{ patientId: pid, orderId, decision: "verified", actor: lvn }] }) as { ok: boolean }).ok;
  }, [o.pid, o.orderId]);
  expect(lvnReview).toBe(false);

  await as(page, "s-rn1", "nurse_rn");
  const rev = await page.evaluate(([pid, orderId]) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const m = j.getStaffMember("s-rn1") as { name: string };
    const rn = { role: "nurse_rn", staffId: "s-rn1", name: m.name };
    const ok = (j.runAction("nurse_review", rn, AdelanteEHR.getPatient(pid), { args: [{ patientId: pid, orderId, decision: "verified", actor: rn }] }) as { ok: boolean }).ok;
    const lvnQ = (j.nurseQueue({ role: "lvn", staffId: "s-lvn1" }) as { orderId?: string; kind: string }[]).some((r) => r.orderId === orderId && r.kind === "administer");
    return { ok, lvnQ };
  }, [o.pid, o.orderId]);
  expect(rev).toEqual({ ok: true, lvnQ: true });

  // LVN Kevin: administer appears in his queue; gives → routes to RN cosign.
  await as(page, "s-lvn1", "lvn");
  await go(page, "/clinician");
  await go(page, "/nurse");
  await expect(page.getByText(/Hydroxyzine/).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j2-2-lvn-administer-queue");
  const give = await page.evaluate(([pid, orderId]) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const m = j.getStaffMember("s-lvn1") as { name: string };
    const lvn = { role: "lvn", staffId: "s-lvn1", name: m.name };
    const r = j.runAction("clinic_dose_give", lvn, AdelanteEHR.getPatient(pid), { args: [{ patientId: pid, orderId, actor: lvn }] }) as { ok: boolean; outcome?: string };
    const d = (j.dosesFor(orderId) as { id: string }[])[0];
    const rnQ = (j.nurseQueue({ role: "nurse_rn", staffId: "s-rn1" }) as { doseId?: string; kind: string }[]).some((x) => x.doseId === d.id && x.kind === "cosign");
    return { outcome: r.outcome, doseId: d.id, rnQ };
  }, [o.pid, o.orderId]);
  expect(give.outcome).toBe("cosign_routed");
  expect(give.rnQ).toBe(true);

  await as(page, "s-rn1", "nurse_rn");
  await go(page, "/clinician");
  await go(page, "/nurse");
  await expect(page.getByText(/cosign/i).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j2-3-rn-cosign-queue");
  const trail = await page.evaluate(([pid, orderId, doseId]) => {
    const { j } = (window as unknown as W).__adelante;
    const m = j.getStaffMember("s-rn1") as { name: string };
    j.cosignClinicDose({ doseId, actor: { role: "nurse_rn", staffId: "s-rn1", name: m.name } });
    return (j.orderSignatureTrail(pid, orderId) as { step: string; pending?: boolean; by?: string }[]);
  }, [o.pid, o.orderId, give.doseId]);
  expect(trail.map((x) => x.step)).toEqual(["ordered", "reviewed", "given", "cosigned"]);
  expect(trail.every((x) => !x.pending)).toBe(true);
});

test("J3 crisis owned by clinician → hand-off → crisis note on 1-day clock → overdue → coordinator Reassign; neutral text", async ({ page }) => {
  await boot(page, "s-tr1", "clinical_trainee");
  const e = await page.evaluate(() => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const p = (AdelanteEHR.listPatients() as { id: string; primaryClinicianId?: string; firstName: string; lastName: string }[]).find((x) => x.primaryClinicianId === "c4")!;
    const m = j.getStaffMember("s-tr1") as { name: string; role: string; clinicianId?: string };
    const owner = { role: m.role, staffId: "s-tr1", name: m.name, clinicianId: m.clinicianId };
    const r = j.runAction("crisis_flag", owner, p, { args: [p.id, owner.name, "Said she took extra oxycodone pills tonight", { category: "clinical" }] }) as { ok: boolean; value: { id: string; ownerStaffId?: string; ownerLane: string } };
    return { pid: p.id, id: r.value.id, lane: r.value.ownerLane, owner: r.value.ownerStaffId, ownerRole: m.role };
  });
  expect(e.lane).toBe("named");
  expect(e.owner).toBe("s-tr1");
  await go(page, "/inbox");
  await go(page, "/clinician");
  await openCrisis(page);
  await expect(page.getByText("Crisis follow-up — yours").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/left/).first()).toBeVisible();
  await shot(page, "j3-1-owner-countdown");

  const toId = await page.evaluate(([pid, id, role]) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const m = j.getStaffMember("s-tr1") as { name: string };
    const owner = { role, staffId: "s-tr1", name: m.name };
    const r = j.runAction("crisis_handoff", owner, AdelanteEHR.getPatient(pid), { args: [pid, id, { toStaffId: "s-th1", reason: "Shift ending — Marisol covering", byStaffId: "s-tr1", byName: m.name, byRole: role }] }) as { ok: boolean };
    AdelanteEHR.addProgressNote(pid, { clinicianId: "c1", date: new Date().toISOString(), sessionType: "individual", subjective: "", objective: "", assessment: "", plan: "", serviceType: "crisis_intervention", crisisEscalationId: id });
    return r.ok ? "s-th1" : "";
  }, [e.pid, e.id, e.ownerRole]);
  expect(toId).toBe("s-th1");
  const thRole = await page.evaluate(() => ((window as unknown as W).__adelante.j.getStaffMember("s-th1") as { role: string }).role);
  await as(page, "s-th1", thRole);
  await go(page, "/inbox");
  await go(page, "/clinician");
  await openCrisis(page);
  await expect(page.getByText("Crisis follow-up — yours").first()).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("today-strip").getByRole("button", { name: /Needs closing/ }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/crisis note/i).first()).toBeVisible();
  await shot(page, "j3-2-new-owner-crisis-note");

  // Two days later: overdue → coordinator pool with Reassign.
  await page.clock.setFixedTime(new Date(+FROZEN + 2 * 86400000));
  await as(page, "s-cc1", "clinical_coordinator");
  await go(page, "/inbox");
  await go(page, "/clinician");
  await openCrisis(page);
  await expect(page.getByRole("button", { name: /Reassign/ }).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j3-3-coordinator-reassign");
  expect(await page.locator("body").innerText()).not.toMatch(/oxycodone|pills|overdose/i);
  const leaks = await page.evaluate((pid) => {
    const { AdelanteEHR } = (window as unknown as W).__adelante;
    return (AdelanteEHR.listNotifications() as { patientId?: string; subject: string; body?: string }[])
      .filter((x) => x.patientId === pid).map((x) => `${x.subject} ${x.body ?? ""}`).filter((t) => /oxycodone|pills|opioid|overdose|substance/i.test(t));
  }, e.pid);
  expect(leaks).toEqual([]);
});

test("J5 peer AFBI dictation pre-enrollment → enroll → coordinator confirms → ISL row (held without consent) → never a claim", async ({ page }) => {
  await boot(page, "s-peer1", "peer_specialist");
  const c = await page.evaluate(() => {
    const { j } = (window as unknown as W).__adelante;
    const m = j.getStaffMember("s-peer1") as { name: string };
    const actor = { name: m.name, role: "peer_specialist", staffId: "s-peer1" };
    const s = j.createDictationDraft({ actor, target: "afbi", initials: "J.Q." }) as { id: string; sentences: { id: string; identifying?: boolean; unsupported?: boolean; resolution?: { kind: string } }[] };
    j.openAiDraft(s.id, actor);
    for (const x of s.sentences.filter((y) => y.identifying)) j.deleteAiSentence(s.id, x.id, actor);
    for (const x of s.sentences.filter((y) => y.unsupported && y.resolution?.kind !== "deleted")) j.keepAiSentence(s.id, x.id, "I did that myself", actor);
    j.confirmAiReview(s.id, actor, 5);
    const contact = j.saveAfbiFromScribe(s.id, actor) as { id: string; initials: string; patientId?: string };
    return contact;
  });
  expect(c.initials).toBe("JQ");
  expect(c.patientId).toBeUndefined();

  const link = await page.evaluate((cid) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const p = AdelanteEHR.createPatient({ firstName: "Jay", lastName: `Quill${Math.random().toString(36).slice(2, 5)}`, dob: "1988-04-04" }) as { id: string };
    const req = j.requestAfbiLink({ role: "peer_specialist", name: "Trey Wilson", staffId: "s-peer1" }, cid, p.id) as { id: string };
    return { pid: p.id, req: req.id, before: (j.getAfbiContact(cid) as { patientId?: string }).patientId ?? null };
  }, c.id);
  expect(link.before).toBeNull();

  await as(page, "s-cc1", "clinical_coordinator");
  const after = await page.evaluate(([cid, pid, req]) => {
    const { j, AdelanteEHR } = (window as unknown as W).__adelante;
    const ok = (j.runAction("afbi_link_decide", { role: "clinical_coordinator", staffId: "s-cc1", name: "Priya Raman" }, AdelanteEHR.getPatient(pid), { args: [{ role: "clinical_coordinator", name: "Priya Raman" }, req, true] }) as { ok: boolean }).ok;
    const range = { from: "2026-01-01", to: "2026-12-31" };
    const rows = j.serviceRows(range) as { cls: { ref: { kind: string; id?: string } }; lane?: string; funding?: string }[];
    const row = rows.find((r) => r.cls.ref.kind === "afbi_contact" && r.cls.ref.id === cid);
    const claims = (AdelanteEHR.listClaims?.() as { sourceId?: string; afbiContactId?: string }[] | undefined) ?? [];
    return { ok, linked: (j.getAfbiContact(cid) as { patientId?: string }).patientId, row: row ? JSON.stringify(row).slice(0, 400) : null, inClaims: JSON.stringify(claims).includes(cid) };
  }, [c.id, link.pid, link.req]);
  expect(after.ok).toBe(true);
  expect(after.linked).toBe(link.pid);
  expect(after.row).not.toBeNull();
  expect(after.inClaims).toBe(false);

  await as(page, "s-bc1", "billing_coordinator");
  await go(page, "/county-reporting");
  await expect(page.getByText(/ISL/).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j5-isl-hub");
  const isl = await page.evaluate(() => {
    const { j } = (window as unknown as W).__adelante;
    const f = j.buildIslFile({ role: "billing_coordinator", name: "Deneen Ford", staffId: "s-bc1" }, { from: "2026-01-01", to: "2026-12-31" }) as Record<string, unknown>;
    return JSON.stringify(f);
  });
  // Dictated activities are SUD-related → the named row is withheld without county consent.
  expect(isl).not.toContain(link.pid);
});

test("J6 billing coordinator CalOMS draft (no ASAM signature / medical-necessity columns); plain billing aggregates <11", async ({ page }) => {
  await boot(page, "s-bc1", "billing_coordinator");
  await go(page, "/county-reporting");
  await expect(page.getByText(/CalOMS/).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j6-1-billing-coordinator-hub");
  const cols = await page.evaluate(() => {
    const { j } = (window as unknown as W).__adelante;
    return (j.exportColumnsFor("billing_coordinator") as { key: string; label: string }[]).map((c) => `${c.key} ${c.label}`);
  });
  expect(cols.join("|")).not.toMatch(/signature|medical.?necessity|co-?signed|asam version/i);
  expect(await page.locator("body").innerText()).not.toMatch(/Medical necessity|LPHA co-signed/i);

  // No notes / ASAM / care plan for the billing coordinator.
  const access = await page.evaluate(() => {
    const { j } = (window as unknown as W).__adelante;
    return ["therapy_notes", "screeners_sud", "care_plan"].map((c) => (j.canAccess("billing_coordinator", c) as { level: string }).level);
  });
  expect(access).toEqual(["none", "none", "none"]);

  await as(page, "s-bill1", "billing");
  await go(page, "/clinician");
  await go(page, "/county-reporting");
  await expect(page.getByText(/CalOMS/).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "j6-2-billing-aggregates");
  const body = await page.locator("body").innerText();
  expect(body).toMatch(/<\s?11|fewer than 11|suppressed/i);
});
