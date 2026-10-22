// §B2-6 parity scenario — pure use of APIs that ALSO exist at rollback
// 5c335b7e (disclose, logReferrerStatusDisclosure, registry consent capture,
// existing gate readers). The same file is run against the rollback archive to
// produce the pinned fixture; the current tree must match it after stripping
// ONLY the new B2-6 fields (entry.consentRecordId, record.disclosureIds,
// consent.* metadata). Requires Date pinned and Math.random seeded BEFORE
// any store module is imported (see the hoisted block in the caller).
import { AdelanteEHR, type ConsentCategory } from "@/lib/ehr";
import { disclose, listDisclosureLog, logReferrerStatusDisclosure, type DisclosureRequest } from "@/lib/part2Disclosure";
import { runAction } from "@/lib/actions/runAction";
import { PART2_ELEMENT_KEYS } from "@/lib/consentRecordModel";
import { buildBillingLifecycleScenario } from "@/lib/billingLifecycleScenario";

export const PARITY_NOW = "2026-10-22T12:00:00.000Z";

/** Deterministic PRNG so uid() sequences match across versions. */
export function seededRandom(seed = 42): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATS = ["sud_treatment", "mental_health", "case_coordination", "billing", "information_sharing_disclosure"] as ConsentCategory[];
const NEW_ENTRY_KEYS = ["consentRecordId"];
const NEW_DETAIL_KEYS = ["consentEvent", "consentType", "consentEventRecordId", "consentEventActorRole", "recipientKind", "supersededConsentEvent", "supersededRecordId"];

function strip<T extends Record<string, unknown>>(o: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (!keys.includes(k)) out[k] = v;
  return out;
}

function gates() {
  return AdelanteEHR.listPatients().map((p) => ({
    id: p.id,
    cats: CATS.map((c) => AdelanteEHR.isConsentCategoryAuthorized(p.id, c)),
    active: AdelanteEHR.activeConsentRecord(p.id)?.id ?? null,
    state: AdelanteEHR.getConsentState(p.id),
  }));
}

const actor = { name: "Parity Staff", role: "therapist", staffId: "s-parity" };
function requests(pid: string): DisclosureRequest[] {
  const base = { patientId: pid, actor, recordClasses: ["SUD treatment notes" as const] };
  return [
    { ...base, recipient: { name: "Adelante care team (printed copy)", type: "internal" }, purpose: "Treatment — printed record", channel: "record_print" },
    { ...base, recipient: { name: "Outside Clinic", type: "provider" }, purpose: "Referral for treatment", channel: "referral_out" },
    { ...base, recipient: { name: "Tulare County", type: "county" }, purpose: "County reporting", channel: "county_report" },
    { ...base, recipient: { name: "Helper", type: "advocate" }, purpose: "Advocate share", channel: "advocate_share" },
    { ...base, recipient: { name: "Public Defender", type: "legal" }, purpose: "Legal", channel: "legal_disclosure" },
    { ...base, recipient: { name: "Me", type: "patient" }, purpose: "Own copy", channel: "record_print" },
    { ...base, recipient: { name: "Valley HIE", type: "hie" }, purpose: "Treatment", channel: "hie_share", simulated: true },
    { ...base, recipient: { name: "ER", organization: "Kaweah Health", type: "provider" }, purpose: "medical emergency", channel: "record_print", emergency: { reason: "unresponsive patient" } },
    { ...base, recordClasses: [], recipient: { name: "Clinic", type: "provider" }, purpose: "Non-SUD", channel: "record_print" },
  ] as DisclosureRequest[];
}

const allElements = Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true]));
function captureCovering(pid: string) {
  const staff = { role: "ecm_provider" as const, staffId: "s-ecm", staffName: "ECM Parity" };
  const storeActor = { role: "ecm_provider" as const, staffId: "s-ecm", name: "ECM Parity" };
  const p = AdelanteEHR.getPatient(pid);
  const drafts = [
    { consentType: "part2_specific_written", recipients: [{ kind: "org", name: "Outside Clinic" }], purpose: "Referral for treatment" },
    { consentType: "part2_tpo_single", recipients: [{ kind: "org", name: "Adelante care team (printed copy)" }], purpose: "Treatment — printed record" },
    { consentType: "legal_part2_disclosure", recipients: [{ kind: "org", name: "Public Defender" }], purpose: "Legal" },
  ];
  return drafts.map((d) =>
    runAction("consent_record_capture", staff, p, {
      args: [{ draft: { patientId: pid, ...d, items: ["SUD treatment notes"], expiresOn: "2027-10-21", part2Elements: allElements }, method: "e_sign", signer: "Parity Signer", relationship: "patient", attested: true, actor: storeActor }],
    }).ok,
  );
}

function run(pid: string) {
  const out = requests(pid).map((r) => {
    const res = disclose(r);
    return res.ok ? { ok: true, notice: res.notice ?? null, entry: res.entry ? strip(res.entry as never, NEW_ENTRY_KEYS) : null } : { ok: false, reason: res.reason };
  });
  const ref = logReferrerStatusDisclosure({ patientId: pid, actor, recipient: { name: "Aunt Rosa", type: "other" }, message: "enrolled", referralId: "ref-parity", sud: true, consentRef: "Verbal assent on file" });
  return { out, referrer: strip(ref as never, NEW_ENTRY_KEYS) };
}

/** Everything existing about disclosures + gates, with only B2-6 fields removed. */
export function paritySnapshot() {
  const seedLog = listDisclosureLog().map((e) => strip(e as never, NEW_ENTRY_KEYS));
  const gatesBefore = gates();
  const pids = AdelanteEHR.listPatients().map((p) => p.id);
  const uncovered = pids.map((pid) => ({ pid, ...run(pid) }));
  const captured = pids.slice(0, 3).map((pid) => ({ pid, ok: captureCovering(pid) }));
  const covered = pids.slice(0, 3).map((pid) => ({ pid, ...run(pid) }));
  const gatesAfter = gates();
  let billing: unknown = null;
  try { billing = Object.keys(buildBillingLifecycleScenario({ complete: true })); } catch (e) { billing = `error: ${(e as Error).message}`; }
  const log = listDisclosureLog().map((e) => strip(e as never, NEW_ENTRY_KEYS));
  const disclosureAudits = AdelanteEHR.listAuditEvents({ category: "disclosure" }).map((e) => ({ action: e.action, patientId: e.patientId, detail: strip((e.detail ?? {}) as never, NEW_DETAIL_KEYS) }));
  const consentAuditCount = AdelanteEHR.listAuditEvents({ category: "consent" }).length;
  return { seedLog, gatesBefore, uncovered, captured, covered, gatesAfter, billing, log, disclosureAudits, consentAuditCount };
}
