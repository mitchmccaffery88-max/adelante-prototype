// §Adelante Journey Phase 5 — self-help Library + Exercise system (schema).
//
// PURE MODULE. Content and shape only: no store access, no React, no
// side effects. The patient's PROGRESS lives in the separate ENGAGEMENT store
// (`src/lib/engagement.ts`), keyed by patient id — real, queryable, server-
// side data (never localStorage), but deliberately NOT a field on the
// clinical `Patient` record: it is engagement data, not documentation.
//
// Reuse, not reinvention:
//  • Population gating is Phase 2's `PopulationTrack` / `isPopulationAllowed`
//    (src/lib/population.ts). An item carries `populations` ONLY when its text
//    genuinely references incarceration or release; the vast majority of this
//    library is population-neutral and carries nothing.
//  • Advocate visibility is Phase 4's tier system (src/lib/advocate.ts). The
//    new `library_progress_view` permission sits at the HIPAA-only read floor
//    and above — see the reasoning there.
// TYPE-ONLY on purpose: `ehr.ts` imports this module for the advocate progress
// read, and `population.ts` imports `ehr.ts`. Keeping this edge erased means
// there is no runtime cycle. The gate LOGIC is Phase 2's, restated in the one
// place it is applied (`isLibraryItemVisible`) rather than duplicated widely.
import type { PopulationResolution, PopulationTrack } from "@/lib/population";
// Ported Adelante Journey collections (generated, copy-identical to source).
import { PORTED_LIBRARY_CATEGORIES, PORTED_LIBRARY_ITEMS } from "@/lib/library.ported";

// ---------------------------------------------------------------------------
// Categories + lessons
// ---------------------------------------------------------------------------

export interface LibraryCategory {
  id: string;
  name: string;
  desc: string;
  /** lucide-react icon NAME, resolved by the UI. Keeps this module pure. */
  icon: string;
  /** What the category is clinically aiming at — shown to staff, not patients. */
  clinicalTarget: string;
  order: number;
}

/**
 * A lesson. The eight-part instructional sequence is the schema, not a
 * convention: Problem → Check-In → Learn → Interactive Activity → Reflection
 * → Insight → Action → Toolkit. Every field below is required so a lesson
 * cannot ship with a missing step.
 */
export interface LibraryItem {
  id: string;
  categoryId: string;
  title: string;
  minutes: number;
  order: number;
  /** 1 — the lived problem, in the patient's own words. */
  problem: string;
  /** 3 — teaching block. */
  learnTitle: string;
  learnBody: string;
  /** 4 — the interactive activity (the doing part). */
  activity: LibraryActivity;
  /** 5 — Adel's reflection prompt + the question the patient answers. */
  adelReflection: string;
  adelQuestion: string;
  /** 6 — the one thing to remember. */
  insight: string;
  /** 7 — the concrete next action. */
  action: string;
  /** 8 — what gets saved into the patient's toolkit on completion. */
  toolkitLabel: string;
  /**
   * Phase 2 population gate. ABSENT means population-neutral (the default,
   * and the case for most of this library). Present means the copy directly
   * references custody or release and must not be shown to someone it does
   * not describe.
   */
  populations?: PopulationTrack[];
  /**
   * TRUE when the lesson's own TITLE is 42 CFR Part 2 content (SUD treatment).
   * Advocate progress reads withhold the title of such an item unless the
   * Part 2 gate is lifted — same rule the group-topic read already uses.
   */
  part2Sensitive?: boolean;
  /** Flag placeholder text so it is never mistaken for cleared content. */
  placeholder?: boolean;
}

/**
 * Step 4 — a small, typed interaction, not free text.
 *
 * The variants below are the ones the real Starting Strong content actually
 * uses. Every variant stays a closed, discriminated member so the renderer
 * fails to compile if one is left unhandled.
 */
