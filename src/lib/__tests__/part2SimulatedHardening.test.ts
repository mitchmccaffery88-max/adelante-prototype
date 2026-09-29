import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { classifyPart2, needsMergeHold, isHeldAfterMerge } from "@/lib/mergePart2";
import { mergePatients, heldItemsFor } from "@/lib/patientMerge";
import { buildTrackingRows } from "@/lib/trackingTimeline";
import { runAction, actionIsSimulated, confirmationFor } from "@/lib/actions/runAction";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { FEATURE_FLAGS, VENDOR_FLAGS, SIMULATED_SURFACE_LABELS, featureFlag } from "@/lib/features";

type Row = Record<string, unknown>;
type In = Parameters<typeof AdelanteEHR.createPatient>[0];
const PRIYA = { staffId: "s-cc1", name: "Priya Raman", role: "clinical_coordinator" };
let n = 0;
const pair = (): [Patient, Patient] => {
  const last = `Hrd${++n}${Math.floor(Math.random() * 1e6)}`;
  const a = AdelanteEHR.createPatient({ firstName: "Ana", lastName: last, dob: "1985-05-05", matchSource: "seed" } as unknown as In);
  const b = AdelanteEHR.createPatient({ firstName: "Anna", lastName: `${last}q`, dob: "1985-05-05", matchSource: "seed" } as unknown as In);
  return [a, b];
};

describe("Part 2 classification uses structured flags only", () => {
  it("SUD flags, sensitive, category, instrument and med classifier mark Part 2", () => {
    expect(classifyPart2({ sudRelated: true })).toBe("part2");
    expect(classifyPart2({ sensitive: true })).toBe("part2");
    expect(classifyPart2({ category: "sud" })).toBe("part2");
    expect(classifyPart2({ noteCategory: "sud" })).toBe("part2");
    expect(classifyPart2({ key: "dast-10", score: 3 })).toBe("part2");
    expect(classifyPart2({ name: "Naltrexone", dose: "50 mg" })).toBe("part2");
  });
  it("structured non-SUD classifications are released", () => {
    expect(classifyPart2({ key: "phq-9", score: 4 })).toBe("not_part2");
    expect(classifyPart2({ name: "Sertraline", dose: "50 mg" })).toBe("not_part2");
    expect(classifyPart2({ category: "mental_health", sensitive: false })).toBe("not_part2");
  });
  it("wording never decides: SUD words in free text of an unclassified row do not release or classify it", () => {
    expect(classifyPart2({ body: "no substance use discussed" })).toBe("unclassified");
    expect(classifyPart2({ body: "plain visit" })).toBe("unclassified");
    // A structured non-SUD row stays released even if its text mentions alcohol.
    expect(classifyPart2({ key: "phq-9", note: "alcohol mentioned" })).toBe("not_part2");
  });
  it("unclassified rows are protected by default", () => {
    expect(needsMergeHold({ id: "x", body: "hello" })).toBe(true);
    expect(needsMergeHold({ key: "gad-7" })).toBe(false);
  });
});

