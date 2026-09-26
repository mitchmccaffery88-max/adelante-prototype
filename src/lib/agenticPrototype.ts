import { asamTaskDueLabel } from "@/lib/asam";
// §Agentic Roadmap prototype — data layer for the three walkthrough screens.
//
// HARD RULE: the FACTS on these screens come out of the existing patient
// record (`AdelanteEHR`) — appointments, orders, charted MAR doses, progress
// notes, screener history, care plan, alerts, tasks, referrals. Nothing here
// writes, and nothing here invents a clinical fact.
//
// The only invented material is the SYNTHESIS NARRATIVE (`sampleNarrative`,
// the scribe panels, the dictation transcript/note), which stands in for what
// a real agent would produce. Every consumer labels that material as sample.
import {
  AdelanteEHR,
  type Appointment,
  type DoseAdministration,
  type MedOrder,
  type Patient,
  type ProgressNote,
  type ScreenerResult,
} from "@/lib/ehr";
import { isReferralOpen } from "@/lib/noteAutofill";
import { canAccess, type StaffRole } from "@/lib/roles";
import { isPart2Screener } from "@/lib/screeners";

export interface ChartReviewFacts {
  patient: Patient;
  /** Next scheduled visit, when one exists. */
  nextAppointment?: Appointment;
  /** Most recent completed/attended visit. */
  lastAppointment?: Appointment;
  activeOrders: MedOrder[];
  /** Charted doses in the trailing 14 days (non-voided). */
  recentDoses: DoseAdministration[];
  dosesGiven: number;
  dosesRefusedOrHeld: number;
  recentNotes: ProgressNote[];
  /** Screener results this viewer may see, most recent first. */
  visibleScreeners: ScreenerResult[];
  /** Part 2 instruments withheld from this viewer. */
  hiddenScreenerCount: number;
  openGoals: number;
  doneGoals: number;
  openTasks: number;
  openReferrals: number;
  openSdoh: number;
  activeAlerts: { label: string; severity: string }[];
  /** Re-screens the existing cadence says are due, viewer-filtered. */
  rescreensDue: { key: string; nextDue: number; lastDays: number | null }[];
  /** Plain-language care gaps derived from the facts above. */
  careGaps: string[];
}

const DAY = 86_400_000;

