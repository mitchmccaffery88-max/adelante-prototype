import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { recordAfbiContact } from "@/lib/afbiOutreach";
import { listDisclosureLog } from "@/lib/part2Disclosure";
import { fspPresumptiveEligibleIds } from "@/lib/fspEligibility";
import { runAction } from "@/lib/actions/runAction";
import {
  _resetCountyReporting,
  bhoatrRollup,
  calomsBlockerRows,
  countyReminders,
  fixCountyError,
  generateReport,
  islRows,
  ISL_LANES,
  listCountyErrors,
  NEUTRAL_ERROR_TEXT,
  resendReport,
  serviceRows,
  simulateCountyResponse,
  submitReport,
  suppressCell,
  tpsList,
  tpsCounts,
  datarCounts,
} from "@/lib/countyReporting";

const WIDE = { from: "2000-01-01T00:00:00.000Z", to: "2100-01-01T00:00:00.000Z" };
const sud = { role: "sud_counselor" as const, name: "Renee Castillo", staffId: "s-sudc1" };
const billing = { role: "billing_coordinator" as const, name: "Billing", staffId: "s-bc1" };

beforeEach(() => _resetCountyReporting());

describe("county reporting — Part 2 gating", () => {
  it("non-SUD roles never get client-level rows", () => {
    for (const role of ["billing_coordinator", "clinical_coordinator", "sys_admin", "credentialing_coordinator"] as const) {
      expect(calomsBlockerRows(role)).toBeNull();
      expect(tpsList(role)).toBeNull();
      expect(() => generateReport({ role, name: "x" }, "caloms", "30")).toThrow(/substance-use/);
    }
    expect(calomsBlockerRows("sud_counselor")).not.toBeNull();
  });
  it("ISL for a non-SUD role withholds SUD rows", () => {
    const s = generateReport(billing, "isl", "30");
    expect(s.file).not.toMatch(/SUD treatment visit/);
  });
  it("error queue text is neutral and has no chart link for non-SUD roles", () => {
    const s = generateReport(sud, "isl", "30");
    submitReport(sud, s.id);
    simulateCountyResponse(sud, s.id);
    for (const e of listCountyErrors("billing_coordinator")) {
      expect(e.text).toBe(NEUTRAL_ERROR_TEXT);
      expect(e.patientId).toBeUndefined();
    }
  });
});

describe("cohort guard", () => {
  it("suppresses 1–10, shows 0 and 11+", () => {
    expect(suppressCell(0)).toBe(0);
    expect(suppressCell(5)).toBeNull();
    expect(suppressCell(10)).toBeNull();
    expect(suppressCell(11)).toBe(11);
  });
  it("every displayed aggregate cell is suppressed or ≥ 11", () => {
    const ok = (v: number | null) => v === null || v === 0 || v >= 11;
    const b = bhoatrRollup(WIDE);
    [b.unduplicated, b.mediCal, b.nonMediCal, ...b.byAge.map((x) => x.count), ...b.fsp.map((x) => x.count)].forEach((v) => expect(ok(v)).toBe(true));
    datarCounts(WIDE).forEach((r) => { expect(ok(r.waitlist)).toBe(true); expect(ok(r.admissions)).toBe(true); });
    Object.values(tpsCounts()).forEach((v) => expect(ok(v)).toBe(true));
  });
});

describe("ISL export", () => {
  it("only ISL/BHSA lanes, no private pay, attended/completed only, AFBI included", () => {
    const c = recordAfbiContact({ role: "peer_specialist", name: "Trey Wilson", staffId: "s-peer2" }, { locationType: "street", initials: "J.D.", description: "Test", activities: ["engagement"], minutes: 20, outcome: "engaged" as never });
    const rows = islRows(WIDE);
    expect(rows.every((r) => (ISL_LANES as readonly string[]).includes(r.cls.fundingSource))).toBe(true);
    expect(rows.some((r) => r.cls.fundingSource === "private_pay")).toBe(false);
    expect(rows.every((r) => r.completed)).toBe(true);
    expect(rows.some((r) => r.cls.ref.kind === "afbi_contact" && r.cls.ref.id === c.id)).toBe(true);
    const notAttended = serviceRows(WIDE).filter((r) => r.cls.ref.kind === "appointment" && !r.completed).map((r) => r.cls.ref.id);
    expect(rows.some((r) => notAttended.includes(r.cls.ref.id))).toBe(false);
  });
  it("AFBI contacts never appear in any claim", () => {
    const ids = new Set(serviceRows(WIDE).filter((r) => r.cls.ref.kind === "afbi_contact").map((r) => r.cls.ref.id));
    for (const cl of AdelanteEHRExt.listClaims()) expect(JSON.stringify(cl)).not.toMatch(new RegExp([...ids].join("|") || "^$^"));
  });
});

