// §Content-authoring pass Batch 8 — MODULE 8 "Becoming Someone New", AUTHORED.
// The final module of the content-authoring project.
//
// WHAT THE GATE FOUND, precisely. Running the Batch 1 quality gate
// (`originalityErrors`) over the ten live lessons of `becoming-someone-new`
// flagged, for real:
//   • 10 of 10 `checkIn`        — "Right now, how much is <problem> a struggle
//     for you?"
//   • 10 of 10 `adelReflection` — "Adel can help you go deeper on <title> …"
//   • 10 of 10 `adelQuestion`   — "What part of this feels hardest for you?"
// Three flags on every lesson, no clean exceptions — identical to Modules 3–7.
//
// WHAT THE TOOL-FLOW MEASUREMENT FOUND (arrays; the gate only reads free text):
//   • `warningSigns`  — 1 distinct set across 10 lessons ("Restless / Angry /
//     Isolating / Skipping meals / Not sleeping / Avoiding calls").
//   • `supportPeople` — 1 distinct set across 10 lessons ("Sponsor / Peer
//     specialist / Community health worker / Therapist / Family").
//   • `todayActions`  — DISTINCT ONLY IN THE FIRST ENTRY: 10 nominally distinct
//     sets, tail entries 2–5 byte-identical in all ten, so the tail collapses
//     to 1. Seven modules for seven — the pattern holds through the last one.
//
// WHAT THE ACTIVITY-CHOICE CHECK FOUND (standard scope since Batch 6):
//   • All ten activities are `kind: "decision"` and all ten carry the SAME four
//     labels in the same order — "Ask what my future self would do / Do one
//     small brave thing / Write it down / Tell someone my goal". Only the
//     feedback paraphrases differ. Re-authored per lesson. Three for three.
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight`, and each
// activity's `kind`, `title` and `prompt` pass the gate and are carried through
// verbatim by clone; only `activity.choices` is replaced.
//
// TONE. Identity, meaning and growth invite abstraction, which is the specific
// risk in this module. Every question here is anchored the way Module 5 anchored
// relationships: to a nameable moment — a Tuesday, a room, a sentence somebody
// said to you, a thing you did without deciding to. Second person, present
// tense, no clinical register, no 1–10 scale questions, and no line that asks
// the person to describe who they are in the abstract.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const BECOMING_SOMEONE_NEW_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Module 8 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, distinct warning signs, support people and today-actions, plus a decision-activity choice set written for each lesson instead of the four labels all ten shared. Closes the content-authoring project.",
};

export interface AuthoredChoice {
  label: string;
  feedback: string;
}

export interface AuthoredLessonFields {
  lessonId: string;
  checkIn: string;
  adelQuestion: string;
  adelReflection: string;
  toolFlow: RecoveryToolFlow;
  /** Replaces the shared four-button choice set on the decision activity. */
  activityChoices: AuthoredChoice[];
}

export const BECOMING_SOMEONE_NEW_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "becoming-someone-new-what-am-i-good-at",
    checkIn: "Which of these did you do for someone this week without being asked?",
    adelQuestion:
      "Think of a time somebody relied on you and you came through. What exactly did you do that day?",
    adelReflection:
      "Most people can list what they've wrecked faster than what they're good at, and that's not humility, it's just practice. The things you did to survive — reading a room, showing up, keeping your word to the one person who mattered — are skills, and they transfer.",
    toolFlow: {
      warningSigns: [
        "Answering a compliment with a joke",
        "Saying I got lucky when I didn't",
        "Turning down a job I could actually do",
        "Listing my failures to somebody I just met",
        "Assuming the good week was a fluke",
      ],
      supportPeople: [
        "Someone who's watched me work",
        "A peer who'd tell me straight what I'm good at",
        "The person who asked me for help last",
        "My case manager, about what to do with it",
        "A family member who remembers me before",
      ],
      todayActions: [
        "Write down one thing somebody thanked me for this month",
        "Say the strength out loud instead of joking past it",
        "Ask one person what they'd come to me for",
        "Use one of those strengths on purpose today",
      ],
    },
    activityChoices: [
      {
        label: "Name one thing I did well this week, out loud",
        feedback:
          "Said out loud it stops being a story you're telling yourself. One real example beats an hour of trying to feel capable.",
      },
      {
        label: "Ask someone what they'd call me for",
        feedback:
          "People usually answer that question fast, and their answer is often something you'd never have listed. It's outside evidence, which is the kind that sticks.",
      },
      {
        label: "Do the thing I'm good at for someone else today",
        feedback:
          "Using a strength is more convincing than describing one. An hour of being useful settles the doubt better than reassurance does.",
      },
      {
        label: "Let the thought pass and come back to it later",
        feedback:
          "That's fine, doubt is not an emergency. If you set it down, pick one small thing to do anyway, so the day still gives you evidence.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-how-do-i-believe-in-myself-again",
    checkIn: "Confidence comes back from doing, not deciding. Which of these have you already done once?",
    adelQuestion:
      "What's something you told someone you'd do, and then did, in the last two weeks — even a small one?",
    adelReflection:
      "You don't argue your way back into trusting yourself; you stack evidence until it's harder to deny than to accept. Every kept promise you can name is a receipt, and you just named one.",
    toolFlow: {
      warningSigns: [
        "Making a promise I already know I'll dodge",
        "Waiting to feel ready before starting",
        "Cancelling on myself first, before anybody else can",
        "Calling a small win meaningless",
        "Comparing my week one to somebody's year three",
      ],
      supportPeople: [
        "Someone who'll hold me to a small promise",
        "A sponsor who checks whether I did it",
        "A peer starting from about where I am",
        "My counselor, when the doubt gets loud",
        "The person I made this week's promise to",
      ],
      todayActions: [
        "Make one promise small enough that I'll keep it today",
        "Write down the last three things I followed through on",
        "Tell one person what I'm doing by Friday",
        "Do the ten-minute version instead of skipping it",
      ],
    },
    activityChoices: [
      {
        label: "Pick a promise I can finish before tonight",
        feedback:
          "Small and finished beats big and pending. Confidence is built out of completions, and today can hold at least one of them.",
      },
      {
        label: "Read back what I've already followed through on",
        feedback:
          "Your memory throws out the wins and keeps the misses. Reading the list corrects that, and it takes about two minutes.",
      },
      {
        label: "Tell one person the deadline I'm setting",
        feedback:
          "A promise with a witness gets kept more often. It's not pressure, it's just a second person who remembers what you said.",
      },
      {
        label: "Wait until I feel more sure about it",
        feedback:
          "The sureness usually shows up after the doing, not before it. If you wait, pick the time you'll start anyway so waiting has an end.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-what-gives-my-life-meaning",
    checkIn: "On a normal Tuesday, which of these makes the day feel worth it?",
    adelQuestion:
      "When was the last time two hours went by and you weren't counting them? What were you doing?",
    adelReflection:
      "Meaning almost never shows up as a big answer about purpose. It shows up as the hour you didn't check the clock, and that hour is data worth taking seriously.",
    toolFlow: {
      warningSigns: [
        "Nothing on the calendar I'd miss if it vanished",
        "Scrolling through a whole evening",
        "Only showing up to things I'm required at",
        "Saying it doesn't matter about things that used to",
        "Waiting for the day to be over by noon",
      ],
      supportPeople: [
        "Someone who does something they care about",
        "A peer who'd bring me along to it",
        "My counselor, about what keeps pulling at me",
        "A group that meets whether I feel like it or not",
        "Anyone who'd notice if I stopped coming",
      ],
      todayActions: [
        "Put one thing on this week I'd actually miss",
        "Spend twenty minutes on the thing I keep almost doing",
        "Ask someone what they'd take me along to",
        "Write down the last hour that didn't drag",
      ],
    },
    activityChoices: [
      {
        label: "Go do the small thing I keep almost doing",
        feedback:
          "Meaning is found by contact, not reflection. Twenty minutes of the actual thing tells you more than an evening of wondering.",
      },
        {
        label: "Call the person this feeling is really about",
        feedback:
          "Adrift often means disconnected. If a name came to mind while you read that, the call is probably the answer.",
      },
      {
        label: "Write down what the day was supposed to be for",
        feedback:
          "Putting it on paper turns a mood into a specific gap. A specific gap is something you can do something about tomorrow.",
      },
      {
        label: "Get through today and look at it later",
        feedback:
          "Some days that's the honest choice. Just pick the later — a day and a time — so it doesn't become the whole month.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-what-kind-of-person-do-i-want-to-become",
    checkIn: "Which of these would you want someone to say about you a year from now?",
    adelQuestion:
      "Picture yourself a year out, on an ordinary morning. What are you doing in the first hour you're awake?",
    adelReflection:
      "Who you're becoming isn't decided in a big moment; it's decided in the ordinary hour you just described. If that hour is reachable from this week, you're already partway into it.",
    toolFlow: {
      warningSigns: [
        "Acting one way with my people and another alone",
        "Doing the thing I said I was done doing",
        "Letting a lie stand because correcting it is awkward",
        "Going quiet when somebody needed me to speak up",
        "Choosing the easier version and calling it realistic",
      ],
      supportPeople: [
        "Someone already living something like it",
        "A person who'll say when I'm off my own script",
        "My sponsor, about the gap between the two",
        "A peer who's a year further along",
        "Whoever I'd hate to disappoint",
      ],
      todayActions: [
        "Do one thing that person would do, before tonight",
        "Write the one sentence I want said about me",
        "Fix the one thing I'm doing that doesn't match it",
        "Ask someone what they see me becoming",
      ],
    },
    activityChoices: [
      {
        label: "Act like the person I described, just for this hour",
        feedback:
          "You can't be someone new all at once, but you can be them for an hour. Enough hours and the description stops being aspirational.",
      },
      {
        label: "Name the one habit that doesn't fit anymore",
        feedback:
          "Most of the gap sits in one or two specific behaviors, not in your whole character. Naming one makes the change a task instead of a personality overhaul.",
      },
      {
        label: "Ask someone who knows me what's changed already",
        feedback:
          "Other people usually clock the change before you do. Their answer gives you a starting point that isn't guesswork.",
      },
      {
        label: "Stay stuck for now and revisit it",
        feedback:
          "Stuck is allowed. Set a day to look again, and in the meantime don't do anything that makes the gap wider.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-how-can-gratitude-help-me",
    checkIn: "Which of these got you through today, even a little?",
    adelQuestion:
      "Name one thing that went right today that you'd normally not bother mentioning. What was it?",
    adelReflection:
      "Gratitude gets sold as a mood, and it isn't — it's attention. Your mind is very good at cataloguing what went wrong, and naming one small thing that didn't is how you start balancing the record.",
    toolFlow: {
      warningSigns: [
        "Only noticing what went wrong today",
        "Brushing off something good as no big deal",
        "Keeping score against people in my head",
        "Saying nothing's changed when things have",
        "Feeling owed rather than steady",
      ],
      supportPeople: [
        "Someone I've been meaning to thank",
        "A peer who'd swap one good thing with me",
        "My counselor, when nothing seems to count",
        "The person who did the small thing today",
        "A group where people say theirs out loud",
      ],
      todayActions: [
        "Thank one person specifically for one thing",
        "Write down three things that went right today",
        "Say one good thing before I list a bad one",
        "Notice one thing on my walk I usually miss",
      ],
    },
    activityChoices: [
      {
        label: "Say one specific thank-you to a real person",
        feedback:
          "Specific beats general — the bus driver who waited, the neighbor who noticed. It lands for them and it interrupts your loop.",
      },
      {
        label: "List three things that went right today",
        feedback:
          "Three is enough to break the circling. They're allowed to be small: hot water, a call answered, a day you didn't use.",
      },
      {
        label: "Notice one thing in the room right now",
        feedback:
          "It pulls you out of the story in your head and back into the actual afternoon, which is usually less dire than the story.",
      },
      {
        label: "Let the negative thoughts run their course",
        feedback:
          "Sometimes they need to. Just don't let them be the only version on the record — add one true good thing when they slow down.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-how-do-i-find-peace",
    checkIn: "When your head is loud, which of these actually slows it down?",
    adelQuestion:
      "Where were you the last time your mind went quiet for a few minutes? Describe the place.",
    adelReflection:
      "Peace is not a state you arrive at; it's a handful of places and moves that reliably turn the volume down. You just named one, and it's more useful than any advice about calm.",
    toolFlow: {
      warningSigns: [
        "Rehearsing the same argument all evening",
        "Can't sit through ten minutes without my phone",
        "Jaw tight and shoulders up since morning",
        "Snapping at someone over the small thing",
        "Lying awake running tomorrow in my head",
      ],
      supportPeople: [
        "Someone I can sit with and not talk",
        "A peer who does the quiet thing with me",
        "My counselor, when it doesn't let up",
        "Whoever's in the house when it's late",
        "The crisis line if the noise turns dangerous",
      ],
      todayActions: [
        "Go stand outside for five minutes with no phone",
        "Do the one thing that reliably slows my head",
        "Put my phone in another room for an hour",
        "Breathe out longer than I breathe in, ten times",
      ],
    },
    activityChoices: [
      {
        label: "Step outside for five minutes without my phone",
        feedback:
          "Changing where your body is changes what your head does. Five minutes of outside air is small enough that you'll actually do it.",
      },
      {
        label: "Slow my breathing until the out-breath is longer",
        feedback:
          "It's physical, not philosophical — a longer out-breath settles your body, and your thoughts usually follow a minute behind.",
      },
      {
        label: "Say the racing thought out loud to one person",
        feedback:
          "Out loud, a spiral tends to shrink to its actual size. You also stop being alone with it, which is half of what made it loud.",
      },
      {
        label: "Push through and finish what I'm doing",
        feedback:
          "Sometimes finishing is the calming thing. If your head is still going afterward, take the five minutes then rather than skipping them.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-what-does-spiritual-recovery-mean-to-me",
    checkIn: "Which of these comes closest to what steadies you — whatever you call it?",
    adelQuestion:
      "When was the last time you felt part of something bigger than your own week? Where were you?",
    adelReflection:
      "Nobody gets to assign you a version of this. Some people find it in a church, some in a room full of folding chairs, some standing in a field at 6am — the test is whether it steadies you, not whether it has a name.",
    toolFlow: {
      warningSigns: [
        "Skipping the thing that used to ground me",
        "Deciding it's all pointless before I've tried",
        "Going only because somebody expects it",
        "Feeling like the only one in the room",
        "Nothing bigger than my own head all week",
      ],
      supportPeople: [
        "Someone whose practice looks nothing like mine",
        "A chaplain or a faith leader who won't push",
        "A peer who's figured out their own version",
        "My counselor, without the religion argument",
        "A group that lets me just sit in the back",
      ],
      todayActions: [
        "Sit somewhere quiet for ten minutes and see",
        "Ask one person what steadies them and why",
        "Go once to the thing I've been curious about",
        "Write what I'd call it, in my own words",
      ],
    },
    activityChoices: [
      {
        label: "Try one version for ten minutes and see how it sits",
        feedback:
          "You don't have to sign up for anything. Ten minutes of trying it tells you more than a year of deciding whether you believe in it.",
      },
      {
        label: "Ask someone what this actually looks like for them",
        feedback:
          "Most people's real answer is smaller and stranger than the official version. Hearing one makes room for yours to be your own.",
      },
      {
        label: "Write down what I'd call it in my own words",
        feedback:
          "The word matters less than whether it means something to you. Naming it yourself keeps someone else's definition from deciding it for you.",
      },
      {
        label: "Skip it — this part isn't for me",
        feedback:
          "That's a real answer and it doesn't cost you your recovery. Plenty of people stay well with connection and purpose and no spiritual language at all.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-how-can-i-help-other-people",
    checkIn: "Which of these could you actually offer someone this week?",
    adelQuestion:
      "Who's about where you were a year ago? What's the one thing you wish somebody had told you then?",
    adelReflection:
      "The worst stretch you went through is the part of you that's most useful to somebody else, and that's not a consolation prize — it's the thing nobody with training can hand over. Just watch that helping doesn't quietly become your way of skipping your own week.",
    toolFlow: {
      warningSigns: [
        "Taking on somebody's crisis instead of my own day",
        "Giving advice I'm not following myself",
        "Getting resentful when help isn't taken",
        "Being needed as the only reason I'm okay",
        "Saying yes when I have nothing left",
      ],
      supportPeople: [
        "Someone who'll tell me when I'm overextending",
        "A peer specialist who does this for a living",
        "My sponsor, about where the line goes",
        "A volunteer coordinator at a place I trust",
        "The person I'd be helping, about what they want",
      ],
      todayActions: [
        "Ask one person how they're actually doing, then listen",
        "Offer the one concrete thing I can follow through on",
        "Find out how to volunteer somewhere real",
        "Check I've done my own thing before I do theirs",
      ],
    },
    activityChoices: [
      {
        label: "Ask how they're doing and let the pause sit",
        feedback:
          "Most people get asked and immediately talked past. Leaving the silence is often the whole of what they needed.",
      },
      {
        label: "Offer one concrete thing instead of a general offer",
        feedback:
          "A ride Thursday gets taken; let me know if you need anything doesn't. Make it specific enough that saying yes is easy.",
      },
      {
        label: "Tell them the part of my story that fits",
        feedback:
          "Not all of it, just the piece that matches where they are. Being told it isn't unusual is worth more than being told what to do.",
      },
      {
        label: "Check what I have to give before I offer it",
        feedback:
          "Helping from empty turns into resentment fast. If today is thin, say so and offer something you can actually deliver later.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-what-future-am-i-building",
    checkIn: "Which piece of the next year feels closest to actually happening?",
    adelQuestion:
      "What would have to be true by this time next year for you to say it went well? Name one thing.",
    adelReflection:
      "A future that's only a feeling stays out of reach; one thing you can name by a date is a plan. The uncertainty doesn't go away, it just stops being the whole picture once there's something specific in it.",
    toolFlow: {
      warningSigns: [
        "Can't picture next month, only this week",
        "Talking about the future only as what I've lost",
        "Turning down a chance because it's too far out",
        "Making no plan that requires me to still be here",
        "Letting a deadline pass without noticing",
      ],
      supportPeople: [
        "Someone who's built the thing I'm aiming at",
        "My case manager, about what's realistic by when",
        "A peer to check on the goal in a month",
        "An employment or housing worker who knows the steps",
        "Someone who'll be in that future with me",
      ],
      todayActions: [
        "Write one thing I want true a year from now",
        "Find the first real step and who to ask about it",
        "Put one date on the calendar for the next step",
        "Tell one person the goal so it exists outside my head",
      ],
    },
    activityChoices: [
      {
        label: "Write one thing I want true twelve months out",
        feedback:
          "One is enough to aim by. Vague uncertainty turns into a target the moment it has words and a rough date attached.",
      },
      {
        label: "Find the very first step and who to ask",
        feedback:
          "Every future goal has a boring first step — a form, a phone number, a class. Knowing it makes the year feel less like a cliff.",
      },
      {
        label: "Put one date on the calendar this week",
        feedback:
          "A date is the difference between an intention and a plan. Even a fifteen-minute appointment moves the thing from someday to Thursday.",
      },
      {
        label: "Sit with the uncertainty for now",
        feedback:
          "Uncertainty is honest — a lot is genuinely not settled yet. Say it out loud to someone rather than carrying it alone all week.",
      },
    ],
  },
  {
    lessonId: "becoming-someone-new-creating-my-vision-for-life",
    checkIn: "A vision is values plus a picture plus a first step. Which part do you have already?",
    adelQuestion:
      "Describe one ordinary evening in the life you're building — who's there, what room are you in?",
    adelReflection:
      "That evening you just described is the vision; everything else is logistics. It doesn't have to be impressive to anybody but you, and it's the thing you're actually doing all this work for.",
    toolFlow: {
      warningSigns: [
        "Making the picture so big I can't start",
        "Borrowing somebody else's version of a good life",
        "Never saying it out loud to anyone",
        "Changing the whole plan every few weeks",
        "Treating the vision as a reward for later",
      ],
      supportPeople: [
        "Someone who'll listen to the whole picture once",
        "A peer to trade visions with, no editing",
        "My counselor, about what's underneath it",
        "Somebody in that picture I should tell",
        "A mentor who's living a version of it",
      ],
      todayActions: [
        "Describe that ordinary evening to one person",
        "Name the three values the picture is built on",
        "Pick the one step that starts it this month",
        "Put the picture somewhere I'll see it daily",
      ],
    },
    activityChoices: [
      {
        label: "Describe one ordinary day in it, start to finish",
        feedback:
          "A whole life is too big to picture; one Tuesday isn't. The specifics — the room, the hour you get up — are what make it something to aim at.",
      },
      {
        label: "Name the three things it has to be built on",
        feedback:
          "Values are the part that doesn't change when the plan does. Three named ones keep the vision yours when circumstances rearrange it.",
      },
      {
        label: "Say the picture out loud to one person",
        feedback:
          "Out loud it becomes real and slightly embarrassing, which is the point. It also means somebody else can remind you of it later.",
      },
      {
        label: "Start with the one step I can take this month",
        feedback:
          "The overwhelm comes from looking at all of it at once. One step this month is enough, and it's the only part today can affect.",
      },
    ],
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredBecomingSomeoneNewBody(
  entry: AuthoredLessonFields,
): RecoveryLesson | undefined {
  const base = RECOVERY_LESSONS.find((l) => l.id === entry.lessonId);
  if (!base) return undefined;
  const next = structuredClone(base);
  // The activity's kind, title and prompt are the editorially-approved
  // originals; only the shared four-button choice set is replaced.
  if (next.activity.kind === "decision") {
    next.activity = {
      ...next.activity,
      choices: entry.activityChoices.map((c) => ({ label: c.label, feedback: c.feedback })),
    };
  }
  return {
    ...next,
    checkIn: entry.checkIn,
    adelQuestion: entry.adelQuestion,
    adelReflection: entry.adelReflection,
    toolFlow: structuredClone(entry.toolFlow),
  };
}

export function seedAuthoredBecomingSomeoneNewLessons(): void {
  for (const entry of BECOMING_SOMEONE_NEW_FIELDS) {
    const body = authoredBecomingSomeoneNewBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: BECOMING_SOMEONE_NEW_AUTHOR.staffId,
        name: BECOMING_SOMEONE_NEW_AUTHOR.name,
        role: BECOMING_SOMEONE_NEW_AUTHOR.role,
      },
      atISO: BECOMING_SOMEONE_NEW_AUTHOR.onISO,
      note: BECOMING_SOMEONE_NEW_AUTHOR.note,
      overridesBaseline: true,
    });
  }
}

seedAuthoredBecomingSomeoneNewLessons();
