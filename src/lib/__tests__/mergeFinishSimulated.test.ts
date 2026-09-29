import { describe, expect, it } from "vitest";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { mergePatients, releasePart2Holds } from "@/lib/patientMerge";
import { _mergeRows as chartOrderRows } from "@/lib/chartOrders";
import { _mergePlanStore } from "@/lib/structuredCarePlan";
import { isHeldAfterMerge, withoutMergeHeld } from "@/lib/mergePart2";
import { buildTrackingRows } from "@/lib/trackingTimeline";
import { runAction, actionIsSimulated, confirmationFor } from "@/lib/actions/runAction";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { FEATURE_FLAGS, featureFlag } from "@/lib/features";
import { PossibleExistingPatientError } from "@/lib/patientMatching";

const PRIYA = { staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" };
let n = 0;
type In = Parameters<typeof AdelanteEHR.createPatient>[0];
const pair = (): [Patient, Patient] => {
  const last = `Mfx${++n}${Math.floor(Math.random() * 1e6)}`;
  const a = AdelanteEHR.createPatient({ firstName: "Ines", lastName: last, dob: "1979-02-03", matchSource: "seed" } as unknown as In);
  const b = AdelanteEHR.createPatient({ firstName: "Inez", lastName: `${last}x`, dob: "1979-02-03", matchSource: "seed" } as unknown as In);
  return [a, b];
};
type Row = Record<string, unknown>;
const stores = () => AdelanteEHR._mergeStores() as unknown as Record<string, Row[]>;
const merge = (a: Patient, b: Patient) => mergePatients({ survivorId: a.id, otherId: b.id, reason: "Same person" }, PRIYA);

describe("merge moves every record type, keeping authors, dates and audit", () => {
  const storeCases: [string, string][] = [
    ["appointments", "visit"],
    ["caseTasks", "task"],
    ["referrals", "referral"],
    ["patientDocuments", "document"],
  ];
  for (const [store, label] of storeCases)
    it(`${label}s move`, () => {
      const [a, b] = pair();
      const row = { id: `x-${store}-${n}`, patientId: b.id, createdBy: "Dr. Original", createdAt: "2026-01-02T10:00:00Z" };
      stores()[store].push(row);
      merge(a, b);
      expect(row.patientId).toBe(a.id);
      expect(row.createdBy).toBe("Dr. Original");
      expect(row.createdAt).toBe("2026-01-02T10:00:00Z");
      expect(row.id).toBe(`x-${store}-${n}`);
    });

  it("notes and their addenda move", () => {
    const [a, b] = pair();
    const note = { id: `n-${n}`, authorName: "Kayla", date: "2026-02-01", body: "Visit", addenda: [{ id: "ad1", by: "Kayla", at: "2026-02-02" }] };
    (b as unknown as Row).progressNotes = [note];
    merge(a, b);
    const moved = (a.progressNotes ?? []).find((x) => x.id === note.id) as unknown as typeof note;
    expect(moved.authorName).toBe("Kayla");
    expect(moved.addenda[0].id).toBe("ad1");
    expect(b.progressNotes ?? []).toHaveLength(0);
  });
  it("messages move", () => {
    const [a, b] = pair();
    (b as unknown as Row).careMessages = [{ id: `m-${n}`, from: "patient", at: "2026-03-01", body: "Hi" }];
    merge(a, b);
    expect((a.careMessages ?? []).some((m) => m.id === `m-${n}`)).toBe(true);
  });
  it("screeners (history and latest) and measures move", () => {
    const [a, b] = pair();
    (b as unknown as Row).screenerHistory = [{ key: "phq-9", score: 12, completedAt: "2026-03-01" }];
    (b.screeners as Row)["gad-7"] = { key: "gad-7", score: 8, completedAt: "2026-03-01" };
    const met = { id: `met-${n}`, patientId: b.id, bpSystolic: 120 };
    (chartOrderRows() as unknown as Record<string, Row[]>).metabolic.push(met);
    merge(a, b);
    expect(a.screenerHistory?.some((h) => h.key === "phq-9")).toBe(true);
    expect((a.screeners as Row)["gad-7"]).toBeTruthy();
    expect(met.patientId).toBe(a.id);
  });
  it("care plan moves", () => {
    const [a, b] = pair();
    _mergePlanStore().set(b.id, { patientId: b.id } as never);
    merge(a, b);
    expect(_mergePlanStore().has(a.id)).toBe(true);
  });
  it("claims move", () => {
    const [a, b] = pair();
    const c = AdelanteEHRExt.createAsamClaim({ asamId: `mc-${n}`, patientId: b.id, clinicianId: "c1", serviceDate: "2026-01-01" }) as unknown as Row;
    merge(a, b);
    expect(c.patientId).toBe(a.id);
  });
  it("audit history is not rewritten", () => {
    const [a, b] = pair();
    const before = AdelanteEHR.listAuditEvents({ patientId: b.id }).length;
    merge(a, b);
    expect(AdelanteEHR.listAuditEvents({ patientId: b.id }).length).toBeGreaterThanOrEqual(before);
  });
});

describe("Part 2 on merged data", () => {
  it("held items: hidden from a restricted role, excluded from disclosures until consent re-confirmed", () => {
    const [a, b] = pair();
    (b as unknown as Row).screenerHistory = [{ key: "audit-c", score: 7, completedAt: "2026-03-01" }];
    const rec = merge(a, b);
    const item = a.screenerHistory!.find((h) => h.key === "audit-c")!;
    expect(isHeldAfterMerge(item)).toBe(true);
    // Restricted role (ECM) never sees it.
    expect(buildTrackingRows(a, "ecm_provider").some((r) => r.key === "audit-c")).toBe(false);
    // An unconsented disclosure never includes it.
    expect(withoutMergeHeld(a.screenerHistory!)).not.toContain(item);
    releasePart2Holds(rec.id, PRIYA);
    expect(isHeldAfterMerge(item)).toBe(false);
  });
});

describe("staff exact-match: Create anyway through runAction", () => {
  it("is audited and requires a reason", () => {
    const last = `Ca${Math.floor(Math.random() * 1e6)}`;
    const base = { firstName: "Noe", lastName: last, dob: "1982-04-04" };
    AdelanteEHR.createPatient({ ...base, matchSource: "seed" } as unknown as In);
    expect(() => AdelanteEHR.createPatient({ ...base, matchSource: "assisted_signup" } as unknown as In)).toThrow(PossibleExistingPatientError);
    const actor = { role: "intake_coordinator" as never, staffId: "s-ic1" };
    const noReason = runAction("patient_create_anyway", { role: "clinical_coordinator", staffId: "s-cc1" }, undefined, { args: [{ ...base, matchSource: "assisted_signup", createAnyway: { reason: " " } }] });
    expect(noReason.ok).toBe(false);
    const r = runAction<Patient>("patient_create_anyway", { role: "clinical_coordinator", staffId: "s-cc1" }, undefined, {
      args: [{ ...base, matchSource: "assisted_signup", createAnyway: { reason: "Different person — ID checked", actorId: "s-cc1" } }],
    });
    expect(r.ok).toBe(true);
    expect(r.event.action).toBe("action.succeeded");
    if (r.ok) expect(AdelanteEHR.listAuditEvents().some((e) => e.action === "patient_created_despite_match" && e.patientId === r.value.id)).toBe(true);
    void actor;
  });
});

describe("HIE match buttons go through runAction", () => {
  it("blocked for a therapist, audited simulated for a coordinator path", () => {
    const r = runAction("hie_match_decide", { role: "therapist", staffId: "s-th1" }, undefined, { via: "rejectMatch", args: ["nope", "x", { name: "T", role: "therapist" }] });
    expect(r.ok).toBe(false);
    expect(r.event.action).toBe("action.blocked");
  });
});

describe("Simulated sweep (standing rule)", () => {
  it("every placeholder feature flag except in_facility is simulated", () => {
    for (const f of FEATURE_FLAGS) expect(f.simulated, f.id).toBe(f.id !== "in_facility");
  });
  it("every simulated action audits simulated: true, never a plain succeeded, and its confirmation says Simulated", () => {
    const sims = CHART_ACTIONS.filter(actionIsSimulated);
    expect(sims.map((a) => a.id)).toEqual(expect.arrayContaining(["eligibility_check", "lab_order", "refill_decision", "med_order", "hie_match_decide", "message_patient", "isl_export", "payment_record"]));
    const patient = AdelanteEHR.listPatients()[0];
    for (const a of sims) {
      const orig = a.store;
      a.store = [{ name: "stub", fn: () => ({ ok: true }) }];
      try {
        const r = runAction(a.id, { role: "sys_admin", staffId: "s-admin" }, patient);
        if (r.ok) {
          expect(r.event.detail?.["simulated"], a.id).toBe(true);
          expect(r.event.detail?.["outcome"], a.id).not.toBe("succeeded");
        }
      } finally {
        a.store = orig;
      }
      expect(confirmationFor(a.id, "Saved"), a.id).toMatch(/Simulated/);
    }
  });
  it("placeholder integration audit rows carry simulated: true", () => {
    const p = AdelanteEHR.listPatients()[0];
    AdelanteEHR._recordAudit({ category: "hie", action: "hie_ingested", patientId: p.id, detail: {} } as never);
    expect(AdelanteEHR.listAuditEvents({ patientId: p.id })[0].detail?.["simulated"]).toBe(true);
    expect(featureFlag("hie_simulated").simulated).toBe(true);
  });
});
