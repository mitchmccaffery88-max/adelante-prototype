// §B2-4 — a typed record naming an EXTERNAL recipient never opens an internal gate.
import "@/test/freezeClock";
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type ConsentCategory } from "@/lib/ehr";
import { coordinatorSudCanRead, COORDINATOR_SUD_ITEMS } from "@/lib/coordinatorSudAccess";
import { coordinatorConsentedPatients } from "@/lib/asamReporting";
import { canAccess, STAFF_ROSTER } from "@/lib/roles";
import { captureExternal } from "@/test/consentEnforcementB2Scenario";

const coord = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator")!;
const viewer = { role: "clinical_coordinator" as const, staffId: coord.id, name: coord.name };
const CATS = ["sud_treatment", "telehealth_services", "group_confidentiality_ack"] as ConsentCategory[];

describe("B2-4 external-recipient records", () => {
  it("Valley Clinic records for TPO, specific, counseling, telehealth and group grant no internal access", () => {
    const pid = "p2"; // no legacy flag, no untyped record
    const p = AdelanteEHR.getPatient(pid)!;
    const before = {
      cats: CATS.map((c) => AdelanteEHR.isConsentCategoryAuthorized(pid, c)),
      coord: [...COORDINATOR_SUD_ITEMS, "counseling_notes" as const].map((i) => coordinatorSudCanRead(viewer, p, i)),
      cm: canAccess("cf_care_manager", "screeners_sud", p),
      cohort: coordinatorConsentedPatients().map((x) => x.id),
    };
    expect(captureExternal(pid).every(Boolean)).toBe(true);
    expect(AdelanteEHR.listConsentRecords(pid).filter((r) => r.consentType && r.status === "active").length).toBe(5);
    const after = {
      cats: CATS.map((c) => AdelanteEHR.isConsentCategoryAuthorized(pid, c)),
      coord: [...COORDINATOR_SUD_ITEMS, "counseling_notes" as const].map((i) => coordinatorSudCanRead(viewer, AdelanteEHR.getPatient(pid)!, i)),
      cm: canAccess("cf_care_manager", "screeners_sud", AdelanteEHR.getPatient(pid)!),
      cohort: coordinatorConsentedPatients().map((x) => x.id),
    };
    expect(after).toEqual(before);
    expect(after.cats).toEqual([false, false, false]);
    expect(after.coord.every((x) => x === false)).toBe(true);
  });
});
