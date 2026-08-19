// §Content-authoring pass Batch 6 — MODULE 6 "Building a Life That Works",
// AUTHORED.
//
// WHAT THE GATE FOUND, precisely. Running the Batch 1 quality gate
// (`originalityErrors`, reached through `RECOVERY_LESSON_TYPE.validate`) over
// the ten live lessons of `building-a-life-that-works` flagged, for real:
//   • 10 of 10 `adelQuestion`   — "What part of this feels hardest for you?"
//   • 10 of 10 `adelReflection` — "Adel can help you go deeper on <title> …"
//   • 10 of 10 `checkIn` — "Right now, how much is <problem> a struggle for
//     you?" — three flags on every lesson, no clean exceptions. Identical
//     shape to Modules 3, 4 and 5.
//
// WHAT THE TOOL-FLOW MEASUREMENT FOUND (arrays; the gate only reads free text):
//   • `warningSigns`  — 1 distinct set across 10 lessons.
//   • `supportPeople` — 1 distinct set across 10 lessons.
//   • `todayActions`  — DISTINCT ONLY IN THE FIRST ENTRY again: entries 2–5
//     ("Attend a meeting / Call someone who supports me / Practice my recovery
//     skill / Complete one important task") were byte-identical in all ten.
//     Five modules for five — the pattern holds.
//
// WHAT THE NEW ACTIVITY-CHOICE CHECK FOUND (the gap Batch 5 surfaced):
//   • All ten lessons are `kind: "decision"` and all ten carry the SAME four
//     choice labels, in the same order — "Make the call anyway / Ask my case
//     manager for help / Break it into one 10-minute step / Bring someone with
//     me". Only the per-choice `feedback` text varies, and it varies by
//     paraphrase, not by content. A patient working the module straight
//     through is offered the identical four buttons ten times. Fixed here:
//     each lesson gets four choices written for its own real decision
//     (a lease, a shift, a bank balance, a bus, a clinic, a Tuesday).
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight` and each
// activity's `title`/`prompt` pass the gate and are carried through verbatim by
// clone; only `activity.choices` is replaced.
//
// VOICE, continuous with Modules 1–5: second person, present tense, concrete
// nouns, no clinical register, no 1–10 scale questions. Because this module is
// about stability, every question anchors to a countable real thing — a bill
// with a date on it, a shift, a balance, a bus that leaves at a time — the way
// Module 4 anchored to hours, meals and beds.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const BUILDING_A_LIFE_THAT_WORKS_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Module 6 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, distinct warning signs, support people and today-actions, plus a decision-activity choice set written for each lesson instead of the four labels all ten shared.",
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

export const BUILDING_A_LIFE_THAT_WORKS_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "building-a-life-that-works-where-am-i-going-to-live",
    checkIn: "Where are you sleeping tonight, and do you know where you're sleeping thirty nights from now?",
    adelQuestion: "Whose name is on the place you're staying, and what happens to you if they change their mind?",
    adelReflection:
      "A couch is a roof, but it's someone else's roof, and part of you is doing math about it every night. Naming the date it runs out is not pessimism — it's the only way to beat it there.",
    toolFlow: {
      warningSigns: [
        "Not knowing where I sleep past this week",
        "Avoiding the person whose place I'm staying at",
        "Missing a housing appointment because I felt embarrassed",
        "Keeping my things in a bag by the door",
        "Telling people I'm fine when I have nowhere Friday",
      ],
      supportPeople: [
        "My case manager, about the housing list",
        "The reentry housing coordinator",
        "Whoever's roof I'm under right now",
        "Someone who'll drive me to an intake appointment",
        "The Adelante care team",
      ],
      todayActions: [
        "Call one housing program and ask what they need from me",
        "Put my ID and papers in one envelope I can grab",
        "Ask the person I'm staying with how long is really okay",
        "Write down the date my current place runs out",
      ],
    },
    activityChoices: [
      {
        label: "Call the housing program before it closes today",
        feedback:
          "Most intake lines stop answering mid-afternoon. Calling while they're open beats a perfect plan you make at nine tonight.",
      },
      {
        label: "Ask my case manager which list to get on first",
        feedback:
          "There's usually an order — emergency beds, then recovery housing, then a waitlist. Your case manager knows the order, and getting it wrong costs you weeks.",
      },
      {
        label: "Put my ID, papers and any letters in one envelope",
        feedback:
          "Every housing door asks for the same documents. Ten minutes now means you don't lose a bed because your ID was in someone else's car.",
      },
      {
        label: "Ask the person I'm staying with for a real end date",
        feedback:
          "It's an uncomfortable question and it buys you time. Knowing you have eleven days is very different from finding out you had two.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-how-do-i-find-a-job",
    checkIn: "What's the one sentence about your record you'd rather not have to say out loud?",
    adelQuestion: "What work have you actually done — paid or not — that you'd be willing to be judged on?",
    adelReflection:
      "The gap on the application is not the part that sinks you; the flinch is. Say the short true version, then say what you've done since, and let them decide instead of deciding for them.",
    toolFlow: {
      warningSigns: [
        "Skipping an application because of the background question",
        "Talking myself out of a job before applying",
        "No-showing an interview I set up",
        "Getting angry at the first no",
        "Working so many hours I drop everything else",
      ],
      supportPeople: [
        "The reentry employment worker",
        "Someone who'll sit through a practice interview with me",
        "A fair-chance employer someone I know has worked for",
        "My parole or probation officer, about what I can hold",
        "The Adelante care team",
      ],
      todayActions: [
        "Say my record sentence out loud once, to one person",
        "Apply to one place that hires fair-chance",
        "Write down three jobs I've actually done",
        "Ask a staffing agency what they have this week",
      ],
    },
    activityChoices: [
      {
        label: "Say the short version and stop talking",
        feedback:
          "Two sentences, past tense, then quiet. Over-explaining reads as something to hide even when there isn't.",
      },
      {
        label: "Practice the answer once before I need it",
        feedback:
          "You'll say it better the third time than the first. Do the first two somewhere that doesn't cost you a job.",
      },
      {
        label: "Ask if they're a fair-chance employer before I go in",
        feedback:
          "Some places won't hire you no matter how the answer goes. Finding that out on the phone saves you a bus fare and a bad afternoon.",
      },
      {
        label: "Answer, then move it to what I can do now",
        feedback:
          "You can't change the record. You can change what the last thing said in the room is — and it should be the work.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-how-do-i-manage-my-money",
    checkIn: "What's in your pocket right now, and what's the next bill with a date on it?",
    adelQuestion: "The last time you had cash on you, where did it go in the first forty-eight hours?",
    adelReflection:
      "Cash in a pocket is a countdown for a lot of people, and pretending it isn't is how the money disappears before rent does. Moving it somewhere with friction — an account, a bill paid early, someone holding it — beats willpower on a hard night.",
    toolFlow: {
      warningSigns: [
        "Carrying more cash than I need for the day",
        "Not knowing what's in my account",
        "Paying for other people to keep the peace",
        "Borrowing from someone I owe already",
        "Avoiding opening the mail",
      ],
      supportPeople: [
        "Someone I trust to hold money for a week",
        "My case manager, about a benefits appointment",
        "The credit union's front counter",
        "A sponsor who's been broke and stayed clean",
        "The Adelante care team",
      ],
      todayActions: [
        "Write down what I spent yesterday, every line",
        "Pay the bill with the closest due date",
        "Move anything I don't need today out of my pocket",
        "Check my actual balance instead of guessing",
      ],
    },
    activityChoices: [
      {
        label: "Pay the bill that's due first, right now",
        feedback:
          "Money spent on paper you already owe never feels good and always works. The urge is loudest before the bill is paid.",
      },
      {
        label: "Put most of it somewhere I can't reach tonight",
        feedback:
          "Distance beats discipline at eleven at night. An account, an envelope with someone else, a prepaid card — anything with a step in front of it.",
      },
      {
        label: "Hand it to the person who agreed to hold it",
        feedback:
          "This only works if you set it up before payday, and if it's someone who won't hand it back when you ask twice.",
      },
      {
        label: "Split it into needs, savings, and a small amount for me",
        feedback:
          "A budget with nothing fun in it is a budget you'll quit by Thursday. Name the small amount so the rest stays where it is.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-should-i-go-back-to-school",
    checkIn: "What's the thing you'd want to be able to do that you can't get hired for yet?",
    adelQuestion: "What made you stop last time you were in a classroom, and is that thing still true?",
    adelReflection:
      "School sounds like four years and a debt, and mostly it's twelve weeks and a certificate that changes what your name gets you on an application. Look up one program's real length and real cost before you decide you can't.",
    toolFlow: {
      warningSigns: [
        "Deciding I'm not smart enough before I look anything up",
        "Missing the enrollment date because I didn't ask",
        "Signing up for more classes than my week holds",
        "Skipping the financial aid appointment",
        "Going quiet when the coursework gets hard",
      ],
      supportPeople: [
        "The college's reentry or EOPS counselor",
        "Someone who finished a program I'm looking at",
        "My case manager, about fee waivers",
        "A friend who'll ask me if I turned it in",
        "The Adelante care team",
      ],
      todayActions: [
        "Look up one certificate's real length and cost",
        "Call the college and ask who helps people coming home",
        "Ask what the next enrollment date is",
        "Write down the one job the program leads to",
      ],
    },
    activityChoices: [
      {
        label: "Look up one twelve-week certificate, not a degree",
        feedback:
          "Short programs are the ones that finish. A certificate you complete beats a degree you drop in the second semester.",
      },
      {
        label: "Call and ask for the reentry counselor by name",
        feedback:
          "Every community college here has someone whose job is people coming home. General admissions won't tell you about the waivers they know about.",
      },
      {
        label: "Ask what it costs after financial aid, not before",
        feedback:
          "The sticker price talks people out of it. The number after aid and fee waivers is often close to nothing.",
      },
      {
        label: "Say out loud what job the class is supposed to get me",
        feedback:
          "If you can't name the job at the end, it's an idea, not a plan. Naming it also tells you which program to pick.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-how-do-i-get-where-i-need-to-go",
    checkIn: "What time is your next appointment, and how are you physically getting there?",
    adelQuestion: "Which ride fell through on you last, and what did missing it cost?",
    adelReflection:
      "Nobody misses an appointment on purpose; they miss the ride and the appointment goes with it. Booking the ride in the same minute you book the appointment is the whole fix, and it takes two extra minutes.",
    toolFlow: {
      warningSigns: [
        "Booking an appointment without knowing how I'll get there",
        "Waiting on a ride that's flaked before",
        "Leaving with no bus fare in my pocket",
        "Cancelling because the trip felt too complicated",
        "Only getting rides from people I shouldn't be around",
      ],
      supportPeople: [
        "My case manager, about bus passes or vouchers",
        "The clinic's transport line",
        "One person who's never left me standing",
        "Medi-Cal's ride benefit line",
        "The Adelante care team",
      ],
      todayActions: [
        "Book the ride for my next appointment now, not that morning",
        "Find out which bus goes there and when it leaves",
        "Ask what transportation help I qualify for",
        "Put bus fare somewhere separate from my other money",
      ],
    },
    activityChoices: [
      {
        label: "Book the ride while I'm still booking the appointment",
        feedback:
          "Two minutes now, on the same call. This is the single change that turns most no-shows into shows.",
      },
      {
        label: "Look up the bus and write down the departure time",
        feedback:
          "The bus is slower and it's yours. Knowing it leaves at 7:42 is different from knowing there's a bus.",
      },
      {
        label: "Ask the clinic what ride benefit I already have",
        feedback:
          "Medi-Cal covers rides to covered appointments and most people never use it. One question answers whether that's you.",
      },
      {
        label: "Line up a backup before the first ride falls through",
        feedback:
          "A second option costs one text today. Finding one at 8am the morning of is how the appointment gets lost.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-how-do-i-take-care-of-my-health",
    checkIn: "What have you been putting off getting looked at — the tooth, the cough, the thing you don't mention?",
    adelQuestion: "When did a doctor last know your name, and what would you want them to know first?",
    adelReflection:
      "Coverage sitting unused is the same as no coverage. One clinic, one doctor who sees you more than once, and the small stuff stops turning into the emergency-room stuff.",
    toolFlow: {
      warningSigns: [
        "Putting off something that hurts because I'm busy",
        "Not knowing whether my coverage is active",
        "Using the ER instead of a clinic",
        "Skipping medication because the refill ran out",
        "Not telling the doctor the real history",
      ],
      supportPeople: [
        "My primary care clinic's front desk",
        "The community health worker",
        "My case manager, about Medi-Cal being active",
        "The pharmacist who fills my prescriptions",
        "The Adelante care team",
      ],
      todayActions: [
        "Confirm my Medi-Cal is actually active",
        "Book the appointment for the thing I've been ignoring",
        "Pick one clinic and make it my regular one",
        "Ask about the dental benefit I already have",
      ],
    },
    activityChoices: [
      {
        label: "Check that my coverage is active before I book",
        feedback:
          "Coverage lapses quietly after release. Five minutes on the phone beats being turned away at the counter.",
      },
      {
        label: "Make the appointment for the thing that hurts",
        feedback:
          "The tooth doesn't get cheaper. Booking it while you're thinking about it is the only part you control today.",
      },
      {
        label: "Pick one clinic and go back to the same one",
        feedback:
          "A doctor who's seen you three times catches things a stranger won't. Continuity is worth more than convenience.",
      },
      {
        label: "Tell the doctor the real history, including the using",
        feedback:
          "They can't dose you safely around what they don't know. It also stops you being handed the exact thing you can't hold.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-what-resources-can-help-me",
    checkIn: "What do you need this week that you've been paying for, or going without, that's actually free?",
    adelQuestion: "Which paper do you not have yet — ID, birth certificate, social card — that keeps stopping you?",
    adelReflection:
      "Most of what's blocking you this week has an office and a phone number, and one of them usually knows about three others. Asking is not begging; it's the fastest route through a system built to be asked.",
    toolFlow: {
      warningSigns: [
        "Going without food or a phone rather than asking",
        "Not having ID and letting that stop everything",
        "Giving up after the first agency says no",
        "Losing paperwork between appointments",
        "Being too embarrassed to walk in",
      ],
      supportPeople: [
        "The community health worker who knows the county",
        "My case manager, about ID and vital records",
        "The food bank's front desk",
        "Someone who'll walk in with me the first time",
        "The Adelante care team",
      ],
      todayActions: [
        "Call one agency and ask what else they connect me to",
        "Start the paperwork for the ID I'm missing",
        "Pick up food from a pantry instead of going without",
        "Write the three numbers I keep needing on one card",
      ],
    },
    activityChoices: [
      {
        label: "Ask the first agency who else I should be calling",
        feedback:
          "The good question at the end of every call. One agency usually knows three, and that's how the list gets built.",
      },
      {
        label: "Start the ID paperwork today, before I need it",
        feedback:
          "Nearly everything downstream — housing, work, benefits — asks for ID first. It takes weeks, so it goes first.",
      },
      {
        label: "Walk in with someone the first time",
        feedback:
          "The front counter is the hardest part. Bringing someone gets you through the door, and you'll go alone next time.",
      },
      {
        label: "Write the numbers I keep needing on one card",
        feedback:
          "Phones get lost and shut off. A card in your pocket survives the week your phone doesn't.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-what-can-i-do-instead-of-using",
    checkIn: "What are you doing between four and eight tonight?",
    adelQuestion: "Which empty stretch of your week is the one you don't trust yourself in?",
    adelReflection:
      "Free time isn't the enemy; unplanned free time in the same hours you used to use is. Put something with a start time and a person in it into that gap before the gap arrives.",
    toolFlow: {
      warningSigns: [
        "Hours where nothing is scheduled and nobody expects me",
        "Scrolling in the same room where I used to use",
        "Turning down invitations and staying in",
        "Waking with nothing on the day at all",
        "Being bored and driving with no destination",
      ],
      supportPeople: [
        "Someone who'll expect me somewhere at a set time",
        "The volunteer coordinator at a place I'd go back to",
        "A meeting I already know the room of",
        "A friend who'll take a walk without asking questions",
        "The Adelante care team",
      ],
      todayActions: [
        "Put one thing with a start time into tonight",
        "Sign up for one shift or class this week",
        "Ask someone to expect me somewhere Thursday",
        "Name the hours I don't trust and fill one of them",
      ],
    },
    activityChoices: [
      {
        label: "Put something with a start time into the empty hours",
        feedback:
          "'I'll find something' loses to 6:30. A time and a place is what actually holds the hour.",
      },
      {
        label: "Ask one person to expect me somewhere",
        feedback:
          "Being expected is stronger than being interested. You'll go for someone waiting when you wouldn't go for yourself.",
      },
      {
        label: "Sign up for one volunteer shift this week",
        feedback:
          "It fills the hour, and it builds a resume and a set of people at the same time. Cheapest three-for-one there is.",
      },
      {
        label: "Leave the room I'm in and walk for ten minutes",
        feedback:
          "Small and immediate, and it works when the plan didn't. Changing rooms changes what the next hour looks like.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-what-kind-of-life-do-i-want",
    checkIn: "A year from now, on an ordinary Tuesday, what time do you get up and where do you go?",
    adelQuestion: "What's one thing in that Tuesday you could start being true this month?",
    adelReflection:
      "Big words like 'better' can't be worked toward — a Tuesday can. Describe the day in the boring detail, the address and the hour and who's in the kitchen, and the steps show up on their own.",
    toolFlow: {
      warningSigns: [
        "Only being able to describe what I don't want",
        "Making a plan so big I never start it",
        "Letting other people name my future for me",
        "Calling any wanting of things naive",
        "Never writing anything down",
      ],
      supportPeople: [
        "Someone whose ordinary life I'd actually want",
        "My counselor, about what I keep talking myself out of",
        "A sponsor who'll ask about it in a month",
        "The person who'd be in that Tuesday with me",
        "The Adelante care team",
      ],
      todayActions: [
        "Write my future Tuesday out, hour by hour",
        "Circle the one part I could start this month",
        "Tell one person the version I actually want",
        "Name the first step and put a date on it",
      ],
    },
    activityChoices: [
      {
        label: "Write the Tuesday down in boring detail",
        feedback:
          "The hour you get up, the room, who's there, what you're paid for. Detail is what makes it a plan instead of a wish.",
      },
      {
        label: "Circle one part I could make true this month",
        feedback:
          "One line out of the day, thirty days out. That's the size of thing that gets done and proves the rest is possible.",
      },
      {
        label: "Say it out loud to one person",
        feedback:
          "Saying it makes it real and it makes it checkable. Pick someone who won't laugh and will ask again later.",
      },
      {
        label: "Put a date on the first step",
        feedback:
          "A step without a date is a feeling. Even a wrong date beats no date, because it comes back around and asks you.",
      },
    ],
  },
  {
    lessonId: "building-a-life-that-works-building-my-stability-plan",
    checkIn: "Of housing, income, health and getting around — which one is closest to falling over?",
    adelQuestion: "What's the one action, with a date, you'd be willing to be asked about next week?",
    adelReflection:
      "Four areas is small enough to hold in your head and big enough to hold a life up. One action each, each with a date on it, and someone who'll ask — that's the whole plan, and it beats intending harder.",
    toolFlow: {
      warningSigns: [
        "Working on the easy area and avoiding the shaky one",
        "Actions on my plan with no dates beside them",
        "Not showing the plan to anyone",
        "Rewriting the plan instead of doing it",
        "Letting a missed deadline end the whole thing",
      ],
      supportPeople: [
        "My case manager, to read the plan with me",
        "Someone who'll ask about it next week",
        "The worker for whichever area is shakiest",
        "My sponsor, about the order to do it in",
        "The Adelante care team",
      ],
      todayActions: [
        "Write one action for housing, income, health and transport",
        "Put a real date beside each of the four",
        "Do the one for the shakiest area first",
        "Show the page to my case manager",
      ],
    },
    activityChoices: [
      {
        label: "Start with the area closest to falling over",
        feedback:
          "Not the easiest one. The shaky one is the one that takes the other three down with it if it goes.",
      },
      {
        label: "Put a date beside each of the four actions",
        feedback:
          "Deadlines beat intentions, every time. A date makes it a thing that either happened or didn't.",
      },
      {
        label: "Show the page to my case manager this week",
        feedback:
          "A plan nobody's seen is a private wish. Showing it gets it corrected and gets you asked about it.",
      },
      {
        label: "Do the smallest one today so the page isn't blank",
        feedback:
          "One crossed-off line changes how the rest of the page reads. Momentum is a real part of this, not a slogan.",
      },
    ],
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredBuildingALifeThatWorksBody(
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

export function seedAuthoredBuildingALifeThatWorksLessons(): void {
  for (const entry of BUILDING_A_LIFE_THAT_WORKS_FIELDS) {
    const body = authoredBuildingALifeThatWorksBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: BUILDING_A_LIFE_THAT_WORKS_AUTHOR.staffId,
        name: BUILDING_A_LIFE_THAT_WORKS_AUTHOR.name,
        role: BUILDING_A_LIFE_THAT_WORKS_AUTHOR.role,
      },
      atISO: BUILDING_A_LIFE_THAT_WORKS_AUTHOR.onISO,
      note: BUILDING_A_LIFE_THAT_WORKS_AUTHOR.note,
      overridesBaseline: true,
    });
  }
}

seedAuthoredBuildingALifeThatWorksLessons();
