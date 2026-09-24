import { signClaimViaNote } from "@/test/claimSigning";
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AdelanteEHR } from "@/lib/ehr";
import {
  AdelanteEHRExt,
  BILLING_WRITE_REFUSED,
  CLAIM_TRANSITIONS,
  claimBillingBucket,
  claimBucketCounts,
} from "@/lib/ehr-ext";
import { billingStatusCounts } from "@/components/billing/BillingStatusSummary";
import { setActingRole, setActingStaff, type StaffRole } from "@/lib/roles";

function actAs(role: string, staffId: string) {
  setActingStaff(staffId);
  setActingRole(role as StaffRole);
}

let slot = 0;
function freshClaim() {
  const c = AdelanteEHR.listClinicians()[0]!;
  const patientId = AdelanteEHR.listPatients()[0]!.id;
  slot += 1;
  const a = AdelanteEHR.bookAppointment({
    patientId,
    clinicianId: c.id,
    start: new Date(Date.now() + 86400_000 * (40 + slot)).toISOString(),
    durationMin: 30,
  });
  AdelanteEHR.updateAppointmentStatus(a.id, "attended");
  return AdelanteEHRExt.claimForEncounter(a.id)!;
}

function walkTo(id: string, states: string[]) {
  for (const s of states) {
    const r = AdelanteEHRExt.transitionClaim(id, s as never, { denialReason: "x" });
    expect(r).toEqual({ ok: true });
  }
}

describe("Phase 7b — claim as the single billing source", () => {
  beforeEach(() => actAs("billing", "s-bill1"));

  it("maps claim states onto the familiar labels", () => {
    expect(claimBillingBucket("documented")).toBe("draft");
    expect(claimBillingBucket("coded")).toBe("draft");
    expect(claimBillingBucket("generated")).toBe("ready");
    expect(claimBillingBucket("written_off")).toBe("write_off");
    expect(claimBillingBucket("partial")).toBe("partial");
    expect(CLAIM_TRANSITIONS.paid).toEqual([]);
    expect(CLAIM_TRANSITIONS.written_off).toEqual(["generated"]);
  });

  it("an attended visit opens a documented claim priced from the rate table (7c)", () => {
    const c = freshClaim();
    expect(c.state).toBe("documented");
    expect(["priced", "no_rate"]).toContain(c.rateStatus);
    if (c.rateStatus === "priced") expect(c.chargeCents).toBe((c.rateCentsPerUnit ?? 0) * (c.units ?? 1));
  });

  it("refuses Sys Admin at the data layer and changes nothing", () => {
    const c = freshClaim();
    signClaimViaNote(c);
    actAs("sys_admin", "s-admin1");
    const before = JSON.stringify(c);
    expect(AdelanteEHRExt.transitionClaim(c.id, "coded")).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
    expect(JSON.stringify(c)).toBe(before);
  });

  it("billing roles write, attributed to the real acting staff, and audited", () => {
    for (const role of ["billing", "billing_coordinator"]) {
      actAs(role, role === "billing" ? "s-bill1" : "s-bc1");
      const c = freshClaim();
      signClaimViaNote(c);
      expect(AdelanteEHRExt.transitionClaim(c.id, "coded")).toEqual({ ok: true });
      const last = c.history.at(-1)!;
      expect(last.role).toBe(role);
      expect(last.actor).toBeTruthy();
      expect(last.actor).not.toBe("billing_coordinator");
      const audit = AdelanteEHR.listAuditEvents({ category: "clinical" }).find(
        (e) => e.action === "claim_status_changed" && e.detail?.["claimId"] === c.id && e.detail?.["to"] === "coded",
      );
      expect(audit?.actorRole).toBe(role);
    }
  });

  it("rejects illegal moves and denial without reason", () => {
    const c = freshClaim();
    expect(AdelanteEHRExt.transitionClaim(c.id, "paid").ok).toBe(false);
    signClaimViaNote(c);
    walkTo(c.id, ["coded", "generated", "submitted"]);
    expect(AdelanteEHRExt.transitionClaim(c.id, "denied").ok).toBe(false);
  });

  it("note signing (clinician) still advances documented -> signed", () => {
    actAs("therapist", "s-th1");
    const c = freshClaim();
    signClaimViaNote(c);
    expect(c.state).toBe("signed");
    // …but a clinician cannot use the billing path.
    expect(AdelanteEHRExt.transitionClaim(c.id, "coded").ok).toBe(false);
  });

  it("write-off is reversible with a reason, billing roles only", () => {
    const c = freshClaim();
    expect(AdelanteEHRExt.transitionClaim(c.id, "written_off").ok).toBe(false);
    walkTo(c.id, ["written_off"]);
    expect(AdelanteEHRExt.transitionClaim(c.id, "generated")).toEqual({
      ok: false,
      error: "A reason is required to reverse a write-off.",
    });
    actAs("sys_admin", "s-admin1");
    expect(AdelanteEHRExt.transitionClaim(c.id, "generated", { note: "late payment" }).ok).toBe(false);
    expect(c.state).toBe("written_off");
    actAs("billing_coordinator", "s-bc1");
    expect(AdelanteEHRExt.transitionClaim(c.id, "generated", { note: "late payment" })).toEqual({ ok: true });
    expect(c.history.at(-1)?.note).toBe("late payment");
    const audit = AdelanteEHR.listAuditEvents({ category: "clinical" }).find(
      (e) => e.action === "claim_status_changed" && e.detail?.["claimId"] === c.id && e.detail?.["from"] === "written_off",
    );
    expect(audit?.detail?.["reason"]).toBe("late payment");
  });

  it("billing page summary, pilot card and claims worklist agree", () => {
    const claims = AdelanteEHRExt.listClaims();
    expect(billingStatusCounts(claims)).toEqual(claimBucketCounts(claims));
    expect(AdelanteEHR.stats().billing).toEqual(claimBucketCounts(claims));
    const c = freshClaim();
    signClaimViaNote(c);
    walkTo(c.id, ["coded", "generated"]);
    expect(AdelanteEHR.exportIslReport).toBeTypeOf("function");
    expect(claimBillingBucket(AdelanteEHRExt.claimForEncounter(c.encounterId)!.state)).toBe("ready");
  });

  it("old parallel paths and scattered amounts are gone", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== "__tests__") walk(p);
        } else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk("src");
    const all = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(all).not.toMatch(/transitionBilling\(|advanceClaim\(|billingStatus:/);
    expect(all).not.toMatch(/\?\? (12000|6000|5000)\b/);
    expect(all).not.toMatch(/claimChargeCents\(/);
  });
});
