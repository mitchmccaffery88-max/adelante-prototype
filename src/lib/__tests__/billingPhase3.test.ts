// §v3.0 Phase 3 — Peer / CHW billing hooks + CHW-ECM mutual exclusivity.
import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";
import { STAFF_ROSTER, isBillableStaff, supervisionStatus } from "../roles";
import {
  CHW_CODES,
  CHW_MAX_UNITS_PER_DAY,
  PEER_CODES,
  PEER_SUPPORT_TAXONOMY,
  activeEcmWindowOn,
} from "../communityBilling";

const patients = () => AdelanteEHR.listPatients();
const chw = () => STAFF_ROSTER.find((s) => s.role === "community_health_worker")!;
const peer = () => STAFF_ROSTER.find((s) => s.role === "peer_specialist")!;

/** A patient with no ECM episode at all. */
function nonEcmPatient() {
  const p = patients().find((x) => !(x.episodes ?? []).some((e) => e.type === "ecm"));
  if (!p) throw new Error("fixture: expected a patient without an ECM episode");
  return p;
}

let n = 0;
const noteId = () => `nt-test-${++n}`;

describe("Peer Specialist billing hook", () => {
  it("generates a real claim on the existing Claims Worklist with H0038", () => {
    const p = patients()[0];
    const id = noteId();
    const claim = AdelanteEHRExt.upsertClaimFromPeerNote({
      patientId: p.id,
      peerNoteId: id,
      staffId: peer().id,
      clinicianId: "c3",
      minutes: 32,
    });
    expect(claim).toBeTruthy();
    expect(claim!.serviceCode).toBe(PEER_CODES.individual);
    expect(claim!.taxonomy).toBe(PEER_SUPPORT_TAXONOMY);
    expect(claim!.units).toBe(3); // 32 min → three 15-minute units
    expect(AdelanteEHRExt.listClaims().some((c) => c.id === claim!.id)).toBe(true);
  });

  it("uses H0025 for group peer support and is idempotent per note", () => {
    const p = patients()[0];
    const id = noteId();
    const a = AdelanteEHRExt.upsertClaimFromPeerNote({
      patientId: p.id, peerNoteId: id, staffId: peer().id, clinicianId: "c3", minutes: 60, mode: "group",
    })!;
    const b = AdelanteEHRExt.upsertClaimFromPeerNote({
      patientId: p.id, peerNoteId: id, staffId: peer().id, clinicianId: "c3", minutes: 60, mode: "group",
    })!;
    expect(a.serviceCode).toBe(PEER_CODES.group);
    expect(b.id).toBe(a.id);
  });

  it("refuses a peer claim from a non-peer role", () => {
    const p = patients()[0];
    expect(
      AdelanteEHRExt.upsertClaimFromPeerNote({
        patientId: p.id, peerNoteId: noteId(), staffId: "s-cm1", clinicianId: "c1", minutes: 30,
      }),
    ).toBeNull();
  });
});

describe("CHW supervision requirement", () => {
  it("requires an enrolled supervising provider, like the trainee/MA links", () => {
    expect(supervisionStatus(chw().id).satisfied).toBe(true);
    expect(isBillableStaff(chw().id)).toBe(true);
  });

  it("blocks the claim when the CHW has no supervising provider", () => {
    const orphan = { id: "s-chw-orphan", name: "Unsupervised CHW", role: "community_health_worker" as const };
    STAFF_ROSTER.push(orphan);
    try {
      expect(isBillableStaff(orphan.id)).toBe(false);
      const p = nonEcmPatient();
      expect(
        AdelanteEHRExt.upsertClaimFromChwNote({
          patientId: p.id, noteId: noteId(), staffId: orphan.id, clinicianId: "c1",
          dateISO: "2026-03-02T10:00:00.000Z", minutes: 30,
        }),
      ).toBeNull();
    } finally {
      STAFF_ROSTER.splice(STAFF_ROSTER.indexOf(orphan), 1);
    }
  });
});

