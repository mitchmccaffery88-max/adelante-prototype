// §Content-authoring pass Batch 3 — MODULE 3 "Understanding My Addiction",
// AUTHORED.
//
// WHAT THE GATE FOUND, precisely. Running the Batch 1 quality gate
// (`originalityErrors`, reached through `RECOVERY_LESSON_TYPE.validate`) over
// the ten live lessons of `understanding-my-addiction` flagged, for real:
//   • 10 of 10 `adelQuestion`  — "What part of this feels hardest for you?"
//   • 10 of 10 `adelReflection` — "Adel can help you go deeper on <title> …"
//   • 10 of 10 `checkIn` — "Right now, how much is <problem> a struggle for
//     you?". Unlike Module 2, there was NO already-authored exception here:
//     every one of the ten was templated on all three fields.
//
// WHAT THE TOOL-FLOW MEASUREMENT FOUND (the gate does not check these — they
// are arrays, and `originalityErrors` only reads free text):
//   • `warningSigns`  — 1 distinct set across 10 lessons (the shared
//     "Restless / Angry / Isolating / Skipping meals / Not sleeping /
//     Avoiding calls").
//   • `supportPeople` — 1 distinct set across 10 lessons ("Sponsor / Peer
//     specialist / Community health worker / Therapist / Family").
//   • `todayActions`  — 10 "distinct" sets, but distinct only in the FIRST
//     entry; entries 2–5 ("Attend a meeting / Call someone who supports me /
//     Practice my recovery skill / Complete one important task") were byte
//     identical in all ten. That is a shared set wearing a per-lesson hat, so
//     it is re-authored here rather than counted as clean.
// These are per-lesson skill data — the patient's selection is stored and
// re-read into the toolkit — so identical sets make the toolkit meaningless.
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight` and the
// decision activity all passed the gate and are carried through verbatim by
// clone. This module's teaching text is already concrete and in voice.
//
// VOICE, continuous with Modules 1 and 2: second person, present tense,
// concrete nouns, no clinical register, and NO 1–10 scale questions (the
// format problem Batch 2 caught by reading rather than by gate). The
// reflection names something true and slightly hard before it offers credit;
// the question anchors to one real past or near-future moment rather than to
// feelings in general.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const UNDERSTANDING_MY_ADDICTION_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Module 3 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, plus distinct warning signs, support people and today-actions for each lesson's own skill.",
};

export interface AuthoredLessonFields {
  lessonId: string;
  checkIn: string;
  adelQuestion: string;
  adelReflection: string;
  toolFlow: RecoveryToolFlow;
}

export const UNDERSTANDING_MY_ADDICTION_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "understanding-my-addiction-why-can-t-i-stop-thinking-about-using",
    checkIn: "How often did a using thought show up today, and what were you doing when it did?",
    adelQuestion: "What was the thought actually offering you the last time it turned up?",
    adelReflection:
      "The thought arriving does not mean you are back at the start. Your brain is repeating an old shortcut it learned worked, and it will keep offering it for a while after you stop taking it.",
    toolFlow: {
      warningSigns: [
        "Replaying a using memory like it was a good day",
        "Arguing with the thought instead of naming it",
        "Keeping the thought secret all day",
        "Driving past somewhere I used to score",
        "Telling myself one thought means I've already failed",
      ],
      supportPeople: [
        "Someone I can say 'I'm having thoughts' to",
        "My peer specialist",
        "A sponsor who's had the same thoughts",
        "My counselor",
        "The Adelante care team",
      ],
      todayActions: [
        "Say 'that's a using thought' out loud once",
        "Write down what the thought promised me",
        "Tell one person a thought showed up today",
        "Change what I'm doing the next time one lands",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-why-are-my-cravings-so-strong",
    checkIn: "When a craving hit this week, how long did you think it would last?",
    adelQuestion: "What did you do with the last twenty minutes of a craving?",
    adelReflection:
      "A craving at its peak lies about how long it will last — it feels permanent right when it is about to fade. You have already outlasted more of them than you have counted.",
    toolFlow: {
      warningSigns: [
        "Believing this craving is the one that won't pass",
        "Bargaining about amounts or 'just once'",
        "Watching the clock and giving up at minute five",
        "Going somewhere I can act on it fast",
        "Riding it out alone because it feels shameful",
      ],
      supportPeople: [
        "Someone who'll stay on the phone twenty minutes",
        "My peer specialist",
        "A person from a meeting I can text late",
        "My prescriber, about craving medication",
        "The Adelante care team",
      ],
      todayActions: [
        "Time one craving instead of acting on it",
        "Get cold water on my face and wrists",
        "Walk until the wave drops",
        "Text someone the minute one starts, not after",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-what-keeps-triggering-me",
    checkIn: "Which of these set something off for you most recently?",
    adelQuestion: "What was around you the last time the urge came out of nowhere?",
    adelReflection:
      "Triggers rarely feel like triggers in the moment — they feel like a normal Tuesday that suddenly got heavy. Naming yours is what turns an ambush into something you can see coming.",
    toolFlow: {
      warningSigns: [
        "Taking the route that goes past the old spot",
        "Keeping a number in my phone I don't need",
        "Saying yes to a place I know is loaded",
        "Payday, and no plan for the afternoon",
        "One particular person calling",
      ],
      supportPeople: [
        "Someone who'll come with me to a hard place",
        "My peer specialist",
        "A friend who knows which places to avoid",
        "Whoever can drive me the long way round",
        "The Adelante care team",
      ],
      todayActions: [
        "List my top three triggers where I can see them",
        "Delete one contact I don't need",
        "Plan the route that avoids the worst block",
        "Decide now what I do if that person calls",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-what-is-halt-trying-to-tell-me",
    checkIn: "Right now — hungry, angry, lonely, tired. Which one is loudest?",
    adelQuestion: "When did you last eat a real meal and sleep a full night?",
    adelReflection:
      "A lot of what gets called weak willpower turns out to be an empty stomach and four hours of sleep. Those are fixable in an afternoon, which is better news than it sounds.",
    toolFlow: {
      warningSigns: [
        "Skipping meals and calling it not being hungry",
        "Snapping at people over small things",
        "Being awake at 3am most nights",
        "Going a whole day without talking to anyone",
        "Running on coffee and cigarettes",
      ],
      supportPeople: [
        "Someone I'd eat a meal with",
        "My peer specialist",
        "Whoever I share a kitchen with",
        "A friend who'd take a late call when I can't sleep",
        "The Adelante care team",
      ],
      todayActions: [
        "Run a HALT check twice today",
        "Eat something before the next hard hour",
        "Be in bed with the lights off by eleven",
        "Say one thing out loud to another person",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-why-does-stress-make-me-want-to-use",
    checkIn: "What's the thing waiting for you this week that you keep thinking about?",
    adelQuestion: "What did your body do the last time stress hit — before you decided anything?",
    adelReflection:
      "Under stress your body wants the fastest relief it knows, and it does not care that the fast one costs the most. Slow breathing is not a small trick; it is the one thing that talks back to that alarm.",
    toolFlow: {
      warningSigns: [
        "Jaw and shoulders tight all day",
        "Court date, bill or appointment I'm dreading",
        "Snapping first and thinking after",
        "Deciding big things while I'm wound up",
        "Holding my breath without noticing",
      ],
      supportPeople: [
        "Someone I can vent to without advice",
        "My peer specialist",
        "My case manager, about the thing causing it",
        "A person who'd sit with me before a hard appointment",
        "The Adelante care team",
      ],
      todayActions: [
        "Use one stress tool today",
        "Breathe out longer than I breathe in, ten times",
        "Deal with the smallest piece of the stressful thing",
        "Ask for help with the thing I'm dreading",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-how-are-my-mental-health-and-recovery-co",
    checkIn: "How much of this week was the using part, and how much was the mood underneath it?",
    adelQuestion: "What have you been told is 'just how you are' that might be treatable?",
    adelReflection:
      "Treating one and ignoring the other is like bailing a boat without patching the hole. Taking something for your head is not a crack in your recovery — it is part of it.",
    toolFlow: {
      warningSigns: [
        "Flat for days with no reason I can name",
        "Stopping medication because I felt better",
        "Panic that comes without a trigger",
        "Sleeping all day or not at all",
        "Believing the low mood is just my personality",
      ],
      supportPeople: [
        "My prescriber",
        "My peer specialist",
        "A therapist or counselor",
        "Someone who notices when I go quiet",
        "The Adelante care team",
      ],
      todayActions: [
        "Book or confirm one appointment",
        "Take my medication at the same time as yesterday",
        "Say one honest sentence about my mood to my care team",
        "Write down what the low days have in common",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-why-do-i-keep-repeating-the-same-pattern",
    checkIn: "Think about the last time this happened. What came right before it?",
    adelQuestion: "What did the pattern give you that nothing else was giving you?",
    adelReflection:
      "Patterns stick because they pay off — relief, quiet, company, something. You don't break one by hating yourself for it; you break it by putting something else in the middle.",
    toolFlow: {
      warningSigns: [
        "Same day of the week, same slide",
        "Doing it on autopilot before I notice",
        "Saying 'this time will be different' with no change to the plan",
        "The hour between getting home and dinner",
        "Only seeing the pattern afterwards",
      ],
      supportPeople: [
        "Someone who can point out my pattern kindly",
        "My peer specialist",
        "A sponsor who's mapped their own",
        "Somebody who'd fill that hour with me",
        "The Adelante care team",
      ],
      todayActions: [
        "Map one pattern: trigger, habit, payoff",
        "Swap the middle step once today",
        "Ask someone what pattern they see in me",
        "Plan the hour I usually lose",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-what-happens-while-my-brain-is-healing",
    checkIn: "How have the last few days actually felt — sharp, foggy, or somewhere in between?",
    adelQuestion: "What have you been able to do this month that you couldn't a month ago?",
    adelReflection:
      "Flat and foggy is not a sign it isn't working. It is what repair feels like from the inside, and the people who felt it worst early on are often the ones surprised at month four.",
    toolFlow: {
      warningSigns: [
        "Reading the fog as proof I'm failing",
        "Wrecked sleep for more than a few nights",
        "Nothing feeling good, including things that used to",
        "Forgetting appointments and names",
        "Expecting to feel normal by a date I made up",
      ],
      supportPeople: [
        "Someone further along who remembers this stretch",
        "My peer specialist",
        "My prescriber, about sleep",
        "A person who'll keep the routine with me",
        "The Adelante care team",
      ],
      todayActions: [
        "Protect my sleep tonight",
        "Keep the same wake-up time as yesterday",
        "Do one thing I did last week, again, on schedule",
        "Tell someone the fog is here and it's normal",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-what-am-i-really-running-from",
    checkIn: "What's the thing you'd rather not think about long enough to name?",
    adelQuestion: "What was going on in the year before your use got heavy?",
    adelReflection:
      "Most people find that what's underneath is smaller and older than the size of the effort spent avoiding it. You do not have to open all of it today, and you do not have to open it alone.",
    toolFlow: {
      warningSigns: [
        "Changing the subject when it gets close",
        "Staying constantly busy so it can't catch up",
        "Anniversaries and dates that flatten me",
        "Anger that arrives instead of grief",
        "Deciding I'll deal with it when I'm stronger",
      ],
      supportPeople: [
        "A trauma-informed counselor",
        "My peer specialist",
        "One person who's earned hearing the hard part",
        "A group where this gets said out loud",
        "The Adelante care team",
      ],
      todayActions: [
        "Write one honest sentence",
        "Name the thing to one safe person",
        "Ask my care team about counseling",
        "Sit with it for five minutes without fixing it",
      ],
    },
  },
  {
    lessonId: "understanding-my-addiction-understanding-my-recovery-story",
    checkIn: "If someone asked how you got here, where would you start the story?",
    adelQuestion: "Which part of your story would help somebody else if you said it out loud?",
    adelReflection:
      "The version you tell yourself at 3am is usually only the harm. The whole story includes every stretch you survived, and that part is evidence, not modesty.",
    toolFlow: {
      warningSigns: [
        "Only telling the version where I'm the villain",
        "Skipping the parts I got through",
        "Letting somebody else narrate my history",
        "Retelling the worst day on a loop",
        "Believing the story is already finished",
      ],
      supportPeople: [
        "Someone safe to tell one chapter to",
        "My peer specialist",
        "A group where sharing is normal",
        "A person from my life before all this",
        "The Adelante care team",
      ],
      todayActions: [
        "Tell one piece of my story to someone safe",
        "Write the part where I got through something",
        "Name what I want the next chapter to say",
        "Thank one person who's in the story",
      ],
    },
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredUnderstandingMyAddictionBody(
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

export function seedAuthoredUnderstandingMyAddictionLessons(): void {
  for (const entry of UNDERSTANDING_MY_ADDICTION_FIELDS) {
    const body = authoredUnderstandingMyAddictionBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: UNDERSTANDING_MY_ADDICTION_AUTHOR.staffId,
        name: UNDERSTANDING_MY_ADDICTION_AUTHOR.name,
        role: UNDERSTANDING_MY_ADDICTION_AUTHOR.role,
      },
      atISO: UNDERSTANDING_MY_ADDICTION_AUTHOR.onISO,
      note: UNDERSTANDING_MY_ADDICTION_AUTHOR.note,
      // Shadows the ported baseline lesson; the catalog prefers the published
      // override and falls back to the baseline if it is ever retired.
      overridesBaseline: true,
    });
  }
}

seedAuthoredUnderstandingMyAddictionLessons();
