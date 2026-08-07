// §v3.0 Phase 2 — pre-release episode, form capture, reentry care plan,
// enrollment code, and the AB 133 / consent path split.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AdelanteEHR,
  CONSENT_CATEGORIES,
  PRE_RELEASE_FORMS,
  type ConsentCategory,
} from "@/lib/ehr";
import { canWritePreReleaseForm, getStaffMember } from "@/lib/roles";
import { resolveCfAttribution } from "@/lib/reentry";
import { ab133CoordinationAccess, disclosureAccess } from "@/lib/ab133";

const DIRECT_CF = "s-cf1";
const PROXY_CF = "s-cf2";
const ECM = "s-cm1";

// Only three patients are seeded, and one active episode is allowed per
// patient — close between cases so each test gets a fresh episode.
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

function openEpisode(patientId: string, cfStaffId = DIRECT_CF) {
  const cf = getStaffMember(cfStaffId)!;
  return AdelanteEHR.openPreReleaseEpisode({
    patientId,
    anticipatedReleaseDate: "2026-09-01",
    cfCareManagerStaffId: cf.id,
    cfCareManagerName: cf.name,
    openedBy: "test",
    actorRole: "cf_care_manager",
  });
}

function directAttribution() {
  const cf = getStaffMember(DIRECT_CF)!;
  return resolveCfAttribution({
    actorStaffId: cf.id,
    actorName: cf.name,
    actorRole: "cf_care_manager",
  }).attribution!;
}

describe("pre-release episode + four form categories", () => {
  it("generates one trackable worklist task per form, tied to the episode", () => {
    const ep = openEpisode("p1");
    const tasks = AdelanteEHR.listCaseTasks().filter((t) =>
      t.dedupeKey?.startsWith(`prerelease:${ep.id}:`),
    );
    expect(tasks).toHaveLength(PRE_RELEASE_FORMS.length);
    expect(tasks.every((t) => t.taskType === "pre_release_form")).toBe(true);
    // Reuses CaseTask, not a parallel mechanism.
    expect(tasks.every((t) => t.allowedRoles?.includes("cf_care_manager"))).toBe(true);
  });

  it("covers all four categories", () => {
    const cats = new Set(PRE_RELEASE_FORMS.map((f) => f.category));
    expect([...cats].sort()).toEqual([
      "clinical_assessment",
      "medi_cal_enrollment",
      "release_consent",
      "transition_planning",
    ]);
  });

  it("captures structured Medi-Cal fields and completes the tracking task", () => {
    const ep = openEpisode("p2");
    const rec = AdelanteEHR.savePreReleaseForm({
      episodeId: ep.id,
      formKey: "pre_release_screening",
      values: { currentlyEnrolled: true, cin: "99887766A", anticipatedReleaseDate: "2026-09-01" },
      complete: true,
      attribution: directAttribution(),
    });
    expect(rec.status).toBe("complete");
    expect(rec.values["cin"]).toBe("99887766A");
    const task = AdelanteEHR.preReleaseTaskFor(ep.id, "pre_release_screening")!;
    expect(task.status).toBe("done");
  });

  it("refuses completion when a required placeholder field is missing", () => {
    const ep = openEpisode("p3");
    expect(() =>
      AdelanteEHR.savePreReleaseForm({
        episodeId: ep.id,
        formKey: "ssapp",
        values: {},
        complete: true,
        attribution: directAttribution(),
      }),
    ).toThrow(/Required before completion/);
  });

  it("refuses to shadow-capture consent forms as loose fields", () => {
    const ep = openEpisode("p1");
    expect(() =>
      AdelanteEHR.savePreReleaseForm({
        episodeId: ep.id,
        formKey: "telehealth_consent",
        values: { anything: "x" },
        complete: true,
        attribution: directAttribution(),
      }),
    ).toThrow(/consent ledger/);
  });

  it("derives release & consent status from the ConsentRecord ledger", () => {
    const ep = openEpisode("p2");
    const before = AdelanteEHR.preReleaseChecklist(ep.id).find(
      (r) => r.def.key === "informed_consent_prerelease",
    )!;
    expect(before.status).toBe("not_started");
    AdelanteEHR.createConsentRecord({
      patientId: ep.patientId,
      formType: "AB133",
      source: "test",
      signedByName: "Test Member",
      attested: true,
      effectiveDate: "2026-01-01",
      sections: [{ category: "pre_release_services", authorized: true }],
      capturedBy: { staffName: "test", role: "cf_care_manager" },
    });
    const after = AdelanteEHR.preReleaseChecklist(ep.id).find(
      (r) => r.def.key === "informed_consent_prerelease",
    )!;
    expect(after.status).toBe("complete");
    expect(after.task?.status).toBe("done");
  });

  it("registers the three new consent categories as real ASCMI placeholders", () => {
    const keys = CONSENT_CATEGORIES.map((c) => c.key);
    for (const k of [
      "pre_release_services",
      "telehealth_services",
      "information_sharing_disclosure",
    ] as ConsentCategory[]) {
      expect(keys).toContain(k);
      expect(CONSENT_CATEGORIES.find((c) => c.key === k)!.label).toMatch(/placeholder/i);
    }
  });
});

