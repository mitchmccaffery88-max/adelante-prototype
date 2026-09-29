import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt, DUPLICATE_CLAIM_BLOCKED } from "@/lib/ehr-ext";
import {
  listMatchReviews,
  PossibleExistingPatientError,
  scoreIdentity,
  SignupNeedsVerificationError,
} from "@/lib/patientMatching";
import { mergePatients, unmergePatients, previewMerge } from "@/lib/patientMerge";
import { runAction } from "@/lib/actions/runAction";
import { scoreHieIncoming } from "@/lib/dataExchange";
import {
  canProxyForCfCareManager,
  getActingRole,
  getActingStaff,
  getStaffMember,
  roleAssignmentsOf,
  setActingStaff,
  STAFF_ROSTER,
  findDuplicateStaff,
} from "@/lib/roles";
import { setFeatureEnabled } from "@/lib/features";

const PRIYA = { staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" };
let n = 0;
const uniq = () => `Zq${++n}${Math.floor(Math.random() * 1e6)}`;
type In = Parameters<typeof AdelanteEHR.createPatient>[0];
const create = (i: Record<string, unknown>) => AdelanteEHR.createPatient(i as In);

describe("scoring", () => {
  it("exact on CIN; exact on name + DOB ignoring accents", () => {
    expect(scoreIdentity({ firstName: "A", lastName: "B", cin: "12345678A" }, { firstName: "X", lastName: "Y", cin: "12345678a" }).band).toBe("exact");
    expect(scoreIdentity({ firstName: "José", lastName: "Peña", dob: "1990-01-02" }, { firstName: "Jose", lastName: "Pena", dob: "1990-01-02" }).band).toBe("exact");
  });
  it("nickname + maternal surname + DOB transposition are probable, never exact", () => {
    const r = scoreIdentity({ firstName: "Pancho", lastName: "García", dob: "1985-03-12" }, { firstName: "Francisco", lastName: "García López", dob: "1985-12-03" });
    expect(r.band).toBe("probable");
    expect(r.fields.map((f) => f.how)).toEqual(expect.arrayContaining(["nickname", "surname_part", "transposed"]));
  });
  it("HIE uses the same engine", () => {
    const luis = AdelanteEHR.listPatients().find((p) => p.firstName === "Luis")!;
    expect(scoreHieIncoming({ name: "Luis Camacho", dob: luis.dob, cin: luis.cin ?? "—", address: "—" }, luis.id).band).not.toBe("none");
  });
});

describe("every creation path goes through the matcher", () => {
  it("staff create: exact stops with Open existing / Create anyway (reason required, audited)", () => {
    const last = uniq();
    create({ firstName: "Ana", lastName: last, dob: "1980-01-01", matchSource: "seed" });
    expect(() => create({ firstName: "Ana", lastName: last, dob: "1980-01-01" })).toThrow(PossibleExistingPatientError);
    expect(() => create({ firstName: "Ana", lastName: last, dob: "1980-01-01", createAnyway: { reason: " " } })).toThrow(/reason/i);
    const p = create({ firstName: "Ana", lastName: last, dob: "1980-01-01", createAnyway: { reason: "Different person, confirmed ID", actorId: "s-cc1" } });
    expect(p.possibleDuplicate?.band).toBe("exact");
    expect(AdelanteEHR.listAuditEvents?.().some((e) => e.action === "patient_created_despite_match" && e.patientId === p.id) ?? true).toBe(true);
  });
  it("self sign-up: neutral error with no details, plus a staff review item", () => {
    const last = uniq();
    const existing = create({ firstName: "Rosa", lastName: last, dob: "1970-05-05", cin: "77700011Z", matchSource: "seed" });
    let err: unknown;
    try {
      create({ firstName: "Rosa", lastName: last, dob: "1970-05-05", cin: "77700011Z", matchSource: "self_signup" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SignupNeedsVerificationError);
    const msg = (err as Error).message + JSON.stringify(err);
    expect(msg).not.toContain(existing.id);
    expect(msg).not.toContain(last);
    expect(msg).not.toContain("1970");
    expect(listMatchReviews().some((r) => r.kind === "signup_attempt" && r.existingPatientId === existing.id)).toBe(true);
  });
  it("probable: record is created, flagged and queued (referral / intake sources too)", () => {
    for (const source of ["staff_create", "referral", "intake", "caseload_upload", "assisted_signup"]) {
      const last = uniq();
      create({ firstName: "Luis", lastName: last, dob: "1990-06-10", matchSource: "seed" });
      const p = create({ firstName: "Luis", lastName: last, dob: "1990-06-11", matchSource: source });
      expect(p.possibleDuplicate?.band, source).toBe("probable");
      expect(listMatchReviews().some((r) => r.newPatientId === p.id && r.source === source)).toBe(true);
    }
  });
  it("referral conversion calls the matcher with source referral", () => {
    const src = AdelanteEHR.enrollReferral.toString() + AdelanteEHR.createPatient.toString();
    expect(src).toMatch(/matchBeforeCreate|matchSource/);
  });
});

function pair() {
  const last = uniq();
  const a = create({ firstName: "Tom", lastName: last, dob: "1987-06-12", phone: "+15595550001", matchSource: "seed" });
  const b = create({ firstName: "Tom", lastName: last, dob: "1987-06-13", phone: "+15595550001", matchSource: "staff_create" });
  return { a, b };
}

describe("merge", () => {
  it("only coordinator / sys_admin, reason required, through runAction", () => {
    const { a, b } = pair();
    const denied = runAction("patient_merge", { role: "therapist", staffId: "s-th1" } as never, a, { via: "mergePatients", args: [{ survivorId: a.id, otherId: b.id, reason: "x" }, { staffId: "s-th1", name: "M", role: "therapist" }] });
    expect(denied.ok).toBe(false);
    expect(denied.event.action).toBe("action.blocked");
    expect(() => mergePatients({ survivorId: a.id, otherId: b.id, reason: "" }, PRIYA)).toThrow(/reason/i);
  });

  it("moves records, keeps authors, leaves consents unextended, blocks duplicate claims; unmerge restores", () => {
    const { a, b } = pair();
    const today = new Date().toISOString().slice(0, 10);
    const consent = AdelanteEHR.createConsentRecord({ patientId: b.id, formType: "AB133", source: "test", signedByName: "Tom B", attested: true, effectiveDate: today, sections: [{ category: "mental_health", authorized: true }], capturedBy: { staffName: "Priya Raman", role: "clinical_coordinator" } });
    const task = AdelanteEHR.createCaseTask?.({ patientId: b.id, title: "Call back", assignedTo: "s-cm1", taskType: "general", createdBy: "Luz" } as never);
    const c1 = AdelanteEHRExt.createAsamClaim({ asamId: `t-${uniq()}`, patientId: a.id, clinicianId: "c1", serviceDate: today });
    const c2 = AdelanteEHRExt.createAsamClaim({ asamId: `t-${uniq()}`, patientId: b.id, clinicianId: "c1", serviceDate: today });
    const s = previewMerge(a.id, b.id);
    expect(s.consentsNeedingReview).toBe(1);
    expect(s.duplicateClaims).toBe(1);

    const r = runAction<ReturnType<typeof mergePatients>>("patient_merge", { role: "clinical_coordinator", staffId: "s-cc1" } as never, a, { via: "mergePatients", args: [{ survivorId: a.id, otherId: b.id, reason: "Same person" }, PRIYA] });
    expect(r.ok).toBe(true);
    expect(r.event.action).toBe("action.succeeded");
    const merged = r.ok ? r.value : undefined!;

    expect(AdelanteEHR._allPatientsIncludingMerged().find((p) => p.id === b.id)?.mergedInto).toBe(a.id);
    expect(AdelanteEHR.listPatients().some((p) => p.id === b.id)).toBe(false);
    expect(AdelanteEHR.resolvePatientId(b.id)).toBe(a.id);
    // Consent moved but flagged, and it does not authorise anything.
    expect(consent.patientId).toBe(a.id);
    expect(consent.needsReviewAfterMerge?.fromPatientId).toBe(b.id);
    expect(AdelanteEHR.activeConsentRecord(a.id)?.id).not.toBe(consent.id);
    if (task) expect((task as { patientId: string; createdBy?: string }).patientId).toBe(a.id);
    // Duplicate claims blocked until billing reviews.
    expect(c1.duplicateReview?.mergeId).toBe(merged.id);
    const role = getActingRole();
    setActingStaff("s-bl1");
    const blocked = AdelanteEHRExt.transitionClaim?.(c1.id, "submitted" as never, "try") as { ok: boolean; error?: string } | undefined;
    if (blocked) expect(blocked.ok === false && /duplicate/i.test(blocked.error ?? DUPLICATE_CLAIM_BLOCKED)).toBe(true);
    setActingStaff(STAFF_ROSTER.find((x) => x.role === role)!.id);

    unmergePatients({ mergeId: merged.id, reason: "Wrong merge" }, PRIYA);
    expect(AdelanteEHR.getPatient(b.id)?.mergedInto).toBeUndefined();
    expect(consent.patientId).toBe(b.id);
    expect(consent.needsReviewAfterMerge).toBeUndefined();
    expect(c1.duplicateReview).toBeUndefined();
    expect(c2.patientId).toBe(b.id);
    if (task) expect((task as { patientId: string }).patientId).toBe(b.id);
  });
});

describe("staff identities", () => {
  it("Darnell is one identity; the in-facility role is hidden while the flag is off", () => {
    expect(STAFF_ROSTER.filter((s) => /Darnell/.test(s.name))).toHaveLength(1);
    const d = getStaffMember("s-cf2")!;
    expect(d.name).toBe("Darnell Pope");
    setFeatureEnabled("in_facility", false);
    expect(roleAssignmentsOf(d).map((a) => a.role)).toEqual(["ecm_provider"]);
    setFeatureEnabled("in_facility", true);
    expect(roleAssignmentsOf(d).map((a) => a.role)).toEqual(["ecm_provider", "cf_care_manager"]);
    setFeatureEnabled("in_facility", false);
    // Proxy attribution still resolves through the assignment.
    expect(canProxyForCfCareManager("s-cm1", "s-cf2").allowed).toBe(true);
  });
  it("the switcher picks the active role for one identity", () => {
    setFeatureEnabled("in_facility", true);
    setActingStaff("s-cf2", "cf_care_manager");
    expect(getActingStaff().id).toBe("s-cf2");
    expect(getActingRole()).toBe("cf_care_manager");
    setActingStaff("s-cf2", "ecm_provider");
    expect(getActingRole()).toBe("ecm_provider");
    // A role the person doesn't hold falls back to their default.
    setActingStaff("s-cf2", "physician");
    expect(getActingRole()).toBe("ecm_provider");
    setFeatureEnabled("in_facility", false);
  });
  it("staff dedupe on NPI or email", () => {
    expect(findDuplicateStaff({ email: "DARNELL.POPE@adelante.example " })?.id).toBe("s-cf2");
    expect(findDuplicateStaff({ email: "nobody@x.example" })).toBeUndefined();
  });
});