describe("CHW billing outside an ECM window", () => {
  it("creates a claim with G0019 first, then G0022 within the same month", () => {
    const p = nonEcmPatient();
    const first = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id, noteId: noteId(), staffId: chw().id, clinicianId: "c1",
      dateISO: "2026-05-04T10:00:00.000Z", minutes: 30,
    })!;
    expect(first.serviceCode).toBe(CHW_CODES.initiating);
    expect(first.units).toBe(1);
    expect(first.supervisingStaffId).toBe("s-np1");

    const second = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id, noteId: noteId(), staffId: chw().id, clinicianId: "c1",
      dateISO: "2026-05-06T10:00:00.000Z", minutes: 45,
    })!;
    expect(second.serviceCode).toBe(CHW_CODES.additional);
    expect(second.units).toBe(2);
  });

  it("caps a member at 2 hours (four 30-minute units) per day", () => {
    const p = nonEcmPatient();
    const day = "2026-07-09T09:00:00.000Z";
    const a = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id, noteId: noteId(), staffId: chw().id, clinicianId: "c1", dateISO: day, minutes: 180,
    })!;
    expect(a.units).toBe(CHW_MAX_UNITS_PER_DAY); // requested 6 units, truncated to the cap
    const b = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id, noteId: noteId(), staffId: chw().id, clinicianId: "c1", dateISO: day, minutes: 30,
    });
    expect(b).toBeNull();
  });
});

describe("CHW / ECM mutual exclusivity", () => {
  const dayIn = "2026-09-10T10:00:00.000Z";
  let patientId: string;

  beforeEach(() => {
    const p = nonEcmPatient();
    patientId = p.id;
    p.episodes = [
      ...(p.episodes ?? []).filter((e) => e.type !== "ecm"),
      { id: "ep-test-ecm", type: "ecm", state: "active", openedAt: "2026-09-01", closedAt: "2026-09-30" },
    ];
  });

  it("derives the enrollment window from the ECM episode", () => {
    const p = AdelanteEHR.getPatient(patientId)!;
    expect(activeEcmWindowOn(p, dayIn)?.episodeId).toBe("ep-test-ecm");
    expect(activeEcmWindowOn(p, "2026-10-05T10:00:00.000Z")).toBeUndefined();
  });

  it("blocks a CHW claim during the ECM window, with a reason and an audit row", () => {
    const before = AdelanteEHR.listAuditEvents({}).length;
    const claim = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId, noteId: noteId(), staffId: chw().id, clinicianId: "c1", dateISO: dayIn, minutes: 30,
    });
    expect(claim).toBeNull();
    const events = AdelanteEHR.listAuditEvents({});
    expect(events.length).toBeGreaterThan(before);
    const blocked = events.find((e) => e.action === "community_billing_blocked");
    expect(blocked?.detail?.["reasonCode"]).toBe("ecm_concurrent");
    expect(String(blocked?.detail?.["reason"])).toMatch(/cannot be billed concurrently/i);
  });

  it("allows a CHW claim after the ECM window closes", () => {
    const claim = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId, noteId: noteId(), staffId: chw().id, clinicianId: "c1",
      dateISO: "2026-11-04T10:00:00.000Z", minutes: 30,
    });
    expect(claim).toBeTruthy();
    expect(claim!.serviceCode).toBe(CHW_CODES.initiating);
  });

  it("allows a CHW claim when ECM was declined", () => {
    const p = AdelanteEHR.getPatient(patientId)!;
    p.episodes = (p.episodes ?? []).map((e) =>
      e.type === "ecm" ? { ...e, state: "declined" } : e,
    );
    const claim = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId, noteId: noteId(), staffId: chw().id, clinicianId: "c1", dateISO: dayIn, minutes: 30,
    });
    expect(claim).toBeTruthy();
  });

  afterEach(() => {
    const p = AdelanteEHR.getPatient(patientId);
    if (p) p.episodes = (p.episodes ?? []).filter((e) => e.id !== "ep-test-ecm");
  });
});