// Cross-role journeys J1–J7 at store level (real store functions + registry +
// runAction). Clock frozen (Tue 29 Sep 2026 08:00 Pacific); advanced explicitly.
// The browser side lives in e2e/crossRole.spec.ts; report in docs/cross-role-test-report.md.
import { FROZEN_NOW } from "@/test/freezeClock";
import { attest } from "@/test/claimSigning";
import { describe, expect, it, vi } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { runAction } from "@/lib/actions/runAction";
import { chartAction } from "@/lib/chartActions";
import { canAccess, getStaffMember, STAFF_ROLES, type StaffRole } from "@/lib/roles";
import { chaseRowsFor, chaseTaskFor } from "@/lib/referralChase";
import { availableSlots } from "@/lib/clinicianAvailability";
import { timelyAccessFor, timelyLine } from "@/lib/timelyAccess";
import { orderSignatureTrail, cosignClinicDose, dosesFor, nurseQueue, nurseReviewFor, nurseReviewOrder, orderClinicMedication } from "@/lib/nursing";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";
import { noteClock } from "@/lib/noteClock";
import {
  canCaptureScribe, canDictateScribe, captureBlocker, confirmAiReview, createDictationDraft, deleteAiSentence, endScribeSession,
  getScribeSession, grantAiRecordingConsent, keepAiSentence, openAiDraft, saveAfbiFromScribe, scribeView, startScribeSession,
  sweepScribeRetention, type ScribeActor, type ScribeSession,
} from "@/lib/scribe";
import { decideAfbiLink, getAfbiContact, requestAfbiLink } from "@/lib/afbiOutreach";
import { serviceRows as serviceRowsDbg, buildIslFile, calomsBlockerRows, generateReport, suppressCell, tpsCounts, _resetCountyReporting, reportCards } from "@/lib/countyReporting";
import { dmcOdsExportRows, exportColumnsFor, ASAM_CLINICAL_COLUMNS } from "@/lib/dmcOdsReadiness";
import { filterSudMedsForRole, roleSeesAsamSection } from "@/lib/asamReporting";
import { roleSeesSudInstruments } from "@/lib/trackingTimeline";
import { linkPartner, recordHandoff, visiblePartnerLinks, DEMO_NTP_ID } from "@/lib/carePartners";
import { recordLegalDisclosureConsent } from "@/lib/outpatientCare";
import { DISCLOSURE_LOG_ROLES, listDisclosureLog } from "@/lib/part2Disclosure";
import { SUD_MEDICATION_NAMES } from "@/lib/sudMedClassifier";

const S = (id: string) => { const m = getStaffMember(id)!; return { role: m.role, staffId: m.id, name: m.name, clinicianId: m.clinicianId, caseManagerId: m.caseManagerId }; };
const COORD = () => S("s-cc1");
const ANITA = () => S("s-th3");
const DR = () => S("s-np1");
const RN = () => S("s-rn1");
const LVN = () => S("s-lvn1");
const PEER = () => S("s-peer1");
const at = (iso: string) => vi.setSystemTime(new Date(iso));
const plusDays = (iso: string, d: number) => new Date(+new Date(iso) + d * 86400000).toISOString();

