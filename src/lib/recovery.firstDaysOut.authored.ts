// §Adelante Journey sync Build 3 — Module 1 lessons 6–10, AUTHORED CONTENT.
//
// WHY THIS FILE IS NOT `recovery.ts`. Build 2 made recovery modules and their
// lessons managed content: an admin can author, review, publish and revise a
// lesson in /admin-content without a deploy. Adding these five as hardcoded
// entries in the shipped baseline array would have re-opened the exact hole
// Build 2 closed — content nobody can edit and that has no revision history.
// So they are authored the way any lesson written from now on is authored:
// as PUBLISHED entries in the shared content lifecycle store, resolved by
// `liveLessonsInModule` through the same overlay as an admin-authored lesson,
// and fully editable in /admin-content with their history intact.
//
// The seed replays a real authoring event (Cathy, clinical coordinator, the
// date she signed the copy off) rather than stamping "now" — the same rule
// the community-resource and naloxone migrations follow.
//
// WHAT THE FIVE COVER, AND WHY THESE FIVE. Lessons 1–5 already cover the 72
// hour window, tolerance/overdose, where you sleep, paperwork/appointments,
// and people-places-things. That leaves the module's mission ("Survive and
// Stabilize") short on four real first-days experiences — the craving that
// arrives right now, the shapeless first full day, the emotional flood of
// being out, and having exactly one person you can actually reach — plus the
// hand-off out of survival mode into the rest of the journey.
import type { RecoveryLesson } from "@/lib/recovery";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const FIRST_DAYS_OUT_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-18T00:00:00.000Z",
  note:
    "Module 1 lessons 6–10 authored to bring 'My First Days Out' to the same ten-lesson depth as the rest of the journey. Post-release copy, so the module's justice-involved population gate applies to each one.",
};


