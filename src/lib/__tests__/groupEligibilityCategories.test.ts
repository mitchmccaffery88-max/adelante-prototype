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

/**
 * Full enroll → attend → document → bill cycle for one occurrence, so every
 * billing test exercises the real write path rather than a stubbed claim.
 */
function billOccurrence(category: GroupCategory, roster: { id: string }[]) {
  for (const p of roster) eligible(p.id);
  const group = makeGroup(category);
  for (const p of roster)
    AdelanteEHR.enrollInGroup({ sessionId: group.id, patientId: p.id, enrolledBy: "test" });
  const start = AdelanteEHR.groupOccurrenceStarts(group.id, 1)[0]!;
  AdelanteEHR.recordGroupAttendance(
    group.id,
    start,
    roster.map((p) => ({ patientId: p.id, status: "present" as const })),
    "test",
  );
  AdelanteEHR.documentGroupOccurrence({
    sessionId: group.id,
    occurrenceStart: start,
    facilitatorId: group.facilitatorId,
    topicCovered: "t",
    groupProcess: "pr",
    perAttendee: Object.fromEntries(roster.map((p) => [p.id, "participated"])),
    actor: "test",
  });
  const occ = AdelanteEHR.getGroupOccurrence(group.id, start)!;
  const claims = roster.map((p) =>
    AdelanteEHRExt.upsertClaimFromGroupAttendee({
      sessionId: group.id,
      occurrenceStart: start,
      patientId: p.id,
      facilitatorId: group.facilitatorId,
      noteId: occ.attendeeNoteIds[p.id]!,
    }),
  );
  const notes = roster.map((p) =>
    (AdelanteEHR.getPatient(p.id)?.progressNotes ?? []).find(
      (n) => n.id === occ.attendeeNoteIds[p.id],
    ),
  );
  return { group, start, claims, notes };
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

  it("still bills a clinical pre-authorized group with H0005", () => {
    const { claims } = billOccurrence("sud_clinical_preauth", [patientAt(7), patientAt(8)]);
    expect(claims[0]).not.toBeNull();
    expect(claims[0]!.serviceCode).toBe("H0005");
  });

  it("bills a skills_education group with H2014 through the same write path", () => {
    const { claims, notes } = billOccurrence("skills_education", [patientAt(9), patientAt(10)]);
    expect(claims).toHaveLength(2);
    for (const c of claims) {
      expect(c).not.toBeNull();
      expect(c!.serviceCode).toBe("H2014");
      // Exact same encounterId pattern H0005 already uses — not new logic.
      expect(c!.encounterId.startsWith("group:")).toBe(true);
    }
    for (const n of notes) {
      expect(n?.groupRef?.billingEligible).toBe(true);
      expect(n?.groupRef?.billingCode).toBe("H2014");
    }
  });
});

describe("under-2 attendance is non-billable at the occurrence level", () => {
  for (const cat of ["sud_clinical_preauth", "skills_education"] as GroupCategory[]) {
    it(`creates no claim for a 1-attendee ${cat} occurrence, but the occurrence still exists`, () => {
      const before = AdelanteEHRExt.listClaims().length;
      const { claims, notes, group, start } = billOccurrence(cat, [patientAt(20)]);
      expect(claims.every((c) => c === null)).toBe(true);
      expect(AdelanteEHRExt.listClaims()).toHaveLength(before);
      expect(notes[0]?.groupRef?.billingEligible).toBe(false);
      // The occurrence itself is untouched: documented, attendance intact.
      const occ = AdelanteEHR.getGroupOccurrence(group.id, start);
      expect(occ?.sharedNote).toBeTruthy();
      expect(occ?.attendance).toHaveLength(1);
    });
  }
});

describe("capacity is capped at the DHCS regulatory maximum", () => {
  it("refuses a capacity above 12 on create and on edit", () => {
    expect(() => makeGroupWithCapacity("skills_education", 13)).toThrow(/cannot exceed 12/i);
    const g = makeGroupWithCapacity("skills_education", 12);
    expect(() => AdelanteEHR.updateGroupSession(g.id, { capacity: 20 }, "test")).toThrow(
      /cannot exceed 12/i,
    );
    // A lower local cap is allowed.
    expect(AdelanteEHR.updateGroupSession(g.id, { capacity: 6 }, "test").capacity).toBe(6);
  });

  it("refuses a capacity below the DHCS minimum of 2", () => {
    expect(() => makeGroupWithCapacity("skills_education", 1)).toThrow(/at least 2/i);
  });
});

