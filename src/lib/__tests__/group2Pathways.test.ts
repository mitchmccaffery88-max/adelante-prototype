// §Group 2 (9 Oct) — pathway flags, Part 2/safety fixes, contacts + advocate. Draft.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { EXERCISES } from "@/lib/library";
import { buildAdelSystemPrompt } from "@/lib/adelPrompt";
import { applyFlagJourneys, detectFlags, journeysForPathway, listContentGaps, pathwayChipLabel, patientPathway, pathwayFromFlags, _resetFlagJourneys } from "@/lib/flagJourneys";
import { getStructuredPlan, staffPlanView, PATHWAY_REVIEW_LABEL, flagReviewLabel, markPathwayChangedForReview } from "@/lib/structuredCarePlan";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { runAction } from "@/lib/actions/runAction";
import { queueHieMatch, confirmMatch } from "@/lib/dataExchange";
import { liveCurricula } from "@/lib/curriculumTypes";
import { engagementRecords, recordExerciseCompleted } from "@/lib/engagement";
import { advocatePart2Masked, type AdvocateAuthorizationType } from "@/lib/advocate";
import {
  RELATIONSHIPS, ADVOCATE_TYPES, authorizationForAdvocateType, validateAdvocateDraft, emptyAdvocateDraft,
  advocateDraftFromContact, contactDrifted, advocateStatus, relationshipText, relationshipFromText,
} from "@/lib/contactAdvocate";
import { signAdvocateConsent } from "@/lib/advocateConsentSign";
import { advocateInvitationConsentActive } from "@/lib/advocateInviteDelivery";

const SUD_EX = ["urge-surfing-timer", "trigger-map", "if-i-slip-plan", "warning-signs"];
const SUD_JOURNEYS = new Set(["first-days-curriculum", "reentry-curriculum"]);
let n = 0;
function referral(extra: Record<string, unknown>): Patient {
  n += 1;
  const r = AdelanteEHR.createReferral({
    firstName: "Path", lastName: `Way${n}${Math.random().toString(36).slice(2, 6)}`, dob: `1990-0${(n % 9) + 1}-1${n % 9}`, phone: `55955501${String(n).padStart(2, "0")}`,
    referringAgency: "Test", referrerName: "Ref", referrerPhone: "5595550100", referralSource: "community_based_organization",
    consentToContact: true, channel: "public", ...extra,
  } as never);
  const pid = AdelanteEHR.enrollReferral(r.id)!;
  applyFlagJourneys(pid);
  return AdelanteEHR.getPatient(pid)!;
}
const autoIds = (pid: string) => getStructuredPlan(pid).assignments.filter((a) => a.active && a.autoAdded).map((a) => a.activityId!);

describe("S1 SUD exercises are Part 2", () => {
  it("the four SUD exercises carry part2Sensitive and are protected in cohort reads", () => {
    for (const id of SUD_EX) expect(EXERCISES.find((e) => e.id === id)?.part2Sensitive, id).toBe(true);
    const p = AdelanteEHR.listPatients()[0]!;
    recordExerciseCompleted(p.id, "urge-surfing-timer");
    const row = engagementRecords([p.id]).find((r) => r.patientId === p.id);
    expect(row?.completedExercises ?? []).not.toContain("urge-surfing-timer");
  });
});

describe("S2 Adel prompt filtered by pathway", () => {
  it("no SUD content without the SUD pathway", () => {
    const general = buildAdelSystemPrompt({ sud: false, reentry: false });
    for (const id of SUD_EX) expect(general).not.toContain(`exercise:${id}`);
    const sud = buildAdelSystemPrompt({ sud: true, reentry: false });
    for (const id of SUD_EX) expect(sud).toContain(`exercise:${id}`);
  });
});

