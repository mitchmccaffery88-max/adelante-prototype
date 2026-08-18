// §Adelante Journey Phase 5b — RECOVERY MODULE SYSTEM (schema + content).
//
// PURE MODULE, exactly like `src/lib/library.ts`: shape and content only, no
// store access, no React, no side effects. Progress lives in the ENGAGEMENT
// store (`src/lib/engagement.ts`), keyed by patient id — never on `Patient`,
// because module progress is engagement data, not clinical documentation.
//
// Difference from the Library: a recovery lesson is a TEN-step canonical
// sequence, and steps 7–9 are real, structured SKILL-BUILDING tool flow —
// warning signs (max 3), support people (max 3), one action for today (single
// select). These are typed option sets, not free text, so what a patient
// selects is queryable data rather than prose.
//
// Rendering reuses the ONE shared module component
// (`src/components/library/ModuleTemplate.tsx`) that the Library also renders
// through. There is deliberately no second renderer.
import type { LibraryActivity } from "@/lib/library";
import type { PopulationTrack } from "@/lib/population";
// Ported Adelante Journey lessons for modules 2–9 (generated).
import { PORTED_RECOVERY_LESSONS } from "@/lib/recovery.ported";

/** Steps 7–9: the tool flow. Closed option sets, with selection limits. */
export interface RecoveryToolFlow {
  /** Step 7 — multi-select, max 3. */
  warningSigns: string[];
  /** Step 8 — multi-select, max 3. */
  supportPeople: string[];
  /** Step 9 — single select. */
  todayActions: string[];
}

export const TOOL_FLOW_LIMITS = { warningSigns: 3, supportPeople: 3, todayActions: 1 } as const;

export interface RecoveryLesson {
  id: string;
  moduleId: string;
  title: string;
  minutes: number;
  order: number;
  /** 1 */ problem: string;
  /** 2 */ checkIn: string;
  /** 3 */ learnTitle: string;
  learnBody: string;
  /** 4 — reuses the Library's activity union; no parallel activity model. */
  activity: LibraryActivity;
  /** 5 */ adelReflection: string;
  adelQuestion: string;
  /** 6 */ insight: string;
  /** 7–9 */ toolFlow: RecoveryToolFlow;
  /** 10 */ toolkitLabel: string;
  populations?: PopulationTrack[];
  part2Sensitive?: boolean;
  placeholder?: boolean;
}

export interface RecoveryModule {
  id: string;
  order: number;
  name: string;
  /** The module's real mission statement, as named in the source. */
  mission: string;
  subtitle: string;
  /** lucide-react icon NAME, resolved by the UI. Keeps this module pure. */
  icon: string;
  populations?: PopulationTrack[];
  /**
   * TRUE when the module's real name/mission are confirmed but its lesson
   * content has not been transcribed yet. Nothing is fabricated for these —
   * the UI states plainly that content is pending.
   */
  contentPending?: boolean;
}

// ---------------------------------------------------------------------------
// The nine modules.
//
// "Living Recovery" / "Protect My Recovery for Life" is module 9: the Journey
// build ships it as a full module with its own lessons, so it is no longer a
// flagged wrapper here.
// ---------------------------------------------------------------------------

export const RECOVERY_MODULES: RecoveryModule[] = [
  {
    id: "first-days-out",
    order: 1,
    name: "My First Days Out",
    mission: "Survive and Stabilize",
    subtitle: "The first stretch: staying alive, staying safe, getting a floor under you.",
    icon: "Sunrise",
    // Written explicitly for the days after release — gated to the
    // justice-involved tracks, same Phase 2 gate the Library uses.
    populations: ["pre_release_ji", "post_release_ji"],
  },
  {
    id: "finding-my-people",
    order: 2,
    name: "Finding My People",
    mission: "Build My Support System",
    subtitle: "Who you can call, who you can trust, and how to ask.",
    icon: "Users",
  },
  {
    id: "understanding-my-addiction",
    order: 3,
    name: "Understanding My Addiction",
    mission: "Know My Patterns",
    subtitle: "Triggers, cycles, and what your use has been doing for you.",
    icon: "Brain",
  },
  {
    id: "changing-my-everyday-life",
    order: 4,
    name: "Changing My Everyday Life",
    mission: "Create Healthy Routines",
    subtitle: "Sleep, food, movement, money, and the shape of a day.",
    icon: "CalendarClock",
  },
  {
    id: "healing-my-relationships",
    order: 5,
    name: "Healing My Relationships",
    mission: "Repair and Protect",
    subtitle: "Making amends where you can, setting limits where you must.",
    icon: "HeartHandshake",
  },
  {
    id: "building-a-life-that-works",
    order: 6,
    name: "Building a Life That Works",
    mission: "Get Stable",
    subtitle: "Housing, work, documents, and income that hold.",
    icon: "Home",
  },
  {
    id: "when-recovery-gets-hard",
    order: 7,
    name: "When Recovery Gets Hard",
    mission: "Strengthen My Recovery",
    subtitle: "Cravings, setbacks, grief, and the days you want to quit.",
    icon: "ShieldCheck",
  },
  {
    id: "becoming-someone-new",
    order: 8,
    name: "Becoming Someone New",
    mission: "Grow Into Who I'm Becoming",
    subtitle: "Identity, purpose, and a version of you that isn't the old one.",
    icon: "Sparkles",
  },
  {
    id: "living-recovery",
    order: 9,
    name: "Living Recovery",
    mission: "Protect My Recovery for Life",
    subtitle: "Everything you have built, kept going — maintenance for the long haul.",
    icon: "Infinity",
  },
];