export const AUTHORED_FIRST_DAYS_OUT_LESSONS: RecoveryLesson[] = [
  {
    id: "fdo-urge-right-now",
    moduleId: "first-days-out",
    title: "The Urge That's Here Right Now",
    minutes: 5,
    order: 6,
    problem: "It's not a someday craving. It's here, in your chest, right now.",
    checkIn: "On a scale you'd be honest about, how loud is the urge at this minute?",
    learnTitle: "An urge is a wave, not a verdict",
    learnBody:
      "A craving feels like it will keep climbing forever, but that isn't how it works. Most urges peak within about twenty minutes and then start coming down on their own, whether or not you do anything about them. What makes them dangerous is the story that rides along with them — that it will never stop, that you can't stand it, that using is the only exit. You don't have to argue with the urge or win against it. You have to outlast this one, and put something between you and the twenty minutes.",
    activity: {
      kind: "grounding",
      title: "Bring it down where you're standing",
      prompt: "Do it right now, wherever you are. Nobody around you has to know you're doing it.",
      senses: [
        { label: "see", count: 5 },
        { label: "feel touching you", count: 4 },
        { label: "hear", count: 3 },
        { label: "smell", count: 2 },
        { label: "do — one slow breath, all the way out", count: 1 },
      ],
    },
    adelReflection:
      "Getting through one urge doesn't mean you're cured, and it isn't nothing either. It's proof the wave came down while you were still standing there.",
    adelQuestion: "What was happening in the hour before the urge showed up?",
    insight: "You don't have to beat the craving. You have to be somewhere else when it peaks.",
    toolFlow: {
      warningSigns: [
        "The urge is getting louder, not quieter",
        "I'm alone and haven't told anyone",
        "I'm counting money I could spend",
        "I'm picturing the whole thing step by step",
        "I've already texted someone about it",
        "I'm telling myself just once won't count",
      ],
      supportPeople: [
        "My sponsor or a peer",
        "My CF care manager",
        "Someone in recovery who's up right now",
        "988 Suicide & Crisis Lifeline",
        "A family member who's safe",
        "The Adelante care team",
      ],
      todayActions: [
        "Set a 20-minute timer and don't decide until it rings",
        "Leave the room I'm in",
        "Call one person and say the word craving out loud",
        "Eat something and drink water",
        "Go somewhere with other people in it",
      ],
    },
    toolkitLabel: "My twenty-minute urge plan",
  },
  {
    id: "fdo-shape-of-the-first-day",
    moduleId: "first-days-out",
    title: "Sixteen Hours With Nothing In Them",
    minutes: 5,
    order: 7,
    problem: "Inside, the day was decided for you. Out here it's wide open, and that's worse than it sounds.",
    checkIn: "What did you actually do with yesterday, hour by hour?",
    learnTitle: "Empty time is a risk factor, not a break",
    learnBody:
      "For a long stretch, someone else decided when you woke up, ate and moved. That structure was miserable and it was also holding a shape. When it disappears overnight, the hours don't feel like freedom — they feel like a hole, and old habits are very good at filling holes. The fix isn't a packed schedule you'll abandon by Thursday. It's three or four fixed anchors a day that don't move, with the rest left loose.",
    activity: {
      kind: "timeline",
      title: "Put four anchors in tomorrow",
      prompt: "Drag these into the order your day could actually run. Four fixed points is enough.",
      steps: [
        "Get up at the same time",
        "Eat something in the morning",
        "One thing outside the house",
        "One appointment or meeting",
        "Check in with one person",
        "Same bedtime, phone down",
      ],
    },
    adelReflection:
      "Nobody rebuilds a full routine in week one. Four things that happen at roughly the same time each day is a routine.",
    adelQuestion: "Which hour of the day is hardest for you right now?",
    insight: "Decide what tomorrow looks like tonight, before the empty hours get a vote.",
    toolFlow: {
      warningSigns: [
        "Sleeping through most of the day",
        "Up all night, out all night",
        "Whole days I can't account for",
        "Nowhere I have to be this week",
        "Only leaving the house to see old contacts",
      ],
      supportPeople: [
        "My CF care manager",
        "My sponsor or a peer",
        "Someone who'd walk or eat with me",
        "A meeting I could show up to daily",
        "The Adelante care team",
      ],
      todayActions: [
        "Set a wake-up time for tomorrow",
        "Put one meeting on the calendar",
        "Plan one reason to leave the house",
        "Ask someone to check in at the same time daily",
        "Pick a bedtime and put the phone down then",
      ],
    },
    toolkitLabel: "My four daily anchors",
  },
  {
    id: "fdo-too-much-at-once",
    moduleId: "first-days-out",
    title: "Everything At Once",
    minutes: 5,
    order: 8,
    problem: "Noise, choices, people, phones. You're out, and you feel worse than you expected to.",
    checkIn: "Since you got out, what's been hitting hardest — the noise, the people, or the feelings?",
    learnTitle: "Overwhelm after release is normal and it's temporary",
    learnBody:
      "Coming out is not one feeling. It's relief and rage and grief and shame arriving in the same afternoon, on a nervous system that spent months braced. A grocery store can be too loud. A simple question about what you want for dinner can be too many choices. None of that means you're failing at being out; it means your body is recalibrating and hasn't caught up yet. It settles over weeks, and it settles faster when you name what you're feeling instead of numbing it.",
    activity: {
      kind: "sliders",
      title: "Where is it loudest today?",
      prompt: "No score to hit. This is for you to see which one is actually running the day.",
      sliders: [
        { id: "noise", label: "Noise and crowds", minLabel: "Fine", maxLabel: "Can't take it" },
        { id: "anger", label: "Anger", minLabel: "Quiet", maxLabel: "Right at the surface" },
        { id: "shame", label: "Shame", minLabel: "Quiet", maxLabel: "Constant" },
        { id: "grief", label: "Grief for what I lost", minLabel: "Quiet", maxLabel: "Heavy" },
        { id: "fear", label: "Fear of going back", minLabel: "Quiet", maxLabel: "Constant" },
      ],
    },
    adelReflection:
      "You spent a long time not showing any of this, because showing it wasn't safe. Out here it costs less to say it than to carry it.",
    adelQuestion: "Which of those is the one you'd least want to admit to anybody?",
    insight: "Feeling wrecked in the first weeks isn't a relapse warning by itself. Hiding it is.",
    toolFlow: {
      warningSigns: [
        "Snapping at people who didn't earn it",
        "Can't be around crowds or noise at all",
        "Shame telling me I don't deserve this chance",
        "Numb, nothing reaches me",
        "Thinking everyone would be better off without me",
        "Only thing that would quiet it is using",
      ],
      supportPeople: [
        "My counselor or therapist",
        "My CF care manager",
        "My sponsor or a peer",
        "988 Suicide & Crisis Lifeline",
        "A family member who's safe",
        "The Adelante care team",
      ],
      todayActions: [
        "Tell one person the honest version",
        "Get outside for ten minutes",
        "Say no to one thing I don't have to do today",
        "Ask about counseling at my next appointment",
        "Eat and sleep before deciding anything big",
      ],
    },
    toolkitLabel: "What's loudest for me right now",
  },
  {
    id: "fdo-one-person-i-can-call",
    moduleId: "first-days-out",
    title: "One Person I Can Actually Call",
    minutes: 5,
    order: 9,
    problem: "You have a phone full of numbers and nobody you'd call at two in the morning.",
    checkIn: "If tonight went bad, whose name comes to mind first — and would you really dial it?",
    learnTitle: "One reachable person beats a long list",
    learnBody:
      "A support network sounds like a lot of people. In the first weeks it's usually one. The person who counts isn't the one who cares the most on paper — it's the one who picks up, who knows you're out, and who won't make you explain yourself from the beginning. It's also someone you've already called once about something small, because a number you've never used is a number you won't use at the worst moment.",
    activity: {
      kind: "write",
      prompt:
        "Write who you'd call, and the sentence you'd open with. Plain words. You're not writing a speech.",
      lines: 4,
      placeholder: "Who: ...  What I'd say first: ...",
    },
    adelReflection:
      "Asking is the part most people skip, and it's the whole thing. One test call while nothing is wrong makes the real call possible.",
    adelQuestion: "What are you afraid they'd think if you called them struggling?",
    insight: "Make the practice call today so the emergency call isn't the first one.",
    toolFlow: {
      warningSigns: [
        "No number I'd actually dial",
        "Everyone I'd call is someone I used with",
        "I've been letting calls go to voicemail",
        "Telling people I'm fine when I'm not",
        "Haven't spoken to anyone in days",
      ],
      supportPeople: [
        "My sponsor or a peer",
        "My CF care manager",
        "A family member who's safe",
        "Someone from a meeting",
        "988 Suicide & Crisis Lifeline",
        "The Adelante care team",
      ],
      todayActions: [
        "Make one practice call today about nothing",
        "Save that number under a name I'll recognize",
        "Tell them plainly that they're my first call",
        "Ask one person from a meeting for their number",
        "Put 988 in my phone",
      ],
    },
    toolkitLabel: "My first call",
  },
  {
    id: "fdo-what-comes-after-week-one",
    moduleId: "first-days-out",
    title: "When Surviving Stops Being the Whole Job",
    minutes: 6,
    order: 10,
    problem: "The emergency is easing off, and you're not sure what you're supposed to be doing now.",
    checkIn: "Which of the basics — sleep, food, meds, appointments, a safe place — is actually holding this week?",
    learnTitle: "Stabilizing is the doorway, not the destination",
    learnBody:
      "The first weeks ask one thing: stay alive and get a floor under you. When that floor holds for a few days running, survival stops being a full-time job and something uncomfortable shows up in the space — the question of what this is all for. That's the point where people either build something or drift back, because nothing pulls harder than an empty life that's technically going fine. The rest of this journey is that build: your people, your patterns, your days, your relationships, and eventually who you're becoming.",
    activity: {
      kind: "checklist",
      prompt: "Check what's been true for three days straight. Unchecked items are still first-days work.",
      items: [
        "I've slept somewhere safe three nights running",
        "I've eaten every day",
        "My medication is going as prescribed",
        "I've made every required check-in",
        "One person knows how I'm doing",
        "I know what I'm doing tomorrow",
      ],
    },
    adelReflection:
      "Moving on from this module isn't graduating. It's the same work getting less loud, so there's room for the rest of it.",
    adelQuestion: "If the emergency is over, what do you want the next three months to be about?",
    insight: "Surviving got you here. It won't be enough to keep you here.",
    toolFlow: {
      warningSigns: [
        "Bored and restless with nothing to aim at",
        "Basics slipping again — sleep, food, meds",
        "Skipping appointments now that things feel okay",
        "Telling myself I've got this handled alone",
        "Old contacts starting to look harmless",
      ],
      supportPeople: [
        "My CF care manager",
        "My sponsor or a peer",
        "My counselor or therapist",
        "Someone from a meeting",
        "The Adelante care team",
      ],
      todayActions: [
        "Start the next module in my journey",
        "Name one thing I want in three months",
        "Book my next appointment before I leave today",
        "Tell my care manager what's holding and what isn't",
        "Add one weekly meeting to my routine",
      ],
    },
    toolkitLabel: "My move out of survival mode",
  },
];

/**
 * Publish them into the shared content store, replaying the real authoring
 * event. `overridesBaseline: false` — these are genuinely NEW lessons, not
 * overrides of shipped ones, so the catalog overlay adds them to Module 1.
 */
export function seedAuthoredFirstDaysOutLessons(): void {
  for (const lesson of AUTHORED_FIRST_DAYS_OUT_LESSONS) {
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: lesson.id,
      body: structuredClone(lesson) as unknown as Record<string, unknown>,
      actor: {
        staffId: FIRST_DAYS_OUT_AUTHOR.staffId,
        name: FIRST_DAYS_OUT_AUTHOR.name,
        role: FIRST_DAYS_OUT_AUTHOR.role,
      },
      atISO: FIRST_DAYS_OUT_AUTHOR.onISO,
      note: FIRST_DAYS_OUT_AUTHOR.note,
      overridesBaseline: false,
    });
  }
}

seedAuthoredFirstDaysOutLessons();
