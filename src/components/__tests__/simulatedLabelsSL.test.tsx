// @vitest-environment jsdom
import "@/test/freezeClock";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SimulatedBadge } from "@/components/SimulatedBadge";
import { EligibilityHistoryCard } from "@/components/coverage/EligibilityHistoryCard";
import { VerificationSourceBadge } from "@/components/coverage/VerificationSourceBadge";
import { FEATURE_FLAGS } from "@/lib/features";
import { CHART_ACTIONS, PUBLIC_WEBSITE_ACTIONS } from "@/lib/chartActions";
import { runAction } from "@/lib/actions/runAction";
import { AdelanteEHR, type CoverageVerificationRecord } from "@/lib/ehr";
import { STAFF_ROLES, setActingStaff } from "@/lib/roles";
import { hieAudit } from "@/lib/hie";
import { adelDraftAudit } from "@/lib/adelDrafts";
import { getAdelBrief, adelSummary } from "@/lib/adelBrief";

afterEach(cleanup);
const flags = ["hie_simulated", "voice_intake", "adel_drafts", "placeholder_lab", "cures_placeholder", "eligibility_simulated", "erx_simulated", "telehealth_simulated", "caloms_export_simulated", "notifications_simulated", "payments_simulated", "scribe_simulated", "llm_simulated", "calendar_sync_simulated", "consent_upload_simulated"] as const;
function patient() {
  const p = AdelanteEHR.listPatients()[0];
  if (!p) throw new Error("Missing demo patient");
  return p;
}
describe("SL all 15 simulated flags: rendered bilingual label and audit contract", () => {
  it("covers the exact simulated registry, excluding outpatient switch", () => {
    expect(FEATURE_FLAGS.filter(f => f.simulated).map(f => f.id).sort()).toEqual([...flags].sort());
    expect(FEATURE_FLAGS.find(f => f.id === "in_facility")?.simulated).toBe(false);
  });
  it("the named public website allowlist is exact and each entry permits no staff actor", () => {
    // 26 Oct (Mitch): only these registry actions run with no staff actor.
    expect([...PUBLIC_WEBSITE_ACTIONS].sort()).toEqual(["resource_public_report", "website_auth_preview", "website_intake_submit", "website_signup"]);
    const p = patient();
    for (const id of PUBLIC_WEBSITE_ACTIONS) {
      const action = CHART_ACTIONS.find(a => a.id === id);
      if (!action) throw new Error(`Missing public website action ${id}`);
      expect(STAFF_ROLES.some(r => action.allowed({ role: r.key, staffId: "s-admin1" }, p).state !== "hidden"), id).toBe(false);
    }
  });
  for (const flag of flags) {
    it(`${flag}: renders English and Spanish integration context`, () => {
      const en = render(<SimulatedBadge flag={flag} />);
      expect(en.container.querySelector(`[data-simulated-flag="${flag}"]`)?.textContent).toMatch(/^Simulated/);
      en.unmount();
      const es = render(<SimulatedBadge flag={flag} lang="es" />);
      expect(es.container.querySelector(`[data-simulated-flag="${flag}"]`)?.textContent).toMatch(/^Simulado/);
    });
    it(`${flag}: every tied registry action writes exactly one simulated action audit`, () => {
      const p = patient();
      for (const action of CHART_ACTIONS.filter(a => a.flags?.includes(flag))) {
        // 26 Oct (Mitch): named public website actions run with no staff actor; everything else must have one.
        if ((PUBLIC_WEBSITE_ACTIONS as readonly string[]).includes(action.id)) continue;
        const role = STAFF_ROLES.find(r => action.allowed({ role: r.key, staffId: "s-admin1" }, p).state !== "hidden")?.key;
        if (!role) throw new Error(`No permitted actor for ${action.id}`);
        // Isolate registry transport, not clinical store correctness (tested separately).
        const stores = action.store;
        action.store = [{ name: "sl_audit_transport", fn: () => ({ ok: true }) }];
        try {
          const before = AdelanteEHR.listAuditEvents({ category: "action" }).length;
          const result = runAction(action.id, { role, staffId: "s-admin1" }, p);
          expect(result.ok, action.id).toBe(true);
          expect(result.event.detail?.simulated, action.id).toBe(true);
          expect(result.event.detail?.outcome, action.id).not.toBe("succeeded");
          expect(AdelanteEHR.listAuditEvents({ category: "action" }).length).toBe(before + 1);
        } finally { action.store = stores; }
      }
      // Surface-only flags do not invent actions/audits; private browser voice has no audit sink.
      if (flag === "voice_intake") expect(CHART_ACTIONS.filter(a => a.flags?.includes(flag))).toHaveLength(0);
    });
  }
});
describe("SL real integration paths, no invented verification", () => {
  it("electronic click shows disconnected result and simulated audits but creates no verification", () => {
    setActingStaff("s-bill1", "billing");
    const p = patient();
    const before = JSON.stringify(p.coverage?.verifications ?? []);
    const actionCount = AdelanteEHR.listAuditEvents({ category: "action" }).length;
    const ui = render(<EligibilityHistoryCard patientId={p.id} canCheck onRecordManual={() => {}} />);
    fireEvent.click(ui.getByTestId("check-electronically"));
    expect(ui.getByTestId("eligibility-not-connected").textContent).toContain("Electronic eligibility isn't connected yet");
    expect(JSON.stringify(p.coverage?.verifications ?? [])).toBe(before);
    expect(AdelanteEHR.listAuditEvents({ category: "action" }).length).toBe(actionCount + 1);
    const audits = AdelanteEHR.listAuditEvents({ patientId: p.id });
    expect(audits.find(e => e.action === "eligibility_check_attempted")?.detail?.simulated).toBe(true);
    expect(audits.find(e => e.detail?.actionId === "eligibility_check")?.detail?.simulated).toBe(true);
  });
  it("real staff-reported verification does not receive an integration label", () => {
    const ui = render(<VerificationSourceBadge record={{ channel: "phone_county", checkedAt: "2026-10-24", checkedBy: "Staff", result: "verified" } as CoverageVerificationRecord} />);
    expect(ui.container.querySelector("[data-simulated-flag]")).toBeNull();
  });
  it("HIE and rule-based draft real audit helpers retain simulated metadata", () => {
    const p = patient();
    hieAudit("sl_hie_review", p.id, { name: "SL reviewer", role: "sys_admin" }, {});
    adelDraftAudit("progress_note", "drafted", p.id, { name: "SL reviewer", role: "sys_admin" });
    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).find(e => e.action === "sl_hie_review")?.detail?.simulated).toBe(true);
    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).find(e => e.action === "adel_draft_drafted")?.detail?.simulated).toBe(true);
    adelSummary(getAdelBrief(p, "physician"), { role: "physician", staffId: "s-np1" });
    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).find(e => e.action === "adel_summary_generated")?.detail?.simulated).toBe(true);
  });
});