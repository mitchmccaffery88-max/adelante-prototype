// §Pre-release build 2 — real AUDIT-10 / DAST-10 reuse + the real AHC-HRSN
// SDOH sibling instrument, both administered inside a pre-release episode.
//
// The point of these tests is SAMENESS: a screener administered from
// pre-release must land in the identical place, with the identical shape, as
// one administered at intake — no parallel scoring, no parallel storage.
import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR, PRE_RELEASE_FORMS, type CfAttribution } from "@/lib/ehr";
import { AHC_HRSN, SCREENERS, scoreScreener, severityFor } from "@/lib/screeners";
import { getStaffMember } from "@/lib/roles";
import { activateAhcdForTest } from "./helpers/ahcdTestActivation";

const cf = () => getStaffMember("s-cf1")!;
const attribution = (): CfAttribution => ({
  enteredBy: { staffId: cf().id, staffName: cf().name, role: "cf_care_manager" },
});

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

function competentIntake(first: string, last: string) {
  const r = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
    firstName: first,
    lastName: last,
    dob: "1988-02-11",
    anticipatedReleaseDate: "2026-11-01",
    cfCareManagerStaffId: cf().id,
    cfCareManagerName: cf().name,
    openedBy: cf().name,
    actorRole: "cf_care_manager",
  });
  opened.push(r.episode.id);
  AdelanteEHR.recordPreReleaseCapacity({
    episodeId: r.episode.id,
    status: "competent",
    basis: "Oriented; explains the purpose of the interview.",
    attribution: attribution(),
  });
  return r;
}

/** AUDIT-10 answers totalling 12 — a real "risky / hazardous" positive. */
const AUDIT_ANSWERS = [3, 2, 2, 1, 1, 0, 1, 1, 1, 0];

describe("the placeholder SUD flag is gone — only real instruments satisfy the step", () => {
  it("bh_sud_loc has no fields and is satisfied by AUDIT-10 + DAST-10", () => {
    const def = PRE_RELEASE_FORMS.find((d) => d.key === "bh_sud_loc")!;
    expect(def.fields).toHaveLength(0);
    expect(def.satisfiedByScreeners).toEqual(["audit", "dast-10"]);
  });

  it("refuses loose field capture for a screener-satisfied step", () => {
    const { episode } = competentIntake("Marisol", "Vega");
    expect(() =>
      AdelanteEHR.savePreReleaseForm({
        episodeId: episode.id,
        formKey: "bh_sud_loc",
        values: { sudScreenPositive: true },
        complete: false,
        attribution: attribution(),
      }),
    ).toThrow(/real completed screener result/);
  });
});

