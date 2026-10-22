// §B2-4 — enforcement switch. Draft — pending clinical sign-off / counsel.
// Precedence: a typed record that APPLIES (type + program recipient + purpose,
// plus item for part2_specific_written) decides via consentCovers; otherwise
// today's source answers (Option A, until B2-5). Emergency path byte-identical.
import "@/test/freezeClock";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { PART2_ELEMENT_KEYS } from "@/lib/consentRecordModel";
import { coordinatorSudCanRead, coordinatorEmergencyFor } from "@/lib/coordinatorSudAccess";
import { STAFF_ROSTER } from "@/lib/roles";

const ROLLBACK = "0089ca4fda285ead2c0632f8cf16c30c53f732c4";
const els = Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true]));
const staff = { role: "ecm_provider" as const, staffId: "s-ecm", staffName: "ECM B24" };
const actor = { role: "ecm_provider" as const, staffId: "s-ecm", name: "ECM B24" };
const coord = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator")!;
const viewer = { role: "clinical_coordinator" as const, staffId: coord.id, name: coord.name };

function capture(pid: string, d: Record<string, unknown>, expiresOn = "2027-10-21") {
  const r = runAction("consent_record_capture", staff, AdelanteEHR.getPatient(pid), {
    args: [{ draft: { patientId: pid, items: ["diagnoses"], expiresOn, part2Elements: els, ...d }, method: "e_sign", signer: "B24 Signer", relationship: "patient", attested: true, actor }],
  });
  expect(r.ok, JSON.stringify(r)).toBe(true);
  return AdelanteEHR.listConsentRecords(pid).find((x) => x.consentType === d.consentType && x.status === "active")!;
}
const revoke = (id: string, pid: string) => {
  const r = runAction("consent_record_revoke", staff, AdelanteEHR.getPatient(pid), { args: [{ recordId: id, method: "in_person", note: "Patient asked", actor }] });
  expect(r.ok, JSON.stringify(r)).toBe(true);
};
const program = [{ kind: "org", name: "Adelante" }];
const coordTeam = [{ kind: "org", name: "Adelante care coordination team" }];
const sud = (pid: string) => AdelanteEHR.isConsentCategoryAuthorized(pid, "sud_treatment");

describe("B2-4 precedence", () => {
  it("Option A: a legacy-flag patient keeps today's answer when no typed record applies", () => {
    expect(sud("p3")).toBe(true); // legacy flag, no untyped record
    expect(sud("p2")).toBe(false);
  });

  it("a program-recipient TPO record with the treatment purpose grants; revoking it denies with no fallback", () => {
    const rec = capture("p2", { consentType: "part2_tpo_single", recipients: program, purpose: "treatment", purposeCode: "treatment" });
    expect(sud("p2")).toBe(true);
    revoke(rec.id, "p2");
    expect(sud("p2")).toBe(false);
  });

  it("an applicable revoked record overrides a legacy flag (narrows, never falls back)", () => {
    const rec = capture("p4", { consentType: "part2_tpo_single", recipients: program, purpose: "treatment", purposeCode: "treatment" });
    revoke(rec.id, "p4");
    expect(sud("p4")).toBe(false);
  });

  it("a superseded record does not grant once its renewal is revoked", () => {
    const pid = "p-demo-mar-seed";
    const a = capture(pid, { consentType: "part2_tpo_single", recipients: program, purpose: "treatment", purposeCode: "treatment" });
    const r = runAction("consent_record_renew", staff, AdelanteEHR.getPatient(pid), { args: [{ recordId: a.id, method: "e_sign", signer: "B24 Signer", relationship: "patient", attested: true, actor, expiresOn: "2027-12-01" }] });
    expect(r.ok).toBe(true);
    expect(AdelanteEHR.listConsentRecords(pid).find((x) => x.id === a.id)!.status).toBe("superseded");
    const b = AdelanteEHR.listConsentRecords(pid).find((x) => x.consentType === "part2_tpo_single" && x.status === "active")!;
    revoke(b.id, pid);
    expect(sud(pid)).toBe(false);
  });

  it("an expired applicable record denies at read time", () => {
    const pid = AdelanteEHR.listPatients().find((p) => p.firstName === "Tomás")!.id;
    capture(pid, { consentType: "part2_tpo_single", recipients: program, purpose: "treatment", purposeCode: "treatment" }, "2026-10-01");
    expect(sud(pid)).toBe(true);
    vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));
    expect(sud(pid)).toBe(false);
    vi.setSystemTime(new Date("2026-09-29T15:00:00.000Z"));
  });

  it("a legacyUnverified applicable record denies", () => {
    const pid = AdelanteEHR.listPatients().find((p) => p.firstName === "Elena")!.id;
    AdelanteEHR.createConsentRecord({
      patientId: pid, formType: "NonAB133", source: "B2-4 test", signedByName: "B24", attested: true, effectiveDate: "2026-09-01",
      sections: [], capturedBy: { staffName: "Migration", role: "system" },
      extension: { consentType: "part2_tpo_single", recipients: [{ kind: "org", name: "Adelante" }], purpose: "treatment", purposeCode: "treatment", legacyUnverified: true, part2Elements: els as never, signature: { method: "e_sign", signer: "B24", relationship: "patient", signedAt: "2026-09-01", recordedAt: "2026-09-01", recordedBy: { staffName: "Migration", role: "system" } } },
    } as never);
    expect(sud(pid)).toBe(false);
  });
});