describe("J1 referral → first visit", () => {
  it("chase task → peer fill → coordinator books on Anita's real availability → attended → timely-access line", () => {
    at(FROZEN_NOW);
    const r = AdelanteEHR.createReferral({
      firstName: "Journey", lastName: `One${Math.random().toString(36).slice(2, 6)}`, dob: "1991-02-03", phone: "5595550111",
      referringAgency: "County Probation", referrerName: "Officer Diaz", referrerPhone: "5595550100", referralSource: "probation",
      consentToContact: true, channel: "public",
    } as never);
    const t = chaseTaskFor(r.id)!;
    expect(t.status).toBe("open");
    expect(chaseRowsFor(COORD()).some((x) => x.referral.id === r.id && x.lane === "pool")).toBe(true);
    const before = t.missing.length;
    expect(runAction("referral_chase_fill", PEER(), undefined, { args: [PEER(), r.id, { preferredLanguage: "Spanish" }] }).ok).toBe(true);
    expect(chaseTaskFor(r.id)!.missing.length).toBe(before - 1);

    // Two days later the coordinator enrolls and books on Anita's calendar.
    at(plusDays(FROZEN_NOW, 2));
    const pid = AdelanteEHR.enrollReferral(r.id)!;
    const p = AdelanteEHR.getPatient(pid)!;
    const slot = availableSlots("c3", { serviceType: "med_management", modality: "in_person" })[0]!;
    expect(slot).toBeTruthy();
    const book = runAction<{ id: string }>("dashboard_book", COORD(), p, {
      args: [{ patientId: pid, clinicianId: "c3", start: slot, durationMin: 60, serviceType: "med_management", modality: "in_person", locationId: AdelanteEHR.listLocations()[0]!.id, bookedBy: { id: "s-cc1", role: "clinical_coordinator" } }],
    });
    expect(book.ok, book.ok ? "" : book.reason).toBe(true);
    const appt = book.ok ? book.value : undefined!;
    expect(AdelanteEHR.listMemberNotifications("patient", pid).some((n) => n.dedupeKey === `booked-patient:${appt.id}`)).toBe(true);

    // Clinician marks attended 10 minutes after the start.
    at(new Date(+new Date(slot) + 10 * 60000).toISOString());
    expect(runAction("visit_attended", ANITA(), p, { args: [appt.id, { name: ANITA().name, role: "pmhnp", id: "s-th3" }] }).ok).toBe(true);

    const v = timelyAccessFor(pid);
    expect(v.request?.at).toBe(FROZEN_NOW);
    expect(v.offered?.at).toBe(plusDays(FROZEN_NOW, 2));
    const expKept = Math.floor((+new Date(slot) + 10 * 60000 - +new Date(FROZEN_NOW)) / 86400000);
    expect(v.daysToOffered).toBe(2);
    expect(v.daysToKept).toBe(expKept);
    expect(timelyLine(v)).toMatch(new RegExp(`First offered .* \\(2d\\) · First kept .* \\(${expKept}d\\)`));
  });
});

describe("J2 medication chain", () => {
  it("Dr. Bagga orders → RN Marisol reviews → LVN Kevin gives → RN cosigns; LVN can't review", () => {
    at(FROZEN_NOW);
    const pid = AdelanteEHR.listPatients()[1].id;
    const p = AdelanteEHR.getPatient(pid);
    const o = runAction<{ id: string; patientId: string }>("clinic_med_order", DR(), p, {
      args: [{ patientId: pid, drugName: "Hydroxyzine 25 MG Oral Tablet", dose: "25 mg", route: "PO", actor: DR(), enforceSafety: false }],
    });
    expect(o.ok).toBe(true);
    const order = o.ok ? o.value : undefined!;
    expect(nurseQueue(RN()).some((r) => r.orderId === order.id && r.kind === "review")).toBe(true);
    expect(() => nurseReviewOrder({ patientId: pid, orderId: order.id, decision: "verified", actor: LVN() })).toThrow(/RN only/);
    expect(runAction("nurse_review", LVN(), p, { args: [] }).ok).toBe(false);
    expect(runAction("nurse_review", RN(), p, { args: [{ patientId: pid, orderId: order.id, decision: "verified", actor: RN() }] }).ok).toBe(true);
    expect(nurseQueue(LVN()).some((r) => r.orderId === order.id && r.kind === "administer")).toBe(true);
    const give = runAction("clinic_dose_give", LVN(), p, { args: [{ patientId: pid, orderId: order.id, actor: LVN() }] });
    expect(give.ok && give.outcome).toBe("cosign_routed");
    const d = dosesFor(order.id)[0];
    expect(nurseQueue(RN()).some((r) => r.doseId === d.id && r.kind === "cosign")).toBe(true);
    cosignClinicDose({ doseId: d.id, actor: RN() });
    // All three signatures on the order trail.
    const o2 = AdelanteEHR.listOrders(pid).find((x) => x.id === order.id) as unknown as { signedBy?: string; createdBy?: string };
    expect(o2.signedBy ?? o2.createdBy).toMatch(/Bagga/);
    expect(nurseReviewFor(order.id)?.by).toMatch(/Marisol/);
    const trail = orderSignatureTrail(pid, order.id);
    expect(trail.map((x) => x.step)).toEqual(["ordered", "reviewed", "given", "cosigned"]);
    expect(trail.every((x) => !x.pending)).toBe(true);
    const dose = dosesFor(order.id)[0] as unknown as { givenBy?: { name: string }; byName?: string; cosign?: { status: string; byName?: string; by?: { name: string } } };
    expect(JSON.stringify(dose)).toMatch(/Kevin/);
    expect(dose.cosign?.status).toBe("signed");
    expect(JSON.stringify(dose.cosign)).toMatch(/Marisol/);
  });
});