describe("AUDIT-10 / DAST-10 reuse is the same mechanism, not a lookalike", () => {
  it("stores an identical result to the one intake's own scoring produces", () => {
    const { patient, episode } = competentIntake("Andre", "Bellamy");
    const result = AdelanteEHR.recordPreReleaseScreener({
      episodeId: episode.id,
      screenerKey: "audit",
      answers: AUDIT_ANSWERS,
      attribution: attribution(),
    });

    // Score/severity come from the shared instrument definition, not a copy.
    const def = SCREENERS.find((s) => s.key === "audit")!;
    const intakeStyleScore = AUDIT_ANSWERS.reduce((a, b) => a + b, 0);
    expect(result.score).toBe(intakeStyleScore);
    expect(result.severity).toBe(severityFor(def, intakeStyleScore));
    expect(result.positive).toBe(true); // cutoff 8

    // Same storage: `patient.screeners` + `screenerHistory`, same as intake.
    const p = AdelanteEHR.getPatient(patient.id)!;
    expect(p.screeners["audit"]).toEqual(result);
    expect(p.screenerHistory?.at(-1)).toEqual(result);
    expect(AdelanteEHR.getScreenerResult(patient.id, "audit")).toEqual(result);
  });

  it("completes the checklist row only once BOTH real instruments are on file", () => {
    const { episode } = competentIntake("Kai", "Ferreira");
    const row = () =>
      AdelanteEHR.preReleaseChecklist(episode.id).find((r) => r.def.key === "bh_sud_loc")!;
    expect(row().status).toBe("not_started");

    AdelanteEHR.recordPreReleaseScreener({
      episodeId: episode.id,
      screenerKey: "audit",
      answers: AUDIT_ANSWERS,
      attribution: attribution(),
    });
    expect(row().status).toBe("in_progress");

    AdelanteEHR.recordPreReleaseScreener({
      episodeId: episode.id,
      screenerKey: "dast-10",
      answers: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      attribution: attribution(),
    });
    expect(row().status).toBe("complete");
  });

  it("audits through the CF proxy-attribution shape and never records answers", () => {
    const { patient, episode } = competentIntake("Tomas", "Oyelaran");
    AdelanteEHR.recordPreReleaseScreener({
      episodeId: episode.id,
      screenerKey: "dast-10",
      answers: Array(10).fill(1),
      attribution: attribution(),
    });
    const entry = AdelanteEHR.listAudit()
      .filter((a) => a.action === "pre_release_screener_recorded" && a.patientId === patient.id)
      .at(0)!;
    expect(entry.detail?.["entryMode"]).toBe("direct");
    expect(entry.detail?.["screenerKey"]).toBe("dast-10");
    expect(entry.detail?.["responses"]).toBeUndefined();
  });

  it("rejects an incomplete item set", () => {
    const { episode } = competentIntake("Iris", "Nakamura");
    expect(() =>
      AdelanteEHR.recordPreReleaseScreener({
        episodeId: episode.id,
        screenerKey: "audit",
        answers: [1, 2],
        attribution: attribution(),
      }),
    ).toThrow(/all 10 items/);
  });
});

describe("AHC-HRSN is a real sibling instrument", () => {
  // Housing worry, food insecure, no transport problem, utilities threatened,
  // HITS total 4 (never on all four items → negative).
  const ANSWERS = [1, 0, 2, 1, 0, 1, 1, 1, 1, 1];

  it("scores by positive DOMAIN count using real per-domain rules", () => {
    const scored = scoreScreener(AHC_HRSN, ANSWERS);
    expect(scored.domains?.filter((d) => d.positive).map((d) => d.key)).toEqual([
      "housing",
      "food",
      "utilities",
    ]);
    expect(scored.score).toBe(3);
    expect(scored.severity).toBe("Multiple identified needs");
    expect(scored.positive).toBe(true);
  });

  it("flags interpersonal safety only above the validated HITS threshold", () => {
    const safe = scoreScreener(AHC_HRSN, [0, 0, 0, 0, 0, 0, 3, 3, 2, 2]).domains!;
    expect(safe.find((d) => d.key === "safety")!.positive).toBe(false); // 10
    const unsafe = scoreScreener(AHC_HRSN, [0, 0, 0, 0, 0, 0, 3, 3, 3, 2]).domains!;
    expect(unsafe.find((d) => d.key === "safety")!.positive).toBe(true); // 11
  });

  it("lands in the same screener storage as AUDIT-10 and satisfies dhcs_hra", () => {
    const { patient, episode } = competentIntake("Delia", "Cruz");
    const result = AdelanteEHR.recordPreReleaseScreener({
      episodeId: episode.id,
      screenerKey: "ahc-hrsn",
      answers: ANSWERS,
      attribution: attribution(),
    });
    expect(AdelanteEHR.getPatient(patient.id)!.screeners["ahc-hrsn"]).toEqual(result);
    expect(result.context).toBe("pre_release");
    expect(result.episodeId).toBe(episode.id);
    expect(
      AdelanteEHR.preReleaseChecklist(episode.id).find((r) => r.def.key === "dhcs_hra")!.status,
    ).toBe("complete");
  });
});

