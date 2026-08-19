// §Content-authoring pass Batch 1 — STARTING STRONG check-ins, AUTHORED.
//
// WHY THIS FILE EXISTS AND WHY IT IS NOT AN EDIT TO `library.ported.ts`.
// Build 3 added `checkIn` / `checkInOptions` to `LibraryItem` and to the admin
// form, but shipped them EMPTY: all ten Starting Strong lessons fell through
// to the shared placeholder ("Take a breath before you start…"), so step 2 of
// the eight-part sequence was the same screen ten times in a row.
//
// Filling them in the ported baseline array would have made them uneditable
// again. So they are authored the way `recovery.firstDaysOut.authored.ts`
// authored Module 1 lessons 6–10: as PUBLISHED entries in the shared content
// lifecycle store, resolved by the catalog overlay, fully editable with real
// revision history in /admin-content.
//
// These are OVERRIDES (`overridesBaseline: true`) rather than new lessons —
// the ten lessons already exist and are already good. Only step 2 was missing,
// so each body is the shipped lesson verbatim with its own check-in added.
// Everything else, including the population gate Build D corrected on
// "Finding My Footing", is carried through by clone.
//
// VOICE. Second person, present tense, no clinical register, no "on a scale of
// 1-10" — matching the `problem` line each lesson already opens with. Options
// are the reference's card pattern: things a patient recognises as themselves,
// written as statements they can tap, never as symptoms.
import { LIBRARY_ITEMS, type LibraryItem } from "@/lib/library";
import { seedPublishedContent } from "@/lib/contentPublishing";

/** The real author and sign-off date for this batch. */
export const STARTING_STRONG_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Starting Strong step 2 authored: a per-lesson check-in and card options replacing the shared placeholder, so the first thing a patient does in each lesson names that lesson's own problem.",
};

export interface AuthoredCheckIn {
  itemId: string;
  checkIn: string;
  checkInOptions: string[];
}

export const STARTING_STRONG_CHECK_INS: AuthoredCheckIn[] = [
  {
    itemId: "ss-finding-my-footing",
    checkIn:
      "Before we start — what does today actually look like for you? Tap whatever is true, even if it's the hard one.",
    checkInOptions: [
      "I don't know what I'm supposed to do first",
      "I'm handling one thing at a time and it's mostly working",
      "Other people are telling me what to do and I'm just following",
      "Nothing feels solid enough to stand on yet",
    ],
  },
  {
    itemId: "ss-daily-rhythm",
    checkIn: "Think about yesterday. Which one of these is closest to how the day went?",
    checkInOptions: [
      "I woke up and the day just happened to me",
      "I had one thing to do and the rest was empty",
      "I was busy all day and still couldn't tell you what I did",
      "Most of it had a shape I chose",
    ],
  },
  {
    itemId: "ss-calming-my-mind",
    checkIn: "What are your thoughts doing right this minute, while you're reading this?",
    checkInOptions: [
      "Going too fast to catch any one of them",
      "Circling back to the same thing over and over",
      "Loud at night, quieter during the day",
      "Quiet right now — I'm here before it starts",
    ],
  },
  {
    itemId: "ss-managing-overwhelm",
    checkIn: "When you picture everything you're supposed to handle, what happens in you?",
    checkInOptions: [
      "I freeze and end up doing none of it",
      "I start five things and finish nothing",
      "I pick the easiest one and avoid the real one",
      "I can see the pile but I know where to start",
    ],
  },
  {
    itemId: "ss-managing-worry",
    checkIn: "What's the 'what if' that's been running today? Tap the shape it takes.",
    checkInOptions: [
      "What if I mess this up and lose my chance",
      "What if something happens to someone I love",
      "What if people find out who I used to be",
      "What if I can't keep this going",
    ],
  },
  {
    itemId: "ss-grounding-myself",
    checkIn: "Check your body for a second, not your thoughts. What's it doing?",
    checkInOptions: [
      "Chest tight or heart going fast",
      "Jaw, shoulders or fists clenched",
      "Can't sit still — legs want to move",
      "Feels far away, like I'm watching from outside",
      "Settled enough right now",
    ],
  },
  {
    itemId: "ss-managing-big-feelings",
    checkIn: "When a feeling gets big on you, what do you usually end up doing with it?",
    checkInOptions: [
      "Push it down and act like it isn't there",
      "It comes out at whoever is nearest",
      "Go quiet and disappear for a while",
      "Look for something that makes it stop fast",
    ],
  },
  {
    itemId: "ss-creating-safety",
    checkIn:
      "Think about where you've been this week. Where did your body actually relax, and where did it not?",
    checkInOptions: [
      "Where I sleep doesn't feel safe",
      "There's one person around who I brace up for",
      "Certain streets or blocks I can't be on",
      "Crowds and noise put me on edge",
      "I have somewhere I can breathe",
    ],
  },
  {
    itemId: "ss-restoring-sleep",
    checkIn: "Last night — which part of sleep is the part that isn't working?",
    checkInOptions: [
      "Lying there for hours before I go under",
      "Waking up over and over through the night",
      "Up at 3am and that's the end of it",
      "Sleeping plenty and still worn out",
    ],
  },
  {
    itemId: "ss-stability-plan",
    checkIn: "Think of the last good stretch you had. What ended it?",
    checkInOptions: [
      "One bad day knocked the whole thing over",
      "I got busy and quietly stopped doing what was working",
      "Something happened that I had no plan for",
      "I don't actually know — it just stopped",
    ],
  },
];

/** The shipped lesson, verbatim, with its authored step 2 added. */
export function authoredStartingStrongBody(entry: AuthoredCheckIn): LibraryItem | undefined {
  const base = LIBRARY_ITEMS.find((i) => i.id === entry.itemId);
  if (!base) return undefined;
  return {
    ...structuredClone(base),
    checkIn: entry.checkIn,
    checkInOptions: [...entry.checkInOptions],
  };
}

export function seedAuthoredStartingStrongCheckIns(): void {
  for (const entry of STARTING_STRONG_CHECK_INS) {
    const body = authoredStartingStrongBody(entry);
    if (!body) continue;
    seedPublishedContent({
      typeId: "library_lesson",
      id: body.id,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: STARTING_STRONG_AUTHOR.staffId,
        name: STARTING_STRONG_AUTHOR.name,
        role: STARTING_STRONG_AUTHOR.role,
      },
      atISO: STARTING_STRONG_AUTHOR.onISO,
      note: STARTING_STRONG_AUTHOR.note,
      // These shadow shipped baseline lessons — the catalog prefers the
      // published override, and falls back to the baseline if it is retired.
      overridesBaseline: true,
    });
  }
}

seedAuthoredStartingStrongCheckIns();