describe("J3 crisis", () => {
  it("named owner with countdown → handoff → crisis note on 1-day clock pinned → overdue to coordinator with Reassign; neutral text", () => {
    at(FROZEN_NOW);
    const p = AdelanteEHR.listPatients().find((x) => x.primaryClinicianId === "c4")!;
    const owner = S("s-tr1"); // Kayla (c4)
    const r = runAction<{ id: string; ownerStaffId?: string; ownerLane: string }>("crisis_flag", owner, p, { args: [p.id, owner.name, "Said she took extra oxycodone pills tonight", { category: "clinical" }] });
    expect(r.ok).toBe(true);
    const e = r.ok ? r.value : undefined!;
    expect(e.ownerLane).toBe("named");
    expect(e.ownerStaffId).toBe("s-tr1");
    const rows = workspaceActionRows({ actor: owner as never, needsClosing: [] });
    const mine = rows.find((x) => x.id === `crisis:${e.id}`)!;
    expect(mine.label).toBe("Crisis follow-up — yours");
    expect(mine.due).toMatch(/left/);
    expect(rows[0].kind).toBe("crisis");

    const to = S("s-th1");
    expect(runAction("crisis_handoff", owner, p, { args: [p.id, e.id, { toStaffId: to.staffId, reason: "Shift ending — Marisol covering", byStaffId: owner.staffId, byName: owner.name, byRole: owner.role }] }).ok).toBe(true);
    const nowRows = workspaceActionRows({ actor: to as never, needsClosing: [] });
    expect(nowRows.some((x) => x.id === `crisis:${e.id}` && x.label === "Crisis follow-up — yours")).toBe(true);

    // Crisis note with the checkbox (crisis_intervention + escalation link).
    const note = AdelanteEHR.addProgressNote(p.id, { clinicianId: "c1", date: FROZEN_NOW, sessionType: "individual", subjective: "", objective: "", assessment: "", plan: "", serviceType: "crisis_intervention", crisisEscalationId: e.id } as never) as { id: string };
    const n = AdelanteEHR.getPatient(p.id)!.progressNotes!.find((x) => x.id === note.id)!;
    expect(noteClock(n, new Date(FROZEN_NOW)).kind).toBe("crisis");
    const withNote = workspaceActionRows({ actor: to as never, needsClosing: [] });
    const firstNonCrisis = withNote.find((x) => x.kind !== "crisis")!;
    expect(firstNonCrisis.kind).toBe("crisis_note");

    // Advance 2 days: overdue → coordinator pool with Reassign; text neutral.
    at(plusDays(FROZEN_NOW, 2));
    const coordRows = workspaceActionRows({ actor: COORD() as never, needsClosing: [], now: new Date() });
    const esc = coordRows.find((x) => x.id === `crisis:${e.id}`)!;
    expect(esc.action).toBe("Reassign");
    expect(coordRows.some((x) => x.id === `crisis_note:${note.id}` && /overdue/.test(x.label))).toBe(true);
    const banned = /oxycodone|pills|opioid|overdose|substance/i;
    for (const row of coordRows.filter((x) => x.patientId === p.id)) expect(`${row.label} ${row.due}`).not.toMatch(banned);
    const notes = AdelanteEHR.listNotifications().filter((x) => x.patientId === p.id && /crisis/i.test(`${x.category} ${x.subject}`));
    expect(notes.length).toBeGreaterThan(0);
    for (const x of notes) expect(`${x.subject} ${x.body}`).not.toMatch(banned);
    for (const a of AdelanteEHR.listAuditEvents({ category: "action" }).filter((x) => x.patientId === p.id)) expect(JSON.stringify(a.detail)).not.toMatch(banned);
  });
});

describe("J4 scribe by role", () => {
  const consent = (pid: string) => grantAiRecordingConsent({ patientId: pid, signedByName: "J F", attested: true, part2: true, capturedBy: { staffName: "x", role: "therapist" } });
  const newP = () => AdelanteEHR.getPatient((AdelanteEHR.createPatient({ firstName: "Scr", lastName: `J${Math.random().toString(36).slice(2, 6)}` } as never) as { id: string }).id)!;
  const CAPTURE: [string, string][] = [["physician", "s-np1"], ["pmhnp", "s-th3"], ["therapist", "s-th1"], ["sud_counselor", "s-sudc1"], ["nurse_rn", "s-rn1"]];
  for (const [role, id] of CAPTURE) {
    it(`${role}: consent → start → end → review → resolve → sign → deletion stub`, () => {
      at(FROZEN_NOW);
      const m = S(id);
      const actor: ScribeActor = { name: m.name, role: m.role, staffId: m.staffId, clinicianId: m.clinicianId };
      const p = newP();
      expect(captureBlocker({ actor, patientId: p.id, format: "soap", allPartyConfirmed: true })?.reason).toMatch(/consent/i);
      consent(p.id);
      const s = startScribeSession({ actor, patientId: p.id, format: "soap", allPartyConfirmed: true });
      const note = endScribeSession(s.id, actor);
      openAiDraft(s.id, actor);
      const sess = getScribeSession(s.id)!;
      for (const x of sess.sentences.filter((y) => y.unsupported || y.speakerUncertain)) {
        if (x.unsupported) deleteAiSentence(s.id, x.id, actor);
        else keepAiSentence(s.id, x.id, "Confirmed speaker myself", actor);
      }
      confirmAiReview(s.id, actor, 4);
      AdelanteEHR.signProgressNote(p.id, note.id, { signedBy: actor.name, role: m.role, attested: true });
      // Existing policy: SUD counselor and RN notes route to a licensed cosigner after the author signs.
      const st = AdelanteEHR.getPatient(p.id)!.progressNotes!.find((x) => x.id === note.id)!.status;
      if (role === "sud_counselor" || role === "nurse_rn") {
        expect(st).toBe("cosign_pending");
        AdelanteEHR.cosignProgressNote(p.id, note.id, { cosignedBy: "Dr. Bagga", cosignedById: "s-np1", role: "pmhnp", attestation: attest("progress_note_supervisor_sign", "Dr. Bagga") });
      }
      expect(AdelanteEHR.getPatient(p.id)!.progressNotes!.find((x) => x.id === note.id)!.status).toMatch(/^(signed|cosigned)$/);
      sweepScribeRetention();
      expect(getScribeSession(s.id)!.transcriptDeleted?.reason).toBe("signed");
    });
  }
  it("peer / CHW / ECM: dictation only, live start absent", () => {
    for (const role of ["peer_specialist", "community_health_worker", "ecm_provider"] as StaffRole[]) {
      expect(canCaptureScribe(role)).toBe(false);
      expect(canDictateScribe(role)).toBe(true);
      expect(chartAction("scribe_start").allowed({ role }).state).toBe("hidden");
      expect(chartAction("scribe_dictate").allowed({ role }).state).not.toBe("hidden");
    }
  });
  it("LVN, billing and admin: no scribe at all", () => {
    for (const role of ["lvn", "billing", "sys_admin"] as StaffRole[]) {
      expect(canDictateScribe(role)).toBe(false);
      for (const id of ["scribe_start", "scribe_dictate"]) expect(chartAction(id).allowed({ role }).state, `${role} ${id}`).toBe("hidden");
    }
  });
  it("field setting with an unnamed bystander is blocked", () => {
    const p = newP();
    consent(p.id);
    const c = S("s-sudc1");
    const b = captureBlocker({ actor: { name: c.name, role: c.role, staffId: c.staffId, clinicianId: c.clinicianId }, patientId: p.id, format: "dap", allPartyConfirmed: true, setting: "field", privateLocationConfirmed: true, parties: [{ kind: "patient", agreed: true }, { kind: "other", agreed: true, name: "", relationship: "" }] } as never);
    expect(b?.reason).toMatch(/name/i);
  });
});

