// §Front-door Phase 3 groundwork — enrollment-code redemption at /start/signup.
import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { getStaffMember } from "@/lib/roles";
import { resolveCfAttribution } from "@/lib/reentry";
import {
  credentialMeta,
  normalizeEnrollmentCode,
  redemptionMessage,
  validateCredentialOnly,
} from "@/lib/signup";

const CF = "s-cf1";

afterEach(() => {
  for (const pid of ["p1", "p2", "p3"]) {
    const ep = AdelanteEHR.activePreReleaseEpisode(pid);
    if (ep)
      AdelanteEHR.closePreReleaseEpisode({
        episodeId: ep.id,
        reason: "test teardown",
        closedBy: "test",
        actorRole: "cf_care_manager",
      });
  }
});

function attribution() {
  const cf = getStaffMember(CF)!;
  return resolveCfAttribution({
    actorStaffId: cf.id,
    actorName: cf.name,
    actorRole: "cf_care_manager",
  }).attribution!;
}

/** Runs the real Phase 2 path end to end so the code under test is the real one. */
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

describe("code entry normalization", () => {
  it("accepts what people actually type", () => {
    expect(normalizeEnrollmentCode("re4k7p92xb")).toBe("RE-4K7P-92XB");
    expect(normalizeEnrollmentCode(" 4K7P 92XB ")).toBe("RE-4K7P-92XB");
    expect(normalizeEnrollmentCode("RE-4K7P-92XB")).toBe("RE-4K7P-92XB");
  });
  it("rejects the wrong shape and the excluded letters", () => {
    expect(normalizeEnrollmentCode("RE-4K7P")).toBeNull();
    expect(normalizeEnrollmentCode("RE-4KIP-92XB")).toBeNull(); // I is never used
    expect(normalizeEnrollmentCode("")).toBeNull();
  });
});

describe("redemption claims the existing record", () => {
  it("links the exact patient the code was issued for and creates no new record", () => {
    const before = AdelanteEHR.listPatients().length;
    const code = issueCode("p1");
    const { patient } = AdelanteEHR.redeemEnrollmentCode({
      code: code.code.toLowerCase(),
      credential: credentialMeta("pin"),
    });
    expect(patient.id).toBe("p1");
    expect(AdelanteEHR.listPatients()).toHaveLength(before);
    expect(AdelanteEHR.getPatient("p1")?.signupCredential?.kind).toBe("pin");
  });

  it("is single-use — a second redemption is rejected and reads as consumed", () => {
    const code = issueCode("p2");
    AdelanteEHR.redeemEnrollmentCode({ code: code.code, credential: credentialMeta("password") });
    expect(AdelanteEHR.enrollmentCodeStatus(code.code)).toBe("consumed");
    expect(AdelanteEHR.getEnrollmentCode(code.code)?.consumedAt).toBeTruthy();
    expect(() =>
      AdelanteEHR.redeemEnrollmentCode({ code: code.code, credential: credentialMeta("pin") }),
    ).toThrow(/consumed/);
  });

  it("refuses an expired code without consuming it", () => {
    const code = issueCode("p3");
    const past = new Date(Date.parse(code.expiresAt) + 1000);
    expect(AdelanteEHR.enrollmentCodeStatus(code.code, past)).toBe("expired");
    expect(() =>
      AdelanteEHR.redeemEnrollmentCode({
        code: code.code,
        credential: credentialMeta("pin"),
        at: past,
      }),
    ).toThrow(/expired/);
    expect(AdelanteEHR.getEnrollmentCode(code.code)?.consumedAt).toBeUndefined();
  });

  it("records an audit event that never contains the code value", () => {
    const code = issueCode("p1");
    AdelanteEHR.redeemEnrollmentCode({ code: code.code, credential: credentialMeta("password") });
    const evt = AdelanteEHR.listAuditEvents().find((e) => e.action === "enrollment_code_redeemed");
    expect(evt?.patientId).toBe("p1");
    expect(JSON.stringify(evt)).not.toContain(code.code);
  });
});

describe("honest, distinguishable failure states", () => {
  it("keeps not-found, expired and already-claimed apart", () => {
    expect(AdelanteEHR.enrollmentCodeStatus("RE-0000-0000")).toBe("unknown");
    const msgs = (["unknown", "expired", "consumed", "malformed"] as const).map(
      (s) => redemptionMessage(s).title,
    );
    expect(new Set(msgs).size).toBe(4);
    // Not-found must not imply anything about having an account.
    expect(redemptionMessage("unknown").body).toMatch(/doesn't tell us anything/);
    // Already-claimed surfaces the "someone else used it" reading rather than hiding it.
    expect(redemptionMessage("consumed").body).toMatch(/someone else/i);
    // Every real failure offers the shared staff fallback; a typo does not.
    expect(redemptionMessage("malformed").offerStaffFallback).toBe(false);
    for (const s of ["unknown", "expired", "consumed"] as const)
      expect(redemptionMessage(s).offerStaffFallback).toBe(true);
  });

  it("reuses the shared credential rules on the redemption branch", () => {
    expect(
      validateCredentialOnly({ credentialKind: "pin", credential: "12", credentialConfirm: "12" })
        .credential,
    ).toBeTruthy();
    expect(
      validateCredentialOnly({
        credentialKind: "password",
        credential: "supersecret1",
        credentialConfirm: "nope",
      }).credentialConfirm,
    ).toBeTruthy();
    expect(
      validateCredentialOnly({
        credentialKind: "password",
        credential: "supersecret1",
        credentialConfirm: "supersecret1",
      }),
    ).toEqual({});
  });
});
