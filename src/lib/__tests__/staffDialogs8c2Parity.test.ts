import { describe, expect, it } from "vitest";
import { AdelanteEHR, GROUP_ELIGIBILITY_ROLES } from "@/lib/ehr";
import { chartAction } from "@/lib/chartActions";
import { canAccess, canReadPreRelease, STAFF_ROLES, type StaffRole } from "@/lib/roles";
import { canEditPlan } from "@/lib/structuredCarePlan";
import { auditSafeReason, runAction } from "@/lib/actions/runAction";

// Gates copied from the UI/store code at rollback e231f0dd (file:line in comments).
const w = (role: StaffRole, cls: Parameters<typeof canAccess>[1], p?: ReturnType<typeof AdelanteEHR.listPatients>[number]) => canAccess(role, cls, p).level === "write";
const OLD: Record<string, (role: StaffRole, p: ReturnType<typeof AdelanteEHR.listPatients>[number]) => boolean> = {
  // CarePlanEditor.tsx:65 `!readOnly && canEditPlan(role)`; readOnly = care_plan level read (recordSections.tsx:261)
  plan_goal_close: (r, p) => canEditPlan(r) && w(r, "care_plan", p),
  plan_suggestion_dismiss: (r, p) => canEditPlan(r) && w(r, "care_plan", p),
  // RecordTabs.tsx CarePlanTab `!readOnly` (recordSections.tsx:261)
  plan_summary_clear: (r, p) => w(r, "care_plan", p),
  // GroupEligibilityEditor.tsx:28
  group_eligibility_remove: (r) => (GROUP_ELIGIBILITY_ROLES as readonly string[]).includes(r),
  // group-sessions.tsx:88,149
  group_enrollment_end: (r) => w(r, "group_sessions"),
  // admin-catalog-governance.tsx:83-84
  frequency_delete: (r) => w(r, "catalog_governance"),
  // StaffAdvocatesTab.tsx:40-41; readOnly = consent_ledger level read (recordSections.tsx:442)
  advocate_document_verify: (r, p) => ["ecm_provider", "sys_admin", "cf_care_manager"].includes(r) && w(r, "consent_ledger", p),
  // pre-release.tsx:123 page gate around AdvocateDesignationPanel (pre-release.tsx:772)
  advocate_access_remove: (r) => canReadPreRelease(r),
  // ConsentRecordsPanel.tsx:58 canWrite gate on revoke (store ref consent_capture/revokeConsentRecord)
  consent_capture: (r, p) => w(r, "consent_ledger", p),
};

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patients = AdelanteEHR.listPatients().slice(0, 6);

describe("8c-2 registry parity with rollback UI gates", () => {
  it("every staff role is allowed iff the rollback gate allowed it", () => {
    const table: Record<string, string[]> = {};
    for (const [id, old] of Object.entries(OLD)) {
      const entry = chartAction(id);
      for (const { key } of STAFF_ROLES) {
        for (const p of patients) {
          const now = entry.allowed({ role: key, staffId: "s-test" }, p).state !== "hidden";
          expect(now, `${id} × ${key} × ${p.id}`).toBe(old(key, p));
        }
        if (old(key, patients[0])) (table[id] ??= []).push(key);
      }
    }
    expect(Object.keys(table).length).toBeGreaterThan(0);
  });
});

describe("8c-2 audit reason privacy", () => {
  const patient = patients[0];
  const writer = STAFF_ROLES.map(r => r.key).find(r => OLD.plan_summary_clear(r, patient))!;
  const stub = (id: string) => { const a = chartAction(id); const orig = a.store; a.store = [{ name: "stub", fn: () => ({ ok: true }) }]; return () => { a.store = orig; }; };

  it("scrubs Part 2 terms, SUD medication names, diagnosis codes and the patient's name", () => {
    const raw = `${patient.firstName} ${patient.lastName} stopped buprenorphine, F11.20 and Z59.0, after AUDIT-C`;
    const out = auditSafeReason(raw, patient)!;
    expect(out).not.toMatch(new RegExp(`${esc(patient.firstName)}|${esc(patient.lastName)}|buprenorphine|F11|Z59|audit-c`, "i"));
  });

  it("writes the scrubbed reason, never undefined, and never store argument bodies", () => {
    const restore = stub("plan_summary_clear");
    try {
      const body = "NOTE BODY: patient disclosed private answer text";
      const r = runAction("plan_summary_clear", { role: writer, staffId: "s-test" }, patient, { args: [patient.id, body, "x"], auditReason: `Clear for ${patient.firstName} naltrexone` });
      const text = JSON.stringify(r.event.detail);
      expect(text).not.toContain(body);
      expect(text).not.toMatch(new RegExp(`${patient.firstName}|naltrexone`, "i"));
      for (const blank of ["", "   ", undefined]) {
        const b = runAction("plan_summary_clear", { role: writer, staffId: "s-test" }, patient, { args: [patient.id, "", "x"], auditReason: blank });
        expect(JSON.stringify(b.event.detail)).not.toContain("undefined");
        expect(b.event.detail?.["reason"]).toBeUndefined();
      }
    } finally { restore(); }
  });
});
