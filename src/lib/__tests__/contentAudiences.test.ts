// "Who it's for" audiences, any-match, plus Part 2 content visible to authors.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  audienceVisible,
  audiencesOf,
  personAudiences,
  resolvePopulation,
} from "@/lib/population";
import { isLibraryItemVisible, LIBRARY_ITEMS } from "@/lib/library";
import { curriculumVisible } from "@/lib/curriculumProgress";
import { liveCurricula } from "@/lib/curriculumTypes";
import { COVERAGE_STAGES, reentryStageOf } from "@/lib/contentTags";
import { JOURNEY_CONTENT_TYPE } from "@/lib/curriculumTypes";
import { contentPart2VisibleToStaff, contentVisibleToStaff } from "@/lib/contentStaff";
import { canAuthorContent } from "@/lib/contentPublishing";
import { roleSeesAsamSection, SUD_MED_WITHHELD_ROLES } from "@/lib/asamReporting";
import { STAFF_ROLES } from "@/lib/roles";

const JI = { audiences: ["justice_involved"] };
const SUD = { audiences: ["sud"] };
const ALL = {};

function patient(last: string) {
  return AdelanteEHR.createPatient({ firstName: "Aud", lastName: last });
}
function makeJi(id: string) {
  AdelanteEHR.addProblem(id, { description: "Reentry after release", icd10Code: "Z65.2", enteredBy: "test" });
}
function makeSud(id: string) {
  AdelanteEHR.addProblem(id, { description: "Opioid use disorder", icd10Code: "F11.20", category: "sud", enteredBy: "test" });
}

describe("person audiences, any-match", () => {
  it("a JI + SUD person sees both sets", () => {
    const p = patient("Both");
    makeJi(p.id);
    makeSud(p.id);
    const a = personAudiences(p.id);
    expect(a).toEqual(expect.arrayContaining(["justice_involved", "sud"]));
    expect(audienceVisible(JI, a) && audienceVisible(SUD, a) && audienceVisible(ALL, a)).toBe(true);
  });
  it("a JI-only person sees no SUD-only content", () => {
    const p = patient("JiOnly");
    makeJi(p.id);
    const a = personAudiences(p.id);
    expect(audienceVisible(JI, a)).toBe(true);
    expect(audienceVisible(SUD, a)).toBe(false);
  });
  it("an SUD-only person sees no JI-only content", () => {
    const p = patient("SudOnly");
    makeSud(p.id);
    const a = personAudiences(p.id);
    expect(audienceVisible(SUD, a)).toBe(true);
    expect(audienceVisible(JI, a)).toBe(false);
  });
  it("a general person sees only everyone-items", () => {
    const p = patient("General");
    const a = personAudiences(p.id);
    expect(a).toEqual([]);
    expect(audienceVisible(ALL, a)).toBe(true);
    expect(audienceVisible(JI, a) || audienceVisible(SUD, a)).toBe(false);
  });
  it("an advocate viewer gets only the advocate audience", () => {
    const p = patient("AdvViewer");
    makeJi(p.id);
    makeSud(p.id);
    const a = personAudiences(p.id, { kind: "advocate", advocateLinkId: "x" });
    expect(a).toEqual(["advocate"]);
    expect(audienceVisible({ audiences: ["advocate"] }, a)).toBe(true);
    expect(audienceVisible(JI, a) || audienceVisible(SUD, a)).toBe(false);
  });
  it("'not sure' stays unconfirmed: no JI content", () => {
    const p = patient("Unsure");
    AdelanteEHR.setCoverage(p.id, { justiceInvolvement: "unsure" } as never);
    expect(personAudiences(p.id)).not.toContain("justice_involved");
  });
  it("a Z65.2-only person (no front-door 'yes') can browse Starting Strong", () => {
    const p = patient("Z652");
    makeJi(p.id);
    expect(AdelanteEHR.getPatient(p.id)?.coverage?.justiceInvolvement).not.toBe("yes");
    const j = liveCurricula().find((x) => x.id === "starting-strong-curriculum")!;
    expect(curriculumVisible(p.id, j)).toBe(true);
  });
});

