// §CF pre-release intake build 1 — in-custody profile creation and the early,
// required capacity / legal-authority step.
import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR, PRE_RELEASE_FORMS, type CfAttribution } from "@/lib/ehr";
import { getStaffMember } from "@/lib/roles";
import { resolvePopulation } from "@/lib/population";
import { activateAhcdForTest } from "./helpers/ahcdTestActivation";

const CF = "s-cf1";
const cf = () => getStaffMember(CF)!;

const opened: string[] = [];
afterEach(() => {
  for (const id of opened.splice(0)) {
    const ep = AdelanteEHR.getPreReleaseEpisode(id);
    if (ep && ep.status !== "closed")
      AdelanteEHR.closePreReleaseEpisode({
        episodeId: id,
        reason: "test teardown",
        closedBy: "test",
        actorRole: "cf_care_manager",
      });
  }
});

function newIntake(first = "Marco", last = "Silva") {
  const r = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
    firstName: first,
    lastName: last,
    dob: "1990-04-02",
    anticipatedReleaseDate: "2026-11-01",
    cfCareManagerStaffId: cf().id,
    cfCareManagerName: cf().name,
    openedBy: cf().name,
    actorRole: "cf_care_manager",
  });
  opened.push(r.episode.id);
  return r;
}

function attribution(): CfAttribution {
  return { enteredBy: { staffId: cf().id, staffName: cf().name, role: "cf_care_manager" } };
}

describe("in-custody profile creation", () => {
  it("creates the patient and opens the episode as one action", () => {
    const { patient, episode } = newIntake();
    expect(AdelanteEHR.getPatient(patient.id)?.lastName).toBe("Silva");
    expect(episode.patientId).toBe(patient.id);
    expect(AdelanteEHR.activePreReleaseEpisode(patient.id)?.id).toBe(episode.id);
    // Same real task generation as any other episode.
    expect(
      AdelanteEHR.listCaseTasks().filter((t) => t.dedupeKey?.startsWith(`prerelease:${episode.id}:`)),
    ).toHaveLength(PRE_RELEASE_FORMS.length);
  });

  it("classifies the new patient as pre_release_ji immediately", () => {
    const { patient } = newIntake("Nadia", "Okonkwo");
    expect(resolvePopulation(patient.id).track).toBe("pre_release_ji");
  });

  it("refuses a nameless record", () => {
    expect(() =>
      AdelanteEHR.openPreReleaseEpisodeForNewPatient({
        firstName: " ",
        lastName: "",
        anticipatedReleaseDate: "2026-11-01",
        cfCareManagerStaffId: cf().id,
        cfCareManagerName: cf().name,
        openedBy: "test",
        actorRole: "cf_care_manager",
      }),
    ).toThrow(/first and last name/i);
  });
});

describe("capacity step is early and required", () => {
  it("is the first checklist row and starts not_started", () => {
    const { episode } = newIntake();
    const rows = AdelanteEHR.preReleaseChecklist(episode.id);
    expect(rows[0].def.key).toBe("capacity_authority");
    expect(rows[0].status).toBe("not_started");
    expect(AdelanteEHR.preReleaseCapacityState(episode.id).decision.state).toBe("not_determined");
  });

  it("blocks consent-dependent steps before any determination exists", () => {
    const { episode } = newIntake();
    const row = AdelanteEHR.preReleaseChecklist(episode.id).find((r) => r.def.key === "bh_sud_loc")!;
    expect(row.blocked).toMatch(/Capacity has not been determined/);
    expect(() =>
      AdelanteEHR.recordPreReleaseScreener({
        episodeId: episode.id,
        screenerKey: "dast-10",
        answers: Array(10).fill(0),
        attribution: attribution(),
      }),
    ).toThrow(/Capacity has not been determined/);
  });

  it("cannot be satisfied by shadow-capturing it as a form", () => {
    const { episode } = newIntake();
    expect(() =>
      AdelanteEHR.savePreReleaseForm({
        episodeId: episode.id,
        formKey: "capacity_authority",
        values: { anything: "x" },
        complete: true,
        attribution: attribution(),
      }),
    ).toThrow(/capacity determination step/);
  });

  it("requires a recorded basis", () => {
    const { episode } = newIntake();
    expect(() =>
      AdelanteEHR.recordPreReleaseCapacity({
        episodeId: episode.id,
        status: "competent",
        basis: "  ",
        attribution: attribution(),
      }),
    ).toThrow(/basis/i);
  });
});

describe("competent branch", () => {
  it("unblocks consent-dependent steps under self-consent", () => {
    const { episode } = newIntake();
    AdelanteEHR.recordPreReleaseCapacity({
      episodeId: episode.id,
      status: "competent",
      basis: "Oriented, answered for themselves throughout.",
      attribution: attribution(),
    });
    const state = AdelanteEHR.preReleaseCapacityState(episode.id);
    expect(state.decision.state).toBe("self_consent");
    expect(state.decision.requiresSurrogate).toBe(false);
    const rows = AdelanteEHR.preReleaseChecklist(episode.id);
    expect(rows[0].status).toBe("complete");
    expect(rows.find((r) => r.def.key === "bh_sud_loc")!.blocked).toBeUndefined();
    const rec = AdelanteEHR.recordPreReleaseScreener({
      episodeId: episode.id,
      screenerKey: "dast-10",
      answers: Array(10).fill(0),
      attribution: attribution(),
    });
    expect(rec.key).toBe("dast-10");
  });
});

