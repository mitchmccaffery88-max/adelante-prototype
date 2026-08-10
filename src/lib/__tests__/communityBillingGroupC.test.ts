// §Group C — CHW supervising-provider selection, block-reason provenance and
// the Claims Worklist filter predicates.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";
import { STAFF_ROSTER, LPHA_SUPERVISOR_ROLES } from "../roles";
import {
  CHW_CODES,
  PEER_CODES,
  eligibleSupervisingProviders,
  validateSupervisingProvider,
} from "../communityBilling";

const chw = () => STAFF_ROSTER.find((s) => s.role === "community_health_worker")!;
const patients = () => AdelanteEHR.listPatients();

function nonEcmPatient() {
  const p = patients().find((x) => !(x.episodes ?? []).some((e) => e.type === "ecm"));
  if (!p) throw new Error("fixture: expected a patient without an ECM episode");
  return p;
}

let n = 0;
const noteId = () => `nt-groupc-${++n}`;

describe("supervising-provider selection reuses the LPHA-tier rule", () => {
  it("only offers LPHA-tier staff as options", () => {
    const opts = eligibleSupervisingProviders();
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((s) => LPHA_SUPERVISOR_ROLES.includes(s.role))).toBe(true);
  });

  it("refuses an empty selection and a non-LPHA selection with distinct codes", () => {
    expect(validateSupervisingProvider(null).reasonCode).toBe("no_supervising_provider");
    expect(validateSupervisingProvider("").reasonCode).toBe("no_supervising_provider");
    const nonLpha = STAFF_ROSTER.find((s) => !LPHA_SUPERVISOR_ROLES.includes(s.role))!;
    expect(validateSupervisingProvider(nonLpha.id).reasonCode).toBe("supervisor_not_lpha");
    const lpha = eligibleSupervisingProviders()[0]!;
    expect(validateSupervisingProvider(lpha.id).ok).toBe(true);
  });
});

describe("CHW claim stamping at note/claim time", () => {
  it("never stamps and never bills when no supervisor was selected", () => {
    const p = nonEcmPatient();
    const id = noteId();
    const claim = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id,
      noteId: id,
      staffId: chw().id, // has a standing link — the explicit refusal still wins
      clinicianId: "c1",
      dateISO: "2026-04-02T10:00:00.000Z",
      minutes: 30,
      supervisingStaffId: null,
    });
    expect(claim).toBeNull();
    expect(
      AdelanteEHRExt.listClaims().some((c) => c.encounterId.includes(id)),
    ).toBe(false);
    const block = AdelanteEHR.lastCommunityBillingBlock({
      patientId: p.id,
      service: "chw_services",
      noteId: id,
    });
    expect(block?.reasonCode).toBe("no_supervising_provider");
  });

  it("refuses a non-LPHA selection", () => {
    const p = nonEcmPatient();
    const id = noteId();
    const nonLpha = STAFF_ROSTER.find((s) => !LPHA_SUPERVISOR_ROLES.includes(s.role))!;
    expect(
      AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-04-03T10:00:00.000Z", minutes: 30, supervisingStaffId: nonLpha.id,
      }),
    ).toBeNull();
    expect(
      AdelanteEHR.lastCommunityBillingBlock({ patientId: p.id, noteId: id })?.reasonCode,
    ).toBe("supervisor_not_lpha");
  });

  it("stamps the selected LPHA provider on the claim", () => {
    const p = nonEcmPatient();
    const lpha = eligibleSupervisingProviders()[0]!;
    const claim = AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id, noteId: noteId(), staffId: chw().id, clinicianId: "c1",
      dateISO: "2026-04-04T10:00:00.000Z", minutes: 30, supervisingStaffId: lpha.id,
    });
    expect(claim).toBeTruthy();
    expect(claim!.supervisingStaffId).toBe(lpha.id);
  });
});

describe("block banner reads the real recorded reason", () => {
  it("returns the ECM exclusivity reasonCode captured at block time", () => {
    const p = nonEcmPatient();
    const original = p.episodes ?? [];
    p.episodes = [
      ...original.filter((e) => e.type !== "ecm"),
      { id: "ep-groupc-ecm", type: "ecm", state: "active", openedAt: "2026-06-01", closedAt: "2026-06-30" },
    ];
    const id = noteId();
    const lpha = eligibleSupervisingProviders()[0]!;
    try {
      const claim = AdelanteEHRExt.upsertClaimFromChwNote({
        patientId: p.id, noteId: id, staffId: chw().id, clinicianId: "c1",
        dateISO: "2026-06-10T10:00:00.000Z", minutes: 30, supervisingStaffId: lpha.id,
      });
      expect(claim).toBeNull();
      const block = AdelanteEHR.lastCommunityBillingBlock({
        patientId: p.id, service: "chw_services", noteId: id,
      });
      // The banner shows the machine code AND the reason string the rule wrote
      // — not generic copy.
      expect(block?.reasonCode).toBe("ecm_concurrent");
      expect(block?.reason).toMatch(/cannot be billed concurrently with ECM/i);
      expect(block?.reason).toMatch(/ep-groupc-ecm/);
    } finally {
      p.episodes = original.filter((e) => e.id !== "ep-groupc-ecm");
    }
  });

  it("scopes the lookup to one note", () => {
    const p = nonEcmPatient();
    expect(
      AdelanteEHR.lastCommunityBillingBlock({ patientId: p.id, noteId: "nt-never-blocked" }),
    ).toBeUndefined();
  });
});

describe("Claims Worklist service-line filters", () => {
  const PEER_LIST: string[] = [PEER_CODES.individual, PEER_CODES.group];
  const CHW_LIST: string[] = [CHW_CODES.initiating, CHW_CODES.additional];

  it("narrows to peer-only and CHW-only claims by the existing serviceCode field", () => {
    const p = nonEcmPatient();
    const peer = STAFF_ROSTER.find((s) => s.role === "peer_specialist")!;
    const lpha = eligibleSupervisingProviders()[0]!;
    AdelanteEHRExt.upsertClaimFromPeerNote({
      patientId: p.id, peerNoteId: noteId(), staffId: peer.id, clinicianId: "c3", minutes: 30,
    });
    AdelanteEHRExt.upsertClaimFromChwNote({
      patientId: p.id, noteId: noteId(), staffId: chw().id, clinicianId: "c1",
      dateISO: "2026-08-04T10:00:00.000Z", minutes: 30, supervisingStaffId: lpha.id,
    });
    const all = AdelanteEHRExt.listClaims();
    const peerOnly = all.filter((c) => PEER_LIST.includes(c.serviceCode ?? ""));
    const chwOnly = all.filter((c) => CHW_LIST.includes(c.serviceCode ?? ""));
    expect(peerOnly.length).toBeGreaterThan(0);
    expect(chwOnly.length).toBeGreaterThan(0);
    expect(peerOnly.some((c) => chwOnly.includes(c))).toBe(false);
    expect(peerOnly.length + chwOnly.length).toBeLessThan(all.length + 1);
  });
});
