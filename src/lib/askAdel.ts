// §Dashboard Standardization Phase 5e — "Ask Adel", a WALKTHROUGH PROTOTYPE.
//
// This is a demo entry point, not a feature. Nothing here calls a model,
// stores a transcript, or writes anything: every answer is assembled from a
// selector the acting role can already run on a page they can already reach,
// and every answer ends in a LINK to where the work is actually done.
//
// Three rules hold this module honest:
//   1. No new data path. Each question names the RecordClass it needs and is
//      dropped for a role the matrix does not grant — the same `canAccess`
//      gate the nav registry and the record sections use.
//   2. No Part 2 leak. SUD screener names come through `screenerDueRows`,
//      which already masks per instrument per patient. Recovery /
//      support-group referrals are never named, never categorised, and never
//      counted in a visible bucket for a gated viewer — they collapse into a
//      restricted count, exactly like the 5d-1 restricted row.
//   3. No causation, no invented number. Cross-patient aggregates carry the
//      shared cohort guard; a question with nothing real behind it is marked
//      `illustrative` and says so on screen.
import { AdelanteEHR, isPart2SensitiveCategory, type ResourceReferral } from "./ehr";
import { AdelanteEHRExt } from "./ehr-ext";
import { canAccess, type AccessLevel, type RecordClass, type StaffRole } from "./roles";
import { cohortGuard, type CohortGuard } from "./cohortGuard";
import {
  myCaseload,
  myOpenItems,
  screenerDueRows,
  disengagementRows,
  disengagementFlagged,
  DISENGAGEMENT_DRAFT,
  RESCREEN_CADENCE_DRAFT_NOTE,
  type ActingIdentity,
} from "./myWork";
import { SDOH_AGING_DRAFT } from "./sdohAging";
import { listUnsignedWork } from "./unsignedWork";
import { coverageWorklistRows, coverageWorklistSummary } from "./coverageWorklist";
import { referralFunnel, REFERRAL_FUNNEL_ASSOCIATION_NOTE } from "./referralFunnel";
import { chartReviewFacts } from "./agenticPrototype";

/** The one label every answer carries, matching the existing prototype chrome. */
export const ASK_ADEL_PROTOTYPE_NOTE =
  "Prototype — not connected to a live AI model. Answers are assembled from this demo's own records and are read-only.";

export const ASK_ADEL_FREE_TEXT_NOTE =
  "This prototype answers only the sample questions listed above. Free-text questions are not available.";

export const ASK_ADEL_CASELOAD_NOTE =
  "Your own work list, not a published aggregate — the small-cohort rule applies to program-wide numbers, not to your own caseload.";

// ---------------------------------------------------------------------------
// Role groups
// ---------------------------------------------------------------------------

export type AskAdelGroup = "clinical" | "coordination" | "admin";

export const ASK_ADEL_GROUP_LABEL: Record<AskAdelGroup, string> = {
  clinical: "Care questions",
  coordination: "Care-coordination questions",
  admin: "Practice-management questions",
};

/**
 * Every role lands in exactly one group. The medical assistant sits with the
 * clinical group but, like every other role, only keeps the questions its
 * matrix grants — it never gains a surface it lacks.
 */
export const ASK_ADEL_GROUP_BY_ROLE: Record<StaffRole, AskAdelGroup> = {
  therapist: "clinical",
  pmhnp: "clinical",
  sud_counselor: "clinical",
  clinical_trainee: "clinical",
  medical_assistant: "clinical",
  ecm_provider: "coordination",
  cf_care_manager: "coordination",
  peer_specialist: "coordination",
  community_health_worker: "coordination",
  clinical_coordinator: "admin",
  billing: "admin",
  billing_coordinator: "admin",
  credentialing_coordinator: "admin",
  sys_admin: "admin",
};