export type LibraryActivity =
  | { kind: "checklist"; prompt: string; items: string[] }
  | { kind: "sort"; prompt: string; buckets: string[]; cards: string[] }
  | { kind: "write"; prompt: string; lines: number; placeholder?: string }
  | { kind: "rate"; prompt: string; min: number; max: number; minLabel: string; maxLabel: string }
  /** Tap-to-select cards; nothing is right or wrong. */
  | { kind: "reflection"; title: string; prompt: string; cards: string[] }
  /** Order a handful of anchors into the shape of a day. */
  | { kind: "timeline"; title: string; prompt: string; steps: string[] }
  /** A paced-breath activity inside a lesson (the exercise type is separate). */
  | {
      kind: "breathing";
      title: string;
      prompt: string;
      inhaleSec: number;
      holdSec: number;
      exhaleSec: number;
      rounds: number;
    }
  /** Several labelled sliders scored together. */
  | {
      kind: "sliders";
      title: string;
      prompt: string;
      sliders: { id: string; label: string; minLabel: string; maxLabel: string }[];
    }
  /** 5-4-3-2-1 style sensory grounding. */
  | { kind: "grounding"; title: string; prompt: string; senses: { label: string; count: number }[] }
  /** Pick a response and get feedback on it. */
  | {
      kind: "decision";
      title: string;
      prompt: string;
      choices: { label: string; feedback: string; good?: boolean }[];
    };

// ---------------------------------------------------------------------------
// Exercises — standalone tools, reachable without a lesson
// ---------------------------------------------------------------------------

export type ExerciseType =
  | "timer"
  | "breathing"
  | "checklist"
  | "worksheet"
  | "mapper"
  | "calculator"
  | "scale";

export type ExerciseContent =
  | { type: "timer"; seconds: number; prompts: string[]; closing?: string }
  | {
      type: "breathing";
      inhaleSec: number;
      holdSec: number;
      exhaleSec: number;
      holdAfterSec: number;
      cycles: number;
    }
  | { type: "checklist"; intro: string; items: string[]; closing?: string }
  | {
      type: "worksheet";
      intro: string;
      fields: {
        id: string;
        label: string;
        placeholder?: string;
        multiline?: boolean;
        /** Tappable suggested answers; the field stays free-text. */
        options?: string[];
      }[];
    }
  | {
      type: "mapper";
      intro: string;
      columns: { id: string; label: string; hint: string; suggestions?: string[] }[];
    }
  | {
      type: "calculator";
      intro: string;
      rows: { id: string; label: string }[];
      totalLabel: string;
      againstLabel: string;
      /** When present, income is itemised instead of a single figure. */
      incomeRows?: { id: string; label: string }[];
      closing?: string;
    }
  | {
      type: "scale";
      intro: string;
      min: number;
      max: number;
      minLabel: string;
      maxLabel: string;
      bands: { upTo: number; label: string; guidance?: string; moves?: string[] }[];
    };

export interface Exercise {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  type: ExerciseType;
  tags: string[];
  /** Why a clinician would hand this to someone. */
  purpose: string;
  content: ExerciseContent;
  populations?: PopulationTrack[];
  part2Sensitive?: boolean;
  placeholder?: boolean;
}

// ---------------------------------------------------------------------------
// Progress — the shapes the patient record stores. Declared here so the store
// and the UI share one definition.
// ---------------------------------------------------------------------------

/** Where a saved toolkit entry came from. */
export type ToolkitOrigin = "library" | "exercise";

