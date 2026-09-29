import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { runAction } from "@/lib/actions/runAction";
import { billingWorkspace, BLOCKED_DOCS } from "@/lib/billingWorkspace";
import { isFeatureEnabled, listFlagChanges, resetFeatureFlags } from "@/lib/features";

const ev = () => AdelanteEHR.listAuditEvents({ category: "action" });
afterEach(() => resetFeatureFlags());

describe("turn 6 — ops '+ New'", () => {
  it("billing, admin and coordinator menus contain the requested items", () => {
    const menu = (role: string) => CHART_ACTIONS.filter((a) => a.opsMenu && a.allowed({ role: role as never }, undefined).state !== "hidden").map((a) => a.id);
    expect(menu("billing")).toEqual(expect.arrayContaining(["claim_correct", "claim_status", "eligibility_check", "payment_record", "payment_arrangement", "claims_export", "claim_duplicate_review", "superbill", "good_faith_estimate"]));
    expect(menu("sys_admin")).toEqual(expect.arrayContaining(["note_template_create", "scheduling_rule_save", "notification_resend", "feature_flag_set", "open_permissions", "review_matching", "staff_add_user"]));
    expect(menu("clinical_coordinator")).toEqual(expect.arrayContaining(["review_matching", "reconfirm_consent_merged"]));
    for (const id of ["superbill", "good_faith_estimate", "staff_add_user", "staff_reset_signin", "staff_edit_roles"]) {
      const a = CHART_ACTIONS.find((x) => x.id === id)!;
      expect(a.pending && a.comingSoon).toBeTruthy();
    }
    for (const a of CHART_ACTIONS.filter((x) => x.opsMenu)) expect(typeof a.needsPatient === "boolean" || a.id === "eligibility_check" || a.id === "payment_arrangement").toBe(true);
  });

  it("flag toggle needs a reason, is audited, and simulated flags can't go live", () => {
    const admin = { role: "sys_admin" as const, staffId: "s-admin" };
    const n = ev().length;
    expect(runAction("feature_flag_set", admin, undefined, { args: ["in_facility", "on", ""] }).ok).toBe(false);
    const ok = runAction("feature_flag_set", admin, undefined, { args: ["in_facility", "on", "pilot test"] });
    expect(ok.ok).toBe(true);
    expect(isFeatureEnabled("in_facility")).toBe(true);
    expect(listFlagChanges()[0]?.reason).toBe("pilot test");
    const live = runAction("feature_flag_set", admin, undefined, { args: ["hie_simulated", "live", "go"] });
    expect(live.ok).toBe(false);
    expect(live.ok ? "" : live.reason).toMatch(/Requires authorized vendor \+ backend/);
    expect(ev().length - n).toBe(3);
    expect(runAction("feature_flag_set", { role: "billing", staffId: "s-b1" }, undefined, { args: ["in_facility", "off", "x"] }).ok).toBe(false);
  });

  it("billing workspace counts are billing-safe", () => {
    const ws = billingWorkspace("billing", AdelanteEHRExt.listClaims());
    const text = ws.blocked.map((b) => b.reason).join(" ");
    expect(text).not.toMatch(/asam|substance|sud|opioid|alcohol|medical necessity/i);
    for (const b of ws.blocked) expect([BLOCKED_DOCS, "Blocked: no rate on file", "Blocked: payment arrangement not recorded", "Denied: fix and resubmit"]).toContain(b.reason);
    expect(ws.holds.every((c) => c.duplicateReview)).toBe(true);
  });
});
