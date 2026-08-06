// §Group sessions — eligibility gate, category-scoped self-service, and the
// hard "open groups never bill" split. These are negative tests on purpose:
// each one proves a refusal at the DATA layer, not a UI filter.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type GroupCategory } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";
import { openGroupEngagement, openGroupEngagementRows } from "../groupMetrics";
import { STAFF_NAV } from "../navSections";
import { canAccess } from "../roles";

/** Seed roster is small; wrap the index so the suite is roster-size independent. */
function patientAt(i: number) {
  const list = AdelanteEHR.listPatients();
  return list[i % list.length]!;
}

function makeGroup(category: GroupCategory) {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  return AdelanteEHR.createGroupSession({
    topic: "Placeholder topic",
    category,
    facilitatorId: clinician.id,
    serviceType: "therapy_group",
    modality: "in_person",
    start: new Date(Date.now() + 86400000).toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "weekly", daysOfWeek: [new Date().getDay()] },
    createdBy: "test",
  });
}

function makeGroupWithCapacity(category: GroupCategory, capacity: number) {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  return AdelanteEHR.createGroupSession({
    topic: "Placeholder topic (capacity)",
    category,
    facilitatorId: clinician.id,
    serviceType: "therapy_group",
    modality: "in_person",
    start: new Date(Date.now() + 86400000).toISOString(),
    durationMin: 60,
    capacity,
    recurrence: { kind: "weekly", daysOfWeek: [new Date().getDay()] },
    createdBy: "test",
  });
}

describe("group eligibility is a real precondition for every enrollment path", () => {
  it("blocks staff enrollment in BOTH categories until eligibility is set", () => {
    const p = patientAt(0);
    AdelanteEHR.clearGroupEligibility?.(p.id, "reset for test", "test");
    for (const cat of ["sud_clinical_preauth", "open_psychoeducational"] as GroupCategory[]) {
      const g = makeGroup(cat);
      expect(() =>
        AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" }),
      ).toThrow(/eligibility/i);
    }
    eligible(p.id);
    const g = makeGroup("sud_clinical_preauth");
    expect(
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" }).patientId,
    ).toBe(p.id);
  });

  it("blocks patient self-enrollment without eligibility", () => {
    const p = patientAt(1);
    const g = makeGroup("open_psychoeducational");
    expect(() => AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: p.id })).toThrow(
      /eligibility/i,
    );
  });

  it("only a clinical / care-management role may set the flag", () => {
    const p = patientAt(2);
    expect(() =>
      AdelanteEHR.setGroupEligibility({
        patientId: p.id,
        reason: "x",
        role: "billing",
        actor: "test",
      }),
    ).toThrow();
  });
});

describe("self-service is categorically scoped to open groups", () => {
  it("never lists a sud_clinical_preauth group for a patient", () => {
    const p = patientAt(3);
    eligible(p.id);
    const sud = makeGroup("sud_clinical_preauth");
    const open = makeGroup("open_psychoeducational");
    const ids = AdelanteEHR.openGroupsForPatient(p.id).map((g) => g.id);
    expect(ids).not.toContain(sud.id);
    expect(ids).toContain(open.id);
  });

  it("refuses a direct self-enroll attempt against a staff-only group", () => {
    const p = patientAt(4);
    eligible(p.id);
    const sud = makeGroup("sud_clinical_preauth");
    expect(() => AdelanteEHR.selfEnrollInGroup({ sessionId: sud.id, patientId: p.id })).toThrow(
      /staff-enrolled/i,
    );
  });

  it("lets an eligible patient self-enroll in an open group", () => {
    const p = patientAt(5);
    eligible(p.id);
    const open = makeGroup("open_psychoeducational");
    const row = AdelanteEHR.selfEnrollInGroup({ sessionId: open.id, patientId: p.id });
    expect(row.patientId).toBe(p.id);
    // The calendar view only shows groups actually enrolled in.
    const other = makeGroup("open_psychoeducational");
    const mine = AdelanteEHR.groupsForPatient(p.id).map((g) => g.id);
    expect(mine).toContain(open.id);
    expect(mine).not.toContain(other.id);
  });
});

describe("open-group attendance never creates a claim", () => {
  it("returns null from the billing hook and leaves attendee notes non-billable", () => {
    const p = patientAt(6);
    eligible(p.id);
    const g = makeGroup("open_psychoeducational");
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      [{ patientId: p.id, status: "present" as const }],
      "test",
    );
    const res = AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "pr",
      perAttendee: { [p.id]: "participated" },
      actor: "test",
    });
    const noteId = res.attendeeNoteIds[0]!;
    const before = AdelanteEHRExt.listClaims().length;
    const claim = AdelanteEHRExt.upsertClaimFromGroupAttendee({
      sessionId: g.id,
      occurrenceStart: start,
      patientId: p.id,
      facilitatorId: g.facilitatorId,
      noteId,
    });
    expect(claim).toBeNull();
    expect(AdelanteEHRExt.listClaims()).toHaveLength(before);
    const note = (AdelanteEHR.getPatient(p.id)?.progressNotes ?? []).find((n) => n.id === noteId);
    expect(note?.groupRef?.billingEligible).toBe(false);

    // …but it DOES show up in the non-billing engagement rollup.
    const engagement = openGroupEngagement();
    expect(engagement.activeGroups).toBeGreaterThanOrEqual(1);
    expect(engagement.enrolledPatients).toBeGreaterThanOrEqual(1);
  });

  it("still bills a clinical pre-authorized group", () => {
    const p = patientAt(7);
    eligible(p.id);
    const g = makeGroup("sud_clinical_preauth");
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      [{ patientId: p.id, status: "present" as const }],
      "test",
    );
    const res = AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "pr",
      perAttendee: { [p.id]: "participated" },
      actor: "test",
    });
    const claim = AdelanteEHRExt.upsertClaimFromGroupAttendee({
      sessionId: g.id,
      occurrenceStart: start,
      patientId: p.id,
      facilitatorId: g.facilitatorId,
      noteId: res.attendeeNoteIds[0]!,
    });
    expect(claim).not.toBeNull();
  });
});

