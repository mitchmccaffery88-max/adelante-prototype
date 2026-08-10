// §Front-door Phase 3 — the two-tier helper model.
//
// Covers the four things this pass changed: Tier 1's field is optional with
// no gate, Tier 2 is RBAC-gated off the existing matrix, a Tier 2 redemption
// stamps the OPERATOR into `consumedBy` (the one behaviour change), and the
// Tier 2 surface is nav-discoverable.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  ASSISTED_SIGNUP_ROLES,
  STAFF_ROLES,
  canRunAssistedSignup,
  getStaffMember,
  type StaffRole,
} from "@/lib/roles";
import { STAFF_NAV, canSeeNavEntry } from "@/lib/navSections";
import { resolveNavAccess } from "@/lib/navGuard";
import { resolveCfAttribution } from "@/lib/reentry";
import {
  cleanHelperName,
  credentialMeta,
  helperAuditDetail,
  informalHelper,
  validateSignup,
  type HelperAttribution,
  type SignupInput,
} from "@/lib/signup";

const CF = "s-cf1";

const draft = (over: Partial<SignupInput> = {}): SignupInput => ({
  firstName: "Rosa",
  lastName: "Marin",
  dob: "1990-04-02",
  phone: "+1 555 555 0123",
  email: "",
  preferredLanguage: "en",
  credentialKind: "password",
  credential: "supersecret1",
  credentialConfirm: "supersecret1",
  ...over,
});

function attribution() {
  const cf = getStaffMember(CF)!;
  return resolveCfAttribution({
    actorStaffId: cf.id,
    actorName: cf.name,
    actorRole: "cf_care_manager",
  }).attribution!;
}

/** Real Phase 2 issuance path, so the code under test is the real one. */
function issueCode(patientId: string) {
  const cf = getStaffMember(CF)!;
  const ep = AdelanteEHR.openPreReleaseEpisode({
    patientId,
    anticipatedReleaseDate: "2026-09-01",
    cfCareManagerStaffId: cf.id,
    cfCareManagerName: cf.name,
    openedBy: "test",
    actorRole: "cf_care_manager",
  });
  AdelanteEHR.saveReentryCarePlan({
    episodeId: ep.id,
    housing: { arrangement: "Transitional housing bed — Casa Vista" },
    appointments: [
      {
        kind: "mental_health",
        start: "2026-09-03T15:00:00.000Z",
        providerName: "Dr. Marisol Reyes",
        location: "Adelante Fresno",
        modality: "in_person",
      },
    ],
    attribution: attribution(),
  });
  return AdelanteEHR.completeReentryCarePlan({
    episodeId: ep.id,
    memberSignatureName: "Test Member",
    attested: true,
    attribution: attribution(),
  }).enrollmentCode;
}

describe("Tier 1 — informal helper is genuinely optional", () => {
  it("validates a submission with no helper at all", () => {
    expect(validateSignup(draft())).toEqual({});
    expect(validateSignup(draft({ helperName: undefined }))).toEqual({});
    expect(validateSignup(draft({ helperName: "" }))).toEqual({});
    expect(validateSignup(draft({ helperName: "   " }))).toEqual({});
  });

  it("accepts a helper name without verifying anything about it", () => {
    expect(validateSignup(draft({ helperName: "Some Shelter, no such org" }))).toEqual({});
    expect(cleanHelperName("  Tia Ana  ")).toBe("Tia Ana");
    expect(cleanHelperName("   ")).toBeUndefined();
    expect(informalHelper("")).toBeUndefined();
    expect(informalHelper("Tia Ana")).toEqual({ tier: 1, helperName: "Tia Ana" });
  });

  it("records the helper on the sign-up audit event, marked unverified", () => {
    const created = AdelanteEHR.createPatient({
      firstName: "Tier1",
      lastName: "Signup",
      dob: "1990-01-01",
      signupCredential: credentialMeta("pin"),
      signupAssistedBy: informalHelper("Tia Ana"),
    });
    const evt = AdelanteEHR.listAuditEvents().find(
      (e) => e.patientId === created.id && e.action === "patient_signup_created",
    )!;
    expect(evt).toBeTruthy();
    expect(evt.actorRole).toBe("patient");
    expect(evt.detail).toMatchObject({
      assistedBy: "informal_helper",
      helperTier: 1,
      helperNameUnverified: "Tia Ana",
    });
  });

  it("still logs an unassisted sign-up, and leaves Track A silent", () => {
    const solo = AdelanteEHR.createPatient({
      firstName: "Solo",
      lastName: "Signup",
      signupCredential: credentialMeta("password"),
    });
    const evt = AdelanteEHR.listAuditEvents().find((e) => e.patientId === solo.id)!;
    expect(evt.detail).toMatchObject({ assistedBy: "none" });
    expect(solo.signupAssistedBy).toBeUndefined();

    // Track A / referral conversion: no credential, no helper, no new event.
    const trackA = AdelanteEHR.createPatient({ firstName: "Track", lastName: "A" });
    expect(AdelanteEHR.listAuditEvents().some((e) => e.patientId === trackA.id)).toBe(false);
  });
});

