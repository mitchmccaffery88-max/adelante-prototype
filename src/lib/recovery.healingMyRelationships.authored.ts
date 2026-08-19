// §Content-authoring pass Batch 5 — MODULE 5 "Healing My Relationships",
// AUTHORED.
//
// WHAT THE GATE FOUND, precisely. Running the Batch 1 quality gate
// (`originalityErrors`, reached through `RECOVERY_LESSON_TYPE.validate`) over
// the ten live lessons of `healing-my-relationships` flagged, for real:
//   • 10 of 10 `adelQuestion`  — "What part of this feels hardest for you?"
//   • 10 of 10 `adelReflection` — "Adel can help you go deeper on <title> …"
//   • 10 of 10 `checkIn` — "Right now, how much is <problem> a struggle for
//     you?" — three flags on every lesson, no clean exceptions. Same shape as
//     Modules 3 and 4.
//
// WHAT THE TOOL-FLOW MEASUREMENT FOUND (arrays; the gate only reads free text):
//   • `warningSigns`  — 1 distinct set across 10 lessons.
//   • `supportPeople` — 1 distinct set across 10 lessons.
//   • `todayActions`  — nominally 10 distinct sets, but DISTINCT ONLY IN THE
//     FIRST ENTRY: entries 2–5 ("Attend a meeting / Call someone who supports
//     me / Practice my recovery skill / Complete one important task") were
//     byte-identical in all ten, so the tail collapses to 1 distinct set. The
//     same pattern Batches 2, 3 and 4 found — now four modules for four.
//
// WHAT IS NOT TOUCHED. `problem`, `learnTitle`, `learnBody`, `insight` and the
// decision activity pass the gate and are carried through verbatim by clone.
//
// VOICE, continuous with Modules 1–4: second person, present tense, concrete
// nouns, no clinical register, no 1–10 scale questions. Because this module is
// about relationships, every question anchors to a specific real person and a
// specific real moment — a name, a phone, a doorway, a visit — rather than to
// "relationships" as an abstraction. That is the same move Batch 2 made for
// "Finding My People", and it is what keeps a lesson about trust from reading
// like a lesson about boundaries.
import { RECOVERY_LESSONS, type RecoveryLesson, type RecoveryToolFlow } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const HEALING_MY_RELATIONSHIPS_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Module 5 authored: per-lesson check-in, Adel question and reflection replacing the imported templates, plus distinct warning signs, support people and today-actions for each lesson's own relationship skill.",
};

export interface AuthoredLessonFields {
  lessonId: string;
  checkIn: string;
  adelQuestion: string;
  adelReflection: string;
  toolFlow: RecoveryToolFlow;
}

