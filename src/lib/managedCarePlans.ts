// §Phase 8b — editable reference list of Medi-Cal managed care plans.
//
// County plan lineups change, so this is DATA, not code. Same rules as the
// 7c billing code table:
//  - only roles with `billing` write (Billing, Billing Coordinator) change it;
//    a read-only role (Sys Admin) is refused in this module, nothing changes;
//  - entries are never deleted — retire one instead, so old plan spans that
//    stored its id still resolve;
//  - every change is attributed and audited;
//  - every seeded entry is a DRAFT pending confirmation of the county's
//    current plans. Editing an entry clears its draft tag.
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess, getActingRole, getActingStaff } from "@/lib/roles";
import { BILLING_WRITE_REFUSED } from "@/lib/rates";

export type ManagedCarePlanKind = "plan" | "ffs" | "other" | "unknown";

export interface ManagedCarePlan {
  id: string;
  name: string;
  kind: ManagedCarePlanKind;
  /** Counties the plan is offered in, as a hint only. */
  counties?: string[];
  active: boolean;
  draft: boolean;
  updatedBy?: string;
  updatedByRole?: string;
  updatedAt?: string;
}

export const MANAGED_CARE_DRAFT_LABEL = "Draft — pending confirmation of the county's current plans";

const seed: ManagedCarePlan[] = [
  { id: "mcp-anthem", name: "Anthem Blue Cross", kind: "plan", counties: ["Tulare", "Kings"], active: true, draft: true },
  { id: "mcp-healthnet", name: "Health Net", kind: "plan", counties: ["Tulare"], active: true, draft: true },
  { id: "mcp-calviva", name: "CalViva Health", kind: "plan", counties: ["Kings"], active: true, draft: true },
  { id: "mcp-kaiser", name: "Kaiser Permanente", kind: "plan", active: true, draft: true },
  { id: "mcp-ffs", name: "Medi-Cal FFS / no plan", kind: "ffs", active: true, draft: true },
  { id: "mcp-other", name: "Other", kind: "other", active: true, draft: true },
  { id: "mcp-unknown", name: "I don't know", kind: "unknown", active: true, draft: true },
];

let plans: ManagedCarePlan[] = seed.map((p) => ({ ...p }));

/** Test helper — restore the seeded list. */
export function _resetManagedCarePlans() {
  plans = seed.map((p) => ({ ...p }));
}

export function listManagedCarePlans(opts: { includeRetired?: boolean } = {}): ManagedCarePlan[] {
  return plans.filter((p) => opts.includeRetired || p.active).map((p) => ({ ...p }));
}

export function getManagedCarePlan(id: string): ManagedCarePlan | undefined {
  const p = plans.find((x) => x.id === id);
  return p ? { ...p } : undefined;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function writer(): { ok: true; id: string; name: string; role: string } | { ok: false; error: string } {
  const role = getActingRole();
  if (canAccess(role, "billing").level !== "write") return { ok: false, error: BILLING_WRITE_REFUSED };
  const s = getActingStaff();
  return { ok: true, id: s?.id ?? role, name: s?.name ?? role, role };
}

export function addManagedCarePlan(input: { name: string; counties?: string[] }): Result<{ plan: ManagedCarePlan }> {
  const w = writer();
  if (!w.ok) return w;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name the plan." };
  if (plans.some((p) => p.active && p.name.toLowerCase() === name.toLowerCase()))
    return { ok: false, error: "That plan is already on the list." };
  const plan: ManagedCarePlan = {
    id: `mcp-${Math.random().toString(36).slice(2, 9)}`,
    name,
    kind: "plan",
    ...(input.counties?.length ? { counties: input.counties } : {}),
    active: true,
    draft: false,
    updatedBy: w.name,
    updatedByRole: w.role,
    updatedAt: new Date().toISOString(),
  };
  // Keep the special entries (FFS / Other / I don't know) at the end.
  const firstSpecial = plans.findIndex((p) => p.kind !== "plan");
  if (firstSpecial < 0) plans.push(plan);
  else plans.splice(firstSpecial, 0, plan);
  AdelanteEHR.recordBillingAudit({
    action: "managed_care_plan_added",
    actorId: w.id,
    actorRole: w.role,
    detail: { planId: plan.id, name: plan.name, counties: plan.counties ?? null, actorName: w.name },
  });
  return { ok: true, plan: { ...plan } };
}

export function updateManagedCarePlan(
  id: string,
  patch: { name?: string; counties?: string[]; active?: boolean },
): Result<{ plan: ManagedCarePlan }> {
  const w = writer();
  if (!w.ok) return w;
  const p = plans.find((x) => x.id === id);
  if (!p) return { ok: false, error: "Plan not found." };
  if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: "Name the plan." };
  if (patch.active === false && p.kind !== "plan")
    return { ok: false, error: "FFS, Other and I don't know stay on the list." };
  const before = { name: p.name, counties: p.counties ?? null, active: p.active };
  if (patch.name !== undefined) p.name = patch.name.trim();
  if (patch.counties !== undefined) p.counties = patch.counties.length ? patch.counties : undefined;
  if (patch.active !== undefined) p.active = patch.active;
  p.draft = false;
  p.updatedBy = w.name;
  p.updatedByRole = w.role;
  p.updatedAt = new Date().toISOString();
  AdelanteEHR.recordBillingAudit({
    action: "managed_care_plan_updated",
    actorId: w.id,
    actorRole: w.role,
    detail: { planId: id, before, after: { name: p.name, counties: p.counties ?? null, active: p.active }, actorName: w.name },
  });
  return { ok: true, plan: { ...p } };
}