describe("Tier 2 — RBAC gate reuses the existing matrix", () => {
  it("allows exactly the enrollment roles", () => {
    expect([...ASSISTED_SIGNUP_ROLES].sort()).toEqual(
      ["cf_care_manager", "ecm_provider", "peer_specialist", "sys_admin"].sort(),
    );
  });

  it("rejects every other staff role", () => {
    const denied = STAFF_ROLES.map((r) => r.key).filter(
      (r) => !ASSISTED_SIGNUP_ROLES.includes(r),
    );
    expect(denied.length).toBeGreaterThan(0);
    for (const role of denied) {
      expect(canRunAssistedSignup(role)).toBe(false);
      // Deep links are refused too, not just the sidebar.
      expect(resolveNavAccess(role, "/assisted-signup").status).toBe("denied");
    }
  });

  it("is nav-discoverable for the allowed roles", () => {
    const entry = STAFF_NAV.find((e) => e.to === "/assisted-signup")!;
    expect(entry).toBeTruthy();
    for (const role of ASSISTED_SIGNUP_ROLES) {
      expect(canSeeNavEntry(role, entry)).toBe(true);
      expect(resolveNavAccess(role as StaffRole, "/assisted-signup").status).toBe("allowed");
    }
  });
});

describe("Tier 2 redemption stamps the operator, not the patient", () => {
  it("puts the real staff id in consumedBy and audits both identities", () => {
    const patient = AdelanteEHR.createPatient({ firstName: "Claimed", lastName: "ByStaff" });
    const code = issueCode(patient.id);
    const peer = getStaffMember("s-peer1")!;
    const operator: HelperAttribution = {
      tier: 2,
      operatorStaffId: peer.id,
      operatorStaffName: peer.name,
      operatorRole: peer.role,
    };

    const before = AdelanteEHR.listPatients().length;
    const { patient: claimed, enrollmentCode } = AdelanteEHR.redeemEnrollmentCode({
      code: code.code,
      credential: credentialMeta("pin"),
      assistedBy: operator,
    });

    expect(claimed.id).toBe(patient.id);
    expect(AdelanteEHR.listPatients().length).toBe(before); // no duplicate record
    expect(enrollmentCode.consumedBy).toBe(peer.id);
    expect(enrollmentCode.consumedBy).not.toBe(patient.id);

    const evt = AdelanteEHR.listAuditEvents().find(
      (e) => e.patientId === patient.id && e.action === "enrollment_code_redeemed_assisted",
    )!;
    expect(evt.actorId).toBe(peer.id);
    expect(evt.actorRole).toBe("peer_specialist");
    expect(evt.detail).toMatchObject({
      assistedBy: "staff_operator",
      helperTier: 2,
      operatorStaffId: peer.id,
      claimedForPatientId: patient.id,
    });
    // The code value itself is never audited.
    expect(JSON.stringify(evt.detail)).not.toContain(code.code);
  });

  it("Tier 1 redemption is unchanged — the patient consumes their own code", () => {
    const patient = AdelanteEHR.createPatient({ firstName: "Self", lastName: "Claim" });
    const code = issueCode(patient.id);
    const { enrollmentCode } = AdelanteEHR.redeemEnrollmentCode({
      code: code.code,
      credential: credentialMeta("password"),
      assistedBy: informalHelper("Cousin Marta"),
    });
    expect(enrollmentCode.consumedBy).toBe(patient.id);
    const evt = AdelanteEHR.listAuditEvents().find(
      (e) => e.patientId === patient.id && e.action === "enrollment_code_redeemed",
    )!;
    expect(evt.actorRole).toBe("patient");
    expect(evt.detail).toMatchObject({ helperNameUnverified: "Cousin Marta" });
  });
});

describe("helper audit detail shape", () => {
  it("never leaks a Tier 1 name into the Tier 2 keys", () => {
    expect(helperAuditDetail(undefined)).toEqual({ assistedBy: "none" });
    expect(helperAuditDetail({ tier: 1, helperName: "X" }).operatorStaffId).toBeUndefined();
    expect(helperAuditDetail({ tier: 2, operatorStaffId: "s1" }).helperNameUnverified)
      .toBeUndefined();
  });
});