describe("S3 consent ledger toggles", () => {
  it("read-only roles are refused (store and registry); write roles audited with the staff member", () => {
    const p = AdelanteEHR.listPatients()[1]!;
    expect(() => AdelanteEHR.staffSetConsent(p.id, "sms", true, { role: "therapist" })).toThrow(/can't change/);
    const blocked = runAction("consent_purpose_set", { role: "pmhnp", staffId: "s-x" }, p, { args: [p.id, "sms", true, { role: "pmhnp" }] });
    expect(blocked.ok).toBe(false);
    const ecm = STAFF_ROSTER.find((s) => s.role === "ecm_provider")!;
    const r = runAction("consent_purpose_set", { role: "ecm_provider", staffId: ecm.id, staffName: ecm.name }, p, { args: [p.id, "sms", true, { role: "ecm_provider", staffId: ecm.id, staffName: ecm.name }, "test"] });
    expect(r.ok).toBe(true);
    const ev = AdelanteEHR.listAuditEvents().find((e) => e.patientId === p.id && e.category === "consent" && e.action === "granted");
    expect(ev?.actorRole).toBe("ecm_provider");
    expect((ev?.detail as { actorName?: string }).actorName).toBe(ecm.name);
    expect(AdelanteEHR.getPatient(p.id)!.consentEvents!.at(-1)!.actorName).toBe(ecm.name);
  });
});

describe("S4 advocate consent card in the patient portal and onboarding", () => {
  it("is mounted on Privacy & consent, My care and onboarding", () => {
    expect(readFileSync("src/components/patient/ProfilePanels.tsx", "utf8")).toContain("<AdvocateConsentCard");
    expect(readFileSync("src/components/PatientHome.tsx", "utf8")).toContain("<AdvocateConsentCard");
    expect(readFileSync("src/routes/intake.tsx", "utf8")).toContain("signAdvocateConsent");
  });
});

describe("S5 reason matches the rule", () => {
  it("a release date alone never sets the flag, and the label never says it does", () => {
    const p = referral({ releaseDate: "2026-09-01" });
    expect(detectFlags(p).justice_involved).toBeUndefined();
    expect(readFileSync("src/lib/flagJourneys.ts", "utf8")).not.toContain('"release date recorded"');
  });
});

describe("P1–P5 pathway flags at the moment of identification", () => {
  it("correctional referral → reentry; Starting Strong + Back on My Feet, not My First Days Out; once", () => {
    const p = referral({ referralSource: "probation" });
    expect(patientPathway(p.id)).toBe("reentry");
    expect(detectFlags(p).justice_involved).toMatch(/correctional referral source/);
    applyFlagJourneys(p.id);
    const ids = autoIds(p.id);
    expect(ids).toEqual(expect.arrayContaining(["starting-strong-curriculum", "back-on-feet-curriculum"]));
    expect(ids).not.toContain("first-days-curriculum");
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("care-partner referral with justice-involved = yes carries the flag and source", () => {
    const p = referral({ justiceInvolved: "yes" });
    expect(detectFlags(p).justice_involved).toBe("justice-involved answer at referral");
    expect(patientPathway(p.id)).toBe("reentry");
  });
  it("care-partner referral with a substance-use need → sud; Recovery Journey; ASAM still queued", () => {
    const p = referral({ substanceUseNeed: true });
    expect(p.needs.substanceUse).toBe(true);
    expect(patientPathway(p.id)).toBe("sud");
    expect(autoIds(p.id)).toEqual(["reentry-curriculum"]);
    expect(liveCurricula().find((j) => j.id === "reentry-curriculum")?.title).toBe("Recovery Journey");
    expect(liveCurricula().find((j) => j.id === "reentry-curriculum")?.es?.title).toBe("Camino de recuperación");
  });
  it("reentry_sud: My First Days Out first, then Recovery Journey", () => {
    expect(journeysForPathway("reentry_sud").map((j) => j.id)).toEqual(["first-days-curriculum", "reentry-curriculum"]);
  });
  it("adding an SUD diagnosis later moves reentry → reentry_sud and marks non-matching items for review, never removed", () => {
    const p = referral({ referralSource: "parole" });
    AdelanteEHR.addProblem(p.id, { description: "Opioid use disorder", icd10Code: "F11.20", category: "sud" } as never);
    applyFlagJourneys(p.id);
    expect(patientPathway(p.id)).toBe("reentry_sud");
    const plan = getStructuredPlan(p.id);
    expect(autoIds(p.id)).toEqual(expect.arrayContaining(["first-days-curriculum", "reentry-curriculum", "starting-strong-curriculum"]));
    const ss = plan.assignments.find((a) => a.activityId === "starting-strong-curriculum")!;
    expect(ss.active).toBe(true);
    expect(ss.flagReview?.kind).toBe("pathway_changed");
    expect(flagReviewLabel(ss.flagReview!)).toBe(PATHWAY_REVIEW_LABEL);
  });
  it("chip respects Part 2: Re-entry + SUD for Part 2 roles, Re-entry otherwise", () => {
    expect(pathwayChipLabel("reentry_sud", true)).toBe("Re-entry + SUD");
    expect(pathwayChipLabel("reentry_sud", false)).toBe("Re-entry");
    expect(pathwayChipLabel("sud", false)).toBeNull();
    expect(pathwayFromFlags({})).toBe("general");
  });
  it("HIE: nothing changes without staff confirmation; a confirmed sud_program record sets the SUD indicator", () => {
    const p = referral({});
    queueHieMatch({ id: `m-${p.id}`, patientId: p.id, record: { kind: "sud_program", at: new Date().toISOString(), facility: "Outside program (placeholder)", reason: "Program visit" } });
    expect(patientPathway(p.id)).toBe("general");
    confirmMatch(`m-${p.id}`, { name: "Coordinator", role: "clinical_coordinator" });
    expect(AdelanteEHR.getPatient(p.id)!.needs.substanceUse).toBe(true);
    expect(patientPathway(p.id)).toBe("sud");
  });
  it("intake answer and problem list paths", () => {
    const p = referral({});
    AdelanteEHR.getPatient(p.id)!.coverage = { ...(p.coverage ?? { status: "none_unsure", verified: "pending" }), justiceInvolvement: "yes" } as never;
    expect(patientPathway(p.id)).toBe("reentry");
    AdelanteEHR.addProblem(p.id, { description: "Alcohol use disorder", icd10Code: "F10.20", category: "sud" } as never);
    expect(detectFlags(AdelanteEHR.getPatient(p.id)!).sud).toBe("SUD diagnosis on the problem list");
  });
  it("changing the rule never removes an item", () => {
    const p = referral({ referralSource: "correctional" });
    const before = getStructuredPlan(p.id).assignments.filter((a) => a.active).length;
    markPathwayChangedForReview(p.id, []);
    expect(getStructuredPlan(p.id).assignments.filter((a) => a.active).length).toBe(before);
  });
});

describe("G1 content gaps go to the content owner", () => {
  it("not the clinical coordinator", () => {
    expect(readFileSync("src/lib/flagJourneys.ts", "utf8")).not.toMatch(/recipientRole: "clinical_coordinator"[^\n]*Content gap/);
    _resetFlagJourneys();
    expect(listContentGaps().every((g) => g.owner !== "clinical_coordinator")).toBe(true);
  });
});

describe("G2 auto-added SUD journeys hidden", () => {
  it("from staff without Part 2 access and from every advocate tier without SUD disclosure", () => {
    const p = referral({ referralSource: "probation", substanceUseNeed: true });
    expect(autoIds(p.id).some((id) => SUD_JOURNEYS.has(id))).toBe(true);
    const noPart2 = (["medical_assistant", "community_health_worker", "peer_specialist", "ecm_provider", "billing"] as StaffRole[]).filter((r) => !roleSeesAsamSection(r, p));
    expect(noPart2.length).toBeGreaterThan(0);
    for (const r of noPart2) {
      const v = staffPlanView(p.id, r);
      expect(v.assignments.some((a) => SUD_JOURNEYS.has(a.activityId!))).toBe(false);
      expect(JSON.stringify(v)).not.toMatch(/My First Days Out|Recovery Journey/);
    }
    for (const t of ["family_participation", "hipaa_authorization", "dhcs_authorized_representative", "ahcd", "conservatorship"] as AdvocateAuthorizationType[])
      expect(advocatePart2Masked(t, { linkValid: true, sudDisclosureConsentActive: false }) || t === "conservatorship" || t === "ahcd", t).toBe(true);
    const row = engagementRecords([p.id]).find((r) => r.patientId === p.id);
    expect(JSON.stringify(row ?? {})).not.toMatch(/first-days-curriculum|reentry-curriculum/);
  });
});

describe("O1–O3 contacts and advocate", () => {
  it("relationship dropdown list and round trip", () => {
    expect(RELATIONSHIPS.map((r) => r.en)).toEqual(["Parent", "Spouse or partner", "Child", "Sibling", "Other family", "Friend", "Sponsor or peer mentor", "Case manager or counselor", "Other"]);
    expect(RELATIONSHIPS.every((r) => r.es.length > 0)).toBe(true);
    expect(relationshipText("other", "Neighbor")).toBe("Other: Neighbor");
    expect(relationshipFromText("Other: Neighbor")).toEqual({ id: "other", other: "Neighbor" });
    expect(relationshipFromText("Sibling").id).toBe("sibling");
  });
  it("separate phone and email, validated, at least one", () => {
    const d = { ...emptyAdvocateDraft(), name: "Ana", typeId: "family" };
    expect(validateAdvocateDraft(d)).toContain("contact_missing");
    expect(validateAdvocateDraft({ ...d, phone: "12" })).toContain("phone_invalid");
    expect(validateAdvocateDraft({ ...d, email: "nope", sendBy: "email" })).toContain("email_invalid");
    expect(validateAdvocateDraft({ ...d, email: "ana@example.org", sendBy: "sms" })).toContain("send_by");
    expect(validateAdvocateDraft({ ...d, phone: "559-555-0142", email: "ana@example.org" })).toEqual([]);
    expect(validateAdvocateDraft({ ...d, phone: "5595550142", consent: "now" })).toContain("sign");
  });
  it("advocate type sets the authorization type", () => {
    expect(ADVOCATE_TYPES.map((t) => t.auth)).toEqual(["family_participation", "dhcs_authorized_representative", "ahcd", "conservatorship"]);
    expect(authorizationForAdvocateType("conservator")).toBe("conservatorship");
  });
  it("make-advocate link, change prompt, sign later then sign now, status chips", () => {
    const p = referral({});
    const contact = { id: "ec_t1", name: "Maria Ruiz", relationship: "Sibling", phone: "5595550199", email: "maria@example.org" };
    AdelanteEHR.updateProfile(p.id, { emergencyContacts: [contact] } as never);
    const d = advocateDraftFromContact(contact, { ...emptyAdvocateDraft(), typeId: "authorized_rep" });
    expect(d.contactId).toBe("ec_t1");
    const link = AdelanteEHR.createAdvocateInvitation({ patientId: p.id, advocateName: d.name, invitationSentTo: d.phone, invitationChannel: "sms", expectedAuthorizationType: authorizationForAdvocateType(d.typeId)!, designatedBy: { actor: "patient", name: "Path" }, contactId: contact.id, contactSnapshot: { name: contact.name, phone: contact.phone } });
    expect(link.expectedAuthorizationType).toBe("dhcs_authorized_representative");
    expect(advocateStatus(link, advocateInvitationConsentActive(p.id))).toBe("waiting_consent");
    expect(contactDrifted(link, { name: "Maria Ruiz", phone: "5595550100" })).toBe(true);
    AdelanteEHR.updateAdvocateFromContact(link.id, { name: "Maria Ruiz", phone: "5595550100" });
    expect(contactDrifted(AdelanteEHR.getAdvocateLink(link.id)!, { name: "Maria Ruiz", phone: "5595550100" })).toBe(false);
    expect(AdelanteEHR.getAdvocateLink(link.id)!.invitationSentTo).toBe("5595550100");
    expect(() => signAdvocateConsent(p.id, "", true)).toThrow();
    signAdvocateConsent(p.id, "Path Way", true);
    expect(advocateStatus(AdelanteEHR.getAdvocateLink(link.id)!, advocateInvitationConsentActive(p.id))).toBe("waiting_signup");
  });
  it("invitation errors are shown, never swallowed", () => {
    const src = readFileSync("src/routes/intake.tsx", "utf8");
    expect(src).not.toMatch(/no-op — the invite form/);
    expect(src).toMatch(/toast\.error\(e instanceof Error \? e\.message : "The advocate invitation could not be created\."\)/);
    expect(readFileSync("src/components/advocate/AdvocateStatusList.tsx", "utf8")).toContain('role="alert"');
  });
});