describe("capacity is a real precondition on the self-service path", () => {
  it("rejects a self-service enrollment into a full open group with a clear reason", () => {
    const roster = [patientAt(12), patientAt(13), patientAt(14)];
    for (const p of roster) eligible(p.id);
    const g = makeGroupWithCapacity("open_psychoeducational", 2);
    // Fill to capacity.
    AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: roster[0]!.id });
    AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: roster[1]!.id });
    expect(AdelanteEHR.listGroupEnrollments(g.id)).toHaveLength(2);

    const overbook = roster[2]!;
    expect(() =>
      AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: overbook.id }),
    ).toThrow(/full — 2 of 2 places are taken/);
    // Not a silent no-op: the roster did not grow.
    expect(AdelanteEHR.listGroupEnrollments(g.id)).toHaveLength(2);
    // …and a full group is never even offered for self-booking.
    expect(AdelanteEHR.openGroupsForPatient(overbook.id).map((x) => x.id)).not.toContain(g.id);
  });

  it("blocks the staff path at capacity too, and audits the refusal", () => {
    const roster = [patientAt(15), patientAt(16)];
    for (const p of roster) eligible(p.id);
    const g = makeGroupWithCapacity("sud_clinical_preauth", 1);
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: roster[0]!.id, enrolledBy: "test" });
    expect(() =>
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: roster[1]!.id, enrolledBy: "test" }),
    ).toThrow(/full/);
    const blocked = AdelanteEHR.listAuditEvents({ category: "clinical" }).filter(
      (e) =>
        e.action === "group_enrollment_blocked" &&
        (e.detail as Record<string, unknown>).groupSessionId === g.id,
    );
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect((blocked[0]!.detail as Record<string, unknown>).reasonCode).toBe("at_capacity");
  });

  it("re-enrolling someone already on a full roster is a no-op, not a capacity error", () => {
    const p = patientAt(17);
    eligible(p.id);
    const g = makeGroupWithCapacity("open_psychoeducational", 1);
    const first = AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: p.id });
    const second = AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: p.id });
    expect(second.id).toBe(first.id);
  });
});

describe("group eligibility audit surface", () => {
  it("is nav-registered and gated on the group_sessions record class", () => {
    const item = STAFF_NAV.find((i) => i.to === "/group-audit");
    expect(item).toBeTruthy();
    expect(item!.gate).toEqual({ kind: "record_class", anyOf: ["group_sessions"] });
    expect(canAccess("credentialing_coordinator", "group_sessions").level).toBe("none");
    expect(canAccess("therapist", "group_sessions").level).toBe("write");
  });

  it("records eligibility changes and blocked attempts in the shared audit stream", () => {
    const p = patientAt(18);
    AdelanteEHR.clearGroupEligibility?.(p.id, "reset for test", "test");
    const g = makeGroup("open_psychoeducational");
    expect(() => AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: p.id })).toThrow();
    eligible(p.id);
    const actions = AdelanteEHR.listAuditEvents({ category: "clinical", patientId: p.id }).map(
      (e) => e.action,
    );
    expect(actions).toContain("group_enrollment_blocked");
    expect(actions).toContain("group_eligibility_set");
  });
});

describe("non-billing engagement export rows", () => {
  it("reports per-group attendance for open groups only", () => {
    const p = patientAt(11);
    eligible(p.id);
    const open = makeGroup("open_psychoeducational");
    const sud = makeGroup("sud_clinical_preauth");
    AdelanteEHR.enrollInGroup({ sessionId: open.id, patientId: p.id, enrolledBy: "test" });
    const start = AdelanteEHR.groupOccurrenceStarts(open.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      open.id,
      start,
      [{ patientId: p.id, status: "present" as const }],
      "test",
    );
    const rows = openGroupEngagementRows();
    const ids = rows.map((r) => r.sessionId);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(sud.id);
    const row = rows.find((r) => r.sessionId === open.id)!;
    expect(row.enrolled).toBeGreaterThanOrEqual(1);
    expect(row.capacity).toBe(8);
  });
});

function eligible(patientId: string) {
  AdelanteEHR.setGroupEligibility({
    patientId,
    reason: "placeholder criteria",
    curriculumNeedTag: "placeholder-tag",
    role: "therapist",
    actor: "test",
  });
}