describe("eligibility write scope", () => {
  it("gives CF Care Manager the narrow pre-release write path, not the class", () => {
    expect(canWritePreReleaseForm("cf_care_manager", "medi_cal_enrollment").allowed).toBe(true);
    expect(canWritePreReleaseForm("cf_care_manager", "clinical_assessment").allowed).toBe(true);
    // Consent instruments are never keyed here.
    expect(canWritePreReleaseForm("cf_care_manager", "release_consent").allowed).toBe(false);
    // Unrelated roles do not inherit it.
    expect(canWritePreReleaseForm("therapist", "medi_cal_enrollment").allowed).toBe(false);
  });
});

describe("direct vs proxy CF access (Phase 1 model)", () => {
  it("a direct-login CF Care Manager authors their own rows", () => {
    const r = resolveCfAttribution({
      actorStaffId: DIRECT_CF,
      actorName: "Rosa Delgado",
      actorRole: "cf_care_manager",
    });
    expect(r.ok).toBe(true);
    expect(r.attribution?.attributedTo).toBeUndefined();
  });

  it("an ECM Provider may key rows for a proxy-mode CF Care Manager, recording both", () => {
    const ep = openEpisode("p1", PROXY_CF);
    const r = resolveCfAttribution({
      actorStaffId: ECM,
      actorName: "Luz Herrera",
      actorRole: "ecm_provider",
      onBehalfOfStaffId: PROXY_CF,
    });
    expect(r.ok).toBe(true);
    const rec = AdelanteEHR.savePreReleaseForm({
      episodeId: ep.id,
      formKey: "dhcs_hra",
      values: { riskTier: "High" },
      complete: false,
      attribution: r.attribution!,
    });
    expect(rec.attribution.enteredBy.staffName).toBe("Luz Herrera");
    expect(rec.attribution.attributedTo?.staffId).toBe(PROXY_CF);
    // Retrievable by either party — same episode-scoped read.
    expect(AdelanteEHR.getPreReleaseForm(ep.id, "dhcs_hra")?.id).toBe(rec.id);
  });

  it("refuses proxy entry for a direct-login CF Care Manager", () => {
    const r = resolveCfAttribution({
      actorStaffId: ECM,
      actorName: "Luz Herrera",
      actorRole: "ecm_provider",
      onBehalfOfStaffId: DIRECT_CF,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/logs in directly/);
  });
});

describe("Person-Centered Reentry Care Plan", () => {
  const goodPlan = (episodeId: string) =>
    AdelanteEHR.saveReentryCarePlan({
      episodeId,
      housing: { arrangement: "Transitional housing bed — Casa Vista" },
      appointments: [
        {
          kind: "mental_health",
          start: "2026-09-03T15:00:00.000Z",
          providerName: "Dr. Marisol Reyes",
          location: "Adelante Fresno",
          modality: "in_person",
        },
        {
          kind: "med_management",
          start: "2026-09-04T17:00:00.000Z",
          providerName: "Dr. R. Bagga",
          location: "Telehealth",
          modality: "video",
        },
      ],
      pharmacy: { name: "Valley Pharmacy" },
      dmeNeeds: ["Cane"],
      attribution: directAttribution(),
    });

  it("is a queryable structured record the ECM Provider reads at D0", () => {
    const ep = openEpisode("p3");
    goodPlan(ep.id);
    const read = AdelanteEHR.reentryCarePlanForPatient(ep.patientId)!;
    expect(read.appointments).toHaveLength(2);
    expect(read.housing.arrangement).toMatch(/Casa Vista/);
    expect(read.appointments[0].providerName).toBe("Dr. Marisol Reyes");
  });

  it("rejects referral-style appointments with no real date or provider", () => {
    const ep = openEpisode("p1");
    AdelanteEHR.saveReentryCarePlan({
      episodeId: ep.id,
      housing: { arrangement: "Family" },
      appointments: [
        { kind: "sud", start: "", providerName: "", location: "TBD", modality: "in_person" },
      ],
      attribution: directAttribution(),
    });
    expect(() =>
      AdelanteEHR.completeReentryCarePlan({
        episodeId: ep.id,
        memberSignatureName: "Test Member",
        attested: true,
        attribution: directAttribution(),
      }),
    ).toThrow(/real date\/time and provider/);
  });

  it("requires member attestation and signature", () => {
    const ep = openEpisode("p2");
    goodPlan(ep.id);
    expect(() =>
      AdelanteEHR.completeReentryCarePlan({
        episodeId: ep.id,
        memberSignatureName: "Test Member",
        attested: false,
        attribution: directAttribution(),
      }),
    ).toThrow(/attestation/i);
  });

  it("issues a retrievable, unique, time-bounded enrollment code on completion", () => {
    const ep = openEpisode("p3");
    goodPlan(ep.id);
    const { plan, enrollmentCode } = AdelanteEHR.completeReentryCarePlan({
      episodeId: ep.id,
      memberSignatureName: "Test Member",
      attested: true,
      attribution: directAttribution(),
    });
    expect(plan.status).toBe("completed");
    expect(enrollmentCode.code).toMatch(/^RE-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(plan.enrollmentCode).toBe(enrollmentCode.code);
    // Retrievable after the fact, which is all this phase must guarantee.
    expect(AdelanteEHR.getEnrollmentCode(enrollmentCode.code)?.patientId).toBe(ep.patientId);
    expect(AdelanteEHR.enrollmentCodeStatus(enrollmentCode.code)).toBe("valid");
    const expired = new Date(Date.parse(enrollmentCode.expiresAt) + 1000);
    expect(AdelanteEHR.enrollmentCodeStatus(enrollmentCode.code, expired)).toBe("expired");
    // Transition-planning task closes with it.
    expect(AdelanteEHR.preReleaseTaskFor(ep.id, "reentry_care_plan")?.status).toBe("done");
  });

  it("locks the plan once member-signed", () => {
    const ep = openEpisode("p1");
    goodPlan(ep.id);
    AdelanteEHR.completeReentryCarePlan({
      episodeId: ep.id,
      memberSignatureName: "Test Member",
      attested: true,
      attribution: directAttribution(),
    });
    expect(() => goodPlan(ep.id)).toThrow(/no longer be edited/);
  });
});

describe("AB 133 exemption vs consent-required disclosure — different code paths", () => {
  const patientId = "p2";

  it("AB 133 coordination never consults the consent ledger", () => {
    const spy = vi.spyOn(AdelanteEHR, "isConsentCategoryAuthorized");
    const activeSpy = vi.spyOn(AdelanteEHR, "activeConsentRecord");
    const decision = ab133CoordinationAccess({
      dataset: "medi_cal_eligibility",
      actorRole: "cf_care_manager",
      recipientRole: "ecm_provider",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.gate).toBe("ab133_exemption");
    expect(decision.consentChecked).toBe(false);
    // The load-bearing assertion: the consent mechanism was not invoked at all.
    expect(spy).not.toHaveBeenCalled();
    expect(activeSpy).not.toHaveBeenCalled();
    spy.mockRestore();
    activeSpy.mockRestore();
  });

  it("Part 2 SUD content does consult the ledger, and denies without authorization", () => {
    const spy = vi.spyOn(AdelanteEHR, "isConsentCategoryAuthorized");
    const decision = disclosureAccess({
      patientId,
      kind: "part2_sud",
      actorRole: "cf_care_manager",
    });
    expect(decision.gate).toBe("consent_record");
    expect(decision.consentChecked).toBe(true);
    expect(spy).toHaveBeenCalledWith(patientId, "sud_treatment", expect.any(Date));
    spy.mockRestore();
  });

  it("third-party disclosure requires the Information Sharing authorization category", () => {
    const pid = "p3";
    const denied = disclosureAccess({ pid: undefined, patientId: pid, kind: "third_party", actorRole: "ecm_provider" } as never);
    expect(denied.allowed).toBe(false);
    AdelanteEHR.createConsentRecord({
      patientId: pid,
      formType: "NonAB133",
      source: "test",
      signedByName: "Test Member",
      attested: true,
      effectiveDate: "2026-01-01",
      sections: [{ category: "information_sharing_disclosure", authorized: true }],
      capturedBy: { staffName: "test", role: "ecm_provider" },
    });
    const allowed = disclosureAccess({
      patientId: pid,
      kind: "third_party",
      actorRole: "ecm_provider",
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.gate).toBe("consent_record");
  });

  it("the same actor pair is exempt for coordination yet blocked for Part 2 — same call site, different mechanism", () => {
    const pid = "p9";
    const coordination = ab133CoordinationAccess({
      dataset: "reentry_care_plan",
      actorRole: "cf_care_manager",
      recipientRole: "ecm_provider",
    });
    const part2 = disclosureAccess({ patientId: pid, kind: "part2_sud", actorRole: "cf_care_manager" });
    expect(coordination.allowed).toBe(true);
    expect(part2.allowed).toBe(false);
    expect(coordination.gate).not.toBe(part2.gate);
  });

  it("a third party is refused on the AB 133 path without ever reaching consent", () => {
    const spy = vi.spyOn(AdelanteEHR, "isConsentCategoryAuthorized");
    const decision = ab133CoordinationAccess({
      dataset: "identity",
      actorRole: "cf_care_manager",
      recipientRole: "billing",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.consentChecked).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