describe("skills_education is self-service but billable", () => {
  it("is offered for self-booking and accepts a patient-initiated enrollment", () => {
    const p = patientAt(11);
    eligible(p.id);
    const g = makeGroup("skills_education");
    expect(AdelanteEHR.openGroupsForPatient(p.id).map((x) => x.id)).toContain(g.id);
    expect(AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId: p.id }).patientId).toBe(p.id);
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
    const roster = [patientAt(15), patientAt(16), patientAt(19)];
    for (const p of roster) eligible(p.id);
    const g = makeGroupWithCapacity("sud_clinical_preauth", 2);
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: roster[0]!.id, enrolledBy: "test" });
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: roster[1]!.id, enrolledBy: "test" });
    expect(() =>
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: roster[2]!.id, enrolledBy: "test" }),
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
    const g = makeGroupWithCapacity("open_psychoeducational", 2);
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

// §Group sessions — "concurrency" and capacity.
//
// HONEST SCOPE: this store is a synchronous in-memory JS module on a single
// thread. `enrollInGroup` runs check-then-write with NO await inside, so the
// JS event loop cannot interleave two calls mid-transaction — two callers can
// never both read "1 seat left" before either writes. That property is what
// this test pins: it is a re-entrancy/atomicity test, NOT proof of protection
// against real concurrent writers.
//
// REAL GAP (documented, not fixable here): there is no optimistic locking,
// version column or transaction anywhere in the data layer. On a real backend
// with two processes, or if `assertEnrollmentAllowed`/`enrollInGroup` ever
// gained an `await` between the capacity read and the roster write, this group
// COULD be overbooked. Any future persistence backend must enforce capacity in
// a transaction (or a unique/partial index), not in application code.
describe("capacity under interleaved enrollment attempts", () => {
  it("only one of two simultaneous attempts takes the last seat", async () => {
    const clinician = AdelanteEHR.listClinicians()[0]!;
    const g = AdelanteEHR.createGroupSession({
      topic: "Last seat (placeholder)",
      facilitatorId: clinician.id,
      serviceType: "therapy_group",
      modality: "in_person",
      category: "open_psychoeducational",
      start: new Date(Date.now() + 86400000).toISOString(),
      durationMin: 60,
      capacity: 2,
      recurrence: { kind: "weekly", daysOfWeek: [new Date().getDay()] },
      createdBy: "test",
    });
    const [a, b, c] = AdelanteEHR.listPatients();
    for (const p of [a!, b!, c!])
      AdelanteEHR.setGroupEligibility({
        patientId: p.id,
        reason: "placeholder criteria",
        role: "therapist",
        actor: "test",
      });
    // Fill to exactly one remaining seat.
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: a!.id, enrolledBy: "test" });
    expect(AdelanteEHR.listGroupEnrollments(g.id)).toHaveLength(1);

    // Two attempts dispatched together, each yielding to the event loop before
    // it calls the store — the only interleaving this runtime can produce.
    const attempt = async (patientId: string) => {
      await Promise.resolve();
      return AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId });
    };
    const results = await Promise.allSettled([attempt(b!.id), attempt(c!.id)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(String(failed[0]!.reason)).toContain("full");
    expect(AdelanteEHR.listGroupEnrollments(g.id)).toHaveLength(2);
    // The loser is audited as a blocked attempt, not a silent drop.
    const blocked = AdelanteEHR.listAuditEvents({ category: "clinical" }).filter(
      (e) => e.action === "group_enrollment_blocked" && e.detail?.["groupSessionId"] === g.id,
    );
    expect(blocked.length).toBe(1);
  });
});

// §Group sessions — /group-audit date-range filter uses listAuditEvents
// since/until (same params the admin audit log uses); this pins that the
// range genuinely narrows the group-eligibility slice.
describe("group audit date-range narrowing", () => {
  it("since/until include and exclude eligibility events by timestamp", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    AdelanteEHR.setGroupEligibility({
      patientId: p.id,
      reason: "probe",
      role: "therapist",
      curriculumNeedTag: "date-filter-probe",
      actor: "test",
    });
    const mine = () =>
      AdelanteEHR.listAuditEvents({ category: "clinical", patientId: p.id }).filter(
        (e) => e.action === "group_eligibility_set" &&
          e.detail?.["curriculumNeedTag"] === "date-filter-probe",
      );
    expect(mine().length).toBe(1);
    const inRange = AdelanteEHR.listAuditEvents({
      category: "clinical",
      patientId: p.id,
      since: new Date(Date.now() - 86400000).toISOString(),
      until: new Date(Date.now() + 86400000).toISOString(),
    }).filter((e) => e.detail?.["curriculumNeedTag"] === "date-filter-probe");
    expect(inRange.length).toBe(1);
    const outOfRange = AdelanteEHR.listAuditEvents({
      category: "clinical",
      patientId: p.id,
      since: new Date(Date.now() + 86400000).toISOString(),
    }).filter((e) => e.detail?.["curriculumNeedTag"] === "date-filter-probe");
    expect(outOfRange.length).toBe(0);
  });
});