describe("J5 AFBI → ISL", () => {
  it("pre-enrollment dictation (initials) → enroll → coordinator confirms link → in ISL export, never a claim", () => {
    at(FROZEN_NOW);
    const peer = PEER();
    const actor: ScribeActor = { name: peer.name, role: peer.role, staffId: peer.staffId };
    const s = createDictationDraft({ actor, target: "afbi", initials: "J.Q." }) as ScribeSession;
    openAiDraft(s.id, actor);
    for (const x of s.sentences.filter((y) => y.identifying)) deleteAiSentence(s.id, x.id, actor);
    for (const x of s.sentences.filter((y) => y.unsupported && y.resolution?.kind !== "deleted")) keepAiSentence(s.id, x.id, "I did that myself", actor);
    confirmAiReview(s.id, actor, 5);
    const c = saveAfbiFromScribe(s.id, actor);
    expect(c.initials).toBe("JQ");
    expect(c.patientId).toBeUndefined();
    const p = AdelanteEHR.createPatient({ firstName: "Jay", lastName: `Quill${Math.random().toString(36).slice(2, 5)}`, dob: "1988-04-04" } as never) as { id: string };
    const req = requestAfbiLink({ role: peer.role, name: peer.name, staffId: peer.staffId }, c.id, p.id);
    expect(getAfbiContact(c.id)!.patientId).toBeUndefined();
    expect(runAction("afbi_link_decide", COORD(), AdelanteEHR.getPatient(p.id), { args: [{ role: "clinical_coordinator", name: "Priya Raman" }, req.id, true] }).ok).toBe(true);
    expect(getAfbiContact(c.id)!.patientId).toBe(p.id);
    const isl = buildIslFile({ role: "billing_coordinator", name: "Deneen Ford", staffId: "s-bc1" } as never, { from: "2026-01-01", to: "2026-12-31" });
    // The linked contact is an ISL row under the person's record (never Medi-Cal)…
    const row = serviceRowsDbg({ from: "2026-01-01", to: "2026-12-31" }).find((r) => r.cls.ref.kind === "afbi_contact" && r.cls.ref.id === c.id)!;
    expect(row.patientId).toBe(p.id);
    expect(row.cls.fundingSource).toBe("isl_non_medi_cal");
    // …and because the dictated activities are SUD-related, the named row goes
    // through disclose(): with no county consent on file it is withheld, not leaked.
    if (row.sud) {
      expect(isl.file).not.toContain(`afbi_contact:${c.id},`);
      expect(isl.withheld).toBeGreaterThan(0);
    } else {
      expect(isl.file).toContain(`afbi_contact:${c.id},2026-09-29,${p.id}`);
    }
    expect(AdelanteEHRExt.listClaims().some((cl) => JSON.stringify(cl).includes(c.id))).toBe(false);
  });
});

