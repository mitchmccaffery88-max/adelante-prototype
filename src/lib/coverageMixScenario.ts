// 29 Oct (Mitch, Draft) — fictional clients that show the funding mix.
// Opt-in only (same pattern as billingLifecycleScenario): default seeds and
// every existing parity count stay unchanged. Records come from the real
// creators (registry actions where they exist, the coverage store function
// otherwise). No real names, numbers or rates.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { runActionOrThrow } from "@/lib/actions/runAction";
import { getActingRole, getActingStaff, setActingStaff, type StaffRole } from "@/lib/roles";
import { groupSessionFundingReview, type GroupFundingReview } from "@/lib/groupFunding";

export const COVERAGE_MIX_KEYS = ["mcp_smhs", "dmc_ods_moud", "commercial_cob", "private_pay", "grant_reentry"] as const;
export type CoverageMixKey = (typeof COVERAGE_MIX_KEYS)[number];
export interface CoverageMixScenario {
  patients: Record<CoverageMixKey, string>;
  /** A therapy group evaluated for members on three funding sources. */
  group: { sessionId: string; memberIds: string[]; review: GroupFundingReview };
}

let loaded: CoverageMixScenario | undefined;

function acting(id: string, role: StaffRole) {
  setActingStaff(id, role);
  return getActingStaff();
}
function action<T>(id: string, via: string, patient: Patient | undefined, ...args: unknown[]): T {
  return runActionOrThrow<T>(id, { staffId: getActingStaff().id, role: getActingRole() }, patient, { via, args });
}
const ymd = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400_000).toISOString().slice(0, 10);

export function loadCoverageMixScenario(): CoverageMixScenario {
  if (loaded) return loaded;
  const prev = getActingStaff();
  const prevRole = getActingRole();
  try {
    const patients = {} as Record<CoverageMixKey, string>;
    const from = ymd(-200);
    for (const key of COVERAGE_MIX_KEYS) {
      acting("s-cf2", "cf_care_manager");
      const p = action<Patient>("patient_create_anyway", "createPatient", undefined, { firstName: "Fictional Coverage", lastName: `Mix ${key}`, matchSource: "seed" });
      patients[key] = p.id;
      const billing = { actorId: "s-bill1", actorRole: "billing" as StaffRole };
      if (key === "mcp_smhs" || key === "dmc_ods_moud") {
        AdelanteEHR.addCoveragePlan(p.id, { payer: "Health Net Medi-Cal", from, source: "staff_entry" as never, planType: "medi_cal_mcp", order: "primary", ...billing });
      }
      if (key === "commercial_cob") {
        AdelanteEHR.addCoveragePlan(p.id, { payer: "Demo Commercial PPO", from, source: "staff_entry" as never, planType: "commercial", order: "primary", ...billing });
        AdelanteEHR.addCoveragePlan(p.id, { payer: "Health Net Medi-Cal", from, source: "staff_entry" as never, planType: "medi_cal_mcp", order: "secondary", ...billing });
      }
      if (key === "private_pay" || key === "grant_reentry") {
        acting("s-bill1", "billing");
        action("payment_arrangement", "setPaymentArrangement", p, p.id, key === "private_pay" ? "self_pay" : "grant_isl");
      }
      if (key === "mcp_smhs") {
        // A treating clinician's dated SMHS determination — never inferred.
        acting("s-th1", "therapist");
        action("smhs_determination_set", "setSmhsDetermination", p, p.id, { meets: true, determinedAt: ymd(-30) }, { name: "Marisol Reyes", role: "therapist" });
      }
    }
    const group = AdelanteEHR.listGroupSessions().find((g) => g.serviceType === "therapy_group") ?? AdelanteEHR.listGroupSessions()[0];
    const memberIds = [patients.mcp_smhs, patients.commercial_cob, patients.private_pay];
    const review = groupSessionFundingReview({ ...group, start: group.start, billable: group.billable }, memberIds);
    loaded = { patients, group: { sessionId: group.id, memberIds, review } };
    return loaded;
  } finally {
    setActingStaff(prev.id, prevRole);
  }
}
