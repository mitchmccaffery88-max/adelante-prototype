// §Content-authoring pass Batch 8 — CATALOG-WIDE activity-choice remediation.
//
// The final full-catalog sweep (all 8 modules, 80 lessons) turned up a real gap
// the per-module batches could not have caught: the activity-choice check only
// entered scope at Batch 6, so Modules 2, 3, 4 and 5 each still shipped ONE
// decision choice set shared byte-identically by all ten of their lessons:
//   • finding-my-people          — "Text my sponsor / Go to a meeting / Call my
//     peer specialist / Show up somewhere in person"
//   • understanding-my-addiction — "Name it as a craving and wait it out / Run a
//     HALT check / Leave the trigger behind / Call for backup"
//   • changing-my-everyday-life  — "Follow my routine anyway / Do the 10-minute
//     version / Ask someone to do it with me / Reset tomorrow, no shame"
//   • healing-my-relationships   — "Take a pause before responding / Use my 'I'
//     statement / Set the boundary out loud / Step away and come back"
// 40 lessons, 4 distinct sets. Module 1's sets were already per-lesson.
//
// This file re-authors all 40 as per-lesson choices written to each lesson's
// actual prompt. It does NOT touch anything else: the body it publishes is the
// CURRENTLY PUBLISHED body from Batches 2–5 (check-in, Adel question and
// reflection, tool flows), with only `activity.choices` replaced.
import { publishedContent, seedPublishedContent } from "@/lib/contentPublishing";
import { RECOVERY_LESSONS, type RecoveryLesson } from "@/lib/recovery";

export const ACTIVITY_CHOICE_REMEDIATION_AUTHOR = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as const,
  onISO: "2026-08-19T00:00:00.000Z",
  note:
    "Catalog-wide remediation: per-lesson decision-activity choices for Modules 2-5, replacing the single choice set each module's ten lessons shared. No other field changed.",
};

type C = [label: string, feedback: string];