describe("migration keeps visibility", () => {
  const LESSONS = ["understanding-psychosis", "back-on-feet-work", "back-on-feet-legal-responsibilities", "success-plan-goals-that-matter"];
  it("the 4 lessons are justice_involved and keep the same visibility", () => {
    const ji = patient("MigJi");
    makeJi(ji.id);
    const gen = patient("MigGen");
    for (const id of LESSONS) {
      const item = LIBRARY_ITEMS.find((i) => i.id === id)!;
      expect(audiencesOf(item)).toEqual(["justice_involved"]);
      expect(isLibraryItemVisible(item, resolvePopulation(ji.id))).toBe(true);
      expect(isLibraryItemVisible(item, resolvePopulation(gen.id))).toBe(false);
    }
  });
  it("the 2 journeys are justice_involved and keep the same visibility", () => {
    const ji = patient("MigJiJ");
    AdelanteEHR.setCoverage(ji.id, { justiceInvolvement: "yes" } as never);
    const gen = patient("MigGenJ");
    for (const id of ["starting-strong-curriculum", "back-on-feet-curriculum"]) {
      const j = liveCurricula().find((x) => x.id === id)!;
      expect(audiencesOf(j)).toEqual(["justice_involved"]);
      expect(curriculumVisible(ji.id, j)).toBe(true);
      expect(curriculumVisible(gen.id, j)).toBe(false);
    }
  });
  it("retired stored fields convert on read; meta.populations is never a gate", () => {
    expect(audiencesOf({ populations: ["pre_release_ji", "post_release_ji"] })).toEqual(["justice_involved"]);
    expect(audiencesOf({ justiceInvolved: true })).toEqual(["justice_involved"]);
    expect(audiencesOf({ meta: { populations: ["justice_involved"] } })).toEqual([]);
  });
});

describe("no release split in content", () => {
  it("has no pre_release content stage", () => {
    expect(COVERAGE_STAGES).not.toContain("pre_release");
    const stage = JOURNEY_CONTENT_TYPE.fields.find((f) => f.key === "reentryStage")!;
    expect(stage.options!.map((o) => o.value)).not.toContain("pre_release");
    const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    expect(reentryStageOf({ releaseDate: future } as never)).toBe("first_30");
  });
});

describe("Part 2 content for content authors", () => {
  it("every author sees Part 2 content; others keep the patient-record rule", () => {
    for (const { key } of STAFF_ROLES) {
      expect(contentPart2VisibleToStaff(key)).toBe(canAuthorContent(key) || roleSeesAsamSection(key));
    }
    expect(contentVisibleToStaff("clinical_coordinator", "recovery_lesson", { title: "Recovery" })).toBe(true);
    expect(contentVisibleToStaff("clinical_coordinator", "recovery_module", { name: "Module" })).toBe(true);
    expect(contentVisibleToStaff("clinical_coordinator", "journey", { title: "J", meta: { part2: true } })).toBe(true);
    expect(contentVisibleToStaff("clinical_coordinator", "exercise", { title: "E", part2Sensitive: true })).toBe(true);
  });
  it("non-authors still need the patient-record rule", () => {
    expect(canAuthorContent("medical_assistant")).toBe(false);
    expect(contentVisibleToStaff("medical_assistant", "recovery_lesson", { title: "Recovery" })).toBe(
      roleSeesAsamSection("medical_assistant"),
    );
  });
  it("patient-record Part 2 checks are unchanged", () => {
    expect(roleSeesAsamSection("clinical_coordinator")).toBe(false);
    expect([...SUD_MED_WITHHELD_ROLES].sort()).toEqual(["billing", "billing_coordinator", "clinical_coordinator", "ecm_provider"]);
  });
});
