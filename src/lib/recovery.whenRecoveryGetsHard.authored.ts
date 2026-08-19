// §Content-authoring pass Batch 7 — MODULE 7 "When Recovery Gets Hard",
// AUTHORED.
//
// WHAT THE GATE FOUND, precisely. Running the Batch 1 quality gate
// (`originalityErrors`) over the ten live lessons of `when-recovery-gets-hard`
// flagged, for real:
//   • 10 of 10 `checkIn`        — "Right now, how much is <problem> a struggle
//     for you?"
//   • 10 of 10 `adelReflection` — "Adel can help you go deeper on <title> …"
//   • 10 of 10 `adelQuestion`   — "What part of this feels hardest for you?"
// Three flags on every lesson, no clean exceptions — the same shape as
// Modules 3, 4, 5 and 6.
//
// WHAT THE TOOL-FLOW MEASUREMENT FOUND (arrays; the gate only reads free text):
//   • `warningSigns`  — 1 distinct set across 10 lessons.
//   • `supportPeople` — 1 distinct set across 10 lessons.
//   • `todayActions`  — DISTINCT ONLY IN THE FIRST ENTRY: 10 nominally distinct
//     sets, but entries 2–5 ("Attend a meeting / Call someone who supports me /
//     Practice my recovery skill / Complete one important task") byte-identical
//     in all ten, so the tail collapses to 1. Six modules for six.
//
// WHAT THE ACTIVITY-CHOICE CHECK FOUND (standard scope since Batch 6):
//   • All ten activities are `kind: "decision"` and all ten carry the SAME four
//     labels in the same order — "Call my sponsor immediately / Leave and go
//     somewhere safe / Open my relapse prevention plan / Get to a meeting
//     today". Only the feedback paraphrases differ. Re-authored per lesson.
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight`, and each
// activity's `kind`, `title` and `prompt` pass the gate and are carried through
// verbatim by clone; only `activity.choices` is replaced.
//
// TONE. This module is about slips, relapse risk and coming back, so every line
// here is written shame-free and keeps the established reflection shape: name
// the hard true thing first, then give real credit. No line implies a slip is a
// verdict, and none of them asks a 1–10 scale question. Questions anchor to a
// concrete warning sign or a concrete moment — a night you stopped answering,
// the last thing you told yourself before it got loud — rather than to feelings
// in the abstract.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const WHEN_RECOVERY_GETS_HARD_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Module 7 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, distinct warning signs, support people and today-actions, plus a decision-activity choice set written for each lesson instead of the four labels all ten shared.",
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

export const WHEN_RECOVERY_GETS_HARD_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "when-recovery-gets-hard-how-do-i-know-i-m-slipping",
    checkIn: "Think back over the last two weeks. Which of these showed up in you before you noticed it?",
    adelQuestion:
      "Who was the last person you didn't call back, and what were you telling yourself when you let it ring?",
    adelReflection:
      "The signs almost never announce themselves; they just look like being busy or being tired. You noticing one at all is the whole skill, and you already used it to get here.",
    toolFlow: {
      warningSigns: [
        "Letting calls ring out from people who check on me",
        "Sleeping through the part of the day I used to use",
        "Telling small lies that don't get me anything",
        "Driving a route I said I wouldn't drive",
        "Feeling fine in a way that doesn't match my week",
      ],
      supportPeople: [
        "The one person who notices when I go quiet",
        "My sponsor, even just a text",
        "A peer specialist who has seen me slide before",
        "My counselor at my next visit",
        "Someone in my house who sees me daily",
      ],
      todayActions: [
        "Write down the three signs that show up first in me",
        "Answer the call I've been letting ring",
        "Tell one person which sign to watch for in me",
        "Put my three signs somewhere I'll see them tomorrow",
      ],
    },
    activityChoices: [
      {
        label: "Say the restless feeling out loud to someone",
        feedback:
          "Restlessness that stays in your head keeps growing. Said out loud to one person, it usually turns back into a bad afternoon instead of a turning point.",
      },
      {
        label: "Text the person I've been avoiding all week",
        feedback:
          "The avoiding is the sign, not the mood. A three-word text breaks the isolating before it has a chance to finish the job.",
      },
      {
        label: "Change what I'm doing for the next hour",
        feedback:
          "You don't have to fix the day. Moving your body somewhere else for an hour is often enough to let the wave pass.",
      },
      {
        label: "Wait and see if it passes on its own",
        feedback:
          "Sometimes it does. But waiting alone is exactly the pattern this lesson is about, so if you choose it, set a time to check in with someone anyway.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-what-happens-before-a-relapse",
    checkIn: "Relapse runs on a chain. Which link do you tend to reach first?",
    adelQuestion:
      "Walk me back through the last close call — what happened the day before it, not the hour before it?",
    adelReflection:
      "Most people can name the last link and none of the earlier ones, because the earlier ones felt like nothing. Tracing it backward the way you just did is the part that makes the chain breakable.",
    toolFlow: {
      warningSigns: [
        "Resentment I keep re-arguing in my head",
        "Skipping the meeting I always go to",
        "Getting short with people over nothing",
        "Making a plan that quietly puts me near it",
        "Deciding I don't need to tell anyone",
      ],
      supportPeople: [
        "Someone who was around during my last chain",
        "A group I can walk into unannounced",
        "My case manager, before it gets loud",
        "A friend from treatment who talks straight",
        "The crisis line if the chain is already moving",
      ],
      todayActions: [
        "Name the link where I usually get stuck",
        "Undo one plan that puts me near a risk",
        "Tell someone which link is next for me",
        "Go to the meeting I skipped last time",
      ],
    },
    activityChoices: [
      {
        label: "Name the feeling before I do anything with it",
        feedback:
          "Emotional unease is the first link. Naming it — bored, wronged, lonely — costs nothing and stops it from renaming itself as a craving.",
      },
      {
        label: "Look at my week for what set this off",
        feedback:
          "The trigger is usually two days back, not right now. Finding it turns a vague dread into a specific thing you can actually deal with.",
      },
      {
        label: "Go to the meeting I was about to skip",
        feedback:
          "Skipping is often the second link. Going anyway breaks the chain at the point where breaking it still costs you nothing but an hour.",
      },
      {
        label: "Push through and keep it to myself",
        feedback:
          "Keeping it in is how a link becomes a chain. If you go this way, at least write down what you're carrying so it's not only in your head.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-what-should-i-do-when-my-thoughts-change",
    checkIn: "When the memory shows up, which version does your mind hand you first?",
    adelQuestion:
      "When you play the tape all the way to the end, what's the scene it always stops on?",
    adelReflection:
      "The memory is real; it's just edited, and it cuts before the part that cost you everything. Being willing to run it to the end is not being hard on yourself — it's refusing to be lied to.",
    toolFlow: {
      warningSigns: [
        "Remembering the first hour and none of the rest",
        "Arguing that this time would be different",
        "Looking up an old contact for no reason",
        "Telling the story like it was funny",
        "Keeping the thought to myself all day",
      ],
      supportPeople: [
        "Someone who was there for the ending, not the start",
        "My sponsor, to tell on the thought",
        "A peer who's had the same thought this month",
        "My counselor, if it keeps coming back",
        "Anyone who'll pick up right now",
      ],
      todayActions: [
        "Say one using thought out loud to someone today",
        "Write the last scene of the tape down",
        "Delete the contact I looked up",
        "Tell the honest version of that story once",
      ],
    },
    activityChoices: [
      {
        label: "Play the tape past the good part",
        feedback:
          "The thought only survives on the edit. Running it through the morning after, the phone calls, the cost, puts it back in proportion in about a minute.",
      },
      {
        label: "Tell on the thought to one person",
        feedback:
          "Said out loud, it stops being a secret plan and goes back to being a thought. Most people find it loses most of its pull immediately.",
      },
      {
        label: "Write down what it's really offering me",
        feedback:
          "Usually it's relief, or quiet, or an hour off from being you. Once you name that, you can go looking for it somewhere that doesn't cost you the year.",
      },
      {
        label: "Distract myself and hope it fades",
        feedback:
          "Distraction can work for a single wave. It works less well the third time in a day, so if it comes back, tell someone rather than out-waiting it alone.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-how-do-i-get-through-high-risk-situation",
    checkIn: "Which place on this list are you going to end up in anyway this month?",
    adelQuestion:
      "For the one you can't skip — how are you getting out of there, and who else knows the plan?",
    adelReflection:
      "Having to go somewhere risky isn't a failure of planning; some of these places are family, or work, or the only ride you've got. Deciding the exit before you walk in is what keeps it survivable.",
    toolFlow: {
      warningSigns: [
        "Going somewhere without knowing how I get home",
        "Being the only sober person in the room",
        "Staying past the point I said I'd leave",
        "Not telling anyone where I'll be",
        "Riding with someone who's using",
      ],
      supportPeople: [
        "Someone sober who'll come with me",
        "A person I can call for a ride at any hour",
        "The friend who'll text me a fake emergency",
        "My sponsor, before I go and after I leave",
        "Whoever I'm staying with, so they know my plan",
      ],
      todayActions: [
        "Plan the exit for one event this month",
        "Line up a ride that doesn't depend on anyone using",
        "Ask one sober person to come with me",
        "Set the time I'm leaving before I arrive",
      ],
    },
    activityChoices: [
      {
        label: "Leave now and sort out the reason later",
        feedback:
          "You never owe anyone a good explanation for leaving a room. Getting out first and explaining after is the version that keeps working.",
      },
      {
        label: "Call the ride I lined up before I came",
        feedback:
          "This is why the ride exists. The plan you made when you were calm is smarter than the one you'd make standing there.",
      },
      {
        label: "Move next to the person I came with",
        feedback:
          "Physical proximity to a sober person changes what's possible in the next ten minutes. It's a small move that does real work.",
      },
      {
        label: "Stay, but stop drinking anything handed to me",
        feedback:
          "It reduces one risk and leaves the bigger one — being there. Fine as a stopgap while your ride comes, not as the whole plan.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-what-if-i-slip",
    checkIn: "If it happened tonight, what's the first thing you'd actually do?",
    adelQuestion: "Who would you want to tell first, and what are you afraid they'd say?",
    adelReflection:
      "The scariest part of a slip is usually the telling, not the using — and the hours spent hiding it are what turn one night into a month. You're planning for it before it happens, which is the opposite of giving up.",
    toolFlow: {
      warningSigns: [
        "Getting somewhere I can't be found",
        "Deleting messages so no one asks",
        "Using alone with the door locked",
        "Deciding I'll tell them once I've stopped",
        "Skipping my next appointment on purpose",
      ],
      supportPeople: [
        "The person I already decided I'd call first",
        "My prescriber, about what I took",
        "Someone who carries naloxone",
        "My sponsor, same day, not next week",
        "911 if I can't tell how much I took",
      ],
      todayActions: [
        "Save my slip-response steps where I can find them",
        "Decide now who my first call is",
        "Check that someone near me has naloxone",
        "Tell one person a slip won't end our contact",
      ],
    },
    activityChoices: [
      {
        label: "Get somewhere I'm not alone",
        feedback:
          "Alone is what makes a slip dangerous, not just secret. Being near one other person is the single biggest thing you can change in that hour.",
      },
      {
        label: "Make the call I said I'd make",
        feedback:
          "This is the whole reason you chose someone in advance. You don't have to explain well — you just have to say it happened.",
      },
      {
        label: "Tell my care team before my next visit",
        feedback:
          "Nothing here punishes you for saying it. Telling early means your dose and your plan get adjusted while it still matters.",
      },
      {
        label: "Clean up first and tell them next week",
        feedback:
          "That week is where most slips turn into relapses. If you can't call tonight, at least tell one person you're not okay, without the details.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-how-do-i-start-again",
    checkIn: "Starting again runs on the basics. Which one has been gone the longest?",
    adelQuestion: "What's the smallest thing you could do before you sleep tonight that counts as day one?",
    adelReflection:
      "Coming back feels like admitting the whole thing collapsed, and it almost never has — usually sleep went, then meals, then everyone else. Picking one of them back up tonight is a real restart, not a consolation prize.",
    toolFlow: {
      warningSigns: [
        "Eating once a day or not at all",
        "Being awake at the hours I used to use",
        "Not having spoken to anyone in recovery this week",
        "Letting my prescription run out",
        "Waiting for Monday to start over",
      ],
      supportPeople: [
        "Someone who'll eat a meal with me",
        "The meeting that doesn't care that I've been gone",
        "My prescriber, about the refill",
        "A peer who's restarted more than once",
        "My case manager, to get me back on the calendar",
      ],
      todayActions: [
        "Do one basics thing before I sleep tonight",
        "Eat a real meal today, even a small one",
        "Walk into the meeting I stopped going to",
        "Book the refill I've been putting off",
      ],
    },
    activityChoices: [
      {
        label: "Eat something and go to bed at a normal hour",
        feedback:
          "Unglamorous and it works. Sleep and food are what make tomorrow's decisions possible; almost nothing else improves until they do.",
      },
      {
        label: "Go back to the meeting I stopped attending",
        feedback:
          "Walking back in is the hardest ten seconds and then it's over. Nobody there is keeping score of how long you were gone.",
      },
      {
        label: "Call one person and say I'm starting over",
        feedback:
          "Saying it to someone makes it a start date instead of an intention. It also gives one person a reason to check on you Thursday.",
      },
      {
        label: "Write the whole plan out before I do anything",
        feedback:
          "A plan is useful, but planning can also be a way of not starting. Write it if you want — then still do one basic thing tonight.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-when-should-i-ask-for-help",
    checkIn: "You usually know before you ask. What's the signal that tells you it's time?",
    adelQuestion: "What would have to get worse before you'd let yourself ask — and why that line?",
    adelReflection:
      "Most people set the bar for asking somewhere just past where they can still be helped easily. Wondering whether it's time is the answer, and you're already wondering.",
    toolFlow: {
      warningSigns: [
        "Rehearsing the ask and never sending it",
        "Saying I'm fine three times in one day",
        "Deciding other people have it worse",
        "Waiting until after the weekend to reach out",
        "Only asking once I'm already in trouble",
      ],
      supportPeople: [
        "The person who never makes it awkward",
        "My sponsor, for the small stuff too",
        "A peer specialist who's easy to text",
        "My counselor, between scheduled visits",
        "The warm line when nobody else picks up",
      ],
      todayActions: [
        "Reach out before I think I need to",
        "Send the message I've been rewriting",
        "Ask one person for something small today",
        "Set my own rule for when I ask",
      ],
    },
    activityChoices: [
      {
        label: "Send the message without polishing it",
        feedback:
          "The perfect wording is the delay. \"Struggling today\" gets you the same help as three careful paragraphs, and it gets it sooner.",
      },
      {
        label: "Ask for something small instead of everything",
        feedback:
          "A ride, a coffee, ten minutes. Small asks are easier to make and they keep the line open for the bigger one later.",
      },
      {
        label: "Tell someone the truth when they ask how I am",
        feedback:
          "You don't always have to start the conversation. Answering one \"how are you\" honestly does most of the work of asking.",
      },
      {
        label: "Handle it myself and ask if it gets worse",
        feedback:
          "Sometimes that's right. Just name now what \"worse\" means, out loud to someone, so the line doesn't quietly move on you.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-which-recovery-tools-work-best-for-me",
    checkIn: "Which of these has actually worked for you in the last month — not in theory?",
    adelQuestion: "Which tool everyone recommends have you honestly never used, and what happens instead?",
    adelReflection:
      "A tool that works for the room and not for you isn't your failure, and pretending it works costs you the moment you needed it. Knowing which three you'd really reach for beats owning a long list.",
    toolFlow: {
      warningSigns: [
        "Saying I have tools but not using one this week",
        "Only using a tool after the urge peaks",
        "Reaching for something that stopped working months ago",
        "Not being able to name a tool when asked",
        "Keeping my tools somewhere I can't get to them",
      ],
      supportPeople: [
        "Someone who'll ask which tool I used",
        "A peer with a different set than mine",
        "My counselor, to swap out what's stale",
        "The group where people say what actually works",
        "My sponsor, to practice one with me",
      ],
      todayActions: [
        "Pick the three tools I'd really reach for",
        "Use one of them today, not just list it",
        "Drop a tool that stopped working for me",
        "Put my top tool somewhere I can reach in a minute",
      ],
    },
    activityChoices: [
      {
        label: "Use the one tool I know works for me",
        feedback:
          "Stress is the wrong time to try something new. Go with the one that has actually worked, even if it's the boring one.",
      },
      {
        label: "Call the person who is my real tool",
        feedback:
          "For a lot of people the tool is a name, not a technique. If that's you, say so plainly instead of trying to breathe through it alone.",
      },
      {
        label: "Try the one I keep meaning to use",
        feedback:
          "Worth doing, but not as your only move right now. Pair it with something proven so you're not testing a theory mid-craving.",
      },
      {
        label: "Do nothing and wait for the wave to drop",
        feedback:
          "Urges do peak and fall. Riding it out counts as a tool — as long as you're not somewhere the wave can reach anything.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-how-do-i-celebrate-small-wins",
    checkIn: "Something went right this week and you probably moved straight past it. Which was it?",
    adelQuestion: "What did you do this week that the you of six months ago couldn't have pulled off?",
    adelReflection:
      "Skipping past a win isn't modesty; it's an old habit of only counting the misses, and it starves the part of you that's doing the work. Naming one out loud is small and it genuinely changes what your brain repeats.",
    toolFlow: {
      warningSigns: [
        "Calling a good week luck instead of effort",
        "Only telling people what went wrong",
        "Comparing my month to someone else's year",
        "Moving the goalposts as soon as I reach them",
        "Feeling uneasy when something goes well",
      ],
      supportPeople: [
        "Someone who's glad for me without making it a speech",
        "A peer whose wins I also notice",
        "My kids or family, if it's safe to share",
        "My sponsor, who remembers where I started",
        "The group, when they ask how the week went",
      ],
      todayActions: [
        "Name one win out loud today",
        "Text someone the thing that went right",
        "Write this week's win where I'll reread it",
        "Say thank you to the person who helped it happen",
      ],
    },
    activityChoices: [
      {
        label: "Say out loud what I just did differently",
        feedback:
          "Naming it is what makes it stick. \"I walked out instead of staying\" tells your brain exactly which move to repeat.",
      },
      {
        label: "Tell one person before the day ends",
        feedback:
          "Shared wins land harder than private ones. Pick someone who won't turn it into advice.",
      },
      {
        label: "Write it on my wins list",
        feedback:
          "A list matters most on the bad weeks, when you can't remember any of this happened. Two lines is enough.",
      },
      {
        label: "Move on, it wasn't a big deal",
        feedback:
          "It was, though. If saying so feels like too much, just write the date and what you did and leave it at that.",
      },
    ],
  },
  {
    lessonId: "when-recovery-gets-hard-building-my-relapse-prevention-plan",
    checkIn: "A plan needs all its parts. Which part of yours is still blank?",
    adelQuestion: "Which two people are getting a copy, and when are they going to hear from you next?",
    adelReflection:
      "A plan nobody else has seen is a private hope, and hopes don't answer the phone at eleven at night. Putting two real names on it is what turns the page into something that works when you can't think.",
    toolFlow: {
      warningSigns: [
        "A plan that's still only in my head",
        "Not having updated it after a hard week",
        "Names on it I haven't spoken to in months",
        "No emergency step for after hours",
        "Not knowing where the plan physically is",
      ],
      supportPeople: [
        "The first of my two plan-holders",
        "The second, so it isn't one person's job",
        "My care team, to check the medical steps",
        "Someone who'll reread it with me monthly",
        "The 24-hour line listed on the plan",
      ],
      todayActions: [
        "Share my plan with one person today",
        "Fill in the part I've left blank",
        "Update it for what happened last hard week",
        "Put the plan where I could find it in the dark",
      ],
    },
    activityChoices: [
      {
        label: "Open the plan and do step one",
        feedback:
          "This is the moment it was written for. You don't have to read the whole thing — the first step is enough right now.",
      },
      {
        label: "Call the first name on my plan",
        feedback:
          "You chose that name when you were clear-headed. Trust the version of you that picked them.",
      },
      {
        label: "Use the emergency step I wrote for after hours",
        feedback:
          "Late nights are exactly why that line is on the page. Using it isn't an overreaction, it's the plan working.",
      },
      {
        label: "Try to ride it out and update the plan tomorrow",
        feedback:
          "If you ride it out, don't do it silently — text one plan-holder that it's a hard night, then update the page in the morning.",
      },
    ],
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredWhenRecoveryGetsHardBody(
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

export function seedAuthoredWhenRecoveryGetsHardLessons(): void {
  for (const entry of WHEN_RECOVERY_GETS_HARD_FIELDS) {
    const body = authoredWhenRecoveryGetsHardBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: WHEN_RECOVERY_GETS_HARD_AUTHOR.staffId,
        name: WHEN_RECOVERY_GETS_HARD_AUTHOR.name,
        role: WHEN_RECOVERY_GETS_HARD_AUTHOR.role,
      },
      atISO: WHEN_RECOVERY_GETS_HARD_AUTHOR.onISO,
      note: WHEN_RECOVERY_GETS_HARD_AUTHOR.note,
      overridesBaseline: true,
    });
  }
}

seedAuthoredWhenRecoveryGetsHardLessons();