export const REMEDIATED_ACTIVITY_CHOICES: Record<string, C[]> = {
  // ── Module 2 — Finding My People ───────────────────────────────────────────
  "finding-my-people-why-can-t-i-do-this-alone": [
    ["Text one person before I close the door", "Isolating wins by being quiet. A three-word text to one person is usually enough to break it before the evening sets."],
    ["Go where people are, even without talking", "You don't have to be social to stop being alone. Sitting in a room with other people counts and costs you nothing."],
    ["Say out loud that I want to disappear today", "Naming the urge to isolate takes most of its power away, and it tells one person exactly what to watch for."],
    ["Stay in tonight and call someone tomorrow", "Sometimes you need the quiet. Pick the person and the time now, so tomorrow doesn't slide into next week."],
  ],
  "finding-my-people-which-recovery-meeting-is-right-for-me": [
    ["Pick the one that's closest and go this week", "Fit matters less than attendance at the start. The nearest meeting you'll actually reach beats the perfect one across town."],
    ["Ask someone in recovery which rooms they liked", "People will tell you which meetings are warm and which are cold. That saves you three wasted trips."],
    ["Try two different kinds before deciding", "One meeting is a sample of one. Two gives you something to compare, and the difference is usually obvious."],
    ["Read about the formats before I commit", "Knowing whether it's a speaker, a step study or open discussion takes the surprise out of walking in."],
  ],
  "finding-my-people-what-really-happens-at-a-meeting": [
    ["Go early and sit near the door", "Arriving before the crowd means you pick your seat instead of walking into a full room. The door seat is yours to use."],
    ["Tell one person it's my first time", "First-timers get looked after in most rooms. Saying it turns strangers into people who know why you're quiet."],
    ["Plan to just listen and pass when asked", "You never have to share. Deciding that beforehand takes the biggest fear out of the hour."],
    ["Bring someone with me the first time", "A familiar person in the passenger seat makes the walk in shorter. You can go alone next week."],
  ],
  "finding-my-people-how-do-i-find-a-sponsor": [
    ["Talk to them after the meeting ends", "The five minutes after the room clears is when this actually happens. Say you liked what they shared and take it from there."],
    ["Ask directly if they're taking anyone on", "Direct is easier for both of you. They'll either say yes, or say who else to ask, and neither answer is a rejection."],
    ["Ask for a temporary sponsor for now", "Temporary lowers the stakes on both sides. Plenty of permanent sponsorships started as a two-week arrangement."],
    ["Get their number and call this week", "A number you never dial is just a name. Calling within the week is what makes it a relationship."],
  ],
  "finding-my-people-what-does-a-peer-recovery-specialist-do": [
    ["Ask them what they can actually help with", "Their job is wider than most people assume — rides, forms, court, bad afternoons. Ask and you'll stop under-using them."],
    ["Bring them the thing I'd be embarrassed to say", "They've been where you are, which is the whole point of the role. The embarrassing thing is usually the useful one."],
    ["Set a regular time instead of only crises", "Standing contact beats emergency contact. When it's already on the calendar, the hard week has somewhere to land."],
    ["Handle it myself and mention it next time", "Sometimes that's the right call. Write it down so it actually gets mentioned rather than forgotten."],
  ],
  "finding-my-people-who-should-be-on-my-recovery-team": [
    ["Call the person on my list for exactly this", "A team works when you know who handles what. Calling the right one saves you the energy of deciding twice."],
    ["Check whether I've been leaning on one person", "One name doing all the work burns out fast. Spreading it out protects both of you."],
    ["Add whoever's missing from my list today", "Most lists are short in one place — medical, practical, or 2am. Fill the gap while you're thinking about it."],
    ["Reach the professional instead of a friend", "Some things need a clinician, not a mate. Knowing which is which is what a team is for."],
  ],
  "finding-my-people-how-do-i-learn-to-trust-again": [
    ["Share one small true thing and see", "Trust gets tested in small amounts. One true, low-cost thing tells you a lot about how someone handles it."],
    ["Watch what they do for a few weeks", "Words are cheap early on. Consistency over a few weeks is real evidence, and it costs you nothing to wait for it."],
    ["Say out loud that trusting is hard for me", "Naming it lowers the pressure. Most decent people slow down when you tell them why you're careful."],
    ["Keep my distance for now", "Distance is a legitimate answer, especially early. Just check it's a choice and not the old reflex making it for you."],
  ],
  "finding-my-people-how-do-i-ask-for-help": [
    ["Say exactly what I need, in one sentence", "Vague asks get vague answers. A ride at four, twenty dollars, an hour on the phone — specific is easy to say yes to."],
    ["Ask the person most likely to say yes", "Start where it's easiest. One yes makes the next ask far less costly than starting with the hardest person."],
    ["Say I need help before I explain why", "Leading with the ask stops you talking yourself out of it halfway through the backstory."],
    ["Try it alone first and ask if it fails", "Sometimes reasonable. Set the point where you'll ask anyway, so trying alone doesn't quietly become never asking."],
  ],
  "finding-my-people-what-does-recovery-look-like-this-week": [
    ["Put three fixed things on the week now", "Three anchors is enough to give a week a shape. Everything else can move around them."],
    ["Start with what already happens weekly", "You probably have one standing thing already. Building around it is faster than inventing a whole schedule."],
    ["Ask someone what their week looks like", "Borrowing a working week from someone further along beats designing one from scratch on a Monday."],
    ["Plan just today and do the week tonight", "A whole week is heavy before coffee. Today is enough to be going on with."],
  ],
  "finding-my-people-my-weekly-recovery-plan": [
    ["Write the plan for the days that are left", "A week started is not a week lost. Plan Wednesday to Sunday and let Monday go."],
    ["Copy last week's plan and change one thing", "Rebuilding from zero is why plans stop happening. Copy forward, adjust one line, done in five minutes."],
    ["Send the plan to one person", "A plan somebody else has seen is one you're more likely to follow. It also gives them something to ask you about."],
    ["Keep it to two commitments this week", "An over-full plan fails by Thursday and takes your confidence with it. Two kept beats six missed."],
  ],

  // ── Module 3 — Understanding My Addiction ─────────────────────────────────
  "understanding-my-addiction-why-can-t-i-stop-thinking-about-using": [
    ["Call it a thought, not a decision", "A thought arriving is not you choosing. Labelling it puts a gap between the two, and the gap is where you act."],
    ["Tell one person the thought showed up", "Said out loud it stops being a secret. Secrets are what let a thought turn into a plan."],
    ["Do something with my hands for ten minutes", "Thoughts fade faster when your attention has somewhere else to be. Ten minutes is usually enough for the peak."],
    ["Watch it without arguing with it", "Fighting a thought keeps it in the room. Letting it be there and doing nothing about it is what makes it leave."],
  ],
  "understanding-my-addiction-why-are-my-cravings-so-strong": [
    ["Time it and wait out the twenty minutes", "Most cravings peak and drop inside twenty minutes. Watching the clock turns unbearable into finite."],
    ["Get out of the room I'm in", "A craving is partly the place you're standing. Changing the room takes a surprising amount of the edge off."],
    ["Drink water and eat something", "Cravings ride on top of hungry and depleted. Food and water don't cure them but they lower the volume."],
    ["Call someone while it's still rising", "Calling during, not after, is the whole skill. Someone on the line makes the peak much easier to sit through."],
  ],
  "understanding-my-addiction-what-keeps-triggering-me": [
    ["Name the trigger before I do anything", "Naming it — the street, the payday, the person — turns an ambush into a known thing with a workaround."],
    ["Leave the situation that set this off", "You don't have to prove you can stand in it. Leaving costs nothing and works every time."],
    ["Write it on my trigger list for next time", "Today's ambush is next month's prediction. The list only works if you add to it when it's fresh."],
    ["Change my route or my timing tomorrow", "Some triggers are geography. Adjusting a route is easier than out-willing the same corner twice a week."],
  ],
  "understanding-my-addiction-what-is-halt-trying-to-tell-me": [
    ["Run through hungry, angry, lonely, tired", "Four questions, thirty seconds. Most surprise urges turn out to be one of them wearing a costume."],
    ["Eat first and reassess after", "Hungry distorts everything. Deal with the simplest one and see how much of the urge is left."],
    ["Call someone if it's the lonely one", "Lonely is the one that doesn't fix itself. It needs another voice, not another strategy."],
    ["Lie down if it's really just tired", "Tired makes everything louder and nothing clearer. Sleep is a legitimate recovery action."],
  ],
  "understanding-my-addiction-why-does-stress-make-me-want-to-use": [
    ["Slow my breathing before I decide anything", "Stress chemicals want a fast answer. A minute of slower breathing buys back the ability to choose one."],
    ["Deal with the one thing causing the stress", "Often it's a single call or bill. Handling it removes the fuel instead of managing the smoke."],
    ["Move my body for ten minutes", "Stress is physical, so the discharge has to be too. A walk does more than talking yourself calm."],
    ["Say I'm stressed to someone instead of fixing it", "Not everything needs solving. Being heard drops the pressure enough that the day stops feeling like an emergency."],
  ],
  "understanding-my-addiction-how-are-my-mental-health-and-recovery-co": [
    ["Ask whether this is depression, not craving", "They feel similar from the inside and need different responses. Sorting which is which changes what helps."],
    ["Tell my prescriber how this week has gone", "Untreated symptoms make recovery twice as hard. Your prescriber can only work with what you report."],
    ["Do the smallest thing on my list", "When mood is low, small and finished is the goal. One item done is genuine evidence against the feeling."],
    ["Stay with someone rather than being alone", "Low mood and being alone amplify each other. Company doesn't have to involve talking about it."],
  ],
  "understanding-my-addiction-why-do-i-keep-repeating-the-same-pattern": [
    ["Find the cue that started the loop", "Every loop opens with a cue — a time, a place, a person. Spot it and you get a place to intervene."],
    ["Name what the pattern actually gives me", "Patterns persist because they pay. Relief, escape, belonging — name the payoff and you can go find it elsewhere."],
    ["Change one step in the middle of it", "You don't have to break the whole loop. Swapping one link is usually enough to stop it completing."],
    ["Let it run and write down what happened", "If it runs anyway, the notes are worth having. Next time you'll recognise it earlier."],
  ],
  "understanding-my-addiction-what-happens-while-my-brain-is-healing": [
    ["Remind myself this is healing, not failing", "Foggy and flat is what recovery looks like at this stage. It's a phase with an end, not a verdict."],
    ["Lower today's bar on purpose", "A healing brain does less. Planning a smaller day is smart, not lazy."],
    ["Ask someone how long this took for them", "Hearing that someone else had four bad months and came out of it is worth more than any explanation."],
    ["Keep the routine even while it feels pointless", "The routine is doing work you can't feel yet. Keeping it is what shortens the stretch."],
  ],
  "understanding-my-addiction-what-am-i-really-running-from": [
    ["Name the feeling underneath the urge", "The urge is the surface. Underneath is usually one nameable thing, and naming it is most of the work."],
    ["Say the real thing to one safe person", "The thing you'd never say out loud is the one keeping the pattern fed. Saying it once changes its weight."],
    ["Bring it to my counselor rather than solving it now", "Some of this is too big for an afternoon. Booking it somewhere safe is a real decision, not avoidance."],
    ["Sit with it for five minutes without doing anything", "Feelings you don't run from tend to shrink. Five minutes is enough to learn they don't kill you."],
  ],
  "understanding-my-addiction-understanding-my-recovery-story": [
    ["Tell the short version and stop there", "You decide how much anyone gets. A two-sentence version is a complete answer, not a dodge."],
    ["Say the part I've made peace with", "Tell the part that's settled. The unsettled parts belong to people who've earned them, not to a dinner table."],
    ["Change the subject and revisit it later", "You don't owe anyone your history over a meal. Later, chosen by you, is a legitimate answer."],
    ["Notice what came up and write it down after", "The feeling that surprised you is the useful part. Get it on paper before the day washes it off."],
  ],

  // ── Module 4 — Changing My Everyday Life ──────────────────────────────────
  "changing-my-everyday-life-how-do-i-build-a-better-daily-routine": [
    ["Restart at the next anchor instead of tomorrow", "A day is not lost at noon. The next anchor — lunch, the afternoon walk — is a real place to pick it up."],
    ["Do the evening part even if the morning went", "Half a routine kept is how routines survive real weeks. Salvage the end of the day."],
    ["Cut the routine to the two things that matter", "An over-built routine collapses the first busy day. Two anchors survive almost anything."],
    ["Write down where it went off today", "Routines fail at a specific hour for a specific reason. Knowing which one lets you fix it once."],
  ],
  "changing-my-everyday-life-why-is-sleep-so-important": [
    ["Go to bed anyway and ride it out lying down", "Cravings shrink with sleep and grow without it. Lying down is a legitimate way to wait one out."],
    ["Put the phone in another room", "The phone is what turns a late night into a 3am one. Distance is easier than willpower at this hour."],
    ["Text someone rather than staying up alone", "Late and alone is the hardest combination. One message means the hour isn't only yours to hold."],
    ["Do the wind-down I keep skipping", "The twenty minutes before bed decides the night. Doing them is the cheapest craving reduction available."],
  ],
  "changing-my-everyday-life-how-can-food-help-my-recovery": [
    ["Eat something with protein right now", "An empty stomach fakes a craving convincingly. Protein settles it within about twenty minutes."],
    ["Check the last time I actually ate", "People in early recovery routinely go eight hours without noticing. The clock answers a lot of afternoons."],
    ["Keep something easy where I'll find it", "Willpower is bad at shopping. Something ready to hand beats a plan to cook later."],
    ["Have water and something small, then reassess", "Small and now beats perfect and later. See what's left of the feeling once you've eaten."],
  ],
  "changing-my-everyday-life-how-can-exercise-help-me-feel-better": [
    ["Go for ten minutes and stop if I want", "Ten minutes with permission to quit is a much easier deal than a workout. Most people keep going anyway."],
    ["Walk instead of doing the whole workout", "Movement is the active ingredient, not intensity. A walk around the block counts fully."],
    ["Do it with someone so I show up", "Company outperforms motivation. If someone's waiting, low mood stops being the deciding vote."],
    ["Skip it today and put it in for tomorrow", "One skipped day is nothing. Put the time in the calendar so it doesn't become the new pattern."],
  ],
  "changing-my-everyday-life-what-can-i-do-instead-of-using": [
    ["Pick from the list I already wrote", "Empty time is the wrong moment to invent options. The list exists so you don't have to think now."],
    ["Fill the hour with something out of the house", "Unstructured time indoors is the riskiest kind. Anywhere else is usually safer than here."],
    ["Do the boring useful thing I've been putting off", "Dull and productive burns the hour and leaves you better off. Recovery is often unglamorous like that."],
    ["Call someone and let the time go on that", "A phone call is a perfectly good use of an empty hour, and it handles the loneliness underneath it."],
  ],
  "changing-my-everyday-life-how-do-i-calm-my-emotions": [
    ["Name the emotion before I act on it", "Named feelings lose speed. Angry, ashamed, scared — one accurate word slows the whole thing down."],
    ["Put cold water on my face and hands", "It's physical, quick and works when talking yourself down doesn't. The body settles first, the mind follows."],
    ["Wait ten minutes before I say anything", "Almost nothing gets worse for waiting ten minutes, and most things you'd have said get better."],
    ["Let it out somewhere it costs nothing", "The feeling needs somewhere to go — paper, a walk, a friend. Anywhere but at the person in front of you."],
  ],
  "changing-my-everyday-life-how-do-i-break-old-habits": [
    ["Put something in the way of the old habit", "Friction beats resolve. Making it thirty seconds harder is often enough to stop it happening automatically."],
    ["Swap in the new routine, keep the reward", "The habit is there for a reason. Keep the payoff, change the route to it, and it sticks."],
    ["Notice the cue and let it pass unanswered", "The cue always fires; that's not failure. Not answering it once is how the loop starts to weaken."],
    ["Do the old thing but tell someone after", "If it happens, telling someone stops the shame that makes it happen again. That's a real step, not a consolation."],
  ],
  "changing-my-everyday-life-why-should-i-take-my-medication": [
    ["Take it today and raise the doubt at my next visit", "Stopping between appointments is where things unravel. Take it, then have the conversation properly."],
    ["Write down exactly what feels wrong with it", "Specific side effects can be adjusted. \"It's not helping\" can't, and it's usually not the real complaint."],
    ["Call my prescriber before I skip a dose", "One phone call is the difference between a dose change and starting over. The line exists for exactly this."],
    ["Ask someone who's been on it longer", "Hearing the first weeks from someone past them reframes a lot of what feels like it isn't working."],
  ],
  "changing-my-everyday-life-how-do-i-have-fun-without-using": [
    ["Try the thing even if it feels flat", "New fun is flat for a while — that's the brain, not the activity. Third time is usually different."],
    ["Do it with people rather than alone", "Most of what made things fun was the company. Bring people and half the problem solves itself."],
    ["Go back to something I liked before", "Something from before it all went sideways often still fits. It's the fastest place to start looking."],
    ["Accept a quiet evening as good enough", "Not every evening has to be fun. Calm and boring is a real improvement on where you were."],
  ],
  "changing-my-everyday-life-building-my-daily-recovery-plan": [
    ["Write the three-line version now", "A plan you finish beats a plan you design. Morning, midday, night — one line each is enough today."],
    ["Base it on what I already did today", "You've already done things worth keeping. Writing them down turns a day into a plan in five minutes."],
    ["Set a fifteen-minute timer and stop when it ends", "Overwhelm comes from open-ended. A timer makes it a task with an end you can see."],
    ["Ask someone to build it with me", "Doing it out loud with another person is faster and produces a plan that actually fits your week."],
  ],

  // ── Module 5 — Healing My Relationships ───────────────────────────────────
  "healing-my-relationships-can-people-trust-me-again": [
    ["Answer the doubt without getting defensive", "Their doubt is earned and it's not an attack. Taking it calmly is itself the evidence they're looking for."],
    ["Make one promise small enough to keep", "Trust rebuilds in kept small things, not declarations. Pick one you'll definitely deliver this week."],
    ["Say I know why they're not sure yet", "Naming it out loud does more than arguing. It tells them you're tracking the same reality they are."],
    ["Let my next few weeks answer it", "Some answers only time can give. Say that plainly rather than trying to win the moment."],
  ],
  "healing-my-relationships-how-do-i-communicate-better": [
    ["Say the one sentence about how I feel", "\"I felt shut out when that happened\" lands differently than \"you always\". Same content, different outcome."],
    ["Repeat back what they said first", "Being heard drops the temperature fast. It also stops you answering an argument they didn't make."],
    ["Ask for ten minutes before I answer", "Anger rising is a reason to pause, not to push through. Ten minutes almost always improves what you say."],
    ["Say I'm getting angry rather than showing it", "Naming it out loud is the difference between a hard conversation and a damaging one."],
  ],
  "healing-my-relationships-how-do-i-set-healthy-boundaries": [
    ["Say no now, without the long explanation", "A short no holds better than a justified one. Explanations invite negotiation you didn't agree to."],
    ["Offer what I can actually do instead", "A boundary can have a door in it. Naming the smaller thing you'll do keeps the relationship and the limit."],
    ["Say I'll answer tomorrow", "Buying a day takes the pressure out of the moment and lets you answer from your own judgment."],
    ["Say yes and notice what it costs me", "If you say yes, track the cost honestly. That record is what makes the next no possible."],
  ],
  "healing-my-relationships-how-can-i-repair-family-relationships": [
    ["Let the old hurt be said without arguing", "They've held it a long time. Hearing it out once is often the price of the conversation moving anywhere new."],
    ["Own my part in one sentence", "Short and specific beats a full account. Long explanations start sounding like defence to the person listening."],
    ["Step outside for a few minutes", "Leaving the room briefly is not walking out. It's how the visit survives the next hour."],
    ["Change what I do next visit, not what I say now", "Families measure in visits, not apologies. The next one going differently is the argument that works."],
  ],
  "healing-my-relationships-how-can-i-be-the-parent-i-want-to-be": [
    ["Get down to their level and slow down", "Flustered is contagious and so is calm. Slowing your own body first changes the whole exchange."],
    ["Say sorry to my kid, plainly", "Children take a straight apology better than adults do. It also teaches them what repair looks like."],
    ["Keep the small promise I made them", "Kids track the small ones. The pickup you showed up for outweighs anything you say about changing."],
    ["Ask someone how they handled this age", "Parenting in recovery has few instructions. Another parent's answer is worth more than an hour of guessing."],
  ],
  "healing-my-relationships-what-makes-a-healthy-friendship": [
    ["Say no once, clearly, and stay put", "You can decline and remain in the room. One clear no often settles it for the rest of the night."],
    ["Leave and text a friend from outside", "You don't owe the room an explanation. Outside with your phone is a complete answer to \"just like old times\"."],
    ["Notice whether they let it drop", "A real friend drops it. Whether they push again after you said no tells you what this friendship actually is."],
    ["Say it's not about them, it's about me staying alive", "That sentence ends most pressure. It's true, it's short, and it doesn't start an argument."],
  ],
  "healing-my-relationships-when-should-i-walk-away": [
    ["Leave now and think about it later", "Deciding the future of a relationship mid-risk is bad timing. Get out first, reason about it tomorrow."],
    ["Take a break instead of ending it", "Not every walk-away is permanent. A month of distance answers a lot of questions on its own."],
    ["Tell someone I'm in this situation", "Deciding this alone is how people talk themselves back in. Say it to someone before you weigh it up."],
    ["Write down what happened while it's fresh", "In two weeks you'll minimise it. The note you write today is the honest version."],
  ],
  "healing-my-relationships-how-do-i-make-things-right": [
    ["Say what I did, without the reasons", "Amends thin out the moment explanation starts. The plain sentence is the one that lands."],
    ["Ask what would actually help them", "Your idea of repair may not be theirs. Asking hands them something they haven't had in a long time — a say."],
    ["Offer the concrete thing I can do", "Money back, a job finished, a call to someone. Concrete outlasts the conversation."],
    ["Accept it if they're not ready", "Amends are made, not received on demand. Leaving the door open is part of doing it properly."],
  ],
  "healing-my-relationships-how-do-i-forgive-myself": [
    ["Say the specific thing instead of \"everything\"", "Regret in bulk can't be worked with. One named thing can be repaired, or grieved, or set down."],
    ["Do one thing today that the old me wouldn't", "Self-forgiveness follows changed behaviour. One concrete different act beats an evening of self-argument."],
    ["Tell someone the thought I'm ashamed of", "Shame needs privacy to survive. Said out loud to one safe person, it usually shrinks to something bearable."],
    ["Let the regret be there without adding to it", "You don't have to resolve it tonight. Feeling it without piling on more is already different from before."],
  ],
  "healing-my-relationships-building-my-relationship-plan": [
    ["Open my plan and use the line I wrote for this", "That's what the page is for. Reading your own words in the moment is easier than improvising."],
    ["Take the pause my plan starts with", "Almost every plan starts the same way, because the pause is what makes the rest of it usable."],
    ["Do the repair step instead of the reaction", "The plan exists because reactions are automatic. Choosing the written step is the whole exercise."],
    ["Get through it, then update the plan tonight", "If it goes badly, the plan gets better. Write what was missing while you still remember it."],
  ],
};