describe("merge holds + Re-confirm consent button path", () => {
  const setup = () => {
    const [a, b] = pair();
    (b as unknown as Row).screenerHistory = [
      { key: "audit", score: 9, completedAt: "2026-03-01" },
      { key: "phq-9", score: 5, completedAt: "2026-03-01" },
    ];
    (b as unknown as Row).careMessages = [{ id: `cm-${n}`, from: "patient", at: "2026-03-01", body: "hi" }];
    const consent = { id: `cr-${n}`, patientId: b.id, formType: "Part2", status: "active" };
    ((AdelanteEHR._mergeStores() as unknown as Record<string, Row[]>).consentRecords ??= []).push(consent);
    const rec = mergePatients({ survivorId: a.id, otherId: b.id, reason: "Same person" }, PRIYA);
    return { a, rec, consent };
  };

  it("holds Part 2 and unclassified items, hides them from every role, releases structured non-SUD", () => {
    const { a, rec } = setup();
    const audit = a.screenerHistory!.find((h) => h.key === "audit")!;
    const phq = a.screenerHistory!.find((h) => h.key === "phq-9")!;
    const msg = (a.careMessages ?? []).find((m) => m.id === `cm-${n}`)!;
    expect(isHeldAfterMerge(audit)).toBe(true);
    expect(isHeldAfterMerge(msg)).toBe(true); // unclassified → protected
    expect(isHeldAfterMerge(phq)).toBe(false);
    expect(buildTrackingRows(a, "sys_admin" as never).some((r) => r.key === "audit")).toBe(false);
    expect(heldItemsFor(rec.id).length).toBeGreaterThan(0);
  });

  it("blocked for a therapist (logged), releases for the coordinator (audited)", () => {
    const { a, rec, consent } = setup();
    const blocked = runAction("patient_merge", { role: "therapist" as never, staffId: "s-th1" }, a, {
      via: "reconfirmConsentAfterMerge",
      args: [consent.id, { staffId: "s-th1", name: "T", role: "therapist" }],
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.event.action).toBe("action.blocked");
    expect(heldItemsFor(rec.id).length).toBeGreaterThan(0);

    const ok = runAction("patient_merge", { role: "clinical_coordinator" as never, staffId: "s-cc1" }, a, {
      via: "reconfirmConsentAfterMerge",
      args: [consent.id, PRIYA],
    });
    expect(ok.ok ? "" : ok.reason).toBe("");
    expect(ok.event.action).toBe("action.succeeded");
    expect(heldItemsFor(rec.id)).toHaveLength(0);
    const evts = AdelanteEHR.listAuditEvents({ patientId: a.id }).map((e) => e.action);
    expect(evts).toContain("consent_reconfirmed_after_merge");
    expect(evts).toContain("part2_consent_reconfirmed_after_merge");
    expect(isHeldAfterMerge(a.screenerHistory!.find((h) => h.key === "audit"))).toBe(false);
  });
});

describe("Simulated: complete enumeration + guards", () => {
  const simulated = FEATURE_FLAGS.filter((f) => f.simulated);

  it("every flag declares simulated as a boolean", () => {
    for (const f of FEATURE_FLAGS) expect(typeof (f as { simulated?: unknown }).simulated, f.id).toBe("boolean");
  });

  it("every vendor file maps to a simulated flag (new vendor without one fails)", () => {
    const dir = join(process.cwd(), "src/lib/vendors");
    const files = readdirSync(dir).filter((x) => x.endsWith(".ts") && x !== "index.ts").map((x) => x.replace(/\.ts$/, ""));
    for (const v of files) {
      expect(VENDOR_FLAGS[v], `vendor ${v} has no flag in VENDOR_FLAGS`).toBeTruthy();
      expect(featureFlag(VENDOR_FLAGS[v]).simulated, v).toBe(true);
    }
  });

  for (const f of simulated) {
    it(`${f.id}: actions audit simulated:true and confirmations say Simulated`, () => {
      const actions = CHART_ACTIONS.filter((a) => (a.flags ?? []).includes(f.id));
      const surface = SIMULATED_SURFACE_LABELS[f.id];
      // Each simulated integration is covered by a registry action or an on-screen label.
      expect(actions.length > 0 || Boolean(surface), `${f.id} has no action and no surface label`).toBe(true);
      if (surface) {
        expect(surface).toMatch(/Simulated/);
        const used = readdirSync(join(process.cwd(), "src/components"), { recursive: true })
          .map(String)
          .filter((p) => p.endsWith(".tsx"))
          .some((p) => readFileSync(join(process.cwd(), "src/components", p), "utf8").includes(`simulatedSurfaceLabel("${f.id}")`));
        expect(used, `${f.id} label not rendered anywhere`).toBe(true);
      }
      const patient = AdelanteEHR.listPatients()[0];
      for (const a of actions) {
        expect(actionIsSimulated(a), a.id).toBe(true);
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
        expect(confirmationFor(a.id, "Saved"), a.id).toMatch(/^Simulated —/);
      }
    });
  }
});