describe("J6 county reporting", () => {
  it("billing coordinator: CalOMS client rows, no ASAM signature/med-necessity columns, no clinical content", () => {
    _resetCountyReporting();
    const bc = { role: "billing_coordinator" as const, name: "Deneen Ford", staffId: "s-bc1" };
    expect(generateReport(bc, "caloms", "30").report).toBe("caloms");
    expect(calomsBlockerRows("billing_coordinator")).not.toBeNull();
    const cols = exportColumnsFor("billing_coordinator");
    for (const c of ASAM_CLINICAL_COLUMNS) expect(cols).not.toContain(c);
    for (const row of dmcOdsExportRows("billing_coordinator") ?? []) for (const c of ASAM_CLINICAL_COLUMNS) expect(Object.keys(row).filter((k) => cols.includes(k as never))).not.toContain(c);
    for (const cls of ["therapy_notes", "screeners_sud", "care_plan", "psych_eval"] as const) expect(canAccess("billing_coordinator", cls).level).toBe("none");
    for (const p of AdelanteEHR.listPatients()) expect(roleSeesAsamSection("billing_coordinator", p)).toBe(false);
  });
  it("plain billing: aggregates only with <11 suppression", () => {
    expect(calomsBlockerRows("billing")).toBeNull();
    expect(dmcOdsExportRows("billing")).toBeNull();
    for (const n of [1, 5, 10]) expect(suppressCell(n)).toBeNull();
    expect(suppressCell(0)).toBe(0);
    expect(suppressCell(11)).toBe(11);
    const t = tpsCounts();
    for (const v of Object.values(t)) if (v !== null) expect(v === 0 || v >= 11).toBe(true);
    expect(reportCards("billing").length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ J7
export type J7Item = "asam_section" | "sud_meds" | "sud_instruments" | "scribe_draft" | "partner_sud_link" | "disclosure_log" | "therapy_notes";
export const J7_ITEMS: J7Item[] = ["asam_section", "sud_meds", "sud_instruments", "scribe_draft", "partner_sud_link", "disclosure_log", "therapy_notes"];
export const PART2_ITEMS: J7Item[] = ["asam_section", "sud_meds", "sud_instruments", "scribe_draft", "partner_sud_link"];

describe("J7 Part 2 sweep", () => {
  it("every staff role × item matches the registry; no leak in task, notification or audit text", () => {
    at(FROZEN_NOW);
    // Luis Camacho — seeded with signed ASAMs and buprenorphine-naloxone (no SUD problem row).
    const p = AdelanteEHR.listPatients().find((x) => x.firstName === "Luis" && x.lastName === "Camacho")!;
    expect(AdelanteEHR.listAsamAssessments(p.id).length).toBeGreaterThan(0);
    // Scribe draft, care-partner link + disclosure-log entry — all through real store functions.
    grantAiRecordingConsent({ patientId: p.id, signedByName: "M W", attested: true, part2: true, capturedBy: { staffName: "x", role: "therapist" } });
    const dr: ScribeActor = { name: DR().name, role: "physician", staffId: "s-np1", clinicianId: DR().clinicianId };
    const s = startScribeSession({ actor: dr, patientId: p.id, format: "soap", allPartyConfirmed: true });
    endScribeSession(s.id, dr);
    recordLegalDisclosureConsent(p.id, { name: DR().name, role: "physician" }, p.firstName, { recipient: "Sequoia Valley Treatment Program (fictional NTP)", purpose: "Medication continuity" });
    const link = linkPartner({ patientId: p.id, orgId: DEMO_NTP_ID, purpose: "Medication continuity", actor: DR() });
    recordHandoff({ linkId: link.id, classes: ["MAT status"], actor: DR() });
    expect(listDisclosureLog({ patientId: p.id } as never).length).toBeGreaterThan(0);

    const pt = AdelanteEHR.getPatient(p.id)!;
    const meds = AdelanteEHR.listMedications(pt.id) as { name?: string }[];
    expect(meds.some((m) => /buprenorphine/i.test(m.name ?? ""))).toBe(true);
    const matrix: Record<string, Record<J7Item, boolean>> = {};
    const leaks: string[] = [];
    for (const { key: role } of STAFF_ROLES) {
      const sud = canAccess(role, "screeners_sud", pt);
      const registryPart2 = sud.level !== "none" && !sud.locked;
      const row: Record<J7Item, boolean> = {
        asam_section: roleSeesAsamSection(role, pt),
        sud_meds: filterSudMedsForRole(meds, role, pt).hidden === 0,
        sud_instruments: roleSeesSudInstruments(role, pt),
        scribe_draft: !scribeView(s.id, role).masked,
        partner_sud_link: visiblePartnerLinks(pt.id, role).some((l) => l.orgId === DEMO_NTP_ID),
        disclosure_log: DISCLOSURE_LOG_ROLES.includes(role),
        therapy_notes: !["none", "summary"].includes(canAccess(role, "therapy_notes", pt).level),
      };
      matrix[role] = row;
      for (const it of PART2_ITEMS) if (row[it] && !registryPart2) leaks.push(`${role} sees ${it} but registry screeners_sud=${sud.level}${sud.locked ? "/locked" : ""}`);
      if (row.therapy_notes !== !["none", "summary"].includes(canAccess(role, "therapy_notes", pt).level)) leaks.push(`${role} therapy_notes mismatch`);
    }
    const banned = new RegExp(`\\b(${[...SUD_MEDICATION_NAMES, "asam", "opioid", "alcohol", "substance use"].join("|")})\\b`, "i");
    for (const n of AdelanteEHR.listNotifications().filter((x) => x.patientId === pt.id)) if (banned.test(`${n.subject} ${n.body}`)) leaks.push(`notification: ${n.subject}`);
    for (const t of AdelanteEHR.listCaseTasks().filter((x) => x.patientId === pt.id)) if (banned.test(`${t.title} ${(t as { description?: string }).description ?? ""}`) && !(t.allowedRoles ?? []).length) leaks.push(`task: ${t.title}`);
    for (const a of AdelanteEHR.listAuditEvents({ category: "action" }).filter((x) => x.patientId === pt.id)) if (banned.test(JSON.stringify(a.detail))) leaks.push(`audit: ${a.action}`);
    for (const a of AdelanteEHR.listAuditEvents({}).filter((x) => x.patientId === pt.id && String(x.action).startsWith("scribe_"))) if (banned.test(JSON.stringify(a.detail))) leaks.push(`scribe audit: ${a.action}`);

    mkdirSync("/tmp/cross-role", { recursive: true });
    const header = `| Role | ${J7_ITEMS.join(" | ")} |\n|---|${J7_ITEMS.map(() => "---").join("|")}|`;
    const body = Object.entries(matrix).map(([r, row]) => `| ${r} | ${J7_ITEMS.map((i) => (row[i] ? "sees" : "hidden")).join(" | ")} |`).join("\n");
    writeFileSync("/tmp/cross-role/j7-patient.txt", pt.id);
    writeFileSync("/tmp/cross-role/j7-matrix.md", `${header}\n${body}\n`);
    writeFileSync("/tmp/cross-role/j7-leaks.json", JSON.stringify(leaks, null, 2));
    expect(leaks).toEqual([]);
  });
});