export interface SavedToolkitItem {
  /** The source lesson/exercise id — one saved entry per source, idempotent. */
  id: string;
  label: string;
  from: ToolkitOrigin;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SEED CONTENT — "Starting Strong"
//
// REAL, cleared content, transcribed verbatim from the source. No item below
// carries `placeholder: true` any more; the flag stays on the type only so a
// future draft can still be marked. Ids are UNCHANGED from the placeholder
// build, so population gating, engagement progress rows and existing tests
// keep resolving.
// ---------------------------------------------------------------------------

const STARTING_STRONG_CATEGORY: LibraryCategory[] = [
  {
    id: "starting-strong",
    name: "Starting Strong",
    desc: "The first steps: steadying the day, the body, and the mind.",
    icon: "Sunrise",
    clinicalTarget:
      "Behavioral activation, arousal regulation, sleep hygiene and early stability planning.",
    order: 1,
  },
];

/** Every lesson in the Starting Strong sequence, in order. */
const STARTING_STRONG_ITEMS: LibraryItem[] = [
  {
    id: "ss-finding-my-footing",
    categoryId: "starting-strong",
    title: "Finding My Footing",
    minutes: 4,
    order: 1,
    problem: "Everything is new and you're not sure where to even start.",
    learnTitle: "Steady comes before strong",
    learnBody:
      "The first stretch of any fresh start is mostly noise — paperwork, people, places, feelings. Your brain can't build new habits while it's scanning for danger. So the first job isn't fixing your whole life. It's finding one or two things that stay the same every day. That's what footing means: something under you that doesn't move.",
    activity: {
      kind: "reflection",
      title: "What's already steady?",
      prompt: "Tap anything true right now, even a little.",
      cards: [
        "I have somewhere to sleep tonight",
        "I know where my next meal comes from",
        "One person knows how I'm doing",
        "I have my ID or I'm working on it",
        "I know one appointment I have coming",
        "I woke up today",
      ],
    },
    adelReflection:
      "Those are your footholds. You don't need many — you need a few you can count on.",
    adelQuestion: "Which one of those would you most want to protect this week?",
    insight: "You don't build a life from nothing. You build it from what's already holding.",
    action: "Name one thing that stays the same every day this week and do it on purpose.",
    toolkitLabel: "My footholds",
    // Kept from the placeholder build: this lesson stays gated to the
    // justice-involved tracks. Content swap only — the gate is unchanged.
    populations: ["pre_release_ji", "post_release_ji"],
  },
  {
    id: "ss-daily-rhythm",
    categoryId: "starting-strong",
    title: "Creating My Daily Rhythm",
    minutes: 5,
    order: 2,
    problem: "Your days feel shapeless — you drift, then the day is gone.",
    learnTitle: "Structure is a nervous system tool",
    learnBody:
      "A day with no shape leaves too much room for cravings, worry, and old patterns. Rhythm isn't a strict schedule. It's three or four anchors — wake time, a meal, a walk, a bedtime — that the rest of the day hangs off of. Your body settles when it can predict what's next.",
    activity: {
      kind: "timeline",
      title: "Build your day",
      prompt: "Put anchors in order.",
      steps: [
        "Wake up at the same time",
        "Eat something in the morning",
        "One thing that matters (appointment, work, meeting)",
        "Move your body or get outside",
        "Wind down — screens off",
        "Same bedtime",
      ],
    },
    adelReflection:
      "That's a rhythm, not a rulebook. If you hit three out of six, the day still worked.",
    adelQuestion: "Which anchor would be easiest to hit tomorrow?",
    insight: "A day with shape is harder for the old life to get into.",
    action: "Pick one anchor and do it at the same time tomorrow.",
    toolkitLabel: "My daily rhythm",
  },
  {
    id: "ss-calming-my-mind",
    categoryId: "starting-strong",
    title: "Calming My Mind",
    minutes: 4,
    order: 3,
    problem: "Thoughts are racing and you can't get them to stop.",
    learnTitle: "Why your brain does this",
    learnBody:
      "When you've been through hard things, your brain learns to scan for danger. That scanning shows up as racing thoughts. It's not a broken mind — it's a protective mind that hasn't been told it's safe yet. The fastest way to slow it down isn't thinking harder. It's dropping into your body.",
    activity: {
      kind: "breathing",
      title: "Paced breathing",
      prompt: "Follow the circle. In for 4, hold for 4, out for 6. Six rounds is enough.",
      inhaleSec: 4,
      holdSec: 4,
      exhaleSec: 6,
      rounds: 6,
    },
    adelReflection:
      "Nice work slowing down for a minute. That's not nothing — that's your nervous system learning it can come back down.",
    adelQuestion: "What was one thought that kept coming up while you breathed?",
    insight: "You can't out-think a racing mind. You have to out-breathe it.",
    action: "Set one alarm for tonight and do 6 slow breaths before bed.",
    toolkitLabel: "Paced breathing — 4/4/6",
  },
  {
    id: "ss-managing-overwhelm",
    categoryId: "starting-strong",
    title: "Managing Overwhelm",
    minutes: 5,
    order: 4,
    problem: "Everything piled up and you don't know where to start.",
    learnTitle: "Overwhelm is a signal, not a verdict",
    learnBody:
      "Overwhelm happens when your brain is trying to solve every problem at the same time. It can't. The fix isn't doing more — it's shrinking the frame down to the very next thing.",
    activity: {
      kind: "sort",
      prompt: "Drop each item into the pile it belongs in. Only 'Now' items get your energy today.",
      buckets: ["Now", "Later"],
      cards: [
        "The bill that's due today",
        "The call I've been dreading",
        "That thing from 3 years ago",
        "Groceries for tonight",
        "Fixing my whole life",
      ],
    },
    adelReflection:
      "That took honesty. Most of what feels urgent isn't actually today's problem.",
    adelQuestion:
      "Of your 'Now' pile, which one do you want to do first — the easiest, or the one that would give you the most relief?",
    insight: "You don't have to do everything. You have to do the next thing.",
    action: "Do one item from your 'Now' pile in the next hour.",
    toolkitLabel: "Now vs Later sort",
  },
  {
    id: "ss-managing-worry",
    categoryId: "starting-strong",
    title: "Managing Worry",
    minutes: 5,
    order: 5,
    problem: "Your mind keeps running 'what if' and it never lands anywhere good.",
    learnTitle: "Worry pretends to be planning",
    learnBody:
      "Worry feels productive — like if you think about it long enough you'll be ready. But real planning ends with a step you can take. Worry just loops. Sorting what you can control from what you can't is how you get your energy back.",
    activity: {
      kind: "sliders",
      title: "Score this worry",
      prompt: "Think of the worry that's loudest today, then move the sliders.",
      sliders: [
        {
          id: "control",
          label: "How much of this can I actually control?",
          minLabel: "None",
          maxLabel: "All",
        },
        {
          id: "today",
          label: "Can I do anything about it today?",
          minLabel: "No",
          maxLabel: "Yes",
        },
        {
          id: "likely",
          label: "How likely is the worst version?",
          minLabel: "Unlikely",
          maxLabel: "Very likely",
        },
      ],
    },
    adelReflection:
      "If it's low control and nothing today, that worry doesn't need more of you right now.",
    adelQuestion: "What would you do with the energy you've been spending on that worry?",
    insight: "If there's no step, it isn't planning — it's worry wearing a costume.",
    action: "Set a 10-minute 'worry window' today. Outside it, write worries down and move on.",
    toolkitLabel: "Control vs no-control sort",
  },
  {
    id: "ss-grounding-myself",
    categoryId: "starting-strong",
    title: "Grounding Myself",
    minutes: 4,
    order: 6,
    problem: "Heart pounding, muscles tight, can't sit still.",
    learnTitle: "Your body is doing its job",
    learnBody:
      "High alert isn't weakness — it's your body trying to protect you from a threat it learned to expect. The way out isn't to fight it. It's to send safety signals your body actually believes: cold, slow breath, weight on your feet.",
    activity: {
      kind: "grounding",
      title: "5-4-3-2-1",
      prompt: "Name what you see, touch, hear, smell, and taste. Say them out loud if you can.",
      senses: [
        { label: "See", count: 5 },
        { label: "Touch", count: 4 },
        { label: "Hear", count: 3 },
        { label: "Smell", count: 2 },
        { label: "Taste", count: 1 },
      ],
    },
    adelReflection: "You just told your body 'we are here, we are safe, we are okay.' That's real.",
    adelQuestion: "What was the one thing that felt most solid to you just now?",
    insight: "Your body listens to your senses faster than it listens to your thoughts.",
    action: "The next time you feel that surge, name 5 things you can see before you do anything else.",
    toolkitLabel: "5-4-3-2-1 grounding",
  },
  {
    id: "ss-managing-big-feelings",
    categoryId: "starting-strong",
    title: "Managing Big Feelings",
    minutes: 5,
    order: 7,
    problem: "A feeling hits so hard it takes over the whole day.",
    learnTitle: "Feelings peak, then fall",
    learnBody:
      "Big feelings have a shape — they rise, top out, and come down, usually inside 20 minutes if you don't feed them. What stretches them out is arguing with them or acting on them. Naming a feeling out loud actually lowers the volume in your brain.",
    activity: {
      kind: "decision",
      title: "The feeling is at a 9. You...",
      prompt: "Pick what you'd actually do.",
      choices: [
        {
          label: "Push it down and keep going",
          feedback: "That works for an hour and then it comes out sideways. Try naming it first.",
        },
        {
          label: "Name it out loud: 'this is anger, it's at a 9'",
          feedback: "Yes. Naming it turns the volume down and gives you a second to choose.",
          good: true,
        },
        {
          label: "Do something to make it stop right now",
          feedback: "That's the urge. Slow it by 5 minutes and see where the wave goes.",
        },
      ],
    },
    adelReflection:
      "You don't have to like the feeling. You just have to let it move through without running your day.",
    adelQuestion: "What feeling shows up most for you lately?",
    insight: "Name it to tame it. A feeling you can name is a feeling you can outlast.",
    action: "Next time a feeling spikes, say its name and a number 1-10 out loud.",
    toolkitLabel: "Name it and rate it",
  },
  {
    id: "ss-creating-safety",
    categoryId: "starting-strong",
    title: "Creating Safety in My Life",
    minutes: 5,
    order: 8,
    problem: "Some places, people, or moments still don't feel safe.",
    learnTitle: "Safety is built, not felt",
    learnBody:
      "Your mind knows you're safe. Your body doesn't yet. Safety gets built two ways: outside (who you're around, where you go, what time you're out) and inside (a place your body can return to). Both count, and both are choices you can make on purpose.",
    activity: {
      kind: "reflection",
      title: "Pick the ones that feel safe to you",
      prompt: "Tap anything that feels safe to you.",
      cards: [
        "A quiet room with a door that locks",
        "Outside near trees",
        "Somewhere with a person I trust",
        "A car with the doors locked",
        "A place from childhood that felt okay",
        "A place I've only imagined",
      ],
    },
    adelReflection: "You just built a safe-place map. Your body can go there anytime.",
    adelQuestion: "What's one place or person you'd want less of this week?",
    insight: "Safety is a picture your body can return to — and a list of places you don't go.",
    action: "Close your eyes tonight and spend 60 seconds in your safe place.",
    toolkitLabel: "My safe place",
  },
  {
    id: "ss-restoring-sleep",
    categoryId: "starting-strong",
    title: "Restoring Healthy Sleep",
    minutes: 5,
    order: 9,
    problem: "You can't fall asleep, or you wake up over and over.",
    learnTitle: "Sleep comes back slowly",
    learnBody:
      "After stress, incarceration, or substance use, sleep is usually the last thing to come back. That's normal, and it isn't permanent. Your body relearns sleep through repetition: same wake time, light in the morning, no bed-scrolling, and getting out of bed if you've been awake more than 20 minutes.",
    activity: {
      kind: "sort",
      prompt: "Helps sleep or hurts sleep?",
      buckets: ["Helps", "Hurts"],
      cards: [
        "Same wake time every day",
        "Scrolling in bed",
        "Caffeine after 2pm",
        "Sunlight in the morning",
        "Napping late afternoon",
        "Getting up when you can't sleep",
      ],
    },
    adelReflection: "Sleep isn't willpower. It's a set of signals — and you can change the signals.",
    adelQuestion: "Which one of the 'hurts' list is most part of your night right now?",
    insight: "You can't force sleep. You can only set the table for it.",
    action: "Pick one wake time and keep it tomorrow, even if last night was rough.",
    toolkitLabel: "My sleep signals",
  },
  {
    id: "ss-stability-plan",
    categoryId: "starting-strong",
    title: "Building My Stability Plan",
    minutes: 6,
    order: 10,
    problem: "Good days happen, but you don't know how to make them repeat.",
    learnTitle: "Stability is a written thing",
    learnBody:
      "The difference between a good week and a good month is usually a plan you can see. A stability plan names what keeps you steady, what tips you over, and who you call. When things get loud, you don't have to think — you read.",
    activity: {
      kind: "reflection",
      title: "What belongs in your plan?",
      prompt: "Tap what belongs in your plan.",
      cards: [
        "My daily anchors",
        "My warning signs",
        "Two people I can call",
        "My grounding tool",
        "My appointments",
        "What I do on a bad day",
        "What I do NOT do on a bad day",
      ],
    },
    adelReflection:
      "That's your plan. Not a perfect life — a page you can read when your head is loud.",
    adelQuestion: "Who should have a copy of it besides you?",
    insight: "A plan you wrote yourself is one you'll actually use.",
    action: "Write your three daily anchors and two support numbers somewhere you'll see them.",
    toolkitLabel: "My stability plan",
  },
];

/** Starting Strong (transcribed here) plus the eight ported Journey
 *  collections. The ported set lives in its own generated module so this
 *  file stays reviewable. */
export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  ...STARTING_STRONG_CATEGORY,
  ...PORTED_LIBRARY_CATEGORIES,
];

