// 26 Oct (Mitch) — one implementation per channel, picked by configuration.
// The clearinghouse adapter is a SIMULATED stub: it never sends a request, is
// disabled by default, and needs a BAA + vendor + credentials setting before
// configuration can switch it on (see coverageConfig.configureEligibilityAdapter).
import type { CoverageAdapter, CoverageCheckRequest, CoverageCheckResponse } from "./adapter";
import { getAdapterConfig, listPayers, type CoverageChannel } from "./coverageConfig";
import { ELIGIBILITY_NOT_CONNECTED } from "./eligibility";

export const PAYER_UNREACHABLE = "Couldn't reach the payer — Billing will check manually.";

/** Manual: no electronic call; Billing records the result with recordCoverageCheck. */
export const manualAdapter: CoverageAdapter = {
  channel: "manual",
  simulated: false,
  async check() { return { outcome: "manual_required", channel: "manual", simulated: false }; },
};

/** The existing simulated vendor: honest "not connected" (same as checkEligibility). */
export const simulatedVendorAdapter: CoverageAdapter = {
  channel: "simulated_vendor",
  simulated: true,
  async check() { return { outcome: "manual_required", errorKind: "not_connected", channel: "simulated_vendor", simulated: true }; },
};
export const SIMULATED_VENDOR_NOTICE = ELIGIBILITY_NOT_CONNECTED;

let txn = 0;
/**
 * 270/271-style stub. Request mapping (documented in docs/eligibility-paths-report.md):
 * 270 NM1*IL ← patient/member reference, NM1*PR ← payer.ediPayerId, DTP*291 ← serviceDate,
 * EQ ← 30 (plan coverage) + MH/AI (behavioral health / SUD). 271 EB segments map to
 * outcome/plan/effective dates/financial/carve-outs below. SIMULATED values only.
 */
export const clearinghouseStubAdapter: CoverageAdapter = {
  channel: "clearinghouse",
  simulated: true,
  async check(req: CoverageCheckRequest): Promise<CoverageCheckResponse> {
    const base = { channel: "clearinghouse" as const, simulated: true, transactionRef: `SIM-271-${String(++txn).padStart(4, "0")}` };
    if (req.payerId === "sim-timeout") return { ...base, outcome: "error", errorKind: "timeout" };
    if (req.payerId === "sim-unreachable") return { ...base, outcome: "error", errorKind: "unreachable" };
    if (req.memberRef === "SIM-NOT-FOUND") return { ...base, outcome: "not_found" };
    const payer = listPayers().find((p) => p.id === req.payerId);
    const start = `${req.serviceDate.slice(0, 7)}-01`;
    return {
      ...base,
      outcome: req.memberRef === "SIM-INACTIVE" ? "inactive" : "active",
      planName: payer?.name,
      effectiveFrom: start,
      ...(req.path === "private" ? { financial: { copayCents: 3000, deductibleCents: 150000, outOfPocketMaxCents: 600000 } } : {}),
      carveOuts: { behavioralHealth: req.path === "medi_cal", sud: req.path === "medi_cal" || req.path === "county_program" },
    };
  },
};

const registry = new Map<CoverageChannel, CoverageAdapter>([
  ["manual", manualAdapter],
  ["simulated_vendor", simulatedVendorAdapter],
  ["clearinghouse", clearinghouseStubAdapter],
]);
/** Seam for an external billing module (e.g. SculptSoft): register, then select by configuration. */
export function registerCoverageAdapter(adapter: CoverageAdapter) { registry.set(adapter.channel, adapter); }

export function selectedAdapter(): CoverageAdapter {
  const cfg = getAdapterConfig();
  if (cfg.selected === "clearinghouse" && !cfg.clearinghouse.enabled) throw new Error("Clearinghouse isn't contracted yet — record a manual check instead.");
  const a = registry.get(cfg.selected);
  if (!a) throw new Error("No coverage adapter is configured for this channel.");
  return a;
}

/** Wraps an adapter call in the configured timeout so a slow payer becomes an error state. */
export async function runAdapter(adapter: CoverageAdapter, req: CoverageCheckRequest): Promise<CoverageCheckResponse> {
  const ms = getAdapterConfig().clearinghouse.timeoutMs;
  try {
    return await Promise.race([
      adapter.check(req),
      new Promise<CoverageCheckResponse>((resolve) => setTimeout(() => resolve({ outcome: "error", errorKind: "timeout", channel: adapter.channel, simulated: adapter.simulated }), ms)),
    ]);
  } catch {
    return { outcome: "error", errorKind: "unreachable", channel: adapter.channel, simulated: adapter.simulated };
  }
}