describe("impaired branch — real AHCD path, real invitation, real gate", () => {
  function impaired() {
    const { patient, episode } = newIntake("Dell", "Harrow");
    AdelanteEHR.recordPreReleaseCapacity({
      episodeId: episode.id,
      status: "impaired",
      basis: "Cannot state the purpose of the interview; documented in chart.",
      attribution: attribution(),
    });
    return { patient, episode };
  }

  it("blocks clinical-consent-dependent steps when no legal authority is on file", () => {
    const { episode } = impaired();
    const state = AdelanteEHR.preReleaseCapacityState(episode.id);
    expect(state.decision.state).toBe("no_authority");
    expect(state.decision.canProceed).toBe(false);
    const rows = AdelanteEHR.preReleaseChecklist(episode.id);
    // The capacity row itself is NOT complete — the branch is unresolved.
    expect(rows[0].status).toBe("in_progress");
    for (const key of [
      "bh_sud_loc",
      "informed_consent_prerelease",
      "telehealth_consent",
      "information_sharing_authorization",
    ]) {
      expect(rows.find((r) => r.def.key === key)!.blocked).toMatch(/no AHCD or conservatorship/);
    }
    expect(() =>
      AdelanteEHR.recordPreReleaseScreener({
        episodeId: episode.id,
        screenerKey: "dast-10",
        answers: Array(10).fill(0),
        attribution: attribution(),
      }),
    ).toThrow(/no AHCD or conservatorship/);
  });

  it("identifying an advocate produces a real, traceable invitation", () => {
    const { patient, episode } = impaired();
    const link = AdelanteEHR.identifyPreReleaseAdvocate({
      episodeId: episode.id,
      advocateName: "Ruth Harrow",
      relationship: "sister",
      invitationSentTo: "ruth@example.com",
      invitationChannel: "email",
      expectedAuthorization: "ahcd",
      identifiedBy: cf().name,
      actorRole: "cf_care_manager",
    });
    // A real AdvocateLink from the existing mechanism, retrievable by code.
    expect(link.invitationCode).toMatch(/^ADV-/);
    expect(AdelanteEHR.advocateLinkByCode(link.invitationCode)?.id).toBe(link.id);
    expect(AdelanteEHR.listAdvocateLinks(patient.id).map((l) => l.id)).toContain(link.id);
    expect(
      AdelanteEHR.getPreReleaseCapacity(episode.id)!.identifiedAdvocates.map((a) => a.advocateLinkId),
    ).toEqual([link.id]);
    // Audited on both mechanisms.
    const actions = AdelanteEHR.listAuditEvents()
      .filter((e) => e.patientId === patient.id)
      .map((e) => e.action);
    expect(actions).toContain("advocate_invited");
    expect(actions).toContain("pre_release_advocate_identified");
  });

  it("refuses advocate identification before the capacity question is answered", () => {
    const { episode } = newIntake("Pat", "Nguyen");
    expect(() =>
      AdelanteEHR.identifyPreReleaseAdvocate({
        episodeId: episode.id,
        advocateName: "Someone",
        invitationSentTo: "x@example.com",
        invitationChannel: "email",
        expectedAuthorization: "ahcd",
        identifiedBy: cf().name,
        actorRole: "cf_care_manager",
      }),
    ).toThrow(/capacity determination first/i);
  });

  it("stays blocked while the directive is only identified, and opens only after the real AHCD activation", () => {
    const { episode } = impaired();
    const link = AdelanteEHR.identifyPreReleaseAdvocate({
      episodeId: episode.id,
      advocateName: "Ruth Harrow",
      invitationSentTo: "ruth@example.com",
      invitationChannel: "email",
      expectedAuthorization: "ahcd",
      identifiedBy: cf().name,
      actorRole: "cf_care_manager",
    });
    expect(AdelanteEHR.preReleaseCapacityState(episode.id).decision.state).toBe("surrogate_pending");

    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "ahcd",
      attestedName: "Ruth Harrow",
    });
    // Claimed but dormant — a directive on file is not authority.
    expect(AdelanteEHR.preReleaseCapacityState(episode.id).decision.canProceed).toBe(false);
    expect(() =>
      AdelanteEHR.recordPreReleaseScreener({
        episodeId: episode.id,
        screenerKey: "dast-10",
        answers: Array(10).fill(0),
        attribution: attribution(),
      }),
    ).toThrow(/not in force yet|validation checklist/);

    // The REAL Phase 4.2 checklist + clinician determination.
    activateAhcdForTest(link.id);

    const state = AdelanteEHR.preReleaseCapacityState(episode.id);
    expect(state.decision.state).toBe("surrogate_active");
    expect(state.activeAuthorityLinkId).toBe(link.id);
    const rows = AdelanteEHR.preReleaseChecklist(episode.id);
    expect(rows[0].status).toBe("complete");
    expect(rows.find((r) => r.def.key === "bh_sud_loc")!.blocked).toBeUndefined();
    expect(
      AdelanteEHR.recordPreReleaseScreener({
        episodeId: episode.id,
        screenerKey: "dast-10",
        answers: Array(10).fill(0),
        attribution: attribution(),
      }).key,
    ).toBe("dast-10");
  });

  it("re-closes the gate when the advocate connection is revoked", () => {
    const { episode } = impaired();
    const link = AdelanteEHR.identifyPreReleaseAdvocate({
      episodeId: episode.id,
      advocateName: "Ruth Harrow",
      invitationSentTo: "ruth@example.com",
      invitationChannel: "email",
      expectedAuthorization: "ahcd",
      identifiedBy: cf().name,
      actorRole: "cf_care_manager",
    });
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "ahcd",
      attestedName: "Ruth Harrow",
    });
    activateAhcdForTest(link.id);
    expect(AdelanteEHR.preReleaseCapacityState(episode.id).decision.canProceed).toBe(true);
    AdelanteEHR.revokeAdvocateLink(link.id, cf().name, "Family dispute — authority withdrawn.");
    expect(AdelanteEHR.preReleaseCapacityState(episode.id).decision.canProceed).toBe(false);
  });
});