describe("B2-4 coordinator SUD view", () => {
  const pid = () => AdelanteEHR.listPatients().find((p) => p.firstName === "Paloma")!.id;
  it("TPO to the care-coordination team for care coordination opens B items, never counseling notes", () => {
    capture(pid(), { consentType: "part2_tpo_single", recipients: coordTeam, purpose: "care_coordination", purposeCode: "care_coordination" });
    const p = AdelanteEHR.getPatient(pid())!;
    expect(coordinatorSudCanRead(viewer, p, "diagnoses")).toBe(true);
    expect(coordinatorSudCanRead(viewer, p, "counseling_notes")).toBe(false);
  });
  it("specific written opens only the listed items", () => {
    const id = AdelanteEHR.listPatients().find((p) => p.firstName === "Victor")!.id;
    capture(id, { consentType: "part2_specific_written", recipients: coordTeam, purpose: "care_coordination", purposeCode: "care_coordination", items: ["diagnoses"] });
    const p = AdelanteEHR.getPatient(id)!;
    expect(coordinatorSudCanRead(viewer, p, "diagnoses")).toBe(true);
    expect(coordinatorSudCanRead(viewer, p, "labs")).toBe(false);
  });
  it("counseling notes need a counseling_notes_release record", () => {
    capture(pid(), { consentType: "counseling_notes_release", recipients: coordTeam, purpose: "care_coordination", purposeCode: "care_coordination" });
    expect(coordinatorSudCanRead(viewer, AdelanteEHR.getPatient(pid())!, "counseling_notes")).toBe(true);
  });
  it("a TPO record for a different purpose does not apply (today's answer stays)", () => {
    const id = AdelanteEHR.listPatients().find((p) => p.firstName === "Carmen")!.id;
    capture(id, { consentType: "part2_tpo_single", recipients: coordTeam, purpose: "treatment", purposeCode: "treatment" });
    expect(coordinatorSudCanRead(viewer, AdelanteEHR.getPatient(id)!, "diagnoses")).toBe(false);
  });
});

describe("B2-4 emergency path", () => {
  const FNS = ["coordinatorEmergencyFor", "validateCoordinatorEmergency", "saveCoordinatorEmergencyGrant", "endCoordinatorEmergencyGrant"];
  const body = (src: string, fn: string) => {
    const start = src.indexOf(`export function ${fn}(`);
    expect(start, fn).toBeGreaterThan(-1);
    const next = src.indexOf("\nexport ", start + 1);
    return src.slice(start, next < 0 ? undefined : next);
  };
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const old = (p: string) => execFileSync("git", ["show", `${ROLLBACK}:${p}`], { encoding: "utf8" });
  it("emergency functions and grant store are byte-identical to rollback", () => {
    const now = readFileSync("src/lib/coordinatorSudAccess.ts", "utf8");
    const was = old("src/lib/coordinatorSudAccess.ts");
    for (const fn of FNS) expect(hash(body(now, fn)), fn).toBe(hash(body(was, fn)));
    for (const line of ["const grants = new Map<string, CoordinatorEmergencyGrant>();", "export const EMERGENCY_ACCESS_MS = 4 * 60 * 60 * 1000;"]) expect(now.includes(line) && was.includes(line)).toBe(true);
    expect(hash(readFileSync("src/lib/coordinatorSudEmergency.ts", "utf8"))).toBe(hash(old("src/lib/coordinatorSudEmergency.ts")));
    expect(now).toContain("|| !!coordinatorEmergencyFor(viewer, patient.id, now);");
  });
  it("no grant, no consent: still locked", () => {
    const p = AdelanteEHR.listPatients().find((x) => x.firstName === "Jordan")!;
    expect(coordinatorEmergencyFor(viewer, p.id)).toBeUndefined();
    expect(coordinatorSudCanRead(viewer, p, "diagnoses")).toBe(false);
  });
});
