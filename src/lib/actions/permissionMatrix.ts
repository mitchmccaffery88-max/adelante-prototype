// §Batch D — role × action × outcome report, built only from the registry.
// Used by the Permissions & features page, its CSV export and the committed
// snapshot test (any permission change shows up as a diff in review).
import { CHART_ACTIONS, REGISTRY_VERSION, type ChartActionGroup, type ChartActionState } from "@/lib/chartActions";
import { STAFF_ROLES, getStaffMember, STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { ACTION_EVENTS } from "@/lib/actions/runAction";
import { featureSnapshot } from "@/lib/features";

export interface MatrixRow {
  role: StaffRole;
  actionId: string;
  label: string;
  group: ChartActionGroup;
  state: ChartActionState;
  check: string;
  events: string;
  flags: string;
  store: string;
}

/** Evaluated without a specific patient (consent-gated classes resolve as locked). */
export function permissionMatrix(): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const { key: role } of STAFF_ROLES) {
    // A representative staff member for the role (cosign routing reads the supervisor).
    const staff = STAFF_ROSTER.find((s) => s.role === role);
    const actor = { role, staffId: staff?.id, clinicianId: getStaffMember(staff?.id)?.clinicianId };
    for (const a of CHART_ACTIONS) {
      if (a.pending) continue;
      const state = a.allowed(actor, undefined).state;
      rows.push({
        role,
        actionId: a.id,
        label: a.label.en,
        group: a.group,
        state,
        check: a.check ?? "allowed() → store check",
        events: state === "hidden" ? "action.blocked" : state === "cosign" ? "action.cosign_routed, action.blocked" : "action.succeeded, action.blocked",
        flags: (a.flags ?? []).join(" "),
        store: a.store.map((s) => s.name).join(" / "),
      });
    }
  }
  return rows;
}

/** Compact role → actionId → state map for the snapshot test. */
export function permissionSnapshot(): Record<string, Record<string, ChartActionState>> {
  const out: Record<string, Record<string, ChartActionState>> = {};
  for (const r of permissionMatrix()) (out[r.role] ??= {})[r.actionId] = r.state;
  return out;
}

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function matrixCsv(rows: MatrixRow[] = permissionMatrix()): string {
  const head = ["registry_version", "role", "action_id", "action", "group", "outcome", "check", "audit_events", "flags", "store_function"];
  return [
    head.join(","),
    ...rows.map((r) => [REGISTRY_VERSION, r.role, r.actionId, r.label, r.group, r.state, r.check, r.events, r.flags, r.store].map(esc).join(",")),
  ].join("\n");
}

export function flagsCsv(): string {
  return [
    "flag_id,description,owner,default,scope,current_value",
    ...featureSnapshot().map(({ flag, value }) => [flag.id, flag.description, flag.owner, flag.default, flag.scope, value].map(esc).join(",")),
  ].join("\n");
}

export { ACTION_EVENTS };
