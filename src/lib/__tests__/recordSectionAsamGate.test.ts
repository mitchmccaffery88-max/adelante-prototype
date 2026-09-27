// §Part 2 — the chart's ASAM section (menu + ?section=asam URL) is hidden for
// roles failing the ASAM Part 2 check, never shown as a locked stub.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { canAccess } from "@/lib/roles";
import { recordSectionVisible } from "@/lib/recordSectionGate";
import { roleSeesAsam } from "@/lib/asamReporting";

describe("ASAM chart section gate", () => {
  const jordan = AdelanteEHR.getPatient(demoScenarioPatientId("sud_no_consent"))!;
  const luis = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented"))!;

  it("hides ASAM from ECM and care manager when they fail the check", () => {
    for (const role of ["ecm_provider", "cf_care_manager", "medical_assistant"] as const) {
      const a = canAccess(role, "screeners_sud", jordan);
      expect(roleSeesAsam(role, jordan)).toBe(false);
      expect(recordSectionVisible("screeners_sud", a)).toBe(false);
    }
  });

  it("section visibility always agrees with roleSeesAsam", () => {
    for (const p of [jordan, luis]) {
      for (const role of ["ecm_provider", "cf_care_manager", "therapist", "pmhnp", "peer_specialist", "clinical_trainee"] as const) {
        expect(recordSectionVisible("screeners_sud", canAccess(role, "screeners_sud", p))).toBe(
          roleSeesAsam(role, p),
        );
      }
    }
  });

  it("non-Part 2 locked sections still list (locked note)", () => {
    expect(recordSectionVisible("demographics", { level: "read", locked: true })).toBe(true);
  });
});