export function chartReviewFacts(
  patientId: string,
  viewerRole: StaffRole,
  now: Date = new Date(),
): ChartReviewFacts | undefined {
  const patient = AdelanteEHR.getPatient(patientId);
  if (!patient) return undefined;
  const t = now.getTime();

  const appts = [...AdelanteEHR.appointmentsForPatient(patientId)].sort(
    (a, b) => +new Date(a.start) - +new Date(b.start),
  );
  const nextAppointment = appts.find(
    (a) => +new Date(a.start) >= t && a.status === "scheduled",
  );
  const lastAppointment = [...appts]
    .reverse()
    .find((a) => +new Date(a.start) < t && a.status === "attended");

  const activeOrders = AdelanteEHR.listOrders(patientId).filter(
    (o) => o.status === "signed",
  );

  const recentDoses = AdelanteEHR.listAdministrations(patientId).filter(
    (d) => !d.voided && t - +new Date(d.scheduledAt) <= 14 * DAY,
  );
  const dosesGiven = recentDoses.filter((d) => d.action === "given").length;
  const dosesRefusedOrHeld = recentDoses.length - dosesGiven;

  const recentNotes = [...(patient.progressNotes ?? [])]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 3);

  // §Part 2 — per-instrument, the same precedent the chart's Tracking tab and
  // the /my-work re-screen list already follow.
  const sudLocked = canAccess(viewerRole, "screeners_sud", patient).locked;
  const allScreeners = [...(patient.screenerHistory ?? [])].sort(
    (a, b) => +new Date(b.completedAt) - +new Date(a.completedAt),
  );
  const visibleScreeners = allScreeners.filter(
    (s) => !(sudLocked && isPart2Screener(s.key)),
  );
  const hiddenScreenerCount = allScreeners.length - visibleScreeners.length;

  const goals = patient.goals ?? [];
  const openGoals = goals.filter((g) => g.status !== "done").length;
  const doneGoals = goals.filter((g) => g.status === "done").length;
  const openTasks = (patient.tasks ?? []).filter((x) => !x.completedAt).length;
  const openReferrals = (patient.resourceReferrals ?? []).filter(isReferralOpen).length;
  const openSdoh = (patient.sdohPlan?.items ?? []).filter(
    (i) => i.status !== "completed",
  ).length;
  const activeAlerts = (patient.alerts ?? [])
    .filter((a) => !a.removedAt)
    .map((a) => ({ label: a.label, severity: a.severity }));

  const rescreensDue = AdelanteEHR.rescreensDue(patientId)
    .filter((d) => !(sudLocked && isPart2Screener(d.key)))
    .map((d) => ({ key: d.key, nextDue: d.nextDue, lastDays: d.lastDays }));

  // Care gaps are DERIVED from the real record above — no invented findings.
  const careGaps: string[] = [];
  if (rescreensDue.length > 0) {
    careGaps.push(
      `${rescreensDue.length} re-screen${rescreensDue.length === 1 ? "" : "s"} past the draft cadence: ${rescreensDue
        .map((d) => d.key.toUpperCase())
        .join(", ")}.`,
    );
  }
  // §Phase 10b — C-SSRS: an open request, and the latest risk level (draft mapping).
  const cssrsOpen = AdelanteEHR.openCssrsRequest(patientId);
  if (cssrsOpen) careGaps.push("C-SSRS indicated and not yet administered.");
  const cssrsLast = patient.screeners?.["c-ssrs-screener"];
  if (cssrsLast?.cssrsRisk && cssrsLast.cssrsRisk !== "none") {
    careGaps.push(
      `Latest C-SSRS: ${cssrsLast.severity} (${cssrsLast.context === "patient_self" ? "patient self-report" : "staff-administered"}; risk mapping draft, item text placeholder).`,
    );
  }
  if (allScreeners.some((s) => s.retiredForm)) {
    careGaps.push("Retired non-validated PTSD short-form results on file — not trended with PC-PTSD-5 / PCL-5.");
  }
  // §Phase 10c — ASAM facts (Part 2 gated; facts only, never a level suggestion).
  if (!sudLocked) {
    const asamTask = AdelanteEHR.openAsamTask(patientId);
    if (asamTask) careGaps.push(`ASAM assessment needed — ${asamTaskDueLabel(asamTask.dueDate)}.`);
    const pendingCosign = (patient.asamAssessments ?? []).find((a) => a.status === "cosign_pending");
    if (pendingCosign) careGaps.push("An ASAM assessment is awaiting LPHA co-signature.");
    const lastSigned = (patient.asamAssessments ?? []).find((a) => a.status === "signed");
    if (lastSigned) {
      careGaps.push(
        `Last signed ASAM: ${lastSigned.signedAt?.slice(0, 10) ?? "—"}, clinician-selected level on file${lastSigned.cosignedBy ? ` (co-signed by ${lastSigned.cosignedBy})` : ""}.`,
      );
    }
  }
  if (dosesRefusedOrHeld > 0) {
    careGaps.push(
      `${dosesRefusedOrHeld} dose${dosesRefusedOrHeld === 1 ? "" : "s"} refused or held in the last 14 days — worth naming in the visit.`,
    );
  }
  if (activeOrders.length === 0) {
    careGaps.push("No active medication orders on the chart.");
  }
  if (openTasks > 0) careGaps.push(`${openTasks} open case task${openTasks === 1 ? "" : "s"}.`);
  if (openSdoh > 0) {
    careGaps.push(`${openSdoh} unresolved social-needs item${openSdoh === 1 ? "" : "s"}.`);
  }
  if (openReferrals > 0) {
    careGaps.push(`${openReferrals} referral${openReferrals === 1 ? "" : "s"} still open.`);
  }
  if (activeAlerts.length > 0) {
    careGaps.push(`${activeAlerts.length} active chart alert${activeAlerts.length === 1 ? "" : "s"}.`);
  }
  if (!lastAppointment) careGaps.push("No attended visit recorded yet for this episode.");

  return {
    patient,
    nextAppointment,
    lastAppointment,
    activeOrders,
    recentDoses,
    dosesGiven,
    dosesRefusedOrHeld,
    recentNotes,
    visibleScreeners,
    hiddenScreenerCount,
    openGoals,
    doneGoals,
    openTasks,
    openReferrals,
    openSdoh,
    activeAlerts,
    rescreensDue,
    careGaps,
  };
}

// ---------------------------------------------------------------------------
// SAMPLE material — illustrative only, always rendered behind a sample label.
// ---------------------------------------------------------------------------