export const HEALING_MY_RELATIONSHIPS_FIELDS: AuthoredLessonFields[] = [
  {
    lessonId: "healing-my-relationships-can-people-trust-me-again",
    checkIn: "Who is the one person still waiting to see if you mean it this time?",
    adelQuestion: "What is the last thing you told that person you'd do?",
    adelReflection:
      "Being doubted by someone who loves you is its own kind of tired, and you cannot argue your way out of it. What you can do is finish one small thing you said you'd finish, where they can see it.",
    toolFlow: {
      warningSigns: [
        "Promising something bigger than I can finish",
        "Getting angry when someone checks on me",
        "Explaining instead of just doing the thing",
        "Going quiet when I miss what I said I'd do",
        "Only calling when I need something",
      ],
      supportPeople: [
        "The person I most want to believe me",
        "Someone who saw the worst of it and stayed",
        "My peer specialist",
        "My sponsor, about what to promise and what not to",
        "The Adelante care team",
      ],
      todayActions: [
        "Finish the smallest thing I already promised",
        "Tell one person exactly when I'll be somewhere",
        "Say 'I can't' instead of a yes I'd break",
        "Send a message when I said I would, not later",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-how-do-i-communicate-better",
    checkIn: "What's the sentence you rehearsed today and never actually said?",
    adelQuestion: "Who did you go quiet on this week, and what were you holding back?",
    adelReflection:
      "Swallowing it feels like keeping the peace, right up until it comes out sideways at the wrong person. Saying the plain version early is smaller and cheaper than the version that arrives at 11pm.",
    toolFlow: {
      warningSigns: [
        "Rehearsing a conversation for days instead of having it",
        "Saying 'it's fine' when it isn't",
        "Raising my voice before I've said the point",
        "Texting something I'd never say out loud",
        "Walking out mid-sentence",
      ],
      supportPeople: [
        "Someone I can say the hard version to first",
        "My counselor, about what I keep swallowing",
        "A friend who tells me when I'm being unclear",
        "Whoever the conversation is actually about",
        "The Adelante care team",
      ],
      todayActions: [
        "Say one 'I feel… when… I need…' out loud today",
        "Ask one question instead of assuming",
        "Repeat back what someone said before answering",
        "Have the small conversation before it grows",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-how-do-i-set-healthy-boundaries",
    checkIn: "Whose name comes up on your phone that you answer even when you shouldn't?",
    adelQuestion: "What did you say yes to this week that cost you something?",
    adelReflection:
      "A no with a paragraph attached invites a negotiation. Four words and a closed mouth is not rude — it's the version that actually holds when they push.",
    toolFlow: {
      warningSigns: [
        "Saying yes before I've thought about it",
        "Explaining my no until it turns into a maybe",
        "Feeling used after a favour I offered",
        "Letting someone stay past when I wanted them gone",
        "Lending money I needed",
      ],
      supportPeople: [
        "Someone who has already told me no kindly",
        "My sponsor, to practise the words with",
        "A housemate who'll back me up in the moment",
        "My case manager, about limits I can't hold alone",
        "The Adelante care team",
      ],
      todayActions: [
        "Say 'I can't do that' with no reason after it",
        "Let one call go to voicemail on purpose",
        "Decide the end time before I agree to go",
        "Write the four words I'll use next time",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-how-can-i-repair-family-relationships",
    checkIn: "When did you last show up at a family thing that wasn't an emergency?",
    adelQuestion: "Which relative would notice first if you called on an ordinary Tuesday?",
    adelReflection:
      "Family remembers the pattern, not the speech, and waiting for them to be ready is slow in a way nothing else in recovery is. Turning up for something boring — a birthday, a ride, a dish washed — is what moves it.",
    toolFlow: {
      warningSigns: [
        "Only showing up when something's gone wrong",
        "Arguing about who was worse back then",
        "Cancelling the visit the morning of",
        "Waiting for an apology before I move",
        "Talking about change instead of doing a chore",
      ],
      supportPeople: [
        "The relative who never fully wrote me off",
        "Someone who can go to the visit with me",
        "My counselor, about what I'm walking into",
        "An aunt, uncle or cousin on the edges",
        "The Adelante care team",
      ],
      todayActions: [
        "Turn up to one ordinary family thing",
        "Do one small job at their house without being asked",
        "Call a relative with no request attached",
        "Let their timeline be slower than mine today",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-how-can-i-be-the-parent-i-want-to-be",
    checkIn: "What did your kid say to you last, and did you actually hear it?",
    adelQuestion: "What's a fifteen-minute thing your child would want to do with you this week?",
    adelReflection:
      "Kids track who turns up on the same day again, not who buys the bigger thing. Being ordinary and there is the version they'll remember, and it's the version you can afford.",
    toolFlow: {
      warningSigns: [
        "Promising an outing I can't pay for",
        "Missing a visit and not explaining it to them",
        "Being in the room but on my phone",
        "Talking about their other parent in front of them",
        "Only turning up on holidays",
      ],
      supportPeople: [
        "Whoever my kids are staying with",
        "My case manager, about visits and paperwork",
        "A parent in recovery who's further along",
        "My child's teacher or school counselor",
        "The Adelante care team",
      ],
      todayActions: [
        "Give one child fifteen minutes with the phone away",
        "Ask them a question and let the answer finish",
        "Say sorry once, plainly, in words their age",
        "Turn up on the day I said, on time",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-what-makes-a-healthy-friendship",
    checkIn: "Who did you spend the most hours with this week, and how did you feel after?",
    adelQuestion: "Which friend has never once asked you to make an exception for them?",
    adelReflection:
      "Some friendships end just by you getting well, and that loss is real even when the friendship wasn't good for you. The test isn't whether they say they support you — it's what they do at 10pm on a bad night.",
    toolFlow: {
      warningSigns: [
        "Feeling worse every time I leave their place",
        "Being teased for going to a meeting",
        "Only hanging out where using happens",
        "Hiding my recovery from someone I call a friend",
        "Being asked to keep something from my sponsor",
      ],
      supportPeople: [
        "The friend who shows up sober",
        "Someone from a meeting I've talked to twice",
        "A friend from before any of this started",
        "My peer specialist, about who to keep",
        "The Adelante care team",
      ],
      todayActions: [
        "Text one friend who's safe to be around",
        "Make a plan somewhere with no using in it",
        "Notice how I feel an hour after seeing someone",
        "Say out loud that I'm in recovery to one friend",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-when-should-i-walk-away",
    checkIn: "Whose company put your recovery closest to the edge this month?",
    adelQuestion: "What would you have to stop pretending about for that to be an easy call?",
    adelReflection:
      "Leaving somebody who is still using can feel like abandoning them, and nobody in a meeting will pretend it's simple. Distance is not a verdict on them — it's what keeps you alive long enough to be any use to anyone.",
    toolFlow: {
      warningSigns: [
        "Making excuses for them to my sponsor",
        "Coming home rattled and needing to level out",
        "Being asked to hold or carry something",
        "Being threatened when I try to leave",
        "Planning my week around avoiding a mood",
      ],
      supportPeople: [
        "Someone whose place I could go to tonight",
        "My counselor, before I make the call",
        "My sponsor, to say it out loud to",
        "A crisis line if it turns unsafe",
        "The Adelante care team",
      ],
      todayActions: [
        "Mute or block one contact for a week",
        "Tell one person where I'll be instead",
        "Skip the one place I always run into them",
        "Write down what would make this permanent",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-how-do-i-make-things-right",
    checkIn: "Whose name have you been avoiding writing down?",
    adelQuestion: "What did that person actually lose — time, money, a night, their trust?",
    adelReflection:
      "An apology that makes you feel lighter and them feel worse is not amends, it's a delivery. Naming the specific thing, and then changing what you do next to them, is the part that lands.",
    toolFlow: {
      warningSigns: [
        "Apologising to feel better rather than to repair",
        "Making the amends about my own guilt",
        "Turning up unannounced to say sorry",
        "Skipping my sponsor before I act",
        "Listing everyone but the person I hurt most",
      ],
      supportPeople: [
        "My sponsor, before I contact anyone",
        "Someone who knows the whole story",
        "My counselor, about what would cause more harm",
        "A person I already made amends to",
        "The Adelante care team",
      ],
      todayActions: [
        "Write down one name and one specific thing",
        "Run it past my sponsor before doing anything",
        "Pay back one small amount I owe",
        "Change the behaviour before making the speech",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-how-do-i-forgive-myself",
    checkIn: "What did you say to yourself the last time you got something wrong?",
    adelQuestion: "What would you say to a friend who told you they'd done exactly what you did?",
    adelReflection:
      "There's a difference between 'I did a bad thing' and 'I am one', and only the first one leaves you anywhere to stand. Carrying the second is not accountability — it's just the fuel that sends people back out.",
    toolFlow: {
      warningSigns: [
        "Calling myself names in my own head",
        "Replaying one night over and over",
        "Deciding I don't deserve the help I'm getting",
        "Punishing myself by skipping something good",
        "Refusing to accept a kind word",
      ],
      supportPeople: [
        "Someone who's told me their worst and stayed",
        "My counselor, about the guilt underneath",
        "A chaplain, elder or person of faith I trust",
        "My sponsor, about the difference between the two",
        "The Adelante care team",
      ],
      todayActions: [
        "Write one true kind sentence about myself",
        "Name the thing I did without naming what I am",
        "Tell one person the part I've been hiding",
        "Accept a compliment without arguing with it",
      ],
    },
  },
  {
    lessonId: "healing-my-relationships-building-my-relationship-plan",
    checkIn: "If you wrote three names down right now, whose would they be?",
    adelQuestion: "Which of those three needs a limit from you before it needs more time?",
    adelReflection:
      "A plan that lists everyone you've ever known is a wish, not a plan. Three names, one limit each, and a date you look at it again is small enough that you'll actually still be using it next month.",
    toolFlow: {
      warningSigns: [
        "A list of names with no limits next to them",
        "Rebuilding everything at once in one week",
        "No plan for what to do when someone pushes back",
        "Never reviewing it after the day I wrote it",
        "Leaving off the relationship I'm avoiding",
      ],
      supportPeople: [
        "The person at the top of my list",
        "My case manager, to read the plan with me",
        "My sponsor, about the order to do it in",
        "Someone who'll ask me about it next month",
        "The Adelante care team",
      ],
      todayActions: [
        "Write three names on one page",
        "Put one clear limit beside each name",
        "Set a date next month to read it again",
        "Show the page to one person I trust",
      ],
    },
  },
];

/** The shipped lesson, verbatim, with its authored fields replaced. */
export function authoredHealingMyRelationshipsBody(
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

export function seedAuthoredHealingMyRelationshipsLessons(): void {
  for (const entry of HEALING_MY_RELATIONSHIPS_FIELDS) {
    const body = authoredHealingMyRelationshipsBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: HEALING_MY_RELATIONSHIPS_AUTHOR.staffId,
        name: HEALING_MY_RELATIONSHIPS_AUTHOR.name,
        role: HEALING_MY_RELATIONSHIPS_AUTHOR.role,
      },
      atISO: HEALING_MY_RELATIONSHIPS_AUTHOR.onISO,
      note: HEALING_MY_RELATIONSHIPS_AUTHOR.note,
      // Shadows the ported baseline lesson; the catalog prefers the published
      // override and falls back to the baseline if it is ever retired.
      overridesBaseline: true,
    });
  }
}

seedAuthoredHealingMyRelationshipsLessons();
