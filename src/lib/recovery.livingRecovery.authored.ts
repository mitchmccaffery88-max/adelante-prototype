// §Content-authoring pass Batch 9 — MODULE 9 "Living Recovery", AUTHORED.
//
// The module Batches 1–8 never reached. The eight-module sweep closed
// `first-days-out` … `becoming-someone-new`; `living-recovery` (order 9) kept
// the imported generator output on every one of its ten lessons.
//
// WHAT THE GATE FOUND, precisely (`originalityErrors` over the ten live
// lessons of `living-recovery`):
//   • 10 of 10 `checkIn`        — "Right now, how much is <problem> a struggle
//     for you?"
//   • 10 of 10 `adelReflection` — "Adel can help you go deeper on …"
//   • 10 of 10 `adelQuestion`   — "What part of this feels hardest for you?"
//
// WHAT THE TOOL-FLOW MEASUREMENT FOUND (arrays; the gate only reads free text):
//   • `warningSigns`  — 1 distinct set across 10 lessons ("Restless / Angry /
//     Isolating / Skipping meals / Not sleeping / Avoiding calls").
//   • `supportPeople` — 1 distinct set across 10 lessons ("Sponsor / Peer
//     specialist / Community health worker / Therapist / Family").
//   • `todayActions`  — distinct only in the first entry; entries 2–5 are
//     byte-identical in all ten, exactly as in Modules 2–8.
//
// WHAT THE ACTIVITY-CHOICE CHECK FOUND: all ten activities are
// `kind: "decision"` and all ten carry the SAME four labels in the same order
// — "Go back to the basics / Call my people / Review my plan / Get to a
// meeting". Re-authored per lesson.
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight`, and
// each activity's `kind`, `title` and `prompt` pass the gate and are carried
// through verbatim by clone; only `activity.choices` is replaced.
//
// TONE. This module is maintenance territory — year two, not week two. The
// specific risk is preachiness ("stay vigilant", "recovery is a journey"), so
// every line here is anchored to something countable: a meeting you did or
// didn't get to, a name, a Sunday, a number of hours of sleep. Second person,
// present tense, no clinical register, no 1–10 scale questions.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const LIVING_RECOVERY_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-26T00:00:00.000Z",
  note:
    "Module 9 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, distinct warning signs, support people and today-actions, plus a decision-activity choice set written for each lesson instead of the four labels all ten shared. Brings the catalog to 90 of 90 authored lessons.",
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

export const LIVING_RECOVERY_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "living-recovery-how-do-i-stay-in-recovery",
    checkIn: "Which of these has slipped in the last two weeks, if any?",
    adelQuestion:
      "What did you do in your first month that you have quietly stopped doing since?",
    adelReflection:
      "Nobody relapses out of nowhere; something gets dropped first, usually something small and boring. Naming the dropped thing while it is still small is the whole trick, and it is a lot easier than starting over.",
    toolFlow: {
      warningSigns: [
        "Skipping the meeting I never used to skip",
        "Letting my phone go to voicemail on purpose",
        "Telling myself I've got this handled now",
        "Going a week without saying anything honest to anyone",
        "Sleeping four hours and calling it fine",
      ],
      supportPeople: [
        "The person who saw me at my worst",
        "Someone who has more time in than me",
        "A peer specialist who'd notice if I went quiet",
        "My counselor, before it turns into a crisis",
        "Whoever picked up the last time I called",
      ],
      todayActions: [
        "Put the dropped habit back on the calendar for this week",
        "Text the one person I've been avoiding",
        "Eat a real meal and get to bed before midnight",
        "Say out loud what I'd notice first if I were sliding",
      ],
    },
    activityChoices: [
      {
        label: "Name the one thing I've let slide",
        feedback:
          "One named habit is fixable tonight. A vague sense that things are off just sits there and gets heavier.",
      },
      {
        label: "Get back to the meeting I stopped going to",
        feedback:
          "Walking back in after weeks away is the awkward part, and it lasts about four minutes. After that you're just someone at a meeting again.",
      },
      {
        label: "Tell one person the thought I just had",
        feedback:
          "Said to another person the thought loses most of its weight. Kept in your head it grows all week.",
      },
      {
        label: "Look at what's actually going well right now",
        feedback:
          "Fair — long-haul doubt is not always a warning sign. Just pair it with one concrete thing you'll keep doing this week, so it doesn't stay a feeling.",
      },
    ],
  },
  {
    lessonId: "living-recovery-why-should-i-keep-going-to-meetings",
    checkIn: "How did last week actually go with meetings?",
    adelQuestion:
      "When was the last meeting you went to, and what did you leave with — even something small?",
    adelReflection:
      "The meeting you stop needing is usually the one you stop going to right before things get complicated. It costs you an hour, and it puts you in a room with people who can tell when you're lying.",
    toolFlow: {
      warningSigns: [
        "Deciding on the drive over that I'm too tired",
        "Going but not speaking for a month straight",
        "Only going when things are already bad",
        "Thinking I've heard it all before",
        "Dropping the meeting because of a work shift I could move",
      ],
      supportPeople: [
        "Someone who'd save me a seat",
        "The person I usually ride with",
        "A newer member who's counting on me showing up",
        "My sponsor, about which meeting fits now",
        "A friend who goes to a different fellowship",
      ],
      todayActions: [
        "Pick the specific meeting and the specific day this week",
        "Ask someone to go with me or meet me there",
        "Say one honest sentence in the room instead of passing",
        "Stay for coffee afterward instead of leaving at the end",
      ],
    },
    activityChoices: [
      {
        label: "Go this week even though I don't feel like it",
        feedback:
          "Attendance doesn't have to be motivated to count. Most people who go on a low-motivation day say afterward they were glad they went.",
      },
      {
        label: "Find a meeting that fits my life better now",
        feedback:
          "Schedules change and so does what you need from a room. Switching meetings is different from quitting them.",
      },
      {
        label: "Share once instead of just sitting there",
        feedback:
          "Speaking is what turns an hour of listening into an hour of being known. It also makes it much harder to disappear next month.",
      },
      {
        label: "Call someone from the group instead of going tonight",
        feedback:
          "A real conversation beats an unattended meeting. Just don't let the phone call quietly become the replacement every week.",
      },
    ],
  },
  {
    lessonId: "living-recovery-how-does-sponsorship-change-recovery",
    checkIn: "Where are you with a sponsor right now?",
    adelQuestion:
      "What's the one thing you'd have to admit to a sponsor that you haven't said to anyone yet?",
    adelReflection:
      "A sponsor is not a boss and not a therapist; they're someone who has already made your next mistake and can tell you what it cost them. The value shows up on the day you'd rather not call.",
    toolFlow: {
      warningSigns: [
        "Editing the story before I tell my sponsor",
        "Going three weeks without checking in",
        "Picking someone I know won't push me",
        "Skipping the step work but keeping the calls friendly",
        "Deciding I don't need one now that I'm stable",
      ],
      supportPeople: [
        "Someone in the room whose recovery I'd want",
        "A temporary sponsor to start with this week",
        "My current sponsor, about what I've been holding back",
        "Someone I sponsor, who keeps me honest",
        "A peer who can tell me how they asked",
      ],
      todayActions: [
        "Ask one person to sponsor me, even temporarily",
        "Tell my sponsor the part I left out last time",
        "Set the day and time we'll talk each week",
        "Do the piece of step work I've been putting off",
      ],
    },
    activityChoices: [
      {
        label: "Call my sponsor before I decide anything",
        feedback:
          "Calling before you act is the whole point of having one. Decisions made alone in a bad hour are the ones that tend to hurt.",
      },
      {
        label: "Say the part I'd normally leave out",
        feedback:
          "The edited version gets you edited advice. The unedited version is usually less shocking to them than it feels to you.",
      },
      {
        label: "Ask someone new to sponsor me",
        feedback:
          "Most people say yes, and the ones who can't will point you at someone who can. Asking is the hardest ninety seconds of it.",
      },
      {
        label: "Handle this one on my own first",
        feedback:
          "Some things genuinely are yours to work out. Set a limit though — if it's still sitting on you tomorrow, that's the call to make.",
      },
    ],
  },
  {
    lessonId: "living-recovery-how-can-helping-others-help-me",
    checkIn: "When did you last do something for someone else in recovery?",
    adelQuestion:
      "Who helped you early on, and what specifically did they do that you could do for somebody now?",
    adelReflection:
      "Helping someone else is the fastest exit from your own head that exists, and it doesn't require you to feel good first. Twenty minutes of being useful changes the day more than an hour of trying to fix your mood.",
    toolFlow: {
      warningSigns: [
        "Sitting in my room replaying the same argument",
        "Turning down the ride somebody asked me for",
        "Feeling useless and then proving it by doing nothing",
        "Only talking about myself in the meeting",
        "Saying I'll help and then not following up",
      ],
      supportPeople: [
        "The newest person in my home group",
        "Someone who asked me for something recently",
        "A peer specialist who knows who needs a hand",
        "The person who helped me my first week",
        "A neighbor or family member with a real task",
      ],
      todayActions: [
        "Give someone the ride, the call or the twenty minutes",
        "Ask the newest person how their week actually went",
        "Show up early and set up the room",
        "Follow through on the favor I already promised",
      ],
    },
    activityChoices: [
      {
        label: "Text the newest person in my group",
        feedback:
          "Two sentences to someone three weeks in is small for you and large for them. It also puts your own week in proportion fast.",
      },
      {
        label: "Do one concrete task for somebody today",
        feedback:
          "A ride, a meal, a setup shift — service that has a start and an end is easier to actually do than a general intention to be helpful.",
      },
      {
        label: "Share what I've learned when it fits",
        feedback:
          "Your story is useful when someone asked for it. Offered when it's wanted, it's help; offered when it isn't, it's noise.",
      },
      {
        label: "Sit with the low mood a while first",
        feedback:
          "Not every low day needs fixing. If it's still there this evening, do one small thing for someone anyway — that's usually what shifts it.",
      },
    ],
  },
  {
    lessonId: "living-recovery-how-do-i-give-back",
    checkIn: "Which of these could you honestly sustain for a few months?",
    adelQuestion:
      "What can you do without much effort that someone around you can't do at all right now?",
    adelReflection:
      "Giving back gets abandoned when it's designed too big. The commitment you can still keep in a hard month is worth more than the ambitious one you drop by March.",
    toolFlow: {
      warningSigns: [
        "Volunteering for more than my week can hold",
        "Resenting the thing I said yes to",
        "Making it about being seen doing it",
        "Cancelling twice and then stopping altogether",
        "Giving money or time I actually need",
      ],
      supportPeople: [
        "Whoever coordinates service at my group",
        "Someone who'd do the commitment alongside me",
        "My case manager, about what's realistic right now",
        "A person already doing the thing I'm considering",
        "Someone who'll tell me when I'm overcommitting",
      ],
      todayActions: [
        "Pick the smallest commitment I'd still keep in a bad month",
        "Say yes to one thing and no to the rest",
        "Put the recurring slot in my phone with a reminder",
        "Tell the coordinator exactly what I can and can't cover",
      ],
    },
    activityChoices: [
      {
        label: "Take the smallest regular commitment available",
        feedback:
          "Coffee, chairs, greeting at the door — small and repeating beats big and one-time, because you keep showing up on the days you'd rather not.",
      },
      {
        label: "Offer the practical thing I'm actually good at",
        feedback:
          "Driving, cooking, fixing something — practical help is easy to accept and easy for you to sustain. It also doesn't require you to be eloquent.",
      },
      {
        label: "Tell my story only where it's welcome",
        feedback:
          "There's real value in it when someone's asking. Check the room first; your story is not owed to anyone who hasn't asked for it.",
      },
      {
        label: "Wait until my own life is steadier",
        feedback:
          "Reasonable if this month is genuinely full. Name the date you'll revisit it, or 'later' turns into never without you deciding.",
      },
    ],
  },
  {
    lessonId: "living-recovery-how-do-i-protect-everything-i-ve-built",
    checkIn: "Which of these have you let slide this month?",
    adelQuestion:
      "What's the one thing you'd have to say no to this week to protect what you've built?",
    adelReflection:
      "Everything you have now was built out of ordinary decisions — where you sleep, who you answer, what time you eat. Protecting it is the same kind of unglamorous work, and it mostly comes down to a few no's you don't want to say.",
    toolFlow: {
      warningSigns: [
        "Saying yes to the party because it'd be rude not to",
        "Trading sleep for one more shift, again",
        "Letting an old number back into my phone",
        "Skipping the monthly look at my plan",
        "Keeping a secret from everybody who'd care",
      ],
      supportPeople: [
        "Someone who'll back me up when I say no",
        "The person I'd call from outside a bad situation",
        "My sponsor, before I agree to something",
        "A housemate or family member who sees my schedule",
        "My counselor, about the pressure I'm under",
      ],
      todayActions: [
        "Say no to the one thing that puts this at risk",
        "Protect tonight's sleep — nothing after 10pm",
        "Delete or block the contact I keep looking at",
        "Book fifteen minutes this month to reread my plan",
      ],
    },
    activityChoices: [
      {
        label: "Say no to the thing I already know is risky",
        feedback:
          "The no is uncomfortable for about a day. The yes can cost you a year, and you usually know which one this is before you ask.",
      },
      {
        label: "Guard my sleep tonight, whatever else happens",
        feedback:
          "Short sleep makes every other decision worse. It's the least dramatic protection you have and the one that fails first.",
      },
      {
        label: "Get the person I don't trust out of my week",
        feedback:
          "Distance is a legitimate tool, not a punishment you're handing out. You can keep it quiet and still keep it firm.",
      },
      {
        label: "Reread my plan and see what needs changing",
        feedback:
          "A plan built for month two often doesn't fit month twenty. Reviewing it is maintenance, not doubt about how you're doing.",
      },
    ],
  },
  {
    lessonId: "living-recovery-what-do-i-do-when-life-gets-hard-again",
    checkIn: "Think of the last hard week you had. What did you do first?",
    adelQuestion:
      "What's the earliest sign, for you, that something has gone wrong — before anyone else would notice?",
    adelReflection:
      "The next hard thing is coming whether or not you're ready, and being ready is not about bracing. It's about knowing, in advance, the first two phone calls you'll make and the one thing you won't do.",
    toolFlow: {
      warningSigns: [
        "Going quiet with everybody at the same time",
        "Handling it alone because people have enough going on",
        "Waiting until it's an emergency to say anything",
        "Cancelling appointments in a bad week",
        "Thinking about using as a way to get through it",
      ],
      supportPeople: [
        "The first call I'd make at 2am",
        "Someone who's been through this exact thing",
        "My counselor, for an earlier appointment",
        "A peer specialist who can sit with me through it",
        "The crisis line, if it's the middle of the night",
      ],
      todayActions: [
        "Write down my first two calls and keep them in my phone",
        "Tell one person what's coming before it lands",
        "Move my next appointment earlier instead of later",
        "Name the one thing I will not do this week, no matter what",
      ],
    },
    activityChoices: [
      {
        label: "Make the call before it gets worse",
        feedback:
          "Early calls are short and awkward. Late calls are long and expensive, and by then you're deciding while flooded.",
      },
      {
        label: "Use the skill that worked last time",
        feedback:
          "You already have evidence about what helps you specifically. A hard week is not the time to test something new.",
      },
      {
        label: "Cut this week down to the essentials",
        feedback:
          "Sleep, food, meds, one person, one appointment. Dropping everything else is a strategy, not a failure.",
      },
      {
        label: "Push through and deal with it later",
        feedback:
          "Sometimes you do have to get through the day. Just set a time you'll come back to it, and tell someone what the plan is.",
      },
    ],
  },
  {
    lessonId: "living-recovery-how-should-i-celebrate-my-progress",
    checkIn: "How do you usually mark a milestone?",
    adelQuestion:
      "What's a milestone you passed without telling anyone, and what stopped you from saying it?",
    adelReflection:
      "Skipping the marker isn't modesty; it's how the whole thing starts to feel like nothing is happening. Saying the number out loud to one person is enough of a celebration to count.",
    toolFlow: {
      warningSigns: [
        "Letting the date pass without mentioning it",
        "Celebrating somewhere I know people will be using",
        "Deciding it doesn't count because of one bad day",
        "Turning the milestone into a reason to test myself",
        "Marking it alone because it feels like bragging",
      ],
      supportPeople: [
        "The person who'd be proudest to hear it",
        "My home group, for the chip or the mention",
        "Someone from my family who's been waiting",
        "A peer who's got a date close to mine",
        "My sponsor, who's been counting anyway",
      ],
      todayActions: [
        "Tell one person the number out loud today",
        "Plan the milestone somewhere alcohol isn't the point",
        "Do the sober thing I've been meaning to treat myself to",
        "Write the date down where I'll see it next year",
      ],
    },
    activityChoices: [
      {
        label: "Tell someone the number out loud",
        feedback:
          "Saying it makes it real and gives someone else the chance to be glad about it. It takes about ten seconds.",
      },
      {
        label: "Pick something sober I actually enjoy",
        feedback:
          "The reward should be something you'd genuinely look forward to. A milestone marked with something dull tends not to get marked again.",
      },
      {
        label: "Take the chip at my home group",
        feedback:
          "Standing up for it is uncomfortable and useful — it puts the date on the record with people who'll remember it.",
      },
      {
        label: "Keep it to myself this time",
        feedback:
          "That's your call, and privacy is allowed. Note the date somewhere anyway, so future you can see the whole run of them.",
      },
    ],
  },
  {
    lessonId: "living-recovery-how-far-have-i-come",
    checkIn: "Which of these is true now that wasn't true a year ago?",
    adelQuestion:
      "What could you not do six months ago that you did last week without thinking about it?",
    adelReflection:
      "Progress is invisible from the inside because the new normal stops feeling new almost immediately. The way to see it is to compare specific weeks, not general feelings.",
    toolFlow: {
      warningSigns: [
        "Measuring myself against someone with ten years",
        "Counting only the days I got wrong",
        "Saying nothing has changed while everything has",
        "Forgetting what week one actually felt like",
        "Waiting to feel proud before I admit it's progress",
      ],
      supportPeople: [
        "Someone who knew me before and knows me now",
        "A peer who started around the same time",
        "My counselor, who has the notes from the start",
        "A family member who noticed something changed",
        "Whoever I called on my worst night",
      ],
      todayActions: [
        "Write down three things that are different from a year ago",
        "Reread what I wrote in my first lessons",
        "Ask someone what they've seen change in me",
        "Count the skills I use now without thinking",
      ],
    },
    activityChoices: [
      {
        label: "Compare this week to my first week, specifically",
        feedback:
          "Week to week, with details — where you slept, who you spoke to — is the comparison that shows something. Vague before-and-after doesn't.",
      },
      {
        label: "Ask someone what they've seen change",
        feedback:
          "Other people track your progress more accurately than you do, because they aren't grading you from inside a bad afternoon.",
      },
      {
        label: "List the things I do now without effort",
        feedback:
          "Every automatic thing on that list was hard once. That's the clearest evidence there is, and it's easy to overlook.",
      },
      {
        label: "Focus on what still isn't fixed",
        feedback:
          "There's real work left, and naming it is fine. Just don't let the unfinished list erase the finished one — hold both.",
      },
    ],
  },
  {
    lessonId: "living-recovery-my-lifelong-recovery-plan",
    checkIn: "Which parts of a long-term plan do you already have written down?",
    adelQuestion:
      "If somebody had to step in and help you tomorrow, what would they need to know that isn't written anywhere yet?",
    adelReflection:
      "A plan that lives in your head only works on the days your head is working. Written down and handed to one person, it keeps working on the days it doesn't.",
    toolFlow: {
      warningSigns: [
        "The plan exists but nobody else has seen it",
        "Not updating it after everything changed",
        "Leaving the warning-signs section blank",
        "Writing it for who I was, not who I am now",
        "Losing the copy and never making another",
      ],
      supportPeople: [
        "The one person who gets a copy",
        "My sponsor, to read it and push back",
        "My counselor, for the clinical parts",
        "A family member who'd act on it if needed",
        "Someone who'll ask me about it in three months",
      ],
      todayActions: [
        "Fill in the section I keep leaving blank",
        "Give a copy to the person who'd need it",
        "Set a reminder to reread it in three months",
        "Write one sentence on why I'm doing this at all",
      ],
    },
    activityChoices: [
      {
        label: "Write the warning signs down while I'm steady",
        feedback:
          "You can see them clearly today; you won't be able to in a bad week. That's exactly why the list gets made now.",
      },
      {
        label: "Give a copy to one person I trust",
        feedback:
          "A plan somebody else has read can be used when you're not the one making decisions. Alone in a drawer it's just paper.",
      },
      {
        label: "Add the reason I'm doing this at all",
        feedback:
          "Purpose is the part that carries the plan on the days the routines feel pointless. One honest sentence is enough.",
      },
      {
        label: "Set a date to look at it again",
        feedback:
          "Plans go stale as your life changes. A reminder every few months turns it into something living instead of a one-off exercise.",
      },
    ],
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredLivingRecoveryBody(
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

export function seedAuthoredLivingRecoveryLessons(): void {
  for (const entry of LIVING_RECOVERY_FIELDS) {
    const body = authoredLivingRecoveryBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: LIVING_RECOVERY_AUTHOR.staffId,
        name: LIVING_RECOVERY_AUTHOR.name,
        role: LIVING_RECOVERY_AUTHOR.role,
      },
      atISO: LIVING_RECOVERY_AUTHOR.onISO,
      note: LIVING_RECOVERY_AUTHOR.note,
      overridesBaseline: true,
    });
  }
}

seedAuthoredLivingRecoveryLessons();
