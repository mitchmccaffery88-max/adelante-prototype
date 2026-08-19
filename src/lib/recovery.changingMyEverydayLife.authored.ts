// §Content-authoring pass Batch 4 — MODULE 4 "Changing My Everyday Life",
// AUTHORED.
//
// WHAT THE GATE FOUND, precisely. Running the Batch 1 quality gate
// (`originalityErrors`, reached through `RECOVERY_LESSON_TYPE.validate`) over
// the ten live lessons of `changing-my-everyday-life` flagged, for real:
//   • 10 of 10 `adelQuestion`  — "What part of this feels hardest for you?"
//   • 10 of 10 `adelReflection` — "Adel can help you go deeper on <title> …"
//   • 10 of 10 `checkIn` — "Right now, how much is <problem> a struggle for
//     you?" — three flags on every single lesson, no clean exceptions, the
//     same shape Batch 3 found in Module 3.
//
// WHAT THE TOOL-FLOW MEASUREMENT FOUND (arrays; the gate only reads free text):
//   • `warningSigns`  — 1 distinct set across 10 lessons.
//   • `supportPeople` — 1 distinct set across 10 lessons.
//   • `todayActions`  — nominally 10 distinct sets, but distinct ONLY IN THE
//     FIRST ENTRY: entries 2–5 ("Attend a meeting / Call someone who supports
//     me / Practice my recovery skill / Complete one important task") were
//     byte-identical in all ten, so the tail collapses to 1 distinct set.
//     Exactly the pattern Batches 2 and 3 found, so it is re-authored here
//     rather than counted as clean.
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight` and the
// decision activity pass the gate and are carried through verbatim by clone.
//
// VOICE, continuous with Modules 1–3: second person, present tense, concrete
// nouns, no clinical register, and no 1–10 scale questions. The reflection
// names something true and slightly hard before it offers credit; the question
// anchors to one real moment rather than to feelings in general. This module
// is about the shape of a day, so questions point at actual hours, meals,
// beds and rooms rather than at intentions.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const CHANGING_MY_EVERYDAY_LIFE_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Module 4 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, plus distinct warning signs, support people and today-actions for each lesson's own skill.",
};

export interface AuthoredLessonFields {
  lessonId: string;
  checkIn: string;
  adelQuestion: string;
  adelReflection: string;
  toolFlow: RecoveryToolFlow;
}

export const CHANGING_MY_EVERYDAY_LIFE_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "changing-my-everyday-life-how-do-i-build-a-better-daily-routine",
    checkIn: "What time did you get up today, and was that close to yesterday?",
    adelQuestion: "Which hour of yesterday had nothing holding it in place?",
    adelReflection:
      "An empty day asks you to decide everything from scratch, and deciding is the part that wears you out. Three fixed points is not a small plan — it is most of the work.",
    toolFlow: {
      warningSigns: [
        "Waking up at a different time every day",
        "Deciding what to do only once I'm already bored",
        "Planning a perfect schedule I never start",
        "Losing the whole afternoon without noticing",
        "Sleeping through the one thing I committed to",
      ],
      supportPeople: [
        "Someone who's up at the same hour I am",
        "My peer specialist",
        "Whoever I share a kitchen or a house with",
        "My case manager, about appointment times",
        "The Adelante care team",
      ],
      todayActions: [
        "Set one alarm for the same time tomorrow",
        "Pick a fixed hour for one meal",
        "Write the three anchors on paper",
        "Do tonight's anchor even if the day fell apart",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-why-is-sleep-so-important",
    checkIn: "What time did you actually fall asleep last night, and what was in your hand?",
    adelQuestion: "What usually happens in the hour before you get into bed?",
    adelReflection:
      "A bad night makes the next day's cravings louder, which is unfair — you are fighting with less than you had. Getting into bed at a boring, repeated hour does more for tomorrow than most of what you'll do tomorrow.",
    toolFlow: {
      warningSigns: [
        "Going to bed at a different time every night",
        "Scrolling in bed until my eyes hurt",
        "Staying up because the quiet feels worse",
        "Pulling an all-nighter and calling it fine",
        "Napping so long the night is gone",
      ],
      supportPeople: [
        "Whoever's awake late that I can text",
        "My prescriber, about sleep and my meds",
        "Someone in the house who'll keep the lights down",
        "My counselor, about what keeps me up",
        "The Adelante care team",
      ],
      todayActions: [
        "Get into bed at the same time as last night",
        "Put the phone across the room before lying down",
        "Make the room as dark as it will go",
        "Keep any nap under an hour today",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-how-can-food-help-my-recovery",
    checkIn: "How many hours has it been since you last ate something real?",
    adelQuestion: "When was the last time you mistook being hungry for wanting to use?",
    adelReflection:
      "Empty and shaky feels almost exactly like a craving, and your body will not tell you which one it is. Eating on a clock takes one whole false alarm off your day.",
    toolFlow: {
      warningSigns: [
        "Going most of the day on coffee",
        "Only eating once the shaking starts",
        "Nothing in the place I could actually eat",
        "Skipping meals to save money, then spending worse",
        "Sugar and nothing else all afternoon",
      ],
      supportPeople: [
        "Someone who'll eat a meal with me",
        "My case manager, about food benefits",
        "Whoever cooks where I'm staying",
        "A food pantry or meal program I can reach",
        "The Adelante care team",
      ],
      todayActions: [
        "Eat something with protein in it today",
        "Drink a full glass of water first",
        "Put one thing in the fridge for tomorrow morning",
        "Eat before the four-hour mark, not after",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-how-can-exercise-help-me-feel-better",
    checkIn: "How far did you walk today — around the block, or not out the door?",
    adelQuestion: "What's the ten-minute version of moving that you'd actually do tomorrow?",
    adelReflection:
      "Nobody has to become a gym person for this to work. Ten minutes of walking changes your mood chemistry, and the version you'll repeat beats the version that sounds impressive.",
    toolFlow: {
      warningSigns: [
        "Not going outside for a whole day",
        "Waiting until I feel motivated to move",
        "Planning an hour and doing nothing",
        "Sitting in the same chair from morning to night",
        "Telling myself a walk doesn't count",
      ],
      supportPeople: [
        "Someone who'll walk with me",
        "A neighbor going the same direction",
        "My peer specialist",
        "Whoever's got a dog that needs walking",
        "The Adelante care team",
      ],
      todayActions: [
        "Walk ten minutes and turn around",
        "Take the stairs once today",
        "Move before I check my phone in the morning",
        "Ask one person to come with me",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-what-can-i-do-instead-of-using",
    checkIn: "Which stretch of today had nothing in it? Tap what's closest.",
    adelQuestion: "What did you do with the last empty evening you had?",
    adelReflection:
      "Boredom is not a small problem in early recovery — it is where old habits walk back in through an unlocked door. A list you wrote while calm is worth more than anything you'll think of while bored.",
    toolFlow: {
      warningSigns: [
        "Whole evenings with nothing in them",
        "Reaching for my phone the second I'm bored",
        "Saying yes to whoever calls, whoever they are",
        "Nothing on my list I can start in one minute",
        "Only making plans I need money for",
      ],
      supportPeople: [
        "Someone I can turn up at without a reason",
        "A meeting that runs at my worst hour",
        "My peer specialist",
        "A friend who'd rather do something than talk",
        "The Adelante care team",
      ],
      todayActions: [
        "Write ten things I can start in one minute",
        "Do one thing off that list tonight",
        "Put the list where I'll see it at 8pm",
        "Fill the hour I know is empty tomorrow",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-how-do-i-calm-my-emotions",
    checkIn: "The last time a feeling got big today, what did you do with your hands?",
    adelQuestion: "What settles you fastest — cold, breath, or moving?",
    adelReflection:
      "Pushing a feeling down keeps it in the room longer, and you already know how that ends. Letting it move through while you keep your hands busy is not weakness — it's the shortest way out.",
    toolFlow: {
      warningSigns: [
        "Going quiet and hoping it passes",
        "Snapping at whoever's nearest",
        "Feeling it in my chest and ignoring it",
        "Making a decision while I'm still hot",
        "Leaving before I've said what happened",
      ],
      supportPeople: [
        "Someone I can call while I'm still upset",
        "My counselor",
        "A person who won't try to fix it",
        "My peer specialist",
        "The Adelante care team",
      ],
      todayActions: [
        "Run cold water over my wrists",
        "Breathe out longer than I breathe in, ten times",
        "Walk it off before I answer anyone",
        "Say the feeling out loud to one person",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-how-do-i-break-old-habits",
    checkIn: "What set off the old habit last time — a place, a time, or a person?",
    adelQuestion: "What could you put in the way of the old routine tonight?",
    adelReflection:
      "You are not trying to want it less; that comes later and mostly on its own. You are changing what happens in the ten seconds after the cue, and that part is a decision you can stack the odds on.",
    toolFlow: {
      warningSigns: [
        "Walking the same route past the same corner",
        "Keeping the old thing within reach 'just in case'",
        "The same hour setting off the same pull",
        "Doing it before I've noticed I started",
        "Trying to quit the cue instead of the routine",
      ],
      supportPeople: [
        "Someone who knows my cue and will ask",
        "My counselor, about the reward underneath",
        "A person to call at the hour it hits",
        "My peer specialist",
        "The Adelante care team",
      ],
      todayActions: [
        "Name the cue, the routine and the reward on paper",
        "Swap the routine once today, keep the reward",
        "Take a different route past the trigger spot",
        "Add one step of friction before the old habit",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-why-should-i-take-my-medication",
    checkIn: "Did you take today's dose, and do you know what time you took it?",
    adelQuestion: "What gets in the way on the days you miss a dose?",
    adelReflection:
      "Taking medication is not skipping the hard part — the hard part is still all of this, just with better odds. If a side effect is what's stopping you, that's a conversation to have, not a reason to quietly stop.",
    toolFlow: {
      warningSigns: [
        "Missing doses on the weekend",
        "Stopping because I felt fine for a while",
        "Not saying anything about a side effect",
        "Running out before I book the refill",
        "Letting someone talk me out of my meds",
      ],
      supportPeople: [
        "My prescriber",
        "The pharmacy that holds my refills",
        "Someone who'll notice if I stop",
        "My case manager, about transport to the clinic",
        "The Adelante care team",
      ],
      todayActions: [
        "Take today's dose at the same time as yesterday",
        "Set the refill reminder a week early",
        "Write down the side effect I've been ignoring",
        "Ask one question about my medication",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-how-do-i-have-fun-without-using",
    checkIn: "What's the last thing you did sober that you'd do again?",
    adelQuestion: "What felt flat the first time that you'd be willing to try twice?",
    adelReflection:
      "Sober fun is quieter at first, and that flatness is real — it isn't you being broken. Enjoyment comes back at its own pace, usually on the third or fourth go, not the first.",
    toolFlow: {
      warningSigns: [
        "Saying nothing sober is any fun",
        "Only going where people are using",
        "Turning down invitations for weeks",
        "Quitting a new thing after one try",
        "Waiting to feel like it before I go",
      ],
      supportPeople: [
        "Someone sober who'll go with me",
        "A group that meets for something other than recovery",
        "My peer specialist",
        "A family member who'd like to be asked",
        "The Adelante care team",
      ],
      todayActions: [
        "Try one new thing this week",
        "Go back to something that felt flat once",
        "Ask someone to come along",
        "Put one thing in the calendar for the weekend",
      ],
    },
  },
  {
    lessonId: "changing-my-everyday-life-building-my-daily-recovery-plan",
    checkIn: "If someone asked what your day looks like tomorrow, could you tell them?",
    adelQuestion: "Which piece of your day is already working well enough to build on?",
    adelReflection:
      "This is the part where the separate pieces stop being ten good ideas and become one page you can look at. Written down and on the wall beats remembered, every single time.",
    toolFlow: {
      warningSigns: [
        "Keeping the whole plan in my head",
        "A plan so full I skip all of it",
        "No person named in it anywhere",
        "Not looking at it again after I wrote it",
        "Starting over instead of adjusting it",
      ],
      supportPeople: [
        "The one person my plan names",
        "My case manager, to look it over",
        "Someone I can read it out to",
        "My peer specialist",
        "The Adelante care team",
      ],
      todayActions: [
        "Write morning, day and night on one page",
        "Put one person's name in the plan",
        "Name the one tool I'll use when it's hard",
        "Stick the page where I'll see it in the morning",
      ],
    },
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredChangingMyEverydayLifeBody(
  entry: AuthoredLessonFields,
): RecoveryLesson | undefined {
  const base = RECOVERY_LESSONS.find((l) => l.id === entry.lessonId);
  if (!base) return undefined;
  return {
    ...structuredClone(base),
    checkIn: entry.checkIn,
    adelQuestion: entry.adelQuestion,
    adelReflection: entry.adelReflection,
    toolFlow: structuredClone(entry.toolFlow),
  };
}

export function seedAuthoredChangingMyEverydayLifeLessons(): void {
  for (const entry of CHANGING_MY_EVERYDAY_LIFE_FIELDS) {
    const body = authoredChangingMyEverydayLifeBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: CHANGING_MY_EVERYDAY_LIFE_AUTHOR.staffId,
        name: CHANGING_MY_EVERYDAY_LIFE_AUTHOR.name,
        role: CHANGING_MY_EVERYDAY_LIFE_AUTHOR.role,
      },
      atISO: CHANGING_MY_EVERYDAY_LIFE_AUTHOR.onISO,
      note: CHANGING_MY_EVERYDAY_LIFE_AUTHOR.note,
      // Shadows the ported baseline lesson; the catalog prefers the published
      // override and falls back to the baseline if it is ever retired.
      overridesBaseline: true,
    });
  }
}

seedAuthoredChangingMyEverydayLifeLessons();
