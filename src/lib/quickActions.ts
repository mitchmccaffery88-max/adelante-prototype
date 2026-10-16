// Quick-actions batch 2 — the acting role's approved "+ New" defaults.
// This module NEVER grants anything: every id is filtered through the
// registry's own `allowed()` before it is shown, and picking an item still
// runs the launcher's existing registry/runAction path. Labels always come
// from the registry (Mitch, Oct 16).
import { CHART_ACTIONS, type ChartAction, type ChartActor } from "@/lib/chartActions";
import type { Patient } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";

/**
 * Mitch's approved defaults (Oct 16), with his swaps applied:
 * sud_counselor "Request a screener" → ASAM assessment; community_health_worker
 * and peer_specialist "Log contact" → SDOH referral; cf_care_manager "Field
 * outreach contact" → SDOH referral; medical_assistant "Book a visit" →
 * Send forms to sign + Sign in person; credentialing_coordinator →
 * Enter time off + Freeze / reactivate bookings.
 */
export const QUICK_ACTION_DEFAULTS: Partial<Record<StaffRole, readonly string[]>> = {
  therapist: ["progress_note", "dashboard_book", "message_patient", "screener_request", "task"],
  sud_counselor: ["progress_note", "dashboard_book", "message_patient", "asam", "task"],
  physician: ["progress_note", "med_order", "refill_decision", "lab_order", "dashboard_book"],
  pmhnp: ["progress_note", "med_order", "refill_decision", "lab_order", "dashboard_book"],
  ecm_provider: ["dashboard_contact", "afbi_contact", "dashboard_referral", "dashboard_book", "message_team"],
  cf_care_manager: ["dashboard_contact", "sdoh_referral", "dashboard_referral", "dashboard_book", "message_team"],
  community_health_worker: ["sdoh_referral", "afbi_contact", "dashboard_referral", "dashboard_book", "message_team"],
  peer_specialist: ["sdoh_referral", "afbi_contact", "dashboard_referral", "dashboard_book", "message_team"],
  nurse_rn: ["triage_call", "metabolic", "specimen_collect"],
  lvn: ["metabolic", "specimen_collect"],
  medical_assistant: ["message_team", "consent_form_send", "consent_form_in_person"],
  clinical_coordinator: ["dashboard_task", "dashboard_book", "referral_assign_owner", "partner_link", "message_team"],
  billing: ["claim_correct", "eligibility_check", "payment_record", "payment_arrangement"],
  billing_coordinator: ["claim_correct", "eligibility_check", "payment_record", "payment_arrangement"],
  sys_admin: ["feature_flag_set", "note_template_create", "scheduling_rule_save", "notification_resend"],
  credentialing_coordinator: ["calendar_time_off_add", "bookings_freeze"],
};

/**
 * Nurse actions waiting on Dr. Bagga's clinical sign-off. They stay in the
 * registry but are NEVER offered as quick actions (or anywhere in "+ New").
 */
export const PENDING_SIGNOFF_IDS: readonly string[] = ["clinic_dose_give", "refill_coordinate"];

/**
 * The role's quick actions, filtered through the registry's permission check
 * for this actor (and patient, when one is in context). Deduped, registry
 * order of the defaults list preserved. Returns at most the approved set —
 * a role with no defaults gets none.
 */
export function quickActionsFor(actor: ChartActor, patient?: Patient): ChartAction[] {
  const ids = QUICK_ACTION_DEFAULTS[actor.role] ?? [];
  const seen = new Set<string>();
  const out: ChartAction[] = [];
  for (const id of ids) {
    if (seen.has(id) || PENDING_SIGNOFF_IDS.includes(id)) continue;
    const action = CHART_ACTIONS.find((a) => a.id === id);
    if (!action || action.pending) continue;
    if (action.allowed(actor, patient).state === "hidden") continue;
    seen.add(id);
    out.push(action);
  }
  return out;
}