/** Current published body with only its decision choices replaced. */
export function remediatedActivityChoiceBody(lessonId: string): RecoveryLesson | undefined {
  const choices = REMEDIATED_ACTIVITY_CHOICES[lessonId];
  if (!choices) return undefined;
  const live =
    (publishedContent("recovery_lesson", lessonId) as unknown as RecoveryLesson | undefined) ??
    RECOVERY_LESSONS.find((l) => l.id === lessonId);
  if (!live) return undefined;
  const next = structuredClone(live);
  if (next.activity.kind !== "decision") return undefined;
  next.activity = {
    ...next.activity,
    choices: choices.map(([label, feedback]) => ({ label, feedback })),
  };
  return next;
}

export function seedRemediatedActivityChoices(): void {
  for (const lessonId of Object.keys(REMEDIATED_ACTIVITY_CHOICES)) {
    const body = remediatedActivityChoiceBody(lessonId);
    if (!body) continue;
    seedPublishedContent({
      typeId: "recovery_lesson",
      id: lessonId,
      body: structuredClone(body) as unknown as Record<string, unknown>,
      actor: {
        staffId: ACTIVITY_CHOICE_REMEDIATION_AUTHOR.staffId,
        name: ACTIVITY_CHOICE_REMEDIATION_AUTHOR.name,
        role: ACTIVITY_CHOICE_REMEDIATION_AUTHOR.role,
      },
      atISO: ACTIVITY_CHOICE_REMEDIATION_AUTHOR.onISO,
      note: ACTIVITY_CHOICE_REMEDIATION_AUTHOR.note,
      overridesBaseline: true,
    });
  }
}

seedRemediatedActivityChoices();
