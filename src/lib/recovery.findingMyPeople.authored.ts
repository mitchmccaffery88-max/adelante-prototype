// §Content-authoring pass Batch 2 — MODULE 2 "Finding My People", AUTHORED.
//
// WHAT THE GATE FOUND. Running the Batch 1 quality gate
// (`originalityErrors`, reached through `RECOVERY_LESSON_TYPE.validate`) over
// the ten live lessons of `finding-my-people` flagged, for real:
//   • 10 of 10 `adelQuestion`  — the imported "What part of this feels
//     hardest for you?" shared by all 80 ported lessons.
//   • 10 of 10 `adelReflection` — the generated "Adel can help you go deeper
//     on <title> …" line.
//   •  9 of 10 `checkIn` — the parameterised "Right now, how much is <problem>
//     a struggle for you?". Lesson 1 ("Why Can't I Do This Alone?") was the
//     one exception and already carried a real check-in; it is re-authored
//     here anyway only because it shared the module's generic option sets.
// Beyond the gate, all ten lessons shipped the SAME `toolFlow.warningSigns`
// ("Restless / Angry / Isolating / …") and the SAME `supportPeople`
// ("Sponsor / Peer specialist / …"), and `todayActions` differed only in its
// first entry. Those are per-lesson skill data — what a patient selects is
// stored and re-read — so identical sets across a module make the toolkit
// meaningless. Each lesson gets its own here.
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight` and the
// activity all passed the gate and are carried through verbatim by clone.
//
// HOW. Published overrides through the Build 2 lifecycle, exactly like
// `recovery.firstDaysOut.authored.ts` and `library.startingStrong.authored.ts`
// — never an edit to the ported baseline array, so every line stays editable
// in /admin-content with real revision history.
//
// VOICE. Continuous with Module 1's authored lessons: second person, present
// tense, concrete nouns, no clinical register, no scales. The reflection
// names something true and slightly hard before it offers credit; the question
// asks about a specific real moment rather than about feelings in general.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const FINDING_MY_PEOPLE_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Module 2 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, plus distinct warning signs, support people and today-actions for each lesson's own skill.",
};

export interface AuthoredLessonFields {
  lessonId: string;
  checkIn: string;
  adelQuestion: string;
  adelReflection: string;
  toolFlow: RecoveryToolFlow;
}

export const FINDING_MY_PEOPLE_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "finding-my-people-why-can-t-i-do-this-alone",
    checkIn: "Think about the last three days. Who actually knew what kind of day you were having?",
    adelQuestion: "When was the last time you turned down company you could have had?",
    adelReflection:
      "Doing it alone can feel like the safest option, because nobody alone can let you down. It also means nobody is close enough to notice the week you start slipping.",
    toolFlow: {
      warningSigns: [
        "Letting calls ring out on purpose",
        "Telling everyone I'm fine when I'm not",
        "Going whole days without saying much out loud",
        "Making plans and cancelling them the same day",
        "Deciding I'd be a burden if I reached out",
      ],
      supportPeople: [
        "Someone who checks on me without being asked",
        "My peer specialist",
        "A person from a meeting I've spoken to twice",
        "A family member who's safe",
        "The Adelante care team",
      ],
      todayActions: [
        "Answer the next call instead of letting it go",
        "Tell one person how the day actually went",
        "Sit in a room with people in it for an hour",
        "Text someone back that I've been ignoring",
      ],
    },
  },
  {
    lessonId: "finding-my-people-which-recovery-meeting-is-right-for-me",
    checkIn: "What's your honest reaction to the word 'meeting' right now?",
    adelQuestion: "Which kind of room would you walk into first if nobody there knew you?",
    adelReflection:
      "Deciding a meeting isn't for you after one room is like deciding food isn't for you after one meal. There are more kinds of rooms than most people are told about.",
    toolFlow: {
      warningSigns: [
        "Ruling every meeting out before trying one",
        "Only going when someone drags me",
        "Sitting in the parking lot and driving off",
        "Picking a meeting I know I'll never get to",
        "Waiting to feel ready before I go",
      ],
      supportPeople: [
        "Someone who'd meet me outside the door",
        "My peer specialist",
        "A sponsor or old-timer who knows the local rooms",
        "Whoever answers the meeting hotline",
        "The Adelante care team",
      ],
      todayActions: [
        "Pick one meeting on the schedule for this week",
        "Try an online meeting from where I'm sitting",
        "Ask someone which room they'd send me to",
        "Write down the times of two meetings near me",
      ],
    },
  },
  {
    lessonId: "finding-my-people-what-really-happens-at-a-meeting",
    checkIn: "Picture yourself walking through that door. What's the part you're bracing for?",
    adelQuestion: "What do you imagine people would think when you walked in?",
    adelReflection:
      "Almost everyone in that room walked in the first time expecting to be judged, and remembers it. The awkward part lasts about ten minutes and then you're just a person in a chair.",
    toolFlow: {
      warningSigns: [
        "Convinced everyone will look at me",
        "Sure I'll be made to talk",
        "Worried someone there will know me from before",
        "Planning to leave before it ends",
        "Arriving late so I don't have to speak to anyone",
      ],
      supportPeople: [
        "Someone who'd walk in with me",
        "The person who chairs the meeting",
        "My peer specialist",
        "Anyone I recognise from the last room",
        "The Adelante care team",
      ],
      todayActions: [
        "Get there ten minutes early and just sit",
        "Say my first name and nothing else",
        "Stay for the whole hour even if I say nothing",
        "Take a coffee and talk to one person after",
      ],
    },
  },
  {
    lessonId: "finding-my-people-how-do-i-find-a-sponsor",
    checkIn: "Is there already someone whose recovery you'd want a version of?",
    adelQuestion: "What's stopping you from asking the person you already have in mind?",
    adelReflection:
      "Being asked to sponsor someone is not a burden to the person you ask — for most of them it's the thing that keeps their own recovery honest. A no is about their week, not about you.",
    toolFlow: {
      warningSigns: [
        "Waiting for someone to offer first",
        "Deciding everyone's too busy for me",
        "Asking nobody so nobody can say no",
        "Picking someone because they're easy, not because they're steady",
        "Never calling the sponsor I already have",
      ],
      supportPeople: [
        "Someone with time in the rooms I respect",
        "A temporary sponsor until I find a fit",
        "My peer specialist",
        "Someone who shares in a way that lands with me",
        "The Adelante care team",
      ],
      todayActions: [
        "Ask one person the plain question: will you sponsor me",
        "Ask someone to be my temporary sponsor",
        "Get one phone number after a meeting",
        "Call the sponsor I have before I need anything",
      ],
    },
  },
  {
    lessonId: "finding-my-people-what-does-a-peer-recovery-specialist-do",
    checkIn: "What have you been handling on your own that somebody's job is to help with?",
    adelQuestion: "What would you bring to someone who had been where you are and can't be shocked?",
    adelReflection:
      "A peer isn't staff watching you and isn't a friend you owe anything to. They've been through the same doors, and none of what you tell them is new to them.",
    toolFlow: {
      warningSigns: [
        "Going to appointments alone when I don't want to",
        "Not saying the real thing at my appointments",
        "Assuming asking will cost me something",
        "Losing my peer's number and not asking again",
        "Handling paperwork alone until it's late",
      ],
      supportPeople: [
        "My peer recovery specialist",
        "My CF care manager",
        "Someone who could come to an appointment with me",
        "The clinic front desk",
        "The Adelante care team",
      ],
      todayActions: [
        "Message my peer specialist about one real thing",
        "Ask my peer to come to my next appointment",
        "Save my peer's number under a name I'll find",
        "Ask what my peer can actually help with",
      ],
    },
  },
  {
    lessonId: "finding-my-people-who-should-be-on-my-recovery-team",
    checkIn: "If today went sideways at 9pm, whose name comes to mind first?",
    adelQuestion: "Which spot on your team is empty right now — and who could fill it?",
    adelReflection:
      "Most people find they've been asking one person for everything. That's not a team, that's a single point of failure, and it wears the person out too.",
    toolFlow: {
      warningSigns: [
        "One person carries all of it for me",
        "No number saved for after hours",
        "Nobody on the list I've spoken to this month",
        "Not sure who to call for what",
        "People on my list who aren't safe for me",
      ],
      supportPeople: [
        "My prescriber or doctor",
        "My therapist or counselor",
        "My sponsor",
        "My peer specialist",
        "A family member who's safe",
        "The Adelante care team",
      ],
      todayActions: [
        "Write the four names down in one place",
        "Add one number I don't have yet",
        "Tell one person I'm putting them on my list",
        "Ask my care manager who covers nights",
      ],
    },
  },
  {
    lessonId: "finding-my-people-how-do-i-learn-to-trust-again",
    checkIn: "What happens in you when someone starts getting close?",
    adelQuestion: "What's one small promise to yourself you'd actually keep this week?",
    adelReflection:
      "You've probably had trust used against you, and the caution came from somewhere real. It doesn't have to be handed over all at once — it can be lent in small amounts and taken back.",
    toolFlow: {
      warningSigns: [
        "Testing people to see if they'll leave",
        "Telling someone everything the first day",
        "Pulling back the moment someone gets close",
        "Breaking small promises to myself",
        "Reading every late reply as proof",
      ],
      supportPeople: [
        "Someone who's been consistent with me for months",
        "My therapist or counselor",
        "My sponsor",
        "A person who's earned one small thing",
        "The Adelante care team",
      ],
      todayActions: [
        "Keep one small promise I made to myself",
        "Tell one person one true low-risk thing",
        "Show up when I said I would",
        "Wait a day before deciding someone let me down",
      ],
    },
  },
  {
    lessonId: "finding-my-people-how-do-i-ask-for-help",
    checkIn: "Think of the last thing you needed and didn't ask for. What stopped you?",
    adelQuestion: "What's the one sentence you'd have to say out loud to get what you need?",
    adelReflection:
      "Hinting protects you from hearing no, and it also means nobody knows what you're asking for. Naming the thing, the size and the day is what makes it easy for someone to say yes.",
    toolFlow: {
      warningSigns: [
        "Hinting instead of asking",
        "Apologising through the whole ask",
        "Asking so vaguely nobody can help",
        "Waiting until it's an emergency",
        "Deciding for people that they'd say no",
      ],
      supportPeople: [
        "Someone who's said yes before",
        "My CF care manager",
        "A neighbour or coworker for practical things",
        "My sponsor",
        "The Adelante care team",
      ],
      todayActions: [
        "Ask for one thing naming the day and time",
        "Say the ask once with no apology attached",
        "Write the sentence out before I send it",
        "Ask a second person if the first says no",
      ],
    },
  },
  {
    lessonId: "finding-my-people-what-does-recovery-look-like-this-week",
    checkIn: "Look at the next seven days. How many of them have anything recovery-related in them?",
    adelQuestion: "Which day this week is most likely to fall apart, and what's already in it?",
    adelReflection:
      "Recovery that lives only in your intentions competes with everything that has a time attached. Written down, it stops being something you have to decide about again each morning.",
    toolFlow: {
      warningSigns: [
        "A week with nothing scheduled in it",
        "Planning it in my head and never writing it",
        "Booking things I know I can't get to",
        "Every commitment on the same day",
        "Empty evenings I usually struggle with",
      ],
      supportPeople: [
        "Someone who'd meet me at a set time",
        "My CF care manager",
        "Whoever helps me with rides",
        "My sponsor",
        "The Adelante care team",
      ],
      todayActions: [
        "Put two meetings in this week with times",
        "Fill the one evening I know is risky",
        "Set a reminder the hour before each one",
        "Book the ride I'll need to get there",
      ],
    },
  },
  {
    lessonId: "finding-my-people-my-weekly-recovery-plan",
    checkIn: "What usually happens to a plan of yours by about Wednesday?",
    adelQuestion: "What day and time will you sit down to plan the next week?",
    adelReflection:
      "The plan isn't the point — the half hour you spend making it is. People who keep that half hour every week stay connected long after motivation runs out.",
    toolFlow: {
      warningSigns: [
        "Skipping the planning hour two weeks running",
        "A plan with no people in it",
        "Only planning when things are already bad",
        "Never looking at the plan again after making it",
        "Planning around everyone else's week but mine",
      ],
      supportPeople: [
        "Someone I check in with weekly",
        "My peer specialist",
        "My sponsor",
        "Whoever I share a calendar with",
        "The Adelante care team",
      ],
      todayActions: [
        "Pick the day and hour I plan every week",
        "Put one person into next week's plan",
        "Review the plan tonight before the week starts",
        "Send my plan to one person who'll ask about it",
      ],
    },
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredFindingMyPeopleBody(
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

export function seedAuthoredFindingMyPeopleLessons(): void {
  for (const entry of FINDING_MY_PEOPLE_FIELDS) {
    const body = authoredFindingMyPeopleBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: FINDING_MY_PEOPLE_AUTHOR.staffId,
        name: FINDING_MY_PEOPLE_AUTHOR.name,
        role: FINDING_MY_PEOPLE_AUTHOR.role,
      },
      atISO: FINDING_MY_PEOPLE_AUTHOR.onISO,
      note: FINDING_MY_PEOPLE_AUTHOR.note,
      // Shadows the ported baseline lesson; the catalog prefers the published
      // override and falls back to the baseline if it is ever retired.
      overridesBaseline: true,
    });
  }
}

seedAuthoredFindingMyPeopleLessons();