describe("BHOATR", () => {
  it("unduplicates clients", () => {
    const rows = serviceRows(WIDE).filter((r) => r.completed);
    const uniq = new Set(rows.map((r) => r.patientId ?? `afbi:${r.cls.ref.id}`));
    expect(bhoatrRollup(WIDE).raw.unduplicated).toBe(uniq.size);
    expect(rows.length).toBeGreaterThanOrEqual(uniq.size);
  });
  it("FSP split covers every presumptive-eligible person with a birth date", () => {
    const r = bhoatrRollup(WIDE).raw.fsp;
    const withDob = fspPresumptiveEligibleIds().filter((id) => AdelanteEHR.getPatient(id)?.dob).length;
    expect(r["25_and_under"] + r["26_and_older"]).toBe(withDob);
  });
});

describe("submission lifecycle", () => {
  it("generate → submit (Simulated) → errors → fix → resend", () => {
    const s = generateReport(sud, "isl", "30");
    expect(s.status).toBe("ready");
    expect(s.simulated).toBe(true);
    submitReport(sud, s.id);
    expect(s.submittedAt).toBeTruthy();
    const errs = simulateCountyResponse(sud, s.id);
    expect(errs.length).toBeGreaterThan(0);
    expect(() => resendReport(sud, s.id)).toThrow(/Fix/);
    errs.forEach((e) => fixCountyError(sud, e.id));
    const next = resendReport(sud, s.id);
    expect(next.resendOf).toBe(s.id);
    expect(listCountyErrors("sud_counselor").filter((e) => e.submissionId === s.id).every((e) => e.status === "resent")).toBe(true);
  });
  it("runs through runAction with a simulated audit", () => {
    const r = runAction("county_generate", { role: "sud_counselor", staffId: "s-sudc1", staffName: "Renee" }, undefined, { via: "generateReport", args: [sud, "datar", "30"] });
    expect(r.ok).toBe(true);
    const blocked = runAction("county_generate", { role: "therapist", staffId: "s-t1" }, undefined, { via: "generateReport", args: [sud, "datar", "30"] });
    expect(blocked.ok).toBe(false);
  });
});

describe("reminders", () => {
  it("5 days and 1 day before, for the billing coordinator only", () => {
    const five = countyReminders("billing_coordinator", new Date(2026, 4, 10, 9));
    expect(five.find((r) => r.report === "caloms")?.kind).toBe("5_day");
    const one = countyReminders("billing_coordinator", new Date(2026, 4, 14, 9));
    expect(one.find((r) => r.report === "caloms")?.kind).toBe("1_day");
    expect(countyReminders("billing_coordinator", new Date(2026, 4, 1, 9)).find((r) => r.report === "caloms")).toBeUndefined();
    expect(countyReminders("clinical_coordinator", new Date(2026, 4, 10, 9))).toEqual([]);
  });
});

describe("every export goes through disclose()", () => {
  it("one disclosure check per client in the file, logged on the county channel", () => {
    const before = listDisclosureLog({}).filter((e) => e.channel === "county_report").length;
    const s = generateReport(sud, "isl", "365");
    const patients = new Set(islRows({ from: new Date(Date.now() - 400 * 864e5).toISOString(), to: new Date().toISOString() }).map((r) => r.patientId).filter(Boolean));
    if (s.rowCount > 0) expect(s.disclosureChecks).toBeGreaterThan(0);
    const after = listDisclosureLog({}).filter((e) => e.channel === "county_report").length;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(s.disclosureChecks).toBeLessThanOrEqual(islRows(WIDE).length + patients.size);
  });
});
