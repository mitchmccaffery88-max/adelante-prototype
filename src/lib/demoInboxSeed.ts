// §Demo inbox seed (item 2 of 7) — crisis queue, notifications and messages
// for the demo, created ONLY through real store functions (flag, screener,
// scanner, notify, message send) so every row carries the same audit trail and
// attribution a real one would. Lives outside ehr.ts because the crisis-text
// scanner imports the store. Idempotent: runs once per store instance.
import { AdelanteEHR, demoScenarioPatientId, type Patient } from "@/lib/ehr";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";
import { GATE_GENERIC_MESSAGE } from "@/lib/dmcOdsReadiness";

let seeded = false;

function byFirst(first: string, last?: string): Patient | undefined {
  return AdelanteEHR.listPatients().find(
    (p) => p.firstName === first && (!last || p.lastName === last),
  );
}

function safe(fn: () => void) {
  try {
    fn();
  } catch (e) {
    if (import.meta.env?.DEV) console.warn("[demo inbox seed]", e);
  }
}

export function seedDemoInbox(): void {
  if (seeded) return;
  seeded = true;
  // Already populated (e.g. HMR re-import) — never double-seed.
  if (
    AdelanteEHR.listOpenCrisisEscalations().length > 0 ||
    AdelanteEHR.listAnonymousCrisisAlerts().length > 0
  )
    return;

  const elena = demoScenarioPatientId("mh_only");
  const paloma = demoScenarioPatientId("medication");
  const victor = demoScenarioPatientId("ji_self_report");
  const carmen = demoScenarioPatientId("public_referral");
  const marcus = byFirst("Marcus")?.id;
  const daniel = byFirst("Daniel")?.id;
  const rosa = byFirst("Rosa")?.id;

  // ---- 1. Crisis queue ----
  // Resolved first so the history exists before the open items.
  if (daniel)
    safe(() => {
      const r = AdelanteEHR.flagCrisis(
        daniel,
        "Dr. James Okafor",
        "Demo: said during session he felt unsafe at home last night; now staying with his sister.",
      );
      AdelanteEHR.resolveCrisisEscalation(daniel, r.id, "Priya Raman", {
        contactedWhom: "Patient and his sister (by phone)",
        actionsTaken: "Reviewed safety plan together; confirmed he is staying with family this week.",
        disposition: "Safety plan reviewed; safe with family. Follow-up visit booked.",
        dispositionCode: "safety_plan_reviewed",
      });
    });
  // C-SSRS reached from PHQ-9 item 9 (placeholder C-SSRS text stays labelled).
  if (elena)
    safe(() => {
      AdelanteEHR.requestCssrs(elena, "PHQ-9 item 9 positive");
      AdelanteEHR.recordCssrs({
        patientId: elena,
        answers: [1, 1, 1, 0, 0, 0],
        mode: "staff",
        staffName: "Dr. Marisol Reyes",
        staffRole: "therapist",
        trigger: "PHQ-9 item 9 positive",
      });
    });
  // Crisis-language scanner on a real patient message.
  if (paloma)
    safe(() => {
      const body = "Rough week. Some nights I feel like I want to die. I don't know who else to tell.";
      AdelanteEHR.sendPatientMessage(paloma, body);
      scanTextForCrisis(paloma, body, { surface: "care team message" });
    });
  // Manual staff flag with a note.
  if (marcus)
    safe(() => {
      AdelanteEHR.flagCrisis(
        marcus,
        "Anita Brooks",
        "Demo: missed two visits and his mother called worried he has stopped answering. Needs a same-day welfare call.",
      );
    });
  // Patient "I need help now" from /crisis.
  if (victor)
    safe(() => {
      AdelanteEHR.flagCrisis(victor, "Patient (crisis page)", "I'm having a really hard night and need to talk to someone.", {
        triggerSource: "patient_request",
      });
    });
  // Front door, no record.
  safe(() => {
    scanTextForCrisis(undefined, "I don't think I want to be here anymore, I keep thinking about suicide", {
      surface: "front door helper",
      anonymousContact: "(559) 555-0142",
    });
  });
  // Staff-flagged urgent social need, in its lane.
  if (carmen)
    safe(() => {
      const item = AdelanteEHR.addSdohItem(
        carmen,
        { need: "Safe place to stay tonight", note: "Demo" },
        { staffName: "Luz Herrera", role: "ecm_provider" },
      ) as { id: string } | undefined;
      const id =
        item?.id ??
        AdelanteEHR.getPatient?.(carmen)?.sdohPlan?.items.find((i) => i.need === "Safe place to stay tonight")?.id;
      if (id)
        AdelanteEHR.flagSdohItemUrgent(
          carmen,
          id,
          "Luz Herrera",
          "Leaving an unsafe home tonight with her child; needs emergency shelter placement.",
        );
    });

  // ---- 2. Notifications (real notify path) ----
  const n = AdelanteEHR.notify;
  const pl = (id?: string) => (id ? { patientId: id } : {});
  if (paloma)
    n({ recipientRole: "pmhnp", category: "refill_request", subject: "Refill request — Paloma O.", body: "Patient asked for a refill of sertraline 50 mg.", linkRoute: "/medications", ...pl(paloma) });
  if (rosa)
    n({ recipientRole: "pmhnp", category: "refill_request", subject: "Refill request — Rosa", body: "Pharmacy asked to renew a 30-day supply.", linkRoute: "/medications", ...pl(rosa) });
  if (elena)
    n({ recipientRole: "therapist", category: "appointment_request", subject: "Appointment request — Elena V.", body: "Requested — waiting for staff confirmation: 1:1 therapy intake.", linkRoute: "/clinician", ...pl(elena) });
  if (marcus)
    n({ recipientStaffId: "Dr. Marisol Reyes", category: "appointment_rescheduled", subject: "Visit rescheduled — Marcus", body: "Patient moved Tuesday's visit to Thursday 2:00 PM.", linkRoute: "/clinician", ...pl(marcus) });
  if (paloma)
    n({ recipientRole: "ecm_provider", category: "connect_request", subject: "\"Connect me\" request — Paloma O.", body: "Patient asked to be connected with food assistance.", linkRoute: "/worklist", ...pl(paloma) });
  if (victor)
    n({ recipientRole: "ecm_provider", category: "needs_task", subject: "Same-day task — Victor H.", body: "Needs a replacement ID today (same-day need from intake).", linkRoute: "/my-work", ...pl(victor) });
  // ASAM task — masked: no reason, no substance-use wording.
  n({ recipientRole: "sud_counselor", category: "asam_task", subject: "Protected assessment task due", body: "A protected assessment task is assigned to your team. Open My Work to view.", linkRoute: "/my-work" });
  n({ recipientRole: "therapist", category: "asam_task", subject: "Protected assessment task due", body: "A protected assessment task needs an assessment visit scheduled.", linkRoute: "/my-work" });
  // Billing — DMC-ODS blocks show only the generic reason.
  n({ recipientRole: "billing", category: "claim_blocked", subject: "Claim blocked — DMC-ODS", body: `${GATE_GENERIC_MESSAGE}.`, linkRoute: "/admin-claims" });
  n({ recipientRole: "billing", category: "claim_blocked", subject: "Claim denied — Medi-Cal (90834)", body: "Denied: eligibility not active on date of service. Verify coverage and resubmit.", linkRoute: "/admin-claims" });
  n({ recipientRole: "billing_coordinator", category: "claim_blocked", subject: "Claim blocked — DMC-ODS", body: `${GATE_GENERIC_MESSAGE}.`, linkRoute: "/admin-claims" });
  n({ recipientRole: "clinical_coordinator", category: "task_assigned", subject: "Coverage needed — Friday clinic", body: "Dr. Okafor is out Friday; 3 visits need a covering clinician.", linkRoute: "/admin-coordination" });

  // ---- 3. Messages ----
  if (rosa)
    safe(() => {
      AdelanteEHR.sendStaffMessage(rosa, "Luz Herrera", "Hi Rosa, just checking how the new bus route to clinic is working.", "ecm_provider");
      AdelanteEHR.sendPatientMessage(rosa, "It's working, thanks. Can we move Thursday to the afternoon? I start a new job shift.");
    });
  if (elena)
    safe(() => {
      AdelanteEHR.sendPatientMessage(elena, "Is there a form I need to bring to my next visit?");
    });
  if (victor)
    safe(() => {
      AdelanteEHR.sendPatientMessage(victor, "I got the letter about my ID appointment. Do I need proof of address?");
    });
  // Advocate thread: not seeded — no demo advocate has a verified document
  // granting communication rights, and seeding one would bypass that rule.
  // Provider requests beyond the existing two.
  if (elena)
    AdelanteEHR.createProviderRequest({ patientId: elena, requestType: "question", context: "Can we add a letter for her employer about weekly visits?", requestedBy: "Luz Herrera", requestedByRole: "ecm_provider" });
  if (paloma)
    AdelanteEHR.createProviderRequest({ patientId: paloma, requestType: "order_entry", context: "Please review a medication refill; she runs out Friday.", requestedBy: "Lupita Sanchez, MSW", requestedByRole: "ecm_provider" });
  if (rosa)
    AdelanteEHR.createProviderRequest({ patientId: rosa, requestType: "question", context: "Patient asks whether video visits are okay while she starts a new job.", requestedBy: "Andre Willis", requestedByRole: "peer_specialist" });

  // A few read, most unread.
  const readOne = (name: string, role: Parameters<typeof AdelanteEHR.listNotificationsFor>[1]) => {
    const rows = AdelanteEHR.listNotificationsFor(name, role);
    const last = rows[rows.length - 1];
    if (last) AdelanteEHR.markNotificationRead(last.id, name);
  };
  readOne("Anita Brooks", "therapist");
  readOne("Tonya Price", "billing");
  readOne("Luz Herrera", "ecm_provider");
}

seedDemoInbox();
