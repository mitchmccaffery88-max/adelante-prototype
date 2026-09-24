// §Phase 6c — patient group-access text notifications.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR, type GroupCategory } from "../ehr";
import {
  __resetGroupNotifications,
  composeGroupNotification,
  GENERIC_GROUP_NOTIFICATION,
  isGroupNotificationSensitive,
  listGroupNotifications,
  setGroupNotificationTransport,
} from "../groupNotifications";

const STAFF = "test therapist";

function patient(i: number) {
  return AdelanteEHR.listPatients()[i]!;
}

function prep(i: number, opts: { sms: boolean; phone?: string }) {
  const p = patient(i);
  (p as { phone?: string }).phone = opts.phone;
  AdelanteEHR.setConsent(p.id, "sms", opts.sms);
  AdelanteEHR.setGroupEligibility({
    patientId: p.id,
    reason: "placeholder",
    role: "therapist",
    actor: STAFF,
  });
  return p.id;
}

function group(category: GroupCategory, topic = `Topic ${category}`) {
  const start = new Date(Date.now() + 2 * 86400000);
  return AdelanteEHR.createGroupSession({
    topic,
    facilitatorId: AdelanteEHR.listClinicians()[0]!.id,
    serviceType: "therapy_group",
    modality: "in_person",
    category,
    start: start.toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "weekly", daysOfWeek: [start.getDay()] },
    createdBy: STAFF,
  });
}

let transport: ReturnType<typeof vi.fn>;
beforeEach(() => {
  __resetGroupNotifications();
  transport = vi.fn();
  setGroupNotificationTransport(transport);
});

describe("Part 2-safe copy", () => {
  it("only the two non-Part 2 categories get specific copy", () => {
    expect(isGroupNotificationSensitive("sud_clinical_preauth")).toBe(true);
    expect(isGroupNotificationSensitive(undefined)).toBe(true);
    expect(isGroupNotificationSensitive("something_new")).toBe(true);
    expect(isGroupNotificationSensitive("skills_education")).toBe(false);
    expect(isGroupNotificationSensitive("open_psychoeducational")).toBe(false);
  });

  it("generic copy never names the group, category or time", () => {
    const when = new Date(Date.now() + 86400000).toISOString();
    const { body, sensitive } = composeGroupNotification({
      event: "occurrence_rescheduled",
      category: "sud_clinical_preauth",
      topic: "SUD group counseling",
      when,
      newWhen: when,
    });
    expect(sensitive).toBe(true);
    expect(body).toBe(GENERIC_GROUP_NOTIFICATION);
    expect(body).not.toMatch(/SUD|counseling|sud_clinical/i);
    expect(body).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun|AM|PM/);
  });

  it("specific copy names the topic but never a link", () => {
    const { body } = composeGroupNotification({
      event: "enrollment_added",
      category: "skills_education",
      topic: "Skills for life",
    });
    expect(body).toContain("Skills for life");
    expect(body).not.toMatch(/https?:/);
  });
});

describe("triggers, consent and attribution", () => {
  it("enrollment notifies with specific copy and staff attribution", () => {
    const pid = prep(3, { sms: true, phone: "+15595550199" });
    const g = group("skills_education", "Skills 6c");
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: pid, enrolledBy: STAFF });
    const [rec] = listGroupNotifications({ sessionId: g.id });
    expect(rec!.event).toBe("enrollment_added");
    expect(rec!.sensitive).toBe(false);
    expect(rec!.body).toContain("Skills 6c");
    expect(rec!.triggeredBy).toEqual({ actorId: STAFF, kind: "staff" });
    expect(rec!.to).toBe("+15595550199");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("SUD group uses the generic message", () => {
    const pid = prep(4, { sms: true, phone: "+15595550198" });
    const g = group("sud_clinical_preauth", "SUD counseling 6c");
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: pid, enrolledBy: STAFF });
    const [rec] = listGroupNotifications({ sessionId: g.id });
    expect(rec!.sensitive).toBe(true);
    expect(rec!.body).toBe(GENERIC_GROUP_NOTIFICATION);
  });

  it("no consent or no phone → skipped, transport never called", () => {
    const a = prep(5, { sms: false, phone: "+15595550197" });
    const b = prep(6, { sms: true, phone: undefined });
    const g = group("skills_education");
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: a, enrolledBy: STAFF });
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: b, enrolledBy: STAFF });
    const recs = listGroupNotifications({ sessionId: g.id });
    expect(recs.find((r) => r.patientId === a)!.skipReason).toBe("no_sms_consent");
    expect(recs.find((r) => r.patientId === b)!.skipReason).toBe("no_phone");
    expect(recs.every((r) => r.delivery === "skipped" && !r.to)).toBe(true);
    expect(transport).not.toHaveBeenCalled();
  });

  it("end, occurrence cancel/move and session cancel notify every active enrollee", () => {
    const a = prep(3, { sms: true, phone: "+15595550191" });
    const b = prep(4, { sms: true, phone: "+15595550192" });
    const g = group("open_psychoeducational");
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: a, enrolledBy: STAFF });
    const eb = AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: b, enrolledBy: STAFF });
    const [s1, s2] = AdelanteEHR.groupOccurrenceStarts(g.id, 3);
    AdelanteEHR.cancelGroupOccurrence(g.id, s1!, "holiday", STAFF);
    const moved = new Date(Date.parse(s2!) + 3600000).toISOString();
    AdelanteEHR.rescheduleGroupOccurrence(g.id, s2!, moved, "room", STAFF);
    AdelanteEHR.endGroupEnrollment(eb.id, "moved away", STAFF);
    AdelanteEHR.cancelGroupSession(g.id, "program ended", STAFF);
    const events = listGroupNotifications({ sessionId: g.id }).map((r) => `${r.event}:${r.patientId}`);
    expect(events.filter((e) => e.startsWith("occurrence_cancelled"))).toHaveLength(2);
    expect(events.filter((e) => e.startsWith("occurrence_rescheduled"))).toHaveLength(2);
    expect(events).toContain(`enrollment_ended:${b}`);
    expect(events).toEqual(expect.arrayContaining([`session_cancelled:${a}`]));
    expect(events).not.toContain(`session_cancelled:${b}`);
  });

  it("blocked enrollment sends nothing", () => {
    const p = patient(7);
    AdelanteEHR.clearGroupEligibility(p.id, "test", STAFF);
    const g = group("skills_education");
    expect(() =>
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: STAFF }),
    ).toThrow();
    expect(listGroupNotifications({ sessionId: g.id })).toHaveLength(0);
  });
});
