// §Demo inbox seed (item 2 of 7) — crisis queue, notifications and messages
// for the demo, created ONLY through real store functions (flag, screener,
// scanner, notify, message send) so every row carries the same audit trail and
// attribution a real one would. Lives outside ehr.ts because the crisis-text
// scanner imports the store. Idempotent: runs once per store instance.
import { AdelanteEHR, demoScenarioPatientId, type Patient } from "@/lib/ehr";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";
import { GATE_GENERIC_MESSAGE } from "@/lib/dmcOdsReadiness";
import { seedInboxActionsDemo } from "@/lib/inboxActions";
import { seedCoordinationDemo } from "@/lib/coordination";
import { seedCaseloadDemo } from "@/lib/caseloadReview";

let seeded = false;

/**
 * §Advocate thread — give a QA advocate link a verified communication-rights
 * document through the NORMAL steps: advocate uploads the file (malware scan,
 * unverified), staff verify it into the chart, staff request the specific
 * communication-rights row, the advocate attests, staff verify the row
 * against the uploaded document. Then one advocate message is seeded. The
 * send uses the demo-harness `allowPendingReview` path: the clinical review
 * gate stays ON, so the live advocate screen still shows the pending notice.
 * Idempotent per link.
 */
export function ensureAdvocateMessagingDemo(linkId: string): void {
  const link = AdelanteEHR.listAdvocateLinks().find((l) => l.id === linkId);
  if (!link) return;
  const has = link.documentRequirements?.some((r) => r.key === "hipaa_roi_communication" && r.status === "verified");
  if (has) return;
  const verifier = { staffId: "s-cm1", staffName: "Luz Herrera", role: "ecm_provider" as const };
  const up = AdelanteEHR.uploadPatientDocument({
    patientId: link.patientId,
    file: { fileName: "HIPAA-release-two-way-communication.pdf", mimeType: "application/pdf", sizeBytes: 184_000 },
    uploader: { kind: "advocate", name: link.advocateName, advocateLinkId: link.id },
    isPart2: false,
    docType: "HIPAA release (two-way communication)",
    note: "Demo document",
  });
  if (!up.ok) return;
  AdelanteEHR.verifyPatientDocument(up.document.id, verifier);
  AdelanteEHR.requestAdvocateDocument({ linkId, key: "hipaa_roi_communication", requestedBy: verifier.staffName });
  AdelanteEHR.attestAdvocateDocumentRequirement({ linkId, key: "hipaa_roi_communication", attestedName: link.advocateName.replace(/\s*\(advocate\)$/, "") });
  AdelanteEHR.verifyAdvocateDocumentRequirement({ linkId, key: "hipaa_roi_communication", verifiedBy: verifier.staffName, verificationRef: up.document.id });
  AdelanteEHR.advocateSendMessage(
    linkId,
    "Hi, this is the family member on file. Is there anything we should bring to Thursday's visit?",
    { allowPendingReview: true },
  );
}

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
  n({ recipientRole: "sud_counselor", category: "protected_task", subject: "Protected assessment task due", body: "A protected assessment task is assigned to your team. Open My Work to view.", linkRoute: "/my-work" });
  n({ recipientRole: "therapist", category: "protected_task", subject: "Protected assessment task due", body: "A protected assessment task needs an assessment visit scheduled.", linkRoute: "/my-work" });
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

  // ---- 4. Cancels and no-shows (real store functions) ----
  const reyes = { name: "Dr. Marisol Reyes", role: "therapist" as const, id: "s-th1" };
  const upcoming = (pid?: string) =>
    pid
      ? AdelanteEHR.appointmentsForPatient(pid)
          .filter((a) => a.status === "scheduled" && +new Date(a.start) > Date.now() && !a.asamTaskId)
          .sort((a, b) => +new Date(a.start) - +new Date(b.start))
      : [];
  // Pending patient cancel request — Carmen's staff-booked therapy visit.
  const carmenNext = upcoming(carmen)[0];
  if (carmen && carmenNext)
    safe(() => void AdelanteEHR.patientRequestCancel(carmen, carmenNext.id, "My daughter's school event moved to that day."));
  // Staff-cancelled, LATE (inside 24 hours) — a visit for Rosa tomorrow morning.
  const clin = AdelanteEHR.listClinicians().find((c) => AdelanteEHR.canBook(c.id).ok);
  if (rosa && clin)
    safe(() => {
      const soon = new Date(Date.now() + 20 * 3600000);
      soon.setMinutes(0, 0, 0);
      const a = AdelanteEHR.bookAppointment({ patientId: rosa, clinicianId: clin.id, start: soon.toISOString(), durationMin: 50, serviceType: "therapy_individual", modality: "video", source: "staff_scheduled", allowPatientOverlap: true });
      AdelanteEHR.staffCancelAppointment(a.id, { reason: "clinician_unavailable", actor: { name: "Priya Raman", role: "clinical_coordinator", id: "s-cc1" } });
    });
  // Luis — his ASAM-linked assessment visit was two days ago and he did not
  // come: marked no-show, so the task returns to "not yet scheduled".
  const luis = demoScenarioPatientId("sud_consented");
  const luisTask = luis ? AdelanteEHR.openAsamWorkTask(luis) : undefined;
  const past = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * 86400000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };
  if (luis && luisTask && clin)
    safe(() => {
      const a = AdelanteEHR.bookAppointment({ patientId: luis, clinicianId: clin.id, start: past(2), durationMin: 60, serviceType: "intake", modality: "video", source: "staff_scheduled", asamTaskId: luisTask.id, bookedBy: { id: reyes.name, role: "therapist" }, allowPatientOverlap: true });
      AdelanteEHR.markAppointmentNoShow(a.id, reyes);
    });
  // Marcus — an ASAM-linked visit yesterday, still unmarked: staff can mark
  // it a no-show on screen and watch the task return to "not yet scheduled".
  const marcusTask = marcus ? AdelanteEHR.openAsamWorkTask(marcus) : undefined;
  if (marcus && marcusTask && clin)
    safe(() => {
      AdelanteEHR.bookAppointment({ patientId: marcus, clinicianId: clin.id, start: past(1), durationMin: 60, serviceType: "intake", modality: "video", source: "staff_scheduled", asamTaskId: marcusTask.id, bookedBy: { id: reyes.name, role: "therapist" }, allowPatientOverlap: true });
    });

  // §Item 6 carry-over — an advocate whose release includes scheduling
  // (conservatorship, court documents verified by staff) and an upcoming 1:1
  // visit for their patient, so the advocate Cancel request can be shown.
  if (victor && clin)
    safe(() => {
      const link = AdelanteEHR.createAdvocateInvitation({ patientId: victor, advocateName: "Teresa Salinas", relationship: "Sister (conservator)", invitationSentTo: "+15595550188", invitationChannel: "sms", designatedBy: { actor: "ecm_provider", name: "Luz Herrera" }, expectedAuthorizationType: "conservatorship" });
      AdelanteEHR.claimAdvocateInvitation({ code: link.invitationCode!, authorizationType: "conservatorship", attestedName: "Teresa Salinas" });
      AdelanteEHR.recordAdvocateConservatorshipDocs(link.id, { verifiedBy: "Luz Herrera", courtOrderRef: "TUL-PR-2026-0412" });
      const d = new Date(Date.now() + 5 * 86400000);
      d.setHours(11, 0, 0, 0);
      AdelanteEHR.bookAppointment({ patientId: victor, clinicianId: clin.id, start: d.toISOString(), durationMin: 50, serviceType: "therapy_individual", modality: "video", source: "staff_scheduled", allowPatientOverlap: true });
    });
  safe(() => seedCoordinationDemo());
  safe(() => seedCaseloadDemo());

  // §Inbox actions — a claim status move raised by the real audit hook, then
  // claim / assign / done / make-a-task through the inbox action functions.
  if (marcus)
    safe(() =>
      AdelanteEHR.recordClaimStatusChange({ claimId: "demo-claim-90834", patientId: marcus, from: "submitted", to: "paid", actorId: "Deneen Ford", actorRole: "billing_coordinator", via: "billing" }),
    );
  safe(() => seedInboxActionsDemo());

  // A few read, most unread.
  const readOne = (name: string, role: Parameters<typeof AdelanteEHR.listNotificationsFor>[1]) => {
    const rows = AdelanteEHR.listNotificationsFor(name, role);
    const last = rows[rows.length - 1];
    if (last) AdelanteEHR.markNotificationRead(last.id, name);
  };
  readOne("Luz Herrera", "ecm_provider");
  readOne("Priya Raman", "clinical_coordinator");
  readOne("Dr. R. Bagga", "pmhnp");
}

seedDemoInbox();
