// §v3.0 Phase 4 — Advocate / Family Member.
//
// These tests exist to prove the HARD invariants, not the happy path:
//  - an invitation alone grants nothing,
//  - Collateral without an active ROI grants nothing,
//  - there is no advocate-driven patient lookup anywhere,
//  - an authorized advocate sees the schedule AND NOTHING ELSE,
//  - every access attempt, allowed or denied, is audited.
import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR, COLLATERAL_ROI_CATEGORY } from "@/lib/ehr";
import { advocateAccessDecision } from "@/lib/advocate";

function patientId(): string {
  const p = AdelanteEHR.listPatients()[0];
  if (!p) throw new Error("fixture patient missing");
  return p.id;
}

function invite(pid = patientId()) {
  return AdelanteEHR.createAdvocateInvitation({
    patientId: pid,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: "rosa@example.org",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
}

function advocateAudit(pid: string) {
  return AdelanteEHR.listAuditEvents({ patientId: pid }).filter((e) => e.category === "advocate");
}

describe("advocate — invitation lifecycle", () => {
  it("an unclaimed invitation grants zero access", () => {
    const link = invite();
    const decision = AdelanteEHR.advocateAccess(link.id);
    expect(decision.allowed).toBe(false);
    expect(decision.denyReason).toBe("not_claimed");
    expect(decision.permissions).toEqual([]);
  });

  it("a claim without a confirmed authorization type is impossible", () => {
    const link = invite();
    // The API has no overload that omits the authorization type — the type
    // system enforces it — so the equivalent runtime state is asserted through
    // the pure policy: an active link with no type still denies.
    const decision = advocateAccessDecision({ status: "active", roiCollateralActive: true });
    expect(decision.allowed).toBe(false);
    expect(decision.denyReason).toBe("authorization_not_confirmed");
    expect(AdelanteEHR.getAdvocateLink(link.id)?.authorizationType).toBeUndefined();
  });

  it("rejects a bad, replayed, or revoked code", () => {
    const link = invite();
    expect(() =>
      AdelanteEHR.claimAdvocateInvitation({
        code: "ADV-0000-0000-0000",
        authorizationType: "hipaa_authorization",
        attestedName: "Rosa Ibarra",
      }),
    ).toThrow(/isn't valid/);

    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "hipaa_authorization",
      attestedName: "Rosa Ibarra",
    });
    expect(() =>
      AdelanteEHR.claimAdvocateInvitation({
        code: link.invitationCode,
        authorizationType: "hipaa_authorization",
        attestedName: "Rosa Ibarra",
      }),
    ).toThrow(/already been claimed/);
  });

  it("revocation stops access immediately, everywhere", () => {
    const link = invite();
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "hipaa_authorization",
      attestedName: "Rosa Ibarra",
    });
    expect(AdelanteEHR.advocateAccess(link.id).allowed).toBe(true);
    AdelanteEHR.revokeAdvocateLink(link.id, "Test Patient", "No longer involved");
    const after = AdelanteEHR.advocateAccess(link.id);
    expect(after.allowed).toBe(false);
    expect(after.denyReason).toBe("revoked");
    expect(AdelanteEHR.advocateSchedule(link.id).items).toEqual([]);
  });

  it("revocation requires a reason", () => {
    const link = invite();
    expect(() => AdelanteEHR.revokeAdvocateLink(link.id, "Test Patient", "   ")).toThrow(/reason/i);
  });
});

describe("advocate — authorization-type gates", () => {
  it("Collateral has ZERO access until an active ROI ConsentRecord exists", () => {
    const pid = patientId();
    const link = invite(pid);
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "dhcs_collateral",
      attestedName: "Rosa Ibarra",
    });

    const blocked = AdelanteEHR.advocateAccess(link.id);
    expect(blocked.allowed).toBe(false);
    expect(blocked.denyReason).toBe("roi_missing");
    expect(AdelanteEHR.advocateSchedule(link.id).allowed).toBe(false);

    AdelanteEHR.createConsentRecord({
      patientId: pid,
      formType: "AB133",
      source: "test",
      signedByName: "Test Patient",
      attested: true,
      effectiveDate: "2020-01-01",
      sections: [{ category: COLLATERAL_ROI_CATEGORY, authorized: true }],
      capturedBy: { staffId: "s-cm1", staffName: "Luz Herrera", role: "ecm_provider" },
    });

    expect(AdelanteEHR.advocateAccess(link.id).allowed).toBe(true);
  });

  it("an AHCD is dormant until a physician activates it", () => {
    const link = invite();
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "ahcd",
      attestedName: "Rosa Ibarra",
    });
    expect(AdelanteEHR.advocateAccess(link.id).denyReason).toBe("ahcd_not_activated");

    AdelanteEHR.activateAdvocateAhcd(link.id, "Dr. Reyes");
    expect(AdelanteEHR.advocateAccess(link.id).allowed).toBe(true);
  });

  it("AHCD activation cannot be applied to another authorization type", () => {
    const link = invite();
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "conservatorship",
      attestedName: "Rosa Ibarra",
    });
    expect(() => AdelanteEHR.activateAdvocateAhcd(link.id, "Dr. Reyes")).toThrow(/AHCD/);
  });
});

