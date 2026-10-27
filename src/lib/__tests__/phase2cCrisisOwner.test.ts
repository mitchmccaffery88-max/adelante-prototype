import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR, resolveCrisisOwner } from "@/lib/ehr";
import { STAFF_ROSTER } from "@/lib/roles";
import { _resetOnCall, addOnCallShift } from "@/lib/onCall";
import vectors from "@/lib/persistence/crisisOwnerVectors.json";

describe("Phase 2c shared crisis-owner vectors", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27T12:00:00Z")); _resetOnCall(); });
  afterEach(() => { _resetOnCall(); vi.useRealTimers(); });
  for (const vector of vectors) {
    it(vector.id, () => {
      const base = AdelanteEHR.listPatients()[0];
      const clinician = STAFF_ROSTER.find((s) => s.role === "therapist" && s.active !== false && s.clinicianId);
      const manager = STAFF_ROSTER.find((s) => s.role === "ecm_provider" && s.active !== false && s.caseManagerId);
      if (!base || !clinician || !manager) throw new Error("Missing real store seed fixture");
      const p = { ...base, primaryClinicianId: vector.assigned === "clinician" ? clinician.clinicianId : undefined, caseManagerId: vector.assigned === "care_manager" ? manager.caseManagerId : undefined };
      if (vector.shift) addOnCallShift({ role: "sys_admin" }, { staffId: clinician.id, start: vector.shift === "in_range" ? "2026-10-27T11:00:00Z" : "2026-10-27T09:00:00Z", end: vector.shift === "in_range" ? "2026-10-27T13:00:00Z" : "2026-10-27T12:00:00Z" }, "fictional_vector");
      const owner = resolveCrisisOwner(p, vector.category === "sdoh" ? "sdoh" : "clinical");
      expect(owner?.id ?? null).toBe(vector.expected === "clinician" ? clinician.id : vector.expected === "care_manager" ? manager.id : null);
      expect(owner === undefined).toBe(vector.fallback);
    });
  }
});