export function roleGroupFor(role: StaffRole): AskAdelGroup {
  return ASK_ADEL_GROUP_BY_ROLE[role];
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface AskAdelContext extends ActingIdentity {
  role: StaffRole;
  /** The patient in context, when the current route has one. */
  patientId?: string;
  now?: Date;
}

export interface AskAdelAnswer {
  lines: string[];
  /** `real` = assembled from this demo's records; `illustrative` = example only. */
  backing: "real" | "illustrative";
  link?: { to: string; label: string };
  /** Draft-threshold and honesty notes rendered under the answer. */
  notes?: string[];
  /** Present on program-wide aggregates only. */
  guard?: CohortGuard;
}

export interface AskAdelQuestion {
  id: string;
  group: AskAdelGroup;
  prompt: string;
  /** Any one of these classes at `minLevel` or better. */
  anyOf: RecordClass[];
  minLevel?: Extract<AccessLevel, "read" | "write">;
  /** Needs a patient in context to answer. */
  needsPatient?: boolean;
  answer: (ctx: AskAdelContext) => AskAdelAnswer;
}

const LEVEL_RANK: Record<AccessLevel, number> = {
  none: 0,
  summary: 1,
  consent_gated: 1,
  read: 2,
  write: 3,
};

function grants(role: StaffRole, q: Pick<AskAdelQuestion, "anyOf" | "minLevel">): boolean {
  const want = LEVEL_RANK[q.minLevel ?? "read"];
  return q.anyOf.some((cls) => LEVEL_RANK[canAccess(role, cls).level] >= want);
}

/**
 * Part 2 gate for cross-patient answers. With no patient in hand a
 * `consent_gated` grant cannot resolve, so it reads as gated — the
 * conservative direction.
 */
export function part2Gated(role: StaffRole): boolean {
  return canAccess(role, "screeners_sud").level === "none" ||
    canAccess(role, "screeners_sud").level === "consent_gated";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export const ASK_ADEL_QUESTIONS: AskAdelQuestion[] = [
  // ---- Clinical ----------------------------------------------------------
  {
    id: "clinical-rescreens",
    group: "clinical",
    prompt: "Which of my patients have overdue re-screens?",
    anyOf: ["screeners_mh"],
    answer: (ctx) => {
      const rows = screenerDueRows(myCaseload(ctx), { role: ctx.role });
      const people = new Set(rows.map((r) => r.patientId));
      return {
        backing: "real",
        lines: rows.length
          ? [
              `${plural(rows.length, "re-screen", "re-screens")} past the draft cadence across ${plural(people.size, "patient", "patients")} on your caseload.`,
              ...rows.slice(0, 5).map(
                (r) => `${r.patientName} — ${r.screenerKey.toUpperCase()}, ${r.daysSinceLast} days since the last one${r.taskAlreadySent ? " (a re-screen task is already out)" : ""}`,
              ),
            ]
          : ["Nothing on your caseload is past the draft re-screen cadence."],
        notes: [
          RESCREEN_CADENCE_DRAFT_NOTE,
          ASK_ADEL_CASELOAD_NOTE,
          ...(part2Gated(ctx.role)
            ? ["Substance-use instruments are not included — your role does not have 42 CFR Part 2 access."]
            : []),
        ],
        link: { to: "/my-work", label: "Open My work" },
      };
    },
  },
  {
    id: "clinical-unsigned",
    group: "clinical",
    prompt: "What documentation of mine is still unsigned?",
    anyOf: ["therapy_notes", "case_notes", "peer_notes", "chw_notes"],
    answer: (ctx) => {
      const rows = listUnsignedWork(
        ctx.clinicianId ? { authorId: ctx.clinicianId } : {},
      );
      const drafts = rows.filter((r) => r.kind === "draft_note").length;
      const undocumented = rows.length - drafts;
      return {
        backing: "real",
        lines: rows.length
          ? [
              `${plural(drafts, "unsigned draft note", "unsigned draft notes")} and ${plural(undocumented, "attended visit", "attended visits")} with no note at all.`,
              `Oldest is ${rows[0].ageDays} days old.`,
            ]
          : ["Nothing of yours is waiting to be signed."],
        notes: [ASK_ADEL_CASELOAD_NOTE],
        link: { to: "/notes-queue", label: "Open unsigned notes" },
      };
    },
  },
  {
    id: "clinical-what-changed",
    group: "clinical",
    prompt: "What changed for this patient since the last visit?",
    anyOf: ["demographics"],
    needsPatient: true,
    answer: (ctx) => {
      const facts = ctx.patientId ? chartReviewFacts(ctx.patientId, ctx.role) : undefined;
      if (!facts) {
        return {
          backing: "real",
          lines: ["Pick a patient first — this answer reads their own record."],
        };
      }
      const lines = [
        facts.lastAppointment
          ? `Last visit ${facts.lastAppointment.start.slice(0, 10)}.`
          : "No attended visit on record yet.",
        `${plural(facts.recentNotes.length, "note", "notes")} since, ${plural(facts.activeOrders.length, "active medication order", "active medication orders")}, ${facts.dosesGiven} doses given and ${facts.dosesRefusedOrHeld} refused or held in the last 14 days.`,
        `${plural(facts.openSdoh, "open social need", "open social needs")}, ${plural(facts.openTasks, "open task", "open tasks")}.`,
      ];
      if (facts.hiddenScreenerCount > 0) {
        lines.push(
          `${facts.hiddenScreenerCount} screener result${facts.hiddenScreenerCount === 1 ? " is" : "s are"} withheld — 42 CFR Part 2 consent required.`,
        );
      }
      return {
        backing: "real",
        lines,
        notes: ["Read straight from this patient's record. No summary was generated."],
        link: {
          to: `/agentic/chart-review/${ctx.patientId}`,
          label: "Open guided chart review",
        },
      };
    },
  },
  {
    id: "clinical-care-gaps",
    group: "clinical",
    prompt: "What care gaps should I close before today's appointment?",
    anyOf: ["care_plan"],
    needsPatient: true,
    answer: (ctx) => {
      const facts = ctx.patientId ? chartReviewFacts(ctx.patientId, ctx.role) : undefined;
      if (!facts) {
        return {
          backing: "real",
          lines: ["Pick a patient first — this answer reads their own record."],
        };
      }
      if (!facts.careGaps.length) {
        return {
          backing: "real",
          lines: ["No care gap is derivable from this record right now."],
          link: {
            to: `/agentic/chart-review/${ctx.patientId}`,
            label: "Open guided chart review",
          },
        };
      }
      return {
        backing: "real",
        lines: facts.careGaps,
        notes: [
          "Derived from the record by the same rules the guided chart review uses — not a clinical recommendation.",
        ],
        link: {
          to: `/agentic/chart-review/${ctx.patientId}`,
          label: "Open guided chart review",
        },
      };
    },
  },

  // ---- Care coordination -------------------------------------------------
  {
    id: "coord-stalled-needs",
    group: "coordination",
    prompt: "Which of my clients have social needs past their aging threshold?",
    anyOf: ["sdoh"],
    answer: (ctx) => {
      const items = myOpenItems(ctx).sdohAging;
      const gated = part2Gated(ctx.role);
      const lines = items.length
        ? [
            `${plural(items.length, "need or referral", "needs and referrals")} past a draft aging threshold on your caseload.`,
            ...items.slice(0, 5).map((i) => {
              const label = gated && i.kind === "referral" ? "Restricted referral" : i.label;
              return `${i.patientName} — ${label}, ${i.aging.days} days with no action`;
            }),
          ]
        : ["Nothing on your caseload is past a draft aging threshold."];
      return {
        backing: "real",
        lines,
        notes: [
          SDOH_AGING_DRAFT.note,
          ASK_ADEL_CASELOAD_NOTE,
          ...(gated
            ? ["Referral detail is withheld — 42 CFR Part 2 consent required for your role."]
            : []),
        ],
        link: { to: "/my-work", label: "Open My work" },
      };
    },
  },
  {
    id: "coord-waitlisted",
    group: "coordination",
    prompt: "Which referrals are sitting on a waitlist?",
    anyOf: ["sdoh"],
    answer: (ctx) => {
      const gated = part2Gated(ctx.role);
      const rows: { name: string; label: string }[] = [];
      let restricted = 0;
      for (const p of myCaseload(ctx)) {
        for (const r of (p.resourceReferrals ?? []) as ResourceReferral[]) {
          if (r.outcome !== "waitlisted") continue;
          const sensitive = isPart2SensitiveCategory(r.category);
          if (sensitive && gated) {
            restricted += 1;
            continue;
          }
          rows.push({
            name: `${p.firstName} ${p.lastName}`,
            label: sensitive ? "Confidential service" : r.provider,
          });
        }
      }
      const lines = rows.length || restricted
        ? [
            `${plural(rows.length + restricted, "referral", "referrals")} on a waitlist across your caseload.`,
            ...rows.slice(0, 5).map((r) => `${r.name} — ${r.label}`),
            ...(restricted
              ? [`${plural(restricted, "referral is", "referrals are")} restricted — 42 CFR Part 2 consent required.`]
              : []),
          ]
        : ["No referral on your caseload is waitlisted."];
      return {
        backing: "real",
        lines,
        notes: [ASK_ADEL_CASELOAD_NOTE],
        link: { to: "/case-manager", label: "Open Care Coordination" },
      };
    },
  },
  {
    id: "coord-no-contact",
    group: "coordination",
    prompt: "Who hasn't been reached lately?",
    anyOf: ["demographics"],
    answer: (ctx) => {
      const flagged = disengagementFlagged(disengagementRows(myCaseload(ctx)));
      return {
        backing: "real",
        lines: flagged.length
          ? [
              `${plural(flagged.length, "client", "clients")} on your caseload with no recent contact signal.`,
              ...flagged.slice(0, 5).map((r) =>
                r.daysSinceContact === null
                  ? `${r.patientName} — no contact of any kind recorded`
                  : `${r.patientName} — ${r.daysSinceContact} days since the last ${r.lastContactKind.replace("_", " ")}`,
              ),
            ]
          : ["Everyone on your caseload has a recent contact signal."],
        notes: [DISENGAGEMENT_DRAFT.note, ASK_ADEL_CASELOAD_NOTE],
        link: { to: "/my-work", label: "Open My work" },
      };
    },
  },
  {
    id: "coord-followups",
    group: "coordination",
    prompt: "Which clients are due a follow-up?",
    anyOf: ["worklist"],
    answer: (ctx) => {
      const tasks = myOpenItems(ctx).overdueTasks;
      return {
        backing: "real",
        lines: tasks.length
          ? [
              `${plural(tasks.length, "task", "tasks")} assigned to you are past due.`,
              ...tasks.slice(0, 5).map((t) => `${t.patientName} — ${t.task.title}, ${t.overdueDays} days overdue`),
            ]
          : ["Nothing assigned to you is past due."],
        notes: [ASK_ADEL_CASELOAD_NOTE],
        link: { to: "/my-work", label: "Open My work" },
      };
    },
  },

  // ---- Administrative ----------------------------------------------------
  {
    id: "admin-referral-conversion",
    group: "admin",
    prompt: "How many referrals reached an attended first visit this period?",
    anyOf: ["population_health"],
    answer: () => {
      const f = referralFunnel({ sinceDays: 90 });
      return {
        backing: "real",
        guard: cohortGuard(f.cohortSize),
        lines: [
          `${f.submitted} referrals submitted in the last 90 days.`,
          `${f.contacted} reached, ${f.enrolled} enrolled, ${f.firstApptScheduled} with a first appointment booked, ${f.firstApptAttended} who actually attended one.`,
          f.medianDaysToFirstAttended !== undefined
            ? `Median ${f.medianDaysToFirstAttended} days from referral to an attended first visit.`
            : "No attended first visit in this window, so there is no median to report.",
        ],
        notes: [REFERRAL_FUNNEL_ASSOCIATION_NOTE],
        link: { to: "/reporting", label: "Open Reporting" },
      };
    },
  },
  {
    id: "admin-eligibility",
    group: "admin",
    prompt: "Which Medi-Cal eligibility checks are overdue?",
    anyOf: ["eligibility"],
    answer: () => {
      const s = coverageWorklistSummary(coverageWorklistRows());
      return {
        backing: "real",
        guard: cohortGuard(s.total),
        lines: [
          `${s.neverChecked} patients have never had a coverage check, ${s.overdue} are overdue and ${s.due} are due.`,
          `${s.current} are current.`,
        ],
        notes: [
          "Staleness uses the existing draft coverage threshold, pending sign-off.",
        ],
        link: { to: "/eligibility-worklist", label: "Open Medi-Cal verification" },
      };
    },
  },
  {
    id: "admin-claims-awaiting-signature",
    group: "admin",
    prompt: "Which claims are stuck at documented, awaiting signature?",
    anyOf: ["billing"],
    answer: () => {
      const stuck = AdelanteEHR.listClaims().filter((c) => c.state === "documented");
      return {
        backing: "real",
        guard: cohortGuard(stuck.length),
        lines: [
          `${plural(stuck.length, "claim is", "claims are")} at documented and cannot advance until the note is signed.`,
        ],
        notes: [
          "A claim leaves this state when the linked note is signed — signing is done in the chart or the unsigned-notes queue, not here.",
        ],
        link: { to: "/admin-claims", label: "Open claims worklist" },
      };
    },
  },
  {
    id: "admin-credentials-expiring",
    group: "admin",
    prompt: "Which credentials are expiring soon?",
    anyOf: ["staff_supervision"],
    minLevel: "write",
    answer: () => {
      const all = AdelanteEHRExt.listAllCredentials();
      const expiring = all.filter((c) => c.status === "expiring");
      const expired = all.filter((c) => c.status === "expired");
      const missing = all.filter((c) => c.status === "missing");
      return {
        backing: "real",
        lines: [
          `${expiring.length} credentials are inside their expiry window, ${expired.length} have already expired and ${missing.length} are missing an expiry date entirely.`,
          ...expiring
            .slice(0, 5)
            .map((c) => `${c.kind.toUpperCase()} — expires ${c.expiresAt}`),
        ],
        notes: ["Workforce records, not patient data — no cohort rule applies."],
        link: { to: "/admin-credentialing", label: "Open credentialing" },
      };
    },
  },
];

export function askAdelQuestionsFor(role: StaffRole): AskAdelQuestion[] {
  const group = roleGroupFor(role);
  return ASK_ADEL_QUESTIONS.filter((q) => q.group === group && grants(role, q));
}

export function answerAskAdel(id: string, ctx: AskAdelContext): AskAdelAnswer | undefined {
  const q = ASK_ADEL_QUESTIONS.find((x) => x.id === id);
  if (!q || !grants(ctx.role, q)) return undefined;
  return q.answer(ctx);
}

// ---------------------------------------------------------------------------
// Encounter-tool shortcuts (the existing /agentic/* prototypes, unchanged)
// ---------------------------------------------------------------------------

export interface AskAdelShortcut {
  id: string;
  label: string;
  desc: string;
  /** Built with the patient in context. */
  path: (patientId: string) => string;
  anyOf: RecordClass[];
}

export const ASK_ADEL_SHORTCUTS: AskAdelShortcut[] = [
  {
    id: "chart-review",
    label: "Guided chart review",
    desc: "Pre-visit summary built from the real record",
    path: (id) => `/agentic/chart-review/${id}`,
    anyOf: ["demographics"],
  },
  {
    id: "scribe",
    label: "Scribe copilot",
    desc: "Live-encounter walkthrough",
    path: (id) => `/agentic/scribe/${id}`,
    anyOf: ["therapy_notes", "case_notes", "peer_notes", "chw_notes"],
  },
  {
    id: "dictation",
    label: "Smart dictation",
    desc: "Post-encounter dictation walkthrough",
    path: (id) => `/agentic/dictation/${id}`,
    anyOf: ["therapy_notes", "case_notes", "peer_notes", "chw_notes"],
  },
];

export function askAdelShortcutsFor(role: StaffRole): AskAdelShortcut[] {
  return ASK_ADEL_SHORTCUTS.filter((s) => grants(role, { anyOf: s.anyOf }));
}

/** The button is hidden entirely for a role with nothing real to offer. */
export function canUseAskAdel(role: StaffRole): boolean {
  return askAdelQuestionsFor(role).length > 0 || askAdelShortcutsFor(role).length > 0;
}