// ---------------------------------------------------------------------------
// REAL CONTENT — Module 1, "My First Days Out".
// Modules 2–9 carry the ported Adelante Journey lessons (recovery.ported.ts).
// ---------------------------------------------------------------------------

const FIRST_DAYS_OUT_LESSONS: RecoveryLesson[] = [
  {
    id: "fdo-first-72-hours",
    moduleId: "first-days-out",
    title: "The First 72 Hours",
    minutes: 6,
    order: 1,
    problem: "You're out, and the first few days feel louder and faster than you expected.",
    checkIn: "Before anything else: have you eaten today, and did you sleep last night?",
    learnTitle: "The first three days are about survival, not progress",
    learnBody:
      "Your tolerance is down, your nervous system is on high alert, and everyone wants something from you. This is the highest-risk window there is — overdose risk after release is at its peak in the first two weeks. So the goal for 72 hours is small on purpose: stay alive, stay fed, sleep somewhere safe, and keep naloxone within reach. Progress can start on day four.",
    activity: {
      kind: "checklist",
      prompt: "Check off what's already handled. Anything unchecked is today's work.",
      items: [
        "I know where I'm sleeping tonight",
        "I have naloxone, or I know where to get it free",
        "I have eaten something today",
        "One person knows where I am",
        "I know my first appointment and when it is",
        "I have my phone or a way to be reached",
      ],
    },
    adelReflection:
      "Nobody stabilizes everything in three days. The people who make it are the ones who cover the basics first.",
    adelQuestion: "Which unchecked item would change the most if you handled it today?",
    insight: "The first 72 hours are not about building a life. They're about staying here to build one.",
    toolFlow: {
      warningSigns: [
        "Craving that won't quiet down",
        "Nowhere confirmed to sleep tonight",
        "Back around people I used with",
        "No food and no money",
        "Haven't slept in over 24 hours",
        "Feeling like nobody would notice if I disappeared",
      ],
      supportPeople: [
        "My CF care manager",
        "My probation or parole officer",
        "A family member who's safe",
        "My sponsor or a peer",
        "988 Suicide & Crisis Lifeline",
        "The Adelante care team",
      ],
      todayActions: [
        "Get naloxone in my pocket",
        "Confirm where I'm sleeping tonight",
        "Eat a real meal",
        "Call one safe person",
        "Confirm my first appointment",
      ],
    },
    toolkitLabel: "My first 72 hours plan",
    populations: ["pre_release_ji", "post_release_ji"],
  },
  {
    id: "fdo-tolerance-and-overdose",
    moduleId: "first-days-out",
    title: "My Tolerance Is Not What It Was",
    minutes: 5,
    order: 2,
    problem: "Part of you thinks you can use the same amount you used before.",
    checkIn: "Have you thought about using since you got out? Honest answer, no consequence.",
    learnTitle: "Tolerance drops fast, and it doesn't warn you",
    learnBody:
      "After weeks or months without use, your body handles far less than it used to. The amount that used to be normal can stop your breathing now. This is why overdose deaths spike right after release — not because people relapse harder, but because their bodies changed while their habits didn't. Knowing this is protection. So is naloxone, and so is never using alone.",
    activity: {
      kind: "decision",
      title: "If you were going to use tonight",
      prompt: "There's no wrong answer here. Pick the one closest to true.",
      choices: [
        {
          label: "I'd use the same amount as before",
          feedback:
            "That's the amount most at risk of being fatal now. If it happens, use far less, and never alone.",
        },
        {
          label: "I'd use less because I know my tolerance dropped",
          feedback: "That's real harm reduction. Keep naloxone with you anyway — supply is unpredictable.",
          good: true,
        },
        {
          label: "I'd call someone first",
          feedback: "That call is the single strongest protective step there is.",
          good: true,
        },
        {
          label: "I don't plan to use",
          feedback: "Good. Carry naloxone anyway — it may be someone else's life you save.",
          good: true,
        },
      ],
    },
    adelReflection:
      "Being honest about this doesn't mean you're going to use. It means you're planning for a body that changed.",
    adelQuestion: "Who could you tell about your tolerance so someone else knows to watch for it?",
    insight: "Your tolerance reset. Your plan has to reset with it.",
    toolFlow: {
      warningSigns: [
        "Telling myself I can handle my old amount",
        "Planning to use alone",
        "Not carrying naloxone",
        "Getting from a source I don't know",
        "Hiding it from everyone",
      ],
      supportPeople: [
        "Someone who carries naloxone",
        "My sponsor or a peer",
        "My CF care manager",
        "A harm reduction program",
        "The Adelante care team",
      ],
      todayActions: [
        "Pick up naloxone today",
        "Tell one person my tolerance is down",
        "Save a number I'd actually call first",
        "Read the overdose response steps",
      ],
    },
    toolkitLabel: "Tolerance reset — my overdose safety plan",
    populations: ["pre_release_ji", "post_release_ji"],
  },
  {
    id: "fdo-where-i-sleep",
    moduleId: "first-days-out",
    title: "Somewhere Safe to Sleep",
    minutes: 5,
    order: 3,
    problem: "Where you're staying isn't settled, or it's a place you know isn't good for you.",
    checkIn: "Where did you sleep last night, and did you feel safe there?",
    learnTitle: "Where you sleep decides most of the rest",
    learnBody:
      "Housing isn't just shelter — it decides who's around you, whether you can keep medication, whether you can rest, and whether you can hold appointments. A bed in a place where people are using is not neutral; it's a daily exposure. It's not always possible to fix this in week one, but naming what you've got is how you start moving.",
    activity: {
      kind: "sort",
      prompt: "Sort each option by whether it's workable for you right now.",
      buckets: ["Workable", "Not safe for me"],
      cards: [
        "Staying with family",
        "Staying with someone I used with",
        "A shelter bed",
        "Sober living / recovery residence",
        "My own place",
        "Couch to couch",
      ],
    },
    adelReflection:
      "Naming a place as unsafe isn't ingratitude. It's information your care team can actually act on.",
    adelQuestion: "If tonight fell through, where's the second option?",
    insight: "A safe bed isn't a luxury step. It's the step everything else stands on.",
    toolFlow: {
      warningSigns: [
        "Nowhere confirmed for tonight",
        "Staying where people are using",
        "Can't keep my medication safe there",
        "Can't sleep more than a few hours",
        "Being asked to leave soon",
      ],
      supportPeople: [
        "My CF care manager",
        "A housing navigator",
        "Family who could take me short-term",
        "A shelter intake line",
        "The Adelante care team",
      ],
      todayActions: [
        "Confirm tonight's bed",
        "Ask my care manager about housing options",
        "Call a shelter intake line",
        "Pack my medication somewhere secure",
      ],
    },
    toolkitLabel: "My sleep-safe plan and backup",
    populations: ["pre_release_ji", "post_release_ji"],
  },
  {
    id: "fdo-paperwork-and-appointments",
    moduleId: "first-days-out",
    title: "Paperwork, ID, and the Appointments That Matter",
    minutes: 6,
    order: 4,
    problem: "There's a stack of things you're supposed to do and no order to any of it.",
    checkIn: "What's the next thing you're supposed to show up for, and do you know when?",
    learnTitle: "Three documents unlock almost everything",
    learnBody:
      "ID, Medi-Cal coverage, and a Social Security card are the keys most other doors need — housing, work, benefits, prescriptions. Everything else can wait behind those three. And of all the appointments in front of you, the ones with consequences attached (parole or probation check-ins, court dates) and the ones that keep your medication going are the two that come first.",
    activity: {
      kind: "timeline",
      title: "Order your week",
      prompt: "This is the order that usually works. Put your own week against it.",
      steps: [
        "Check in with probation or parole if required",
        "Confirm Medi-Cal is active",
        "Keep the medication appointment",
        "Start the ID replacement",
        "Apply for benefits (CalFresh, GA)",
        "Housing or work follow-up",
      ],
    },
    adelReflection:
      "You don't have to do all six this week. You have to not miss the ones with a consequence.",
    adelQuestion: "Which one have you been avoiding, and what's the reason underneath it?",
    insight: "Missed appointments cost more than the appointment. Show up even when you show up badly.",
    toolFlow: {
      warningSigns: [
        "Already missed a required check-in",
        "No ID and no plan to get one",
        "Not sure my Medi-Cal is active",
        "Avoiding a call I need to make",
        "Losing track of dates",
      ],
      supportPeople: [
        "My CF care manager",
        "My probation or parole officer",
        "A benefits or eligibility worker",
        "Someone who can give me a ride",
        "The Adelante care team",
      ],
      todayActions: [
        "Write every date in one place",
        "Confirm my Medi-Cal status",
        "Start the ID replacement",
        "Make the call I've been avoiding",
        "Arrange a ride to my next appointment",
      ],
    },
    toolkitLabel: "My first-week appointment order",
    populations: ["pre_release_ji", "post_release_ji"],
  },
  {
    id: "fdo-people-places-things",
    moduleId: "first-days-out",
    title: "The People and Places I'm Walking Back Into",
    minutes: 5,
    order: 5,
    problem: "The same street, the same numbers in your phone, the same people at the door.",
    checkIn: "Has anyone from before already reached out to you since you got out?",
    learnTitle: "Old cues fire before you decide anything",
    learnBody:
      "Cravings aren't only about wanting. A street corner, a ringtone, a certain person's voice — your brain learned those as the start of a sequence, and it runs the sequence before the thinking part catches up. You can't erase the cues, but you can decide in advance what happens next: a number blocked, a route changed, a person you call instead.",
    activity: {
      kind: "reflection",
      title: "What's already come back around?",
      prompt: "Tap anything that's happened since you got out.",
      cards: [
        "Someone I used with contacted me",
        "I walked past a place I used",
        "I still have numbers in my phone",
        "Someone offered",
        "I drove or walked a familiar route",
        "None of this yet",
      ],
    },
    adelReflection:
      "Every one of those is normal and none of them means you failed. They mean the plan needs to be specific.",
    adelQuestion: "What's the one contact or place you most need a plan for this week?",
    insight: "Decide what you'll do before the moment decides for you.",
    toolFlow: {
      warningSigns: [
        "Old contacts reaching out",
        "Keeping numbers I said I'd delete",
        "Going back to the same street",
        "Answering when I said I wouldn't",
        "Telling myself one visit is fine",
      ],
      supportPeople: [
        "My sponsor or a peer",
        "A family member who's safe",
        "My CF care manager",
        "Someone from a meeting",
        "The Adelante care team",
      ],
      todayActions: [
        "Delete or block one number",
        "Change one route I take",
        "Tell someone what I'm avoiding",
        "Put one meeting on my calendar",
        "Save the number I'd call instead",
      ],
    },
    toolkitLabel: "My people-and-places plan",
    populations: ["pre_release_ji", "post_release_ji"],
  },
];

// ---------------------------------------------------------------------------
// Pure selectors
// ---------------------------------------------------------------------------

/** Module 1 (transcribed here) plus the ported Journey modules 2–9. */
export const RECOVERY_LESSONS: RecoveryLesson[] = [
  ...FIRST_DAYS_OUT_LESSONS,
  ...PORTED_RECOVERY_LESSONS,
];

export function getRecoveryModule(id: string): RecoveryModule | undefined {
  return RECOVERY_MODULES.find((m) => m.id === id);
}

export function getRecoveryLesson(id: string): RecoveryLesson | undefined {
  return RECOVERY_LESSONS.find((l) => l.id === id);
}

export function lessonsInModule(moduleId: string): RecoveryLesson[] {
  return RECOVERY_LESSONS.filter((l) => l.moduleId === moduleId).sort((a, b) => a.order - b.order);
}

export function moduleProgress(
  moduleId: string,
  completedLessonIds: readonly string[],
): { total: number; completed: number; pct: number } {
  const lessons = lessonsInModule(moduleId);
  const completed = lessons.filter((l) => completedLessonIds.includes(l.id)).length;
  return {
    total: lessons.length,
    completed,
    pct: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
  };
}
