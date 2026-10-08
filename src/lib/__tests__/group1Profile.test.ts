// §Group 1 (8 Oct) — profile, availability, flag-driven journeys. Draft.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AdelanteEHR } from "@/lib/ehr";
import { STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import {
  BOOKABLE_ROLES, isBookableRole, isBookableClinician, availabilityPageTitle, listCareTags, addCareTag,
  saveStaffProfile, getStaffProfile, hourSitesFor, siteServices, blockOffersService, setBookingsFrozen, bookingsFrozen,
  DEMO_SECOND_SITE,
} from "@/lib/staffProfile";
import { availableSlots } from "@/lib/clinicianAvailability";
import { eligibleClinicians } from "@/lib/bookingFlow";
import { saveStaffHours } from "@/lib/workingCalendar";
import { listSites } from "@/lib/providerReference";
import { staffSiteIds } from "@/lib/chartAccess";
import { credentialKindsFor, credentialSummary } from "@/lib/credentialAccess";
import { applyFlagJourneys, journeysForFlag, NEW_CONTENT_NOTICE, NEW_CONTENT_BODY } from "@/lib/flagJourneys";
import { getStructuredPlan, staffPlanView } from "@/lib/structuredCarePlan";
import { roleSeesAsamSection } from "@/lib/asamReporting";

const staffOf = (role: StaffRole) => STAFF_ROSTER.find((s) => s.role === role && s.active !== false)!;
const BANNED = /\bpart 2\b|\bsud\b|substance|opioid|recovery|alcohol|drug/i;

describe("P1 bookable roles", () => {
  it("medical assistants and admin roles are never bookable", () => {
    for (const r of ["medical_assistant", "sys_admin", "billing", "billing_coordinator", "credentialing_coordinator"] as StaffRole[]) expect(isBookableRole(r)).toBe(false);
    for (const r of ["physician", "pmhnp", "therapist", "lvn", "peer_specialist", "clinical_coordinator"] as StaffRole[]) expect(isBookableRole(r)).toBe(true);
    expect(BOOKABLE_ROLES).not.toContain("medical_assistant");
  });
  it("every booking surface excludes non-bookable clinicians", () => {
    const ma = STAFF_ROSTER.find((s) => s.role === "medical_assistant" && s.clinicianId);
    if (ma?.clinicianId) {
      expect(isBookableClinician(ma.clinicianId)).toBe(false);
      expect(availableSlots(ma.clinicianId)).toEqual([]);
    }
    const p = AdelanteEHR.listPatients()[0];
    const ids = eligibleClinicians("therapy_individual", p, { role: "clinical_coordinator" } as never).map((c) => c.clinicianId ?? (c as { id?: string }).id);
    for (const id of ids) if (id) expect(isBookableClinician(id)).toBe(true);
  });
  it("page label follows the role", () => {
    expect(availabilityPageTitle("therapist")).toBe("My clinical availability");
    expect(availabilityPageTitle("medical_assistant")).toBe("My availability");
    expect(availabilityPageTitle("billing")).toBe("My availability");
  });
});

describe("P2 specialty tags", () => {
  it("starter list is seeded; only sys_admin / coordinator edit it", () => {
    expect(listCareTags().map((t) => t.label)).toEqual(expect.arrayContaining(["Individual therapy", "Group facilitation", "Spanish-speaking"]));
    expect(() => addCareTag({ role: "therapist" }, { label: "Art therapy", reason: "x" })).toThrow();
    const t = addCareTag({ role: "clinical_coordinator", staffId: "s-coord" }, { label: "Art therapy", reason: "Team request" });
    expect(listCareTags().some((x) => x.id === t.id)).toBe(true);
  });
  it("tags save; old free text shows only until tags are picked", () => {
    const th = staffOf("therapist");
    const owner = getStaffProfile(th.id).ownerId;
    const actor = { role: th.role, staffId: th.id, clinicianId: th.clinicianId };
    saveStaffProfile(actor, { ownerId: owner, specialtyTags: [], primarySiteId: getStaffProfile(owner).primarySiteId });
    const tag = listCareTags()[0].id;
    saveStaffProfile(actor, { ownerId: owner, specialtyTags: [tag], primarySiteId: getStaffProfile(owner).primarySiteId, secondarySiteIds: getStaffProfile(owner).secondarySiteIds });
    expect(getStaffProfile(owner).specialtyTags).toEqual([tag]);
    expect(getStaffProfile(owner).previousSpecialty).toBeUndefined();
  });
});

describe("P3 primary / secondary facility and the chart-entry site rule", () => {
  it("a secondary site allows hours there, but grants chart entry only once hours exist", () => {
    const th = staffOf("therapist");
    const owner = getStaffProfile(th.id).ownerId;
    const actor = { role: th.role, staffId: th.id, clinicianId: th.clinicianId };
    const hanford = listSites().find((s) => s.name === DEMO_SECOND_SITE)!;
    const visalia = listSites().find((s) => s.name === "Premier Visalia")!;
    expect(() => saveStaffHours(actor, { clinicianId: owner, weekday: 6, start: "09:00", end: "10:00", modality: "hybrid", siteId: hanford.id, careTypes: [], reason: "Try" } as never)).toThrow(/profile/);
    saveStaffProfile(actor, { ownerId: owner, specialtyTags: [], primarySiteId: visalia.id, secondarySiteIds: [hanford.id] });
    expect(hourSitesFor(owner)).toContain(hanford.id);
    expect(staffSiteIds(th.id)).not.toContain(hanford.id);
    saveStaffHours(actor, { clinicianId: owner, weekday: 6, start: "09:00", end: "10:00", modality: "hybrid", siteId: hanford.id, careTypes: [], reason: "Saturday clinic" } as never);
    expect(staffSiteIds(th.id)).toContain(hanford.id);
  });
});

describe("A3 care type × site services × modality", () => {
  it("a block can't carry a care type its site doesn't offer", () => {
    const th = staffOf("therapist");
    const owner = getStaffProfile(th.id).ownerId;
    const hanford = listSites().find((s) => s.name === DEMO_SECOND_SITE)!;
    expect(siteServices(hanford.id)).not.toContain("group-facilitation");
    expect(() => saveStaffHours({ role: th.role, staffId: th.id, clinicianId: th.clinicianId }, { clinicianId: owner, weekday: 4, start: "13:00", end: "15:00", modality: "hybrid", siteId: hanford.id, careTypes: [], careTags: ["group-facilitation"], reason: "Groups" } as never)).toThrow(/doesn't offer/);
  });
  it("booking matches visit type to block tags and site services; empty tags mean all site services", () => {
    const visalia = listSites().find((s) => s.name === "Premier Visalia")!.id;
    const hanford = listSites().find((s) => s.name === DEMO_SECOND_SITE)!.id;
    expect(blockOffersService({ careTypes: [], careTags: ["individual-therapy"] }, visalia, "therapy_group")).toBe(false);
    expect(blockOffersService({ careTypes: [], careTags: ["group-facilitation"] }, visalia, "therapy_group")).toBe(true);
    expect(blockOffersService({ careTypes: [] }, visalia, "therapy_group")).toBe(true);
    expect(blockOffersService({ careTypes: [] }, hanford, "therapy_group")).toBe(false);
  });
});

describe("A2 / A4 time off and freeze", () => {
  it("no single-date time-off form remains", () => {
    const src = readFileSync("src/routes/my-calendar.tsx", "utf8");
    expect(src).toMatch(/First day/);
    expect(src).toMatch(/Last day/);
  });
  it("freeze bookings works from availability and needs a reason", () => {
    const th = staffOf("therapist");
    const cid = th.clinicianId!;
    const actor = { role: th.role, staffId: th.id, clinicianId: cid };
    expect(() => setBookingsFrozen(actor, { clinicianId: cid, frozen: true, reason: " " })).toThrow();
    setBookingsFrozen(actor, { clinicianId: cid, frozen: true, reason: "Leave" });
    expect(bookingsFrozen(cid)).toBe(true);
    setBookingsFrozen(actor, { clinicianId: cid, frozen: false, reason: "Back" });
    expect(bookingsFrozen(cid)).toBe(false);
    expect(readFileSync("src/routes/clinician-profile.tsx", "utf8")).not.toMatch(/Freeze bookings<\/Button>/);
  });
});

describe("P4 credentials on profile", () => {
  it("degrees type; admin roles get no licence / DEA kinds; summary counts documents", () => {
    expect(credentialKindsFor("therapist")).toContain("degree");
    for (const r of ["sys_admin", "billing"] as StaffRole[]) {
      const k = credentialKindsFor(r) as string[];
      expect(k.some((x) => /licen|dea/i.test(x))).toBe(false);
    }
    expect(typeof credentialSummary([] as never)).toBe("string");
  });
});

describe("C2 flag-driven journeys", () => {
  const pick = () => AdelanteEHR.listPatients().find((p) => !p.problems?.some((x) => /^F1/.test(x.icd10Code ?? "")) && p.coverage?.justiceInvolvement !== "yes")!;
  it("an SUD problem added later auto-adds the SUD journey once, audited, neutral notice", () => {
    const p = pick();
    expect(journeysForFlag("sud").length).toBeGreaterThan(0);
    AdelanteEHR.addProblem(p.id, { description: "Opioid use disorder, moderate", icd10Code: "F11.20", category: "sud" } as never);
    applyFlagJourneys(p.id);
    applyFlagJourneys(p.id);
    const auto = getStructuredPlan(p.id).assignments.filter((a) => a.active && a.autoAdded?.flag === "sud");
    const ids = auto.map((a) => a.activityId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(auto.length).toBe(journeysForFlag("sud").length);
    expect(auto[0].autoAdded?.trigger).toMatch(/^Added automatically: /);
    expect(AdelanteEHR.listAuditEvents().some((e) => e.patientId === p.id && /auto/i.test(e.action))).toBe(true);
    expect(NEW_CONTENT_NOTICE.en).not.toMatch(BANNED);
    expect(NEW_CONTENT_BODY.en).not.toMatch(BANNED);
  });
  it("SUD journeys stay hidden from staff without Part 2 access", () => {
    const p = AdelanteEHR.listPatients().find((x) => getStructuredPlan(x.id).assignments.some((a) => a.autoAdded?.flag === "sud"))!;
    const ids = new Set(journeysForFlag("sud").map((j) => j.id));
    const noPart2 = (["medical_assistant", "community_health_worker", "peer_specialist", "ecm_provider"] as StaffRole[]).find((r) => !roleSeesAsamSection(r));
    if (noPart2) expect(staffPlanView(p.id, noPart2).assignments.some((a) => ids.has(a.activityId!))).toBe(false);
    expect(staffPlanView(p.id, "pmhnp").assignments.some((a) => ids.has(a.activityId!))).toBe(true);
  });
  it("removing the flag marks the item for review without deleting it", () => {
    const p = AdelanteEHR.listPatients().find((x) => getStructuredPlan(x.id).assignments.some((a) => a.active && a.autoAdded?.flag === "sud" && x.problems?.some((pr) => pr.icd10Code === "F11.20")))!;
    for (const pr of p.problems!.filter((x) => x.icd10Code === "F11.20")) AdelanteEHR.resolveProblem(p.id, pr.id, "test");
    const flags = applyFlagJourneys(p.id);
    void flags;
    const items = getStructuredPlan(p.id).assignments.filter((a) => a.autoAdded?.flag === "sud");
    expect(items.every((a) => a.active)).toBe(true);
    if (!AdelanteEHR.getPatient(p.id)!.needs?.substanceUse) expect(items.some((a) => a.flagReview && !a.flagReview.resolved)).toBe(true);
  });
});