describe("advocate — no patient lookup exists", () => {
  it("the store exposes no advocate-facing lookup keyed on patient identifiers", () => {
    // A structural test, not "the button isn't there": any function an advocate
    // surface could call to resolve a patient from advocate-supplied identity
    // information would have to be on the store. Assert none exists.
    const forbidden = Object.keys(AdelanteEHR).filter((k) =>
      /^(findPatientBy|matchPatient|searchPatients|lookupPatient|advocateFind|advocateSearch|advocateMatch)/.test(
        k,
      ),
    );
    expect(forbidden).toEqual([]);
  });

  it("the only advocate lookup is by invitation code, and it is not satisfiable by patient data", () => {
    const pid = patientId();
    const patient = AdelanteEHR.getPatient(pid)!;
    invite(pid);
    for (const guess of [patient.id, patient.lastName, patient.dob, patient.phone]) {
      expect(AdelanteEHR.advocateLinkByCode(String(guess))).toBeUndefined();
    }
    expect(AdelanteEHR.advocateLinkByCode("")).toBeUndefined();
  });
});

describe("advocate — access scope is schedule-only", () => {
  function authorized() {
    const pid = patientId();
    const link = invite(pid);
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "hipaa_authorization",
      attestedName: "Rosa Ibarra",
    });
    return { pid, link };
  }

  it("grants exactly one permission and nothing more", () => {
    const { link } = authorized();
    const decision = AdelanteEHR.advocateAccess(link.id);
    expect(decision.permissions).toEqual(["schedule_view"]);
    for (const p of ["care_plan_view", "clinical_notes_view", "messaging"] as const) {
      expect(AdelanteEHR.advocateCan(link.id, p)).toBe(false);
    }
  });

  it("the schedule DTO carries no clinical content", () => {
    const { link } = authorized();
    const { allowed, items } = AdelanteEHR.advocateSchedule(link.id);
    expect(allowed).toBe(true);
    const allowedKeys = new Set([
      "kind",
      "id",
      "start",
      "durationMin",
      "label",
      "modality",
      "locationName",
    ]);
    for (const item of items) {
      for (const key of Object.keys(item)) expect(allowedKeys.has(key)).toBe(true);
      expect(new Date(item.start).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
    }
  });

  it("SUD-track group topics are never exposed", () => {
    const { pid, link } = authorized();
    const sudGroups = AdelanteEHR.groupsForPatient(pid).filter(
      (g) => g.category === "sud_clinical_preauth",
    );
    const topics = new Set(sudGroups.map((g) => g.topic));
    for (const item of AdelanteEHR.advocateSchedule(link.id).items) {
      expect(topics.has(item.label)).toBe(false);
    }
  });
});

describe("advocate — audit", () => {
  it("logs designation, claim, allowed views and denials with identity + authorization", () => {
    const pid = patientId();
    const before = advocateAudit(pid).length;
    const link = invite(pid);

    // Denied read while unclaimed.
    AdelanteEHR.advocateSchedule(link.id);

    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "hipaa_authorization",
      attestedName: "Rosa Ibarra",
    });
    AdelanteEHR.advocateSchedule(link.id);
    AdelanteEHR.revokeAdvocateLink(link.id, "Test Patient", "Done");

    const events = advocateAudit(pid).slice(0, advocateAudit(pid).length - before);
    const actions = events.map((e) => e.action);
    expect(actions).toContain("advocate_invited");
    expect(actions).toContain("advocate_access_denied");
    expect(actions).toContain("advocate_connection_claimed");
    expect(actions).toContain("advocate_schedule_viewed");
    expect(actions).toContain("advocate_access_revoked");

    const viewed = events.find((e) => e.action === "advocate_schedule_viewed")!;
    expect(viewed.detail?.["advocateLinkId"]).toBe(link.id);
    expect(viewed.detail?.["advocateName"]).toBe("Rosa Ibarra");
    expect(viewed.detail?.["authorizationType"]).toBe("hipaa_authorization");
    expect(viewed.detail?.["resource"]).toBe("upcoming_schedule");
    expect(viewed.at).toBeTruthy();
  });

  it("never writes the invitation code to the audit log", () => {
    const pid = patientId();
    const link = invite(pid);
    const serialized = JSON.stringify(advocateAudit(pid));
    expect(serialized).not.toContain(link.invitationCode);
  });
});
