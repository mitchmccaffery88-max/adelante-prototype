// Build-time only (Phase 2b, 27 Oct). Boots the real demo store, runs the three new intakes through
// the action registry (runAction), then projects store output into SQL for a migration-owned seed.
// Never imported by the app; no runtime path can call it. Every row is synthetic.
// Usage: bun scripts/generate-phase2-seed.ts > /tmp/p2b/seed.json (pasted into the migration-owned seed)
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import "@/lib/chartActions";
import { STAFF_ROSTER } from "@/lib/roles";
import { patientSiteId, staffSiteIds, onCareTeam, isRestricted } from "@/lib/chartAccess";
import { seedIntakePhaseAThroughRegistry } from "@/lib/intakePhaseADemo";
import { signupActor, type SignupResult } from "@/lib/website/signupStore";
import { intakePacketNeeds, intakePacketDocuments } from "@/lib/intakePacket";

const intake = { role: "intake_coordinator" as const, staffId: "s-admin1" };
function must<T>(r: { ok: true; value: T } | { ok: false; reason: string }, what: string): T { if (!r.ok) throw new Error(`${what}: ${r.reason}`); return r.value; }
const act = <T,>(id: string, args: unknown[], reason = "Phase 2b synthetic seed") => must(runAction<T>(id, intake, undefined, { args: [intake, ...args, reason], auditReason: reason }), id);
const signup = (input: Record<string, unknown>) => must(runAction<SignupResult>("website_signup", signupActor, undefined, { via: "runSignupCommand", args: [signupActor, input] }), "website_signup");

// Intake (c) public_unverified + Phase A scenarios, through the registry seed.
seedIntakePhaseAThroughRegistry(intake);

// Intake (a) general-population new sign-up.
const general = { firstName: "Rowan", lastName: "Fictional-Signup", dob: "1991-05-14", phone: "(555) 010-4411", email: "rowan.signup@example.invalid", preferredLanguage: "en" as const, credentialKind: "pin" as const };
const gs = signup({ operation: "start" }).sessionId;
const g = signup({ operation: "finish", sessionId: gs, path: "new", draft: general });
if (!g.patientId) throw new Error(`General sign-up did not create a patient (${g.outcome}).`);

// Intake (b) pre-release packet referral → staging → documents/needs → patient → care team → handoff.
const packetId = { firstName: "Dana", lastName: "Fictional-Packet", dob: "1987-03-22", phone: "(555) 010-7722", email: "dana.packet@example.invalid" };
const staged = must(runAction<{ referralIds: string[] }>("intake_staging_import", intake, undefined, { args: [intake, "pre_release_packet", "fictional-template-v1.json", [{ ...packetId, referrerName: "Fictional Reentry Partner", releaseDate: "2026-11-03", referralReason: "Outpatient intake", sdoh: [{ kind: "housing" }, { kind: "food" }, { kind: "transportation" }] }], "Partner supplied packet"] }), "intake_staging_import");
const packetRef = staged.referralIds[0]; if (!packetRef) throw new Error("Staging created no referral.");
const attached: { id: string; type: string; classification: string; fileName: string }[] = [];
for (const [type, classification, fileName] of [["medication_list", "general", "fictional-med-list.txt"], ["hra", "general", "fictional-hra.txt"], ["reentry_plan", "sud_related", "fictional-reentry-plan.txt"], ["roi", "part2", "fictional-sud-history.txt"]] as const)
  attached.push({ id: act<{ documentId: string }>("intake_packet_attach", [packetRef, { type, source: "pre_release_packet", fileName, size: 4, mime: "text/plain", dataUrl: "data:text/plain;base64,dGVzdA==", classification }]).documentId, type, classification, fileName });
const ps = signup({ operation: "start" }).sessionId;
const pd = { ...packetId, preferredLanguage: "en" as const, credentialKind: "pin" as const };
const otp = signup({ operation: "finish", sessionId: ps, path: "no_code", draft: pd });
const pm = signup({ operation: "verify", sessionId: ps, otp: otp.demoCode, draft: pd }); // simulated delivery: demo code only
const pref = AdelanteEHR.listReferrals().find(r => r.id === packetRef);
if (!pref?.enrolledPatientId) throw new Error(`Packet sign-up did not link the staged referral (${pm.outcome}).`);
act("intake_team_assign", [packetRef, "care_manager", "s-cm2", "2026-10-28"], "Initial assignment");
act("intake_team_assign", [packetRef, "clinician", "s-th2", "2026-10-28"], "Initial assignment");
act("intake_complete", [packetRef, { identity_link_checked: true, contact_checked: true, packet_received: true, handoff_ready: true }], "Handoff");

// ---------- projection (compact JSON; SQL derives ids as md5('phase2b:'||key)::uuid) ----------
const patients = AdelanteEHR.listPatients().filter(p => !p.mergedInto);
const staff = STAFF_ROSTER.map(m => [m.id, m.name, m.role, m.additionalRoles ?? [], staffSiteIds(m.id).length > 0]);
const team: string[][] = [];
const pat = patients.map(p => {
  for (const m of STAFF_ROSTER) if (onCareTeam(m.id, p)) team.push([p.id, m.id, m.role, m.caseManagerId && p.caseManagerId === m.caseManagerId ? "care_manager" : "clinician"]);
  const c = AdelanteEHR.listConsentRecords(p.id).find(c => c.consentType === "part2_tpo_single" && c.status === "active");
  return [p.id, p.firstName, p.lastName, p.dob || null, !!patientSiteId(p), isRestricted(p.id), c ? [c.purposeCode, c.expiresOnEvent ?? null] : null];
});
const accepted = new Set(intakePacketDocuments(intake, packetRef).map(d => d.id));
if (attached.some(d => !accepted.has(d.id))) throw new Error("Store did not retain every attached packet document.");
const refs = AdelanteEHR.listReferrals().map(r => [r.id, r.firstName, r.lastName, r.dob || null, r.referralSource ?? "other", r.identityConfidence === "public_unverified" ? "public_unverified" : "verified_source", r.enrolledPatientId ? "enrolled" : (["submitted", "contacted", "declined"].includes(r.status) ? r.status : "submitted"), r.channel ?? "public", r.enrolledPatientId ?? null]);
const packet = { ref: packetRef, docs: attached.map(d => [d.type, d.classification, d.fileName]), needs: intakePacketNeeds(intake, packetRef).map(n => [n.source, n.sourceRef, n.kind, n.state, !!n.part2]), cm: "s-cm2", cl: "s-th2" };
console.log(JSON.stringify({ staff, pat, team, refs, packet }));
console.error(JSON.stringify({ staff: staff.length, patients: pat.length, careTeam: team.length, part2Signed: pat.filter(p => p[6]).length, referrals: refs.length }));