describe("population-health queries run against the stored results", () => {
  it("reports positive-screen rates and SDOH domain prevalence across a cohort", () => {
    const a = competentIntake("Pop", "One");
    const b = competentIntake("Pop", "Two");
    const cohort = [a.patient.id, b.patient.id];

    // A: AUDIT positive (12) + housing/food/utilities needs.
    AdelanteEHR.recordPreReleaseScreener({
      episodeId: a.episode.id,
      screenerKey: "audit",
      answers: AUDIT_ANSWERS,
      attribution: attribution(),
    });
    AdelanteEHR.recordPreReleaseScreener({
      episodeId: a.episode.id,
      screenerKey: "ahc-hrsn",
      answers: [1, 0, 2, 1, 0, 1, 1, 1, 1, 1],
      attribution: attribution(),
    });
    // B: AUDIT negative (2) + housing need only.
    AdelanteEHR.recordPreReleaseScreener({
      episodeId: b.episode.id,
      screenerKey: "audit",
      answers: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      attribution: attribution(),
    });
    AdelanteEHR.recordPreReleaseScreener({
      episodeId: b.episode.id,
      screenerKey: "ahc-hrsn",
      answers: [1, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      attribution: attribution(),
    });

    const summary = AdelanteEHR.screenerPopulationSummary({
      patientIds: cohort,
      keys: ["audit", "ahc-hrsn"],
    });
    const audit = summary.instruments.find((i) => i.key === "audit")!;
    expect(audit.administered).toBe(2);
    expect(audit.positive).toBe(1);
    expect(audit.positiveRate).toBe(0.5);

    const byDomain = Object.fromEntries(summary.sdohDomains.map((d) => [d.key, d]));
    expect(byDomain["housing"]!.positive).toBe(2);
    expect(byDomain["housing"]!.rate).toBe(1);
    expect(byDomain["food"]!.positive).toBe(1);
    expect(byDomain["transportation"]!.positive).toBe(0);
    expect(byDomain["safety"]!.screened).toBe(2);
  });
});

describe("both instruments respect the Build-1 capacity gate", () => {
  function impaired(first: string) {
    const r = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
      firstName: first,
      lastName: "Gatekept",
      anticipatedReleaseDate: "2026-11-01",
      cfCareManagerStaffId: cf().id,
      cfCareManagerName: cf().name,
      openedBy: cf().name,
      actorRole: "cf_care_manager",
    });
    opened.push(r.episode.id);
    AdelanteEHR.recordPreReleaseCapacity({
      episodeId: r.episode.id,
      status: "impaired",
      basis: "Unable to describe the purpose of the interview.",
      attribution: attribution(),
    });
    return r;
  }

  it("blocks both the SUD and the SDOH screener with no legal authority on file", () => {
    const { episode } = impaired("Gate");
    const rows = AdelanteEHR.preReleaseChecklist(episode.id);
    for (const key of ["bh_sud_loc", "dhcs_hra"])
      expect(rows.find((r) => r.def.key === key)!.blocked).toMatch(/no AHCD or conservatorship/);
    for (const screenerKey of ["audit", "ahc-hrsn"])
      expect(() =>
        AdelanteEHR.recordPreReleaseScreener({
          episodeId: episode.id,
          screenerKey,
          answers: Array(10).fill(0),
          attribution: attribution(),
        }),
      ).toThrow(/no AHCD or conservatorship/);
  });

  it("opens once real AHCD authority is in force", () => {
    const { episode } = impaired("Opened");
    const link = AdelanteEHR.identifyPreReleaseAdvocate({
      episodeId: episode.id,
      advocateName: "Ruth Gatekept",
      invitationSentTo: "ruth@example.com",
      invitationChannel: "email",
      expectedAuthorization: "ahcd",
      designatedBy: { actor: "cf_care_manager", name: cf().name },
    });
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "ahcd",
      attestedName: "Ruth Gatekept",
    });
    activateAhcdForTest(link.id);
    expect(
      AdelanteEHR.recordPreReleaseScreener({
        episodeId: episode.id,
        screenerKey: "ahc-hrsn",
        answers: Array(10).fill(0),
        attribution: attribution(),
      }).key,
    ).toBe("ahc-hrsn");
  });
});