/** The synthesis paragraph a real agent would write. Sample text. */
export function sampleNarrative(firstName: string): string[] {
  return [
    `${firstName} is mid-episode and engaging unevenly: attendance has held, but medication charting shows a cluster of missed or held doses in the last two weeks, and at least one re-screen has drifted past the program's cadence.`,
    `The through-line across the last few notes is practical instability rather than clinical deterioration — transport, paperwork, and shifting housing keep displacing appointments. Clinical risk indicators have not moved in the same direction.`,
    `Suggested focus for this visit: confirm what is actually happening with the medication routine, close the overdue screening, and decide whether the open social-needs items belong to the care manager rather than this appointment.`,
  ];
}

export interface ScribePanel {
  items: string[];
}

/** Xaia-style live-encounter panels. Every string here is sample content. */
export function sampleScribePanels(firstName: string) {
  return {
    redFlags: [
      "Patient describes waking at 3am most nights for the past two weeks — new since last visit.",
      "Mentions skipping the evening dose 'when the day gets away from me'.",
      "Reports one contact with a former using partner; declined further detail.",
    ],
    chartInsights: [
      "Prior note recorded the same sleep complaint three visits ago; it resolved without a medication change.",
      "Last screening scores were stable — no upward trend to support a deterioration read.",
      "Charted administrations show the gaps are evening doses specifically, not morning.",
    ],
    differential: [
      "Behaviorally-driven insomnia tied to schedule disruption (most consistent with the record).",
      "Partial medication non-adherence producing evening symptom rebound.",
      "Emerging mood episode — currently unsupported by the screening trend.",
    ],
    suggestedQuestions: [
      `What does a typical evening look like for ${firstName} between 6pm and bedtime?`,
      "When a dose gets missed, what is usually happening at that moment?",
      "Has anything changed about where they are sleeping?",
      "What would make the evening dose easier to take without thinking about it?",
    ],
    recommendations: [
      "Consider shifting the evening dose earlier rather than changing the agent.",
      "Offer the sleep-hygiene module already in the patient's library.",
      "Route the transport and paperwork items to the care manager instead of absorbing them in this visit.",
      "Re-screen at this visit to close the overdue cadence step.",
    ],
    transcript: [
      { speaker: "Clinician", text: `Good to see you. How have the last couple of weeks gone?` },
      { speaker: "Patient", text: "Honestly, not great on sleep. I'm up at three most nights." },
      { speaker: "Clinician", text: "Is that new, or has it been building?" },
      { speaker: "Patient", text: "Started maybe two weeks ago. Around when my hours changed." },
      { speaker: "Clinician", text: "And the evening medication — how is that going?" },
      { speaker: "Patient", text: "I take the morning one fine. Evenings I forget when the day gets away from me." },
      { speaker: "Clinician", text: "That's useful. Let's look at what the evening actually looks like." },
    ],
  };
}

/** Sample post-encounter dictation and the polished note it would become. */
export function sampleDictation(firstName: string) {
  return {
    spoken: `Okay, this is a follow-up visit for ${firstName}. Sleep is the main thing — waking around three, started about two weeks ago when work hours changed. Morning medication is consistent, evenings are getting missed, patient says they forget rather than choosing not to. No safety concerns raised, denies any use. Mood looks about the same as last time. Plan is move the evening dose earlier, do the overdue screening today, and send the transport and paperwork items over to the care manager. Follow up in two weeks.`,
    note: {
      subjective: `${firstName} reports new-onset middle insomnia for approximately two weeks, temporally associated with a change in work hours. Describes consistent morning medication adherence with intermittent missed evening doses, attributed to forgetting rather than intentional discontinuation. Denies substance use since the last visit. Denies suicidal ideation or safety concerns.`,
      objective: `Alert, oriented, cooperative. Speech normal in rate and volume. Affect congruent, no psychomotor abnormality observed. No acute distress.`,
      assessment: `Symptom picture most consistent with schedule-driven sleep disruption compounded by partial evening medication non-adherence. No evidence of clinical deterioration; screening trend stable. Practical barriers (transport, paperwork) remain the dominant driver of missed engagement.`,
      plan: `1. Shift evening dose earlier to align with the patient's actual routine; no change in agent or total dose. 2. Complete the overdue screening at today's visit. 3. Refer transport and paperwork items to the assigned care manager. 4. Sleep-hygiene module assigned from the patient library. 5. Follow up in two weeks.`,
    },
    /** What a real system would claim to have pulled from the chart. Sample. */
    chartAwareness: [
      "Matched the medication names and current directions against the active order list.",
      "Carried the prior visit's screening trend into the assessment rather than re-asking.",
      "Left every diagnosis and billing code out — coding is not part of this prototype.",
    ],
  };
}