export const LIBRARY_ITEMS: LibraryItem[] = [
  ...STARTING_STRONG_ITEMS,
  ...PORTED_LIBRARY_ITEMS,
];

export const EXERCISES: Exercise[] = [
  {
    id: "urge-surfing-timer",
    title: "Urge Surfing Timer",
    subtitle: "Ride the wave without acting on it",
    minutes: 3,
    type: "timer",
    tags: ["craving", "relapse-prevention", "triggers"],
    purpose: "Cravings rise, peak, and pass. This timer keeps you company while it passes.",
    content: {
      type: "timer",
      seconds: 180,
      prompts: [
        "Notice where you feel it in your body. Don't fight it — just find it.",
        "Give it a number, 1 to 10. Watch whether it moves.",
        "Breathe out longer than you breathe in.",
        "The wave is cresting. You don't have to do anything about it.",
        "Still here. Still not using. That's the whole skill.",
        "Feel it start to drop. This is what passing looks like.",
      ],
      closing: "You rode it out. Cravings don't last — you just proved it to yourself.",
    },
  },
  {
    id: "box-breathing",
    title: "Box Breathing",
    subtitle: "Four counts in, four hold, four out",
    minutes: 2,
    type: "breathing",
    tags: ["anxiety", "anger", "craving"],
    purpose: "Slows your body down when your head is moving too fast.",
    content: { type: "breathing", inhaleSec: 4, holdSec: 4, exhaleSec: 4, holdAfterSec: 4, cycles: 8 },
  },
  {
    id: "trigger-map",
    title: "Trigger Map",
    subtitle: "People, places, feelings, times",
    minutes: 5,
    type: "mapper",
    tags: ["triggers", "craving", "relapse-prevention"],
    purpose: "You can't dodge what you haven't named. Map yours so you see them coming.",
    content: {
      type: "mapper",
      intro: "Add what belongs in each zone. Tap a suggestion or type your own.",
      columns: [
        {
          id: "people",
          label: "People",
          hint: "Who makes it harder?",
          suggestions: [
            "Old running partner",
            "Family member",
            "Someone I owe",
            "A dealer's number still in my phone",
          ],
        },
        {
          id: "places",
          label: "Places",
          hint: "Where does it get loud?",
          suggestions: ["Old neighborhood", "Certain corner store", "Parties", "Alone in my room"],
        },
        {
          id: "feelings",
          label: "Feelings",
          hint: "What sets it off inside?",
          suggestions: ["Boredom", "Anger", "Shame", "Loneliness", "Being disrespected"],
        },
        {
          id: "times",
          label: "Times",
          hint: "When is it worst?",
          suggestions: ["Late night", "Payday", "Weekends", "After a hard call"],
        },
      ],
    },
  },
  {
    id: "thought-record",
    title: "Thought Record",
    subtitle: "Catch it, check it, change it",
    minutes: 6,
    type: "worksheet",
    tags: ["cbt", "anxiety"],
    purpose: "Thoughts feel like facts. Writing them down is how you tell the difference.",
    content: {
      type: "worksheet",
      intro: "Take one thought that's been running you today.",
      fields: [
        {
          id: "situation",
          label: "What happened?",
          placeholder: "Just the facts — what a camera would see.",
        },
        { id: "thought", label: "What did I think?", placeholder: "The exact sentence in your head." },
        {
          id: "feeling",
          label: "What did I feel?",
          options: ["Angry", "Ashamed", "Scared", "Hopeless", "Numb", "Anxious"],
        },
        {
          id: "counter",
          label: "What says it's not the whole story?",
          multiline: true,
          placeholder: "One fact that doesn't fit.",
        },
        {
          id: "fairer",
          label: "A fairer way to say it",
          multiline: true,
          placeholder: "Not fake-positive. Just fair.",
        },
      ],
    },
  },
  {
    id: "anger-thermometer",
    title: "Anger Thermometer + De-escalation Plan",
    subtitle: "Know your number, know your move",
    minutes: 4,
    type: "scale",
    tags: ["anger", "communication"],
    purpose: "Anger is easier to steer early. This sets a move for each level.",
    content: {
      type: "scale",
      intro: "Where's your anger right now?",
      min: 0,
      max: 10,
      minLabel: "Calm",
      maxLabel: "About to blow",
      bands: [
        {
          upTo: 3,
          label: "Cool",
          moves: [
            "Name what bothered me",
            "Say it plain before it builds",
            "Keep doing what I'm doing",
          ],
        },
        {
          upTo: 6,
          label: "Heating up",
          moves: [
            "Step outside for two minutes",
            "Slow my breathing out",
            "Text someone on my list",
            "Drink water, eat something",
          ],
        },
        {
          upTo: 8,
          label: "Hot",
          moves: [
            "Leave the room — no explanation needed",
            "Walk until my hands unclench",
            "Call my peer specialist",
            "No decisions until I'm under 5",
          ],
        },
        {
          upTo: 10,
          label: "Boiling",
          moves: [
            "Get physically away from the person",
            "No phone, no texts, no driving",
            "Call someone who can talk me down",
            "Come back to it tomorrow",
          ],
        },
      ],
    },
  },
  {
    id: "support-circle",
    title: "Support Circle Mapper",
    subtitle: "Who's actually in your corner",
    minutes: 5,
    type: "mapper",
    tags: ["support", "communication"],
    purpose: "Most people have more support than they can name under pressure. Name it now.",
    content: {
      type: "mapper",
      intro: "Put real names or roles in each ring.",
      columns: [
        {
          id: "any-hour",
          label: "Call any hour",
          hint: "The 2am people.",
          suggestions: ["Sponsor", "Peer specialist", "Mom", "Best friend"],
        },
        {
          id: "steady",
          label: "Steady support",
          hint: "Reliable, not urgent.",
          suggestions: ["Case manager", "Therapist", "Sibling", "Coworker"],
        },
        {
          id: "professional",
          label: "Professional",
          hint: "Paid to help — use them.",
          suggestions: ["Doctor", "Counselor", "Parole officer", "Housing navigator"],
        },
        {
          id: "group",
          label: "Group support",
          hint: "Rooms where you're not alone.",
          suggestions: ["AA/NA meeting", "Church", "Peer group", "Gym"],
        },
      ],
    },
  },
  {
    id: "budget-basics",
    title: "Budget Basics Calculator",
    subtitle: "What's coming in, what's going out",
    minutes: 6,
    type: "calculator",
    tags: ["money", "goal-setting"],
    purpose: "Money stress is a relapse risk. Seeing the real number lowers the noise.",
    content: {
      type: "calculator",
      intro: "Rough monthly numbers are fine. Guessing beats avoiding.",
      incomeRows: [
        { id: "job", label: "Job/wages" },
        { id: "benefits", label: "Benefits (CalFresh, SSI, GA)" },
        { id: "family", label: "Family help" },
        { id: "other-income", label: "Other" },
      ],
      rows: [
        { id: "rent", label: "Rent/sober living" },
        { id: "food", label: "Food" },
        { id: "phone", label: "Phone" },
        { id: "transport", label: "Transportation" },
        { id: "court", label: "Court fees/restitution" },
        { id: "other-expense", label: "Other" },
      ],
      totalLabel: "Money going out",
      againstLabel: "Money coming in",
      closing:
        "If the number is negative, that's information — not failure. Bring it to your case manager.",
    },
  },
  {
    id: "communication-script",
    title: "Communication Script Builder",
    subtitle: "Say the hard thing, calmly",
    minutes: 5,
    type: "worksheet",
    tags: ["communication", "support", "anger"],
    purpose: "Hard conversations go better with a script you wrote when you were calm.",
    content: {
      type: "worksheet",
      intro: "Build one sentence you can actually say out loud.",
      fields: [
        { id: "who", label: "Who is this for?", placeholder: "Name or role" },
        {
          id: "when",
          label: "When I…",
          multiline: true,
          placeholder: "The situation — no blame words.",
        },
        {
          id: "feel",
          label: "I feel…",
          options: ["Frustrated", "Hurt", "Worried", "Disrespected", "Overwhelmed"],
        },
        {
          id: "need",
          label: "What I need is…",
          multiline: true,
          placeholder: "One clear, doable ask.",
        },
        {
          id: "sideways",
          label: "If it goes sideways, I'll…",
          options: [
            "Take a walk",
            "End the call politely",
            "Come back to it tomorrow",
            "Text my sponsor",
          ],
        },
      ],
    },
  },
  {
    id: "if-i-slip-plan",
    title: '"If I Slip" Plan',
    subtitle: "Decided ahead of time, not in the moment",
    minutes: 5,
    type: "worksheet",
    tags: ["relapse-prevention", "craving"],
    purpose: "A slip is not the end. What happens in the next hour is what matters.",
    content: {
      type: "worksheet",
      intro: "Write this while you're steady, so it's ready if you're not.",
      fields: [
        { id: "first-tell", label: "First person I tell", placeholder: "Name and number" },
        {
          id: "first-hour",
          label: "What I do in the first hour",
          options: [
            "Stop and get somewhere safe",
            "Call my sponsor",
            "Go to a meeting",
            "Tell my peer specialist",
            "Eat and sleep",
          ],
        },
        {
          id: "will-not",
          label: "What I will NOT do",
          options: [
            "Disappear on everyone",
            "Say it's over",
            "Keep using to fix the shame",
            "Skip my next appointment",
          ],
        },
        {
          id: "self-talk",
          label: "What I'll tell myself",
          multiline: true,
          placeholder: "Your own words.",
        },
      ],
    },
  },
  {
    id: "warning-signs",
    title: "Relapse Warning Signs Checklist",
    subtitle: "The stuff that shows up before the using does",
    minutes: 4,
    type: "checklist",
    tags: ["relapse-prevention", "triggers"],
    purpose: "Relapse starts long before the substance. These are your early flags.",
    content: {
      type: "checklist",
      intro: "Check anything that's true in the last week.",
      items: [
        "Skipping meetings",
        "Isolating from people who care",
        "Not sleeping",
        "Skipping meals",
        "Stopped taking my meds",
        "Keeping secrets",
        "Hanging around old people or places",
        "Romanticizing using",
        "Anger on a short fuse",
        "Letting appointments slide",
        "Telling people I'm fine when I'm not",
        "Money disappearing",
      ],
      closing: "Three or more is a signal to reach out today — not a verdict on you.",
    },
  },
  {
    id: "milestone-reward",
    title: "Milestone Reward Planner",
    subtitle: "Something to walk toward",
    minutes: 4,
    type: "worksheet",
    tags: ["goal-setting", "support"],
    purpose: "Recovery needs something to move toward, not just something to avoid.",
    content: {
      type: "worksheet",
      intro: "Pick one milestone that's close enough to feel real.",
      fields: [
        {
          id: "milestone",
          label: "My next milestone",
          options: ["7 days", "30 days", "90 days", "First paycheck", "Own place"],
        },
        { id: "when", label: "Roughly when", placeholder: "A date or a week" },
        {
          id: "mark-it",
          label: "How I'll mark it",
          options: [
            "Good meal",
            "New shoes",
            "Day at the lake",
            "Call my kids",
            "Share at a meeting",
          ],
        },
        { id: "tell", label: "Who I'll tell", placeholder: "Name" },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Pure selectors
// ---------------------------------------------------------------------------

export function getLibraryCategory(id: string): LibraryCategory | undefined {
  return LIBRARY_CATEGORIES.find((c) => c.id === id);
}

export function getLibraryItem(id: string): LibraryItem | undefined {
  return LIBRARY_ITEMS.find((i) => i.id === id);
}

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function itemsInCategory(categoryId: string): LibraryItem[] {
  return LIBRARY_ITEMS.filter((i) => i.categoryId === categoryId).sort((a, b) => a.order - b.order);
}

/**
 * The Phase 2 gate, applied to content. An item with no `populations` is
 * ALWAYS visible — population-neutral is the default and the common case.
 * Otherwise the resolution must be an allowed, CONFIRMED track: an unconfirmed
 * "not sure" answer never surfaces reentry-specific copy.
 */
export function isLibraryItemVisible(
  item: { populations?: PopulationTrack[] },
  resolution: PopulationResolution,
): boolean {
  if (!item.populations || item.populations.length === 0) return true;
  // Identical to `isPopulationAllowed(resolution, item.populations)` with the
  // default `requireConfirmed: true`.
  return item.populations.includes(resolution.track) && !resolution.provisional;
}

export function visibleItemsInCategory(
  categoryId: string,
  resolution: PopulationResolution,
): LibraryItem[] {
  return itemsInCategory(categoryId).filter((i) => isLibraryItemVisible(i, resolution));
}

export function visibleExercises(resolution: PopulationResolution): Exercise[] {
  return EXERCISES.filter((e) => isLibraryItemVisible(e, resolution));
}

/** Completion math for one category, against the patient's visible set. */
export function categoryProgress(
  categoryId: string,
  completedItemIds: readonly string[],
  resolution: PopulationResolution,
): { total: number; completed: number; pct: number } {
  const items = visibleItemsInCategory(categoryId, resolution);
  const completed = items.filter((i) => completedItemIds.includes(i.id)).length;
  return {
    total: items.length,
    completed,
    pct: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
  };
}
