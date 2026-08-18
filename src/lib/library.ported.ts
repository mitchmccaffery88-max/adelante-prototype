// GENERATED CONTENT — ported verbatim from the Adelante Journey build and
// mapped onto this project's stricter LibraryItem schema (see src/lib/library.ts).
// Copy is unchanged; only structure was translated. "Starting Strong" is NOT
// here: that collection was transcribed earlier and keeps its original ids.
import type { LibraryCategory, LibraryItem } from "@/lib/library";

export const PORTED_LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    "id": "understanding",
    "name": "Understanding My Diagnosis",
    "desc": "Plain-language explanations of what you might be going through.",
    "icon": "BookOpen",
    "clinicalTarget": "Psychoeducation · Reducing stigma",
    "order": 2
  },
  {
    "id": "treatment",
    "name": "Taking Care of My Treatment",
    "desc": "Making treatment work for you — not something done to you.",
    "icon": "Pill",
    "clinicalTarget": "Medication adherence · Shared decision-making",
    "order": 3
  },
  {
    "id": "train-mind",
    "name": "Train My Mind",
    "desc": "Working with the thoughts that keep running the show.",
    "icon": "Brain",
    "clinicalTarget": "Cognitive restructuring · CBT skills",
    "order": 4
  },
  {
    "id": "strengthen-recovery",
    "name": "Strengthen My Recovery",
    "desc": "Tools for cravings, triggers, and the days that test you.",
    "icon": "Waves",
    "clinicalTarget": "Relapse prevention · Urge management",
    "order": 5
  },
  {
    "id": "big-emotions",
    "name": "Managing Big Emotions",
    "desc": "Anger, frustration, and the seconds before you react.",
    "icon": "Flame",
    "clinicalTarget": "Emotion regulation · Anger management",
    "order": 6
  },
  {
    "id": "support-team",
    "name": "Building My Support Team",
    "desc": "Rebuilding trust and finding people who show up.",
    "icon": "Users",
    "clinicalTarget": "Social support · Interpersonal effectiveness",
    "order": 7
  },
  {
    "id": "back-on-feet",
    "name": "Getting Back on My Feet",
    "desc": "Housing, work, money, and the practical stuff that holds a life up.",
    "icon": "Compass",
    "clinicalTarget": "Social determinants · Re-entry stability",
    "order": 8
  },
  {
    "id": "success-plan",
    "name": "My Success Plan",
    "desc": "Turning where you want to go into something you can actually do.",
    "icon": "Sparkles",
    "clinicalTarget": "Goal setting · Relapse prevention planning",
    "order": 9
  }
];

export const PORTED_LIBRARY_ITEMS: LibraryItem[] = [
  {
    "id": "understanding-sud",
    "categoryId": "understanding",
    "title": "Understanding Substance Use Disorder",
    "minutes": 6,
    "order": 1,
    "problem": "You want to know if this is a choice, a habit, or something else.",
    "learnTitle": "A learned shortcut, not a character flaw",
    "learnBody": "Substance use disorder changes how the reward part of the brain works. Over time, the substance stops being about feeling good and starts being about not feeling awful. That's why willpower alone rarely does it — the brain has learned a shortcut. Treatment, time, and new routines are what rebuild the road.",
    "activity": {
      "kind": "timeline",
      "title": "The craving cycle",
      "prompt": "Put the cycle in order — knowing the order is how you interrupt it.",
      "steps": [
        "Trigger (place, person, feeling)",
        "Thought about using",
        "Body reacts — urge builds",
        "Decision point",
        "Use or ride it out",
        "What happens next"
      ]
    },
    "adelReflection": "The decision point is real. It's short, but it's there — and it gets longer with practice.",
    "adelQuestion": "Where in that cycle do you usually notice it first?",
    "insight": "It's a brain that learned something. Brains can learn something else.",
    "action": "Name your most common trigger out loud today.",
    "toolkitLabel": "My craving cycle map"
  },
  {
    "id": "understanding-depression",
    "categoryId": "understanding",
    "title": "Understanding Depression",
    "minutes": 6,
    "order": 2,
    "problem": "Everything feels heavy, flat, or pointless — and you don't know why.",
    "learnTitle": "Depression lies with confidence",
    "learnBody": "Depression isn't sadness. It's a flattening — of energy, interest, and hope. It tells you nothing will help, which is exactly why doing one small thing anyway is the treatment. Movement usually comes before motivation, not after.",
    "activity": {
      "kind": "sort",
      "prompt": "Symptom or story? — Sort each statement. This is how you learn the difference.",
      "buckets": [
        "Symptom",
        "Story"
      ],
      "cards": [
        "I'm too tired to shower",
        "I'm lazy",
        "Nothing sounds fun anymore",
        "I'm a burden",
        "I can't concentrate"
      ]
    },
    "adelReflection": "Symptoms describe what's happening. Stories describe who you are — and depression writes cruel stories.",
    "adelQuestion": "Which story does your depression tell you the most?",
    "insight": "Depression is a symptom set, not a personality.",
    "action": "Do one small thing today before you feel like it.",
    "toolkitLabel": "Symptom vs story"
  },
  {
    "id": "understanding-anxiety",
    "categoryId": "understanding",
    "title": "Understanding Anxiety",
    "minutes": 5,
    "order": 3,
    "problem": "You feel on edge and can't tell if something's actually wrong.",
    "learnTitle": "An alarm that goes off too easily",
    "learnBody": "Anxiety is a smoke alarm with the sensitivity turned all the way up. It's not lying to you on purpose — it's protecting you from things that used to be dangerous. Avoiding what scares you makes the alarm louder over time. Facing it in small doses turns it down.",
    "activity": {
      "kind": "sliders",
      "title": "Where's your alarm today?",
      "prompt": "Move each slider to where you are right now.",
      "sliders": [
        {
          "id": "body",
          "label": "Body",
          "minLabel": "Relaxed",
          "maxLabel": "Wired"
        },
        {
          "id": "worry",
          "label": "Worry",
          "minLabel": "Quiet",
          "maxLabel": "Loud"
        },
        {
          "id": "hope",
          "label": "Hope",
          "minLabel": "Low",
          "maxLabel": "High"
        }
      ]
    },
    "adelReflection": "Anxiety runs quieter when you look right at it instead of around it.",
    "adelQuestion": "What's one thing you've been avoiding because of the alarm?",
    "insight": "Anxiety is an alarm, not evidence.",
    "action": "Do one small piece of something you've been avoiding.",
    "toolkitLabel": "My anxiety alarm check"
  },
  {
    "id": "understanding-bipolar",
    "categoryId": "understanding",
    "title": "Understanding Bipolar Disorder",
    "minutes": 6,
    "order": 4,
    "problem": "Your moods swing hard and you can't predict them.",
    "learnTitle": "Two directions, one condition",
    "learnBody": "Bipolar disorder means mood moves in both directions — down into depression, up into elevated or irritable energy. The up side can feel great at first, which is why it's easy to miss. The most useful skill is knowing your early warning signs before the swing gets big: sleep changes, spending, talking fast, big plans.",
    "activity": {
      "kind": "reflection",
      "title": "Your early warning signs",
      "prompt": "Tap the ones you've noticed before a swing.",
      "cards": [
        "Sleeping way less and not feeling tired",
        "Talking faster than usual",
        "Big spending or big plans",
        "Irritable with everyone",
        "Withdrawing from everyone",
        "Nothing feels worth doing"
      ]
    },
    "adelReflection": "Warning signs aren't failure. They're information — the earlier you see them, the smaller the swing.",
    "adelQuestion": "Who in your life notices your signs before you do?",
    "insight": "You can't control the weather, but you can read the sky.",
    "action": "Tell one person your top two warning signs so they can flag them.",
    "toolkitLabel": "My mood warning signs"
  },
  {
    "id": "understanding-ptsd",
    "categoryId": "understanding",
    "title": "Understanding PTSD & Trauma",
    "minutes": 7,
    "order": 5,
    "problem": "Memories or reactions hit you out of nowhere.",
    "learnTitle": "Your body kept the receipt",
    "learnBody": "Trauma is stored differently than regular memory. That's why a smell, a voice, or a hallway can drop you straight back into it. This isn't weakness or being 'stuck in the past' — it's a survival system that never got the message that it's over. It can be treated, and it does get better.",
    "activity": {
      "kind": "reflection",
      "title": "What does your body do when a memory hits?",
      "prompt": "Tap all that apply. There's no wrong answer.",
      "cards": [
        "Chest tightens",
        "I go numb / far away",
        "I get angry fast",
        "I need to leave the room",
        "I can't remember what happened after",
        "I want to use"
      ]
    },
    "adelReflection": "Those are survival responses, not character. Knowing yours makes them less scary.",
    "adelQuestion": "What helps you come back after one of those moments?",
    "insight": "It's not happening again. Your body just remembers like it is.",
    "action": "Practice one grounding tool while you're calm, so it's ready when you're not.",
    "toolkitLabel": "My trauma response map"
  },
  {
    "id": "understanding-psychosis",
    "categoryId": "understanding",
    "title": "Understanding Schizophrenia & Psychosis",
    "minutes": 7,
    "order": 6,
    "problem": "You've heard or seen things others didn't, or been told you did.",
    "learnTitle": "The brain's filter slips",
    "learnBody": "Psychosis means the brain's filter between inside and outside gets thin — thoughts can sound like voices, patterns can look like meaning. It's a medical experience, not a moral one, and it responds to treatment. Sleep, stress, and substances all make it louder.",
    "activity": {
      "kind": "sort",
      "prompt": "Helpful vs harmful — Sort what tends to help from what tends to make it worse.",
      "buckets": [
        "Helps",
        "Makes it worse"
      ],
      "cards": [
        "Staying on medication",
        "Skipping sleep",
        "Telling my treatment team early",
        "Using stimulants",
        "Keeping a routine",
        "Isolating for days"
      ]
    },
    "adelReflection": "Nothing on that list is about being a good or bad person. It's about what keeps the filter working.",
    "adelQuestion": "Who's the first person you'd tell if things got loud again?",
    "insight": "This is a health condition with a treatment plan, not a verdict on who you are.",
    "action": "Protect your sleep tonight — it's the single biggest lever.",
    "toolkitLabel": "What helps my filter",
    "populations": [
      "pre_release_ji",
      "post_release_ji"
    ]
  },
  {
    "id": "understanding-my-triggers-2",
    "categoryId": "understanding",
    "title": "Understanding My Triggers",
    "minutes": 5,
    "order": 7,
    "problem": "Something sets you off and you only figure it out afterward.",
    "learnTitle": "Triggers are patterns, not surprises",
    "learnBody": "A trigger is anything your brain has linked to a strong feeling or an old behavior — a person, a place, a time of day, an emotion. They feel random because they fire fast. Written down, most people find they have four or five, not fifty.",
    "activity": {
      "kind": "reflection",
      "title": "Your top triggers",
      "prompt": "Tap the ones that hit hardest.",
      "cards": [
        "Payday",
        "Being alone at night",
        "Family conflict",
        "Certain streets or houses",
        "Feeling disrespected",
        "Boredom",
        "Being told no",
        "Anniversaries"
      ]
    },
    "adelReflection": "That's a short list. Short lists can be planned for.",
    "adelQuestion": "Which one is most likely to show up this week?",
    "insight": "A trigger you can name is a trigger you can plan around.",
    "action": "Pick your top trigger and write one 'if this, then I' line for it.",
    "toolkitLabel": "My trigger list"
  },
  {
    "id": "understanding-my-strengths",
    "categoryId": "understanding",
    "title": "Understanding My Strengths",
    "minutes": 5,
    "order": 8,
    "problem": "You can list what's wrong with you faster than what's right.",
    "learnTitle": "Strengths are evidence, not compliments",
    "learnBody": "Recovery gets built on what already works. Surviving hard things builds real skills: reading a room, handling pressure, loyalty, resourcefulness. Naming them isn't bragging — it's inventory. You need to know what you're working with.",
    "activity": {
      "kind": "reflection",
      "title": "What's true about you?",
      "prompt": "Tap anything that's been true at least once.",
      "cards": [
        "I keep my word",
        "I can handle pressure",
        "I read people well",
        "I'm resourceful",
        "I show up for people I love",
        "I've survived things most people haven't",
        "I ask questions",
        "I can start over"
      ]
    },
    "adelReflection": "Every one of those is a tool you already own.",
    "adelQuestion": "Where could you use one of those strengths this week?",
    "insight": "You're not starting from zero. You're starting from experience.",
    "action": "Use one of your strengths on purpose today and notice it.",
    "toolkitLabel": "My strengths inventory"
  },
  {
    "id": "understanding-treatment-team",
    "categoryId": "understanding",
    "title": "Understanding My Treatment Team",
    "minutes": 5,
    "order": 9,
    "problem": "There are a lot of names and titles and you're not sure who does what.",
    "learnTitle": "Everyone has one job",
    "learnBody": "A treatment team usually includes a prescriber for medication, a therapist or counselor for talking work, a case manager for the practical stuff, and a peer specialist who's been where you are. You're on the team too — the plan doesn't work without your input.",
    "activity": {
      "kind": "sort",
      "prompt": "Who do I call? — Sort each need to the right person.",
      "buckets": [
        "Prescriber / Case manager",
        "Counselor / Peer"
      ],
      "cards": [
        "Side effects from my medication",
        "I need help with housing paperwork",
        "I want to talk through what happened",
        "I need someone who's been through it"
      ]
    },
    "adelReflection": "When you know who does what, you stop waiting for the wrong person to fix it.",
    "adelQuestion": "Which of your team members do you know the least?",
    "insight": "You're not a case. You're a member of your own team.",
    "action": "Save one team member's number in your phone with their role in the name.",
    "toolkitLabel": "My treatment team map"
  },
  {
    "id": "understanding-recovery-journey-2",
    "categoryId": "understanding",
    "title": "Understanding My Recovery Journey",
    "minutes": 6,
    "order": 10,
    "problem": "You want to know what recovery actually looks like over time.",
    "learnTitle": "Recovery is a road, not a switch",
    "learnBody": "Recovery moves through stages: getting stable, building routines, reconnecting with people, growing into goals, and eventually helping others. Movement isn't a straight line, and going back a stage isn't starting over — you keep everything you learned.",
    "activity": {
      "kind": "timeline",
      "title": "The stages",
      "prompt": "Put the stages in order, then think about where you are.",
      "steps": [
        "Stabilizing — basic needs steady",
        "Building strength — routines hold",
        "Reconnecting — relationships repair",
        "Growing — goals and purpose",
        "Thriving — helping others"
      ]
    },
    "adelReflection": "Wherever you are on that road is a real place, not a waiting room.",
    "adelQuestion": "What would moving one step forward look like for you?",
    "insight": "Recovery isn't a day you arrive at. It's a direction you keep facing.",
    "action": "Name your current stage and one thing that would help you hold it.",
    "toolkitLabel": "Where I am on the road"
  },
  {
    "id": "treatment-why-meds",
    "categoryId": "treatment",
    "title": "Why My Medication Matters",
    "minutes": 5,
    "order": 1,
    "problem": "You're not sure medication is really doing anything.",
    "learnTitle": "Medication buys you room",
    "learnBody": "Medication doesn't fix your life. It lowers the volume enough that the rest of the work — therapy, routines, relationships — becomes possible. That's why it often feels like 'nothing's happening': what's happening is fewer bad days, not instant good ones.",
    "activity": {
      "kind": "sort",
      "prompt": "True or myth? — Sort each statement.",
      "buckets": [
        "True",
        "Myth"
      ],
      "cards": [
        "Needing medication means I'm weak",
        "It can take weeks to feel a difference",
        "If I feel better I should stop",
        "Side effects can often be adjusted",
        "Medication replaces therapy"
      ]
    },
    "adelReflection": "Most people stop when they start feeling better — and that's usually the medication working.",
    "adelQuestion": "What's your biggest question about your medication right now?",
    "insight": "Medication doesn't do the work. It makes the work possible.",
    "action": "Write your top medication question down and bring it to your next visit.",
    "toolkitLabel": "My medication questions"
  },
  {
    "id": "treatment-med-routine",
    "categoryId": "treatment",
    "title": "Building My Medication Routine",
    "minutes": 4,
    "order": 2,
    "problem": "You forget doses, or the timing keeps slipping.",
    "learnTitle": "Anchor it to something you already do",
    "learnBody": "Memory is a bad system. Habit stacking is a good one: attach your dose to something that already happens at the same time — coffee, brushing your teeth, feeding a pet. Put the bottle where the anchor happens.",
    "activity": {
      "kind": "reflection",
      "title": "Pick your anchor",
      "prompt": "Tap the thing you already do at the right time.",
      "cards": [
        "Morning coffee",
        "Brushing teeth",
        "Feeding my pet",
        "Getting in the car",
        "Charging my phone at night",
        "Right after dinner"
      ]
    },
    "adelReflection": "An anchor beats a reminder, because you don't have to remember to remember.",
    "adelQuestion": "Where will you keep the bottle so it's next to that anchor?",
    "insight": "Don't build willpower. Build a spot on the counter.",
    "action": "Move your medication next to your anchor tonight.",
    "toolkitLabel": "My medication anchor"
  },
  {
    "id": "treatment-tracking-feelings",
    "categoryId": "treatment",
    "title": "Tracking How I'm Feeling",
    "minutes": 5,
    "order": 3,
    "problem": "When your provider asks how it's going, you can't remember.",
    "learnTitle": "Ten seconds a day beats memory",
    "learnBody": "Your brain remembers the worst day, not the average week. A daily one-number rating gives you and your prescriber an actual trend line — which is how doses get adjusted correctly instead of by guesswork.",
    "activity": {
      "kind": "sliders",
      "title": "Rate today",
      "prompt": "This is the whole tracking system. Ten seconds.",
      "sliders": [
        {
          "id": "mood",
          "label": "Mood",
          "minLabel": "Rough",
          "maxLabel": "Good"
        },
        {
          "id": "sleep",
          "label": "Sleep last night",
          "minLabel": "Bad",
          "maxLabel": "Solid"
        },
        {
          "id": "side",
          "label": "Side effects today",
          "minLabel": "None",
          "maxLabel": "Heavy"
        }
      ]
    },
    "adelReflection": "Three numbers a day gives your prescriber more than an hour of trying to remember.",
    "adelQuestion": "What time of day would be easiest to log this?",
    "insight": "Data beats memory in the appointment room.",
    "action": "Log your three numbers once today.",
    "toolkitLabel": "My daily 3-number check"
  },
  {
    "id": "treatment-side-effects",
    "categoryId": "treatment",
    "title": "Managing Side Effects",
    "minutes": 6,
    "order": 4,
    "problem": "Something about how you feel on this medication isn't right.",
    "learnTitle": "Side effects are negotiable",
    "learnBody": "Most side effects can be reduced — by timing, dose, or a different medication. What can't be fixed is a side effect nobody knows about. Stopping on your own is the riskiest option; reporting it is the fastest route to feeling better.",
    "activity": {
      "kind": "reflection",
      "title": "What have you noticed?",
      "prompt": "Tap anything that's shown up since you started.",
      "cards": [
        "Tired all day",
        "Dry mouth",
        "Weight change",
        "Trouble sleeping",
        "Stomach issues",
        "Feeling flat or numb",
        "Shaky or restless"
      ]
    },
    "adelReflection": "That list is exactly what your prescriber needs to hear — nothing on it is a complaint.",
    "adelQuestion": "Which one bothers you the most day to day?",
    "insight": "A reported side effect can be fixed. A silent one just gets you to quit.",
    "action": "Message or call your prescriber about your top side effect this week.",
    "toolkitLabel": "My side effect list"
  },
  {
    "id": "treatment-talking-provider",
    "categoryId": "treatment",
    "title": "Talking With My Provider",
    "minutes": 5,
    "order": 5,
    "problem": "Appointments go fast and you leave without saying what mattered.",
    "learnTitle": "Three things, written down",
    "learnBody": "Providers work in short windows. The people who get the most out of a visit bring three things: what's better, what's worse, and one question. Written down, in your pocket. It changes the whole appointment.",
    "activity": {
      "kind": "decision",
      "title": "Your appointment is 12 minutes. You...",
      "prompt": "Pick the move.",
      "choices": [
        {
          "label": "Wait to see what they ask",
          "feedback": "Then the visit gets shaped by their checklist, not your life."
        },
        {
          "label": "Open with your three things",
          "feedback": "Yes. It puts your priorities in the first two minutes, where they'll actually get addressed.",
          "good": true
        },
        {
          "label": "Say everything's fine and leave",
          "feedback": "Common, and it costs you months. Providers can only respond to what they hear."
        }
      ]
    },
    "adelReflection": "You're allowed to run part of that meeting. It's your care.",
    "adelQuestion": "What's the one thing you've been meaning to say and haven't?",
    "insight": "Bring three things. Say them first.",
    "action": "Write your three things for your next appointment now.",
    "toolkitLabel": "My three things"
  },
  {
    "id": "treatment-missed-dose",
    "categoryId": "treatment",
    "title": "What If I Miss a Dose?",
    "minutes": 4,
    "order": 6,
    "problem": "You missed one and you don't know what to do.",
    "learnTitle": "One miss isn't a restart",
    "learnBody": "Missing a dose is common and usually fixable. The general rule: take it when you remember unless it's close to the next one — then skip and go on as normal. Never double up without asking. Two misses in a row is worth a call.",
    "activity": {
      "kind": "decision",
      "title": "You realize at 2pm you missed this morning's dose. You...",
      "prompt": "Pick what you'd do.",
      "choices": [
        {
          "label": "Take it now",
          "feedback": "Usually right if the next dose is hours away. Check with your pharmacist for your specific medication.",
          "good": true
        },
        {
          "label": "Double up tonight",
          "feedback": "Risky — doubling can spike side effects. Ask before you ever do this."
        },
        {
          "label": "Give up on the day",
          "feedback": "One miss doesn't undo the week. Get back on at the next scheduled time."
        }
      ]
    },
    "adelReflection": "The goal is a pattern, not a perfect record.",
    "adelQuestion": "What made this morning's dose slip?",
    "insight": "One miss is a miss. Quitting is the only real failure mode.",
    "action": "Save your pharmacy's number in your phone today.",
    "toolkitLabel": "My missed-dose rule"
  },
  {
    "id": "treatment-habits-treatment",
    "categoryId": "treatment",
    "title": "Building Healthy Habits Around Treatment",
    "minutes": 5,
    "order": 7,
    "problem": "The medication is one piece, but the rest of the day works against it.",
    "learnTitle": "Medication has helpers",
    "learnBody": "Sleep, food, movement, water, and cutting back on alcohol all change how well medication works. None of these are extra credit — they're part of the treatment. Pick one, not all five.",
    "activity": {
      "kind": "sort",
      "prompt": "Helps my treatment work or fights it? — Sort each one.",
      "buckets": [
        "Helps",
        "Fights it"
      ],
      "cards": [
        "Sleeping 7+ hours",
        "Drinking on top of it",
        "Eating something with the dose",
        "Skipping meals all day",
        "A 15-minute walk",
        "Heavy caffeine all day"
      ]
    },
    "adelReflection": "You don't need all of them. One consistent helper moves the needle.",
    "adelQuestion": "Which helper is most realistic for you this week?",
    "insight": "Medication works better with a body that's been fed and rested.",
    "action": "Pick one helper and do it today.",
    "toolkitLabel": "My treatment helper"
  },
  {
    "id": "treatment-treatment-goals",
    "categoryId": "treatment",
    "title": "Understanding My Treatment Goals",
    "minutes": 5,
    "order": 8,
    "problem": "You're in treatment but nobody's said what 'better' looks like.",
    "learnTitle": "Goals should be yours",
    "learnBody": "A treatment plan should answer one question: what do you want your life to look like? 'Fewer symptoms' is a clinical goal. 'Be steady enough to see my kids' is a real one. When your goals are written in, the plan starts making sense.",
    "activity": {
      "kind": "reflection",
      "title": "What would 'better' actually mean?",
      "prompt": "Tap what matters to you.",
      "cards": [
        "Sleeping through the night",
        "Being trusted again",
        "Holding a job",
        "Staying out of the hospital",
        "Being present with my kids",
        "Feeling like myself",
        "Staying off substances"
      ]
    },
    "adelReflection": "Those are goals a plan can be built around.",
    "adelQuestion": "Which one would you want written at the top of your chart?",
    "insight": "If the goal isn't yours, the plan won't stick.",
    "action": "Tell your provider or case manager your top goal in your own words.",
    "toolkitLabel": "My treatment goals"
  },
  {
    "id": "treatment-prep-appointments",
    "categoryId": "treatment",
    "title": "Preparing for Appointments",
    "minutes": 4,
    "order": 9,
    "problem": "You show up unprepared, or you don't show up at all.",
    "learnTitle": "The appointment starts the day before",
    "learnBody": "Most missed appointments aren't about motivation — they're about transportation, timing, and forgetting. A short prep list the night before handles all three: confirm the time, plan the ride, put your notes and med list in your pocket.",
    "activity": {
      "kind": "timeline",
      "title": "Your prep order",
      "prompt": "Put the steps in the order that works.",
      "steps": [
        "Confirm date and time",
        "Plan the ride",
        "Write my three things",
        "Bring my medication list",
        "Set an alarm the night before",
        "Show up 10 minutes early"
      ]
    },
    "adelReflection": "That's not a lot of work. It's the difference between going and not going.",
    "adelQuestion": "Which step usually breaks down for you?",
    "insight": "Showing up is a logistics problem, not a character problem.",
    "action": "Plan the ride for your next appointment today.",
    "toolkitLabel": "My appointment prep list"
  },
  {
    "id": "treatment-ownership",
    "categoryId": "treatment",
    "title": "Taking Ownership of My Recovery",
    "minutes": 6,
    "order": 10,
    "problem": "It can feel like treatment is something happening to you.",
    "learnTitle": "You're the one who lives here",
    "learnBody": "Providers give options; you make choices. Ownership means asking questions, saying when something isn't working, and knowing your own plan well enough to explain it. People who own their plan stay in treatment longer and do better — that's not motivation talk, it's the data.",
    "activity": {
      "kind": "decision",
      "title": "A new medication is suggested and you're unsure. You...",
      "prompt": "Pick your move.",
      "choices": [
        {
          "label": "Say yes and figure it out later",
          "feedback": "Common — and it's how people quietly stop taking things."
        },
        {
          "label": "Ask what it's for, what to expect, and when to check back",
          "feedback": "That's ownership. Three questions and you're a partner, not a passenger.",
          "good": true
        },
        {
          "label": "Say no automatically",
          "feedback": "Fair instinct, but ask first. You can still say no after you know."
        }
      ]
    },
    "adelReflection": "Owning it doesn't mean doing it alone. It means having a say.",
    "adelQuestion": "What's one part of your plan you'd want to change?",
    "insight": "Nobody recovers on someone else's plan.",
    "action": "Ask one question about your treatment this week.",
    "toolkitLabel": "My ownership questions"
  },
  {
    "id": "train-mind-thoughts-wont-stop",
    "categoryId": "train-mind",
    "title": "My Thoughts Won't Stop",
    "minutes": 5,
    "order": 1,
    "problem": "Your mind keeps replaying the same thing over and over.",
    "learnTitle": "The loop has an exit",
    "learnBody": "Replaying a moment feels like solving it, but the brain treats repetition as importance — so the loop gets stronger. The exit isn't stopping the thought. It's noticing it, naming it as a loop, and moving your body or attention somewhere specific.",
    "activity": {
      "kind": "timeline",
      "title": "The thought loop",
      "prompt": "Put the loop in order so you can spot where you jump in.",
      "steps": [
        "Something reminds me",
        "The replay starts",
        "I look for what I did wrong",
        "Feeling gets stronger",
        "I replay again",
        "Notice — and step out"
      ]
    },
    "adelReflection": "You don't have to win the argument in your head. You just have to leave it.",
    "adelQuestion": "What thought loops the most for you?",
    "insight": "You can't stop a thought. You can stop feeding it.",
    "action": "Next loop, say 'that's a loop' and do something with your hands for 2 minutes.",
    "toolkitLabel": "Loop exit"
  },
  {
    "id": "train-mind-fact-story",
    "categoryId": "train-mind",
    "title": "Thoughts Are Not Always Facts",
    "minutes": 5,
    "order": 2,
    "problem": "Your thoughts feel like the truth even when they hurt.",
    "learnTitle": "Thoughts are guesses your brain makes fast",
    "learnBody": "A thought arrives with confidence, not proof. 'They're mad at me' and 'they didn't text back' feel like one thing, but only one of them is a fact. Separating the two is the single most useful skill in this whole collection.",
    "activity": {
      "kind": "sort",
      "prompt": "Fact or story? — Sort each statement.",
      "buckets": [
        "Fact",
        "Story"
      ],
      "cards": [
        "She didn't answer my call",
        "She's done with me",
        "I got written up at work",
        "I'll never keep a job",
        "I felt shaky at the meeting"
      ]
    },
    "adelReflection": "Facts you can act on. Stories you can question.",
    "adelQuestion": "What story has your brain been repeating this week?",
    "insight": "A thought is a guess, not a verdict.",
    "action": "Write one story you had today and the fact underneath it.",
    "toolkitLabel": "Fact vs story"
  },
  {
    "id": "train-mind-thinking-traps",
    "categoryId": "train-mind",
    "title": "Catching Thinking Traps",
    "minutes": 6,
    "order": 3,
    "problem": "Your brain jumps to the worst version of everything.",
    "learnTitle": "Old patterns with names",
    "learnBody": "Thinking traps are shortcuts your brain repeats: all-or-nothing, mind reading, catastrophizing, should statements. They're not stupidity — they're speed. Naming the trap slows it down enough for something more accurate to get in.",
    "activity": {
      "kind": "reflection",
      "title": "Which traps sound like your brain?",
      "prompt": "Tap the ones you recognize.",
      "cards": [
        "All-or-nothing — one slip means I failed",
        "Mind reading — I know what they think of me",
        "Catastrophizing — worst case is the real case",
        "Should statements — I should be further along",
        "Labeling — I'm just a screw-up",
        "Filtering — only the bad parts count"
      ]
    },
    "adelReflection": "You just named your brain's favorite shortcuts. They lose power once they have names.",
    "adelQuestion": "Which trap costs you the most?",
    "insight": "Catch the trap and you get your choice back.",
    "action": "Name your trap out loud the next time it fires today.",
    "toolkitLabel": "My thinking traps"
  },
  {
    "id": "train-mind-inner-voice",
    "categoryId": "train-mind",
    "title": "Changing My Inner Voice",
    "minutes": 5,
    "order": 4,
    "problem": "The voice in your head talks to you worse than anyone else does.",
    "learnTitle": "Honest isn't the same as harsh",
    "learnBody": "A harsh inner voice usually came from somewhere real — someone said it first. But harshness doesn't create change; it creates avoidance. The alternative isn't fake positivity. It's honest and fair: what's true, said the way you'd say it to someone you care about.",
    "activity": {
      "kind": "sort",
      "prompt": "Harsh or honest? — Sort each line.",
      "buckets": [
        "Honest",
        "Harsh"
      ],
      "cards": [
        "I messed that up and I can fix part of it",
        "I'm worthless",
        "That was harder than I expected",
        "I always ruin everything",
        "I need help with this"
      ]
    },
    "adelReflection": "Honest lines still hold you accountable. They just don't take you out.",
    "adelQuestion": "What would you say to a friend in your exact situation?",
    "insight": "Talk to yourself like someone you're responsible for.",
    "action": "Rewrite one harsh line you said to yourself today.",
    "toolkitLabel": "My honest voice"
  },
  {
    "id": "train-mind-worry-cycle",
    "categoryId": "train-mind",
    "title": "Breaking the Worry Cycle",
    "minutes": 5,
    "order": 5,
    "problem": "Worry keeps you up and doesn't change anything.",
    "learnTitle": "Worry needs a container",
    "learnBody": "Worry expands to fill whatever time you give it. Two things shrink it: a set worry window (10 minutes, same time daily) and a forced ending — either a step you take or a written 'not today.' The brain accepts a container better than a ban.",
    "activity": {
      "kind": "sliders",
      "title": "Score this worry",
      "prompt": "Move the sliders for the worry that's loudest.",
      "sliders": [
        {
          "id": "control",
          "label": "How much of this can I actually control?",
          "minLabel": "None",
          "maxLabel": "All"
        },
        {
          "id": "today",
          "label": "Is there anything I can do about it today?",
          "minLabel": "No",
          "maxLabel": "Yes"
        }
      ]
    },
    "adelReflection": "Low control plus nothing today means it goes in the parking lot, not the driver's seat.",
    "adelQuestion": "What time of day would your worry window be?",
    "insight": "Give worry a window and it stops taking the whole house.",
    "action": "Hold a 10-minute worry window today, then close it.",
    "toolkitLabel": "My worry window"
  },
  {
    "id": "train-mind-bigger-picture",
    "categoryId": "train-mind",
    "title": "Seeing Things Differently",
    "minutes": 5,
    "order": 6,
    "problem": "One bad thing colors the whole day.",
    "learnTitle": "Zoom out on purpose",
    "learnBody": "Under stress, attention narrows to the threat. That's useful in danger and terrible for daily life. Deliberately asking 'what else is also true today?' widens the frame — not to erase the bad thing, but to put it next to everything else.",
    "activity": {
      "kind": "reflection",
      "title": "What else is true today?",
      "prompt": "Tap everything that's also true.",
      "cards": [
        "I got out of bed",
        "Someone was decent to me",
        "I ate something",
        "I didn't use",
        "I did one thing I said I'd do",
        "I'm still here"
      ]
    },
    "adelReflection": "The hard thing is still real. It's just not the only thing.",
    "adelQuestion": "What's one part of today you almost didn't count?",
    "insight": "Zooming out doesn't erase the bad. It stops it from being everything.",
    "action": "Name three things that also went okay before bed tonight.",
    "toolkitLabel": "What else is true"
  },
  {
    "id": "train-mind-confidence-decisions",
    "categoryId": "train-mind",
    "title": "Building Confidence in My Decisions",
    "minutes": 5,
    "order": 7,
    "problem": "You second-guess yourself until you don't decide at all.",
    "learnTitle": "Good decisions come from a process",
    "learnBody": "Confidence isn't feeling sure — it's having a way to decide. Name the choice, list what matters, pick, and set a check-in date. Most decisions are reversible, and the cost of not deciding is usually higher than the cost of deciding imperfectly.",
    "activity": {
      "kind": "timeline",
      "title": "Your decision steps",
      "prompt": "Put the process in order.",
      "steps": [
        "Name the actual choice",
        "What matters most to me here",
        "List the two real options",
        "Pick one",
        "Tell someone",
        "Check back in a week"
      ]
    },
    "adelReflection": "That's a process you can reuse on anything — housing, work, relationships.",
    "adelQuestion": "What decision have you been sitting on?",
    "insight": "Confidence follows a repeatable process, not a good feeling.",
    "action": "Run one small decision through those steps today.",
    "toolkitLabel": "My decision steps"
  },
  {
    "id": "train-mind-letting-go-shame",
    "categoryId": "train-mind",
    "title": "Letting Go of Shame",
    "minutes": 6,
    "order": 8,
    "problem": "What you've done feels like who you are.",
    "learnTitle": "Guilt says 'I did'. Shame says 'I am'.",
    "learnBody": "Guilt can be useful — it points to a repair. Shame just isolates, and isolation is where relapse and depression live. Moving out of shame usually takes two things: saying it out loud to one safe person, and doing one concrete repair.",
    "activity": {
      "kind": "sort",
      "prompt": "Guilt or shame? — Sort each statement.",
      "buckets": [
        "Guilt — points to action",
        "Shame — points to me"
      ],
      "cards": [
        "I hurt someone I love",
        "I'm a bad person",
        "I broke a promise",
        "I'm unfixable",
        "I need to make that right"
      ]
    },
    "adelReflection": "Guilt gives you somewhere to go. Shame just keeps you home.",
    "adelQuestion": "Who's the one person you could say the hard thing to?",
    "insight": "You are not the worst thing you've done.",
    "action": "Say one shame thought out loud to a safe person or write it down and read it back.",
    "toolkitLabel": "Guilt vs shame"
  },
  {
    "id": "train-mind-solving-problems",
    "categoryId": "train-mind",
    "title": "Solving Problems Step by Step",
    "minutes": 5,
    "order": 9,
    "problem": "The problem is too big and you freeze.",
    "learnTitle": "Big problems are stacked small ones",
    "learnBody": "'Fix my housing' isn't a task — it's a category. Problem-solving works when you turn a category into one next action you could do in under 20 minutes: make one call, find one form, ask one person.",
    "activity": {
      "kind": "decision",
      "title": "You need housing in 30 days. First move?",
      "prompt": "Pick the most useful first step.",
      "choices": [
        {
          "label": "Search everything online for 3 hours",
          "feedback": "Feels productive, usually ends in overwhelm. Narrow it to one call."
        },
        {
          "label": "Call my case manager and ask for the two best options",
          "feedback": "Yes. One call turns a category into two real choices.",
          "good": true
        },
        {
          "label": "Wait until it's closer",
          "feedback": "Understandable, but 30 days shrinks fast. Do one thing today."
        }
      ]
    },
    "adelReflection": "The move is always the same: shrink it until it fits in 20 minutes.",
    "adelQuestion": "What big thing could you shrink right now?",
    "insight": "You don't solve the problem. You take the next step in it.",
    "action": "Take one 20-minute step on your biggest problem today.",
    "toolkitLabel": "Shrink it to 20 minutes"
  },
  {
    "id": "train-mind-resilient-mindset",
    "categoryId": "train-mind",
    "title": "Building a Resilient Mindset",
    "minutes": 6,
    "order": 10,
    "problem": "Setbacks knock you all the way back down.",
    "learnTitle": "Resilience is a set of habits",
    "learnBody": "Resilient people aren't tougher — they recover faster, because they've practiced a few things: they name what happened without exaggerating it, they keep one routine going, and they tell someone. Bounce-back speed is trainable.",
    "activity": {
      "kind": "reflection",
      "title": "What helps you bounce back?",
      "prompt": "Tap what's worked before, even once.",
      "cards": [
        "Talking to someone",
        "Getting outside",
        "Going back to my routine the next day",
        "Writing it down",
        "A meeting",
        "Helping someone else",
        "Sleeping and trying again"
      ]
    },
    "adelReflection": "Those are your bounce-back moves. Knowing them means you don't have to invent them on a bad day.",
    "adelQuestion": "Which one is easiest to reach for when you're low?",
    "insight": "Resilience isn't not falling. It's how fast you get back to your routine.",
    "action": "Write your top two bounce-back moves and keep them in your phone.",
    "toolkitLabel": "My bounce-back moves"
  },
  {
    "id": "strengthen-recovery-want-to-use",
    "categoryId": "strengthen-recovery",
    "title": "Understanding My Cravings",
    "minutes": 5,
    "order": 1,
    "problem": "The urge to use hits hard and you don't know what it is.",
    "learnTitle": "A craving is a message, not a command",
    "learnBody": "Cravings come from a brain that learned a fast way to stop pain. They rise, peak, and fall — usually within 20 to 30 minutes if you don't act on them. Every craving you outlast makes the shortcut weaker. That's not willpower. That's rewiring.",
    "activity": {
      "kind": "breathing",
      "title": "Ride the wave",
      "prompt": "Breathe with the circle while the urge does its thing. In 4, hold 4, out 6.",
      "inhaleSec": 4,
      "holdSec": 4,
      "exhaleSec": 6,
      "rounds": 6
    },
    "adelReflection": "You just gave the wave time to crest without acting on it. That counts.",
    "adelQuestion": "What was going on right before the craving showed up?",
    "insight": "A craving is a wave. Waves crest.",
    "action": "Set a 20-minute timer next time and do anything else until it rings.",
    "toolkitLabel": "Ride the wave — 20 minutes"
  },
  {
    "id": "strengthen-recovery-triggers",
    "categoryId": "strengthen-recovery",
    "title": "Recognizing My Triggers",
    "minutes": 6,
    "order": 2,
    "problem": "Triggers keep catching you before you see them coming.",
    "learnTitle": "Most people have five, not fifty",
    "learnBody": "Triggers are people, places, times, and feelings your brain linked to using. Written down, the list is short — and short lists can be planned for. The goal isn't avoiding life. It's knowing which five need a plan.",
    "activity": {
      "kind": "reflection",
      "title": "Your top triggers",
      "prompt": "Tap the ones that hit hardest.",
      "cards": [
        "Payday",
        "Old friends",
        "Certain streets",
        "Fighting with family",
        "Being alone at night",
        "Boredom",
        "Feeling disrespected",
        "Celebrating"
      ]
    },
    "adelReflection": "That's your list. Five things you can build around instead of being surprised by.",
    "adelQuestion": "Which one is most likely to show up this week?",
    "insight": "A trigger you named is a trigger you planned for.",
    "action": "Write one 'if this happens, then I' line for your top trigger.",
    "toolkitLabel": "My trigger plan"
  },
  {
    "id": "strengthen-recovery-surfing",
    "categoryId": "strengthen-recovery",
    "title": "Surfing the Craving",
    "minutes": 5,
    "order": 3,
    "problem": "You know the craving will pass but you can't get through the middle.",
    "learnTitle": "The middle is the whole skill",
    "learnBody": "Urge surfing means staying with the sensation instead of fighting it or feeding it. You notice where it lives in your body, breathe, and describe it like weather. Fighting it stacks it. Watching it lets it crest.",
    "activity": {
      "kind": "timeline",
      "title": "The wave",
      "prompt": "Put the surf steps in order.",
      "steps": [
        "Notice the urge starting",
        "Name it: 'this is a craving'",
        "Find where it sits in my body",
        "Breathe and watch it rise",
        "Let it peak without acting",
        "Notice it drop"
      ]
    },
    "adelReflection": "You don't have to make it go away. You only have to outlast it.",
    "adelQuestion": "Where does a craving usually sit in your body?",
    "insight": "You can't stop the wave. You can stay on the board.",
    "action": "Practice the six steps once today, even at a low urge level.",
    "toolkitLabel": "Urge surfing steps"
  },
  {
    "id": "strengthen-recovery-recovery-choices",
    "categoryId": "strengthen-recovery",
    "title": "Making Recovery Choices",
    "minutes": 5,
    "order": 4,
    "problem": "Small choices add up and you don't always see them happening.",
    "learnTitle": "The decision happens early",
    "learnBody": "Most relapses don't start at the moment of use. They start three or four choices earlier — the ride you took, the number you kept, the meeting you skipped. Recovery gets easier when you make the decision at the early link in the chain, where it's cheap.",
    "activity": {
      "kind": "decision",
      "title": "An old friend offers you a ride. You...",
      "prompt": "Pick the move and see how it plays out.",
      "choices": [
        {
          "label": "Take the ride, I'll be fine",
          "feedback": "Maybe. But you just moved the decision to a harder place with fewer options."
        },
        {
          "label": "Say no and call someone else",
          "feedback": "That's the early link. Cheapest possible place to decide.",
          "good": true
        },
        {
          "label": "Take it but text my support first",
          "feedback": "Better than nothing — you kept a line open. Still a harder spot than needed."
        }
      ]
    },
    "adelReflection": "Recovery is mostly made of unglamorous early choices.",
    "adelQuestion": "Where's the earliest link in your usual chain?",
    "insight": "Decide early, where it's cheap.",
    "action": "Name the earliest link in your chain and one way to break it.",
    "toolkitLabel": "My early link"
  },
  {
    "id": "strengthen-recovery-stress-without-using",
    "categoryId": "strengthen-recovery",
    "title": "Handling Stress Without Using",
    "minutes": 6,
    "order": 5,
    "problem": "Stress builds and using is the only relief you fully trust.",
    "learnTitle": "You need replacements, not just rules",
    "learnBody": "Substances worked — that's why they're hard to leave. Quitting without replacements leaves a gap, and stress fills it. Real relief comes from a short menu you've tested: movement, cold, calling someone, food, sleep, a meeting.",
    "activity": {
      "kind": "reflection",
      "title": "What actually gives you relief?",
      "prompt": "Tap what's worked for you before, even a little.",
      "cards": [
        "Walking it off",
        "Cold water or a cold shower",
        "Calling someone",
        "A meeting",
        "Loud music",
        "Working with my hands",
        "Eating a real meal",
        "Sleeping it off"
      ]
    },
    "adelReflection": "That's a menu. When stress hits, you read the menu instead of deciding from scratch.",
    "adelQuestion": "Which one could you do in the next ten minutes?",
    "insight": "You don't quit relief. You replace it.",
    "action": "Do one thing from your relief menu today before you need it.",
    "toolkitLabel": "My relief menu"
  },
  {
    "id": "strengthen-recovery-one-bad-day",
    "categoryId": "strengthen-recovery",
    "title": "Recovering After a Setback",
    "minutes": 5,
    "order": 6,
    "problem": "You slipped and it feels like everything's gone.",
    "learnTitle": "A slip is data, not an identity",
    "learnBody": "What turns a slip into a relapse is usually shame and silence — not the substance. The people who recover fastest do three things within 24 hours: tell someone, look at what led to it, and get back to their routine the same day.",
    "activity": {
      "kind": "decision",
      "title": "You slipped last night. This morning you...",
      "prompt": "Pick what you'd do.",
      "choices": [
        {
          "label": "Hide it and hope nobody finds out",
          "feedback": "That's the path that turns one night into a month. Silence is the risk."
        },
        {
          "label": "Tell one person and go to today's meeting",
          "feedback": "Yes. Same-day return is what keeps a slip from becoming a slide.",
          "good": true
        },
        {
          "label": "Decide I've blown it and start Monday",
          "feedback": "Monday is a long way off. Start with the next hour instead."
        }
      ]
    },
    "adelReflection": "You didn't lose the time you put in. It's all still yours.",
    "adelQuestion": "What led up to it — what was happening that day?",
    "insight": "One bad day doesn't erase the days behind it.",
    "action": "If something happened, tell one person today.",
    "toolkitLabel": "My setback plan"
  },
  {
    "id": "strengthen-recovery-recovery-toolbox",
    "categoryId": "strengthen-recovery",
    "title": "Building My Recovery Toolbox",
    "minutes": 6,
    "order": 7,
    "problem": "In the moment you can't remember anything that helps.",
    "learnTitle": "A toolbox beats memory under pressure",
    "learnBody": "Under stress your thinking brain goes quiet. That's not the moment to invent a plan. A toolbox is a written short list — three tools, two people, one place — that you can read when you can't think.",
    "activity": {
      "kind": "reflection",
      "title": "Your toolbox",
      "prompt": "Tap what goes in yours.",
      "cards": [
        "Paced breathing",
        "5-4-3-2-1 grounding",
        "Call my sponsor",
        "Go to a meeting",
        "Cold water",
        "Walk",
        "Text my peer specialist",
        "Read my reasons list"
      ]
    },
    "adelReflection": "Keep it short. A toolbox with twenty things is a toolbox nobody opens.",
    "adelQuestion": "Which three would you want at the top?",
    "insight": "When you can't think, you read.",
    "action": "Put your top three tools in your phone notes today.",
    "toolkitLabel": "My recovery toolbox"
  },
  {
    "id": "strengthen-recovery-motivation",
    "categoryId": "strengthen-recovery",
    "title": "Strengthening My Motivation",
    "minutes": 5,
    "order": 8,
    "problem": "Some days you can't remember why you're doing this.",
    "learnTitle": "Motivation is a list, not a mood",
    "learnBody": "Motivation rises and falls — that's normal and not a warning sign. What holds is a written 'why': the specific people, freedoms, and futures you're doing this for. Reading it on a low day is more reliable than waiting to feel it.",
    "activity": {
      "kind": "reflection",
      "title": "Why are you doing this?",
      "prompt": "Tap every reason that's real for you.",
      "cards": [
        "My kids",
        "Staying out",
        "Getting my health back",
        "Being trusted again",
        "Proving something to myself",
        "A job I actually want",
        "Peace of mind",
        "Someone who believed in me"
      ]
    },
    "adelReflection": "That list is your fuel. It works even when the feeling isn't there.",
    "adelQuestion": "Which reason would carry you on the hardest day?",
    "insight": "You don't need to feel motivated. You need to remember why.",
    "action": "Write your top reason where you'll see it every morning.",
    "toolkitLabel": "My reasons list"
  },
  {
    "id": "strengthen-recovery-recovery-support-system",
    "categoryId": "strengthen-recovery",
    "title": "Building My Recovery Support System",
    "minutes": 6,
    "order": 9,
    "problem": "You're doing this mostly alone and it's heavy.",
    "learnTitle": "Recovery is a team sport",
    "learnBody": "The strongest predictor of staying in recovery isn't willpower — it's connection. A support system has layers: one person for 2am, a group that expects you, and a professional who knows your history. You don't need many. You need reachable.",
    "activity": {
      "kind": "sort",
      "prompt": "Who's on the team? — Sort these support types by whether you have one right now.",
      "buckets": [
        "I have this",
        "I need this"
      ],
      "cards": [
        "Someone I can call at 2am",
        "A regular meeting or group",
        "A counselor or peer specialist",
        "Someone sober I see weekly"
      ]
    },
    "adelReflection": "Whatever's in the 'need' pile is your next move — one at a time.",
    "adelQuestion": "Which gap would make the biggest difference to close?",
    "insight": "Nobody does this alone, and nobody's supposed to.",
    "action": "Reach out to one person or group today.",
    "toolkitLabel": "My support system map"
  },
  {
    "id": "strengthen-recovery-who-i-want",
    "categoryId": "strengthen-recovery",
    "title": "Becoming the Person I Want to Be",
    "minutes": 6,
    "order": 10,
    "problem": "You know what you're moving away from, not what you're moving toward.",
    "learnTitle": "Values pull harder than fear",
    "learnBody": "Fear-based recovery works for a while. Values-based recovery lasts, because it gives you something to walk toward. Naming what matters — being reliable, being present, being someone's steady person — makes daily choices simpler.",
    "activity": {
      "kind": "reflection",
      "title": "What matters most to you?",
      "prompt": "Tap the values you want your life to look like.",
      "cards": [
        "Being reliable",
        "Being honest",
        "Being present with my family",
        "Taking care of my health",
        "Doing work I'm proud of",
        "Helping other people",
        "Being calm",
        "Being free"
      ]
    },
    "adelReflection": "That's not a wish list. It's a direction you can check your day against.",
    "adelQuestion": "Which value did you already live out this week, even a little?",
    "insight": "Recovery isn't just quitting something. It's becoming someone.",
    "action": "Pick one value and do one thing today that matches it.",
    "toolkitLabel": "My values"
  },
  {
    "id": "big-emotions-understanding-emotions",
    "categoryId": "big-emotions",
    "title": "Understanding My Emotions",
    "minutes": 5,
    "order": 1,
    "problem": "You feel something strong but can't say what it is.",
    "learnTitle": "Emotions are information",
    "learnBody": "Every emotion is pointing at something: anger at a boundary crossed, fear at a threat, sadness at a loss, guilt at a value you broke. People who can name emotions precisely regulate them better — it's one of the most reliable findings in the field.",
    "activity": {
      "kind": "sort",
      "prompt": "What's it pointing at? — Match each feeling to what it usually signals.",
      "buckets": [
        "Something was crossed or threatened",
        "Something was lost or broken"
      ],
      "cards": [
        "Anger",
        "Fear",
        "Sadness",
        "Guilt"
      ]
    },
    "adelReflection": "You don't have to obey the emotion. You just have to hear what it's flagging.",
    "adelQuestion": "What emotion shows up most for you, and what might it be pointing at?",
    "insight": "Feelings are messengers, not orders.",
    "action": "Name one emotion out loud today and what it's about.",
    "toolkitLabel": "What my feelings point at"
  },
  {
    "id": "big-emotions-anger-signs",
    "categoryId": "big-emotions",
    "title": "The Anger Warning Signs",
    "minutes": 5,
    "order": 2,
    "problem": "By the time you notice you're angry, you're already at a 10.",
    "learnTitle": "Anger has a runway",
    "learnBody": "Anger doesn't come from nowhere — the body starts first: jaw, shoulders, hands, heat, faster breathing. Catching it at a 3 gives you options. At a 9, you only have damage control. Learning your own early signs is the whole skill.",
    "activity": {
      "kind": "reflection",
      "title": "Your early signs",
      "prompt": "Tap what your body does first.",
      "cards": [
        "Jaw tightens",
        "Hands clench",
        "Face gets hot",
        "Chest tight",
        "Voice gets louder",
        "Pacing",
        "Tunnel vision",
        "Going quiet and cold"
      ]
    },
    "adelReflection": "Those are your early warning lights. Nobody else sees them — you do.",
    "adelQuestion": "What's the very first sign, before all the others?",
    "insight": "Catch it at a 3 and you still have choices.",
    "action": "Check your jaw and shoulders three times today.",
    "toolkitLabel": "My anger warning signs"
  },
  {
    "id": "big-emotions-explode",
    "categoryId": "big-emotions",
    "title": "What Happens Before I React",
    "minutes": 4,
    "order": 3,
    "problem": "You go from zero to blowing up with nothing in between.",
    "learnTitle": "There's always a gap — it's just short",
    "learnBody": "Between the trigger and the reaction there's a gap of a few seconds. Under stress it feels like zero, but it's there. Six slow seconds is usually enough for the thinking part of your brain to come back online.",
    "activity": {
      "kind": "breathing",
      "title": "Six-second reset",
      "prompt": "Breathe in 4, out 6. Do it six times. That's the gap you're training.",
      "inhaleSec": 4,
      "holdSec": 4,
      "exhaleSec": 6,
      "rounds": 6
    },
    "adelReflection": "That's the gap. Every time you use it, it gets a little wider.",
    "adelQuestion": "What usually happens in your gap right now?",
    "insight": "You can't stop the spark. You can widen the gap.",
    "action": "Use six slow breaths once today before you answer someone.",
    "toolkitLabel": "Six-second gap"
  },
  {
    "id": "big-emotions-pause",
    "categoryId": "big-emotions",
    "title": "Creating My Pause Button",
    "minutes": 4,
    "order": 4,
    "problem": "You need something you can actually do in the moment.",
    "learnTitle": "A pause needs a script",
    "learnBody": "'Calm down' isn't a plan. A pause button is a specific sentence and a specific move: 'Give me ten minutes' + walk outside. Practiced ahead of time, it works even when you're hot, because you don't have to think of it.",
    "activity": {
      "kind": "decision",
      "title": "Someone cuts you off in traffic. You...",
      "prompt": "Pick your move.",
      "choices": [
        {
          "label": "Ride their bumper",
          "feedback": "Feels good for eight seconds and can cost you everything you're building."
        },
        {
          "label": "Say 'not worth it' out loud and slow down",
          "feedback": "That's a pause button — a line plus a physical move.",
          "good": true
        },
        {
          "label": "Stew about it for an hour",
          "feedback": "No blow-up, but it still runs your day. Try naming it and letting it go."
        }
      ]
    },
    "adelReflection": "The line matters as much as the breathing. It gives your mouth something to do.",
    "adelQuestion": "What's your line going to be?",
    "insight": "A pause is a sentence and a step, decided in advance.",
    "action": "Pick your pause line and say it out loud once today.",
    "toolkitLabel": "My pause button"
  },
  {
    "id": "big-emotions-choose-response",
    "categoryId": "big-emotions",
    "title": "Choosing My Response",
    "minutes": 5,
    "order": 5,
    "problem": "You react, then spend a week fixing what you said.",
    "learnTitle": "Reaction is fast. Response is chosen.",
    "learnBody": "A reaction protects your pride in the moment. A response protects the thing you actually want — the job, the relationship, your freedom. Asking 'what do I want to be true in an hour?' is the fastest way to pick the second one.",
    "activity": {
      "kind": "sort",
      "prompt": "Reaction or response? — Sort each one.",
      "buckets": [
        "Response",
        "Reaction"
      ],
      "cards": [
        "Yelling back",
        "Saying 'I need a minute'",
        "Slamming the door",
        "Asking what they meant",
        "Texting something I can't take back"
      ]
    },
    "adelReflection": "Both are human. Only one of them leaves you with options tomorrow.",
    "adelQuestion": "What do you usually want to be true an hour after a conflict?",
    "insight": "Ask what you want in an hour, not what you want right now.",
    "action": "Before your next hard reply, ask yourself the one-hour question.",
    "toolkitLabel": "The one-hour question"
  },
  {
    "id": "big-emotions-managing-conflict",
    "categoryId": "big-emotions",
    "title": "Managing Conflict",
    "minutes": 6,
    "order": 6,
    "problem": "Disagreements turn into fights fast.",
    "learnTitle": "Conflict isn't the problem — escalation is",
    "learnBody": "Disagreement is normal in every relationship that matters. What damages things is escalation: raising volume, bringing up the past, going for the weak spot. Staying on one topic, at one volume, is a skill you can practice.",
    "activity": {
      "kind": "decision",
      "title": "It's getting louder. You...",
      "prompt": "Pick the de-escalating move.",
      "choices": [
        {
          "label": "Match their volume so they hear you",
          "feedback": "Volume never wins an argument. It just moves it up a level."
        },
        {
          "label": "Lower your voice and stay on one topic",
          "feedback": "Yes. Lowering volume forces the other person to lower theirs to hear you.",
          "good": true
        },
        {
          "label": "Bring up what they did last month",
          "feedback": "That's the escalator. Now you're fighting about two things."
        }
      ]
    },
    "adelReflection": "One topic, one volume. That's most of conflict management.",
    "adelQuestion": "Who do you escalate with most, and what usually starts it?",
    "insight": "You don't have to win it. You have to keep it survivable.",
    "action": "In your next disagreement, keep it to one topic.",
    "toolkitLabel": "One topic, one volume"
  },
  {
    "id": "big-emotions-communicating-upset",
    "categoryId": "big-emotions",
    "title": "Communicating When I'm Upset",
    "minutes": 5,
    "order": 7,
    "problem": "When you're upset, what comes out isn't what you meant.",
    "learnTitle": "Three sentences",
    "learnBody": "Upset communication works better with a shape: what happened (facts), how it landed (your feeling), and what you're asking for (one request). It keeps you out of blame and gets you something you can actually receive.",
    "activity": {
      "kind": "timeline",
      "title": "Build the three sentences",
      "prompt": "Put them in the order that works.",
      "steps": [
        "When [what happened, just facts]",
        "I felt [one word]",
        "What I need is [one specific thing]",
        "Then stop talking and listen"
      ]
    },
    "adelReflection": "The last step is the hardest and it's where most of the repair happens.",
    "adelQuestion": "Who do you need to say three sentences to?",
    "insight": "Facts, feeling, request. Then listen.",
    "action": "Use the three-sentence shape once this week.",
    "toolkitLabel": "My three sentences"
  },
  {
    "id": "big-emotions-repair",
    "categoryId": "big-emotions",
    "title": "Repairing After Conflict",
    "minutes": 6,
    "order": 8,
    "problem": "You said something you regret and don't know how to come back.",
    "learnTitle": "Repair matters more than never messing up",
    "learnBody": "Every relationship has ruptures. What separates strong relationships isn't fewer fights — it's faster repair. A real repair names what you did, doesn't explain it away, and says what you'll do differently. No 'but'.",
    "activity": {
      "kind": "decision",
      "title": "You snapped at your kid this morning. Best repair?",
      "prompt": "Pick the strongest one.",
      "choices": [
        {
          "label": "Buy them something",
          "feedback": "It's a gesture, but it doesn't tell them what happened wasn't their fault."
        },
        {
          "label": "'I yelled and that wasn't okay. It wasn't about you. I'm working on it.'",
          "feedback": "That's a real repair — named, owned, no excuse.",
          "good": true
        },
        {
          "label": "'Sorry, but you were being difficult'",
          "feedback": "The 'but' erases the apology. Drop everything after it."
        }
      ]
    },
    "adelReflection": "Kids and adults both remember the repair more than the rupture.",
    "adelQuestion": "Is there a repair you've been putting off?",
    "insight": "Repair is the skill. Perfect is not available.",
    "action": "Make one repair today, even a small one.",
    "toolkitLabel": "My repair script"
  },
  {
    "id": "big-emotions-emotional-strength",
    "categoryId": "big-emotions",
    "title": "Building Emotional Strength",
    "minutes": 5,
    "order": 9,
    "problem": "Small things knock you sideways more than they should.",
    "learnTitle": "Capacity is physical first",
    "learnBody": "Emotional strength isn't attitude — it's capacity, and capacity runs on sleep, food, movement, and connection. Most 'overreactions' are a body running on empty. Fill the tank and the same events stop landing as hard.",
    "activity": {
      "kind": "sliders",
      "title": "Where's your tank today?",
      "prompt": "Be honest. This explains a lot of days.",
      "sliders": [
        {
          "id": "sleep",
          "label": "Sleep",
          "minLabel": "Empty",
          "maxLabel": "Full"
        },
        {
          "id": "food",
          "label": "Food and water",
          "minLabel": "Empty",
          "maxLabel": "Full"
        },
        {
          "id": "people",
          "label": "Connection",
          "minLabel": "Empty",
          "maxLabel": "Full"
        }
      ]
    },
    "adelReflection": "If two of those are low, today was always going to be harder. That's not a character issue.",
    "adelQuestion": "Which tank is easiest to top off today?",
    "insight": "You don't have a temper problem on a full tank.",
    "action": "Fill one tank today — a meal, a nap, or a call.",
    "toolkitLabel": "My capacity check"
  },
  {
    "id": "big-emotions-respond-not-react",
    "categoryId": "big-emotions",
    "title": "Responding Instead of Reacting",
    "minutes": 6,
    "order": 10,
    "problem": "You want this to be who you are, not something you try once.",
    "learnTitle": "It becomes automatic with reps",
    "learnBody": "Every time you catch an early sign, pause, and choose a response, you strengthen that path in your brain. It feels forced at first, like all new skills. After enough reps, the pause happens before you decide to make it happen.",
    "activity": {
      "kind": "timeline",
      "title": "Your full sequence",
      "prompt": "Put your whole system in order.",
      "steps": [
        "Notice the early sign",
        "Say my pause line",
        "Six slow breaths",
        "Ask: what do I want in an hour?",
        "Respond in three sentences",
        "Repair if I need to"
      ]
    },
    "adelReflection": "That's a complete system — and every part of it you've already practiced.",
    "adelQuestion": "Which step will you most need to practice?",
    "insight": "Responding isn't a personality. It's a rep count.",
    "action": "Run the whole sequence once this week and notice what happened.",
    "toolkitLabel": "My response sequence"
  },
  {
    "id": "support-team-count-on",
    "categoryId": "support-team",
    "title": "Who Can I Count On?",
    "minutes": 5,
    "order": 1,
    "problem": "You're not sure who's actually in your corner.",
    "learnTitle": "Support has layers",
    "learnBody": "Most people think of support as one big group. It's really layers: an inner circle of one or two, a wider circle you see regularly, and professionals who are paid to be reliable. You don't need a crowd. You need to know which layer each person is in.",
    "activity": {
      "kind": "sort",
      "prompt": "Your circle — who's actually here? — Sort each type of person by whether they're steady right now.",
      "buckets": [
        "Steady for me",
        "Not steady right now"
      ],
      "cards": [
        "Family",
        "Sober friends",
        "Sponsor or peer specialist",
        "Counselor or case manager",
        "Coworkers",
        "Old friends from before"
      ]
    },
    "adelReflection": "That's honest. Knowing who's steady stops you from calling the wrong number on a hard night.",
    "adelQuestion": "Who's the one person you'd call first?",
    "insight": "Two reliable people beat twenty maybes.",
    "action": "Save your first-call person at the top of your favorites.",
    "toolkitLabel": "My support circle"
  },
  {
    "id": "support-team-ask-help",
    "categoryId": "support-team",
    "title": "Asking for Help Is a Strength",
    "minutes": 5,
    "order": 2,
    "problem": "You'd rather struggle than ask.",
    "learnTitle": "Where 'don't ask' came from",
    "learnBody": "In a lot of environments, asking for help got you used or hurt — so you learned not to. Out here, that same rule keeps you stuck. Asking specifically ('can you give me a ride Thursday at 9?') is easier for people to say yes to than asking vaguely.",
    "activity": {
      "kind": "decision",
      "title": "You need a ride to your appointment. You...",
      "prompt": "Pick the ask most likely to work.",
      "choices": [
        {
          "label": "Don't ask, miss it",
          "feedback": "That's the old rule running. It costs you the appointment and the trust of showing up."
        },
        {
          "label": "'Could you drive me Thursday at 9? It's 20 minutes.'",
          "feedback": "Specific asks get yeses. People can picture exactly what you need.",
          "good": true
        },
        {
          "label": "'I never have any help with anything'",
          "feedback": "That's real frustration, but it's hard for anyone to act on."
        }
      ]
    },
    "adelReflection": "Specific and small. That's the whole trick.",
    "adelQuestion": "What's one thing you need this week that you haven't asked for?",
    "insight": "A clear ask is a strength, not a debt.",
    "action": "Make one specific ask today.",
    "toolkitLabel": "My specific ask"
  },
  {
    "id": "support-team-rebuild-trust",
    "categoryId": "support-team",
    "title": "Building Trust Again",
    "minutes": 6,
    "order": 3,
    "problem": "People have reasons not to trust you and you can't rush it.",
    "learnTitle": "Trust rebuilds in deposits",
    "learnBody": "Trust doesn't come back through apologies or promises. It comes back through small kept commitments over time — being where you said, when you said. Every kept promise is a deposit; every explanation without action is a withdrawal.",
    "activity": {
      "kind": "timeline",
      "title": "How trust rebuilds",
      "prompt": "Put it in order.",
      "steps": [
        "Say what I'm going to do",
        "Do exactly that",
        "Do it again next week",
        "Don't ask for credit",
        "Let time do the rest"
      ]
    },
    "adelReflection": "Nobody has to give you trust on a schedule. But consistency is undefeated.",
    "adelQuestion": "Who are you most hoping will trust you again?",
    "insight": "Trust is a deposit account. Small, repeated, no shortcuts.",
    "action": "Make one small promise today and keep it exactly.",
    "toolkitLabel": "Trust deposits"
  },
  {
    "id": "support-team-boundaries",
    "categoryId": "support-team",
    "title": "Creating Healthy Boundaries",
    "minutes": 5,
    "order": 4,
    "problem": "You either let people run you over or cut them off completely.",
    "learnTitle": "A boundary is about you, not them",
    "learnBody": "A wall keeps everyone out. A boundary says what you will do: 'If the yelling starts, I'm leaving for an hour.' You don't need permission and you don't need to argue it. You just need to follow through.",
    "activity": {
      "kind": "sort",
      "prompt": "Boundary or wall? — Sort each statement.",
      "buckets": [
        "Boundary",
        "Wall"
      ],
      "cards": [
        "If you show up high, I'll leave",
        "I'm never speaking to anyone in that family again",
        "I can help Saturday, not tonight",
        "I don't answer calls after 10pm",
        "I don't need anybody"
      ]
    },
    "adelReflection": "Boundaries keep relationships possible. Walls end them.",
    "adelQuestion": "Where do you most need a boundary right now?",
    "insight": "A boundary says what you'll do, not what they can't.",
    "action": "Set one boundary today and follow through on it.",
    "toolkitLabel": "My boundaries"
  },
  {
    "id": "support-team-communicating-needs",
    "categoryId": "support-team",
    "title": "Communicating My Needs",
    "minutes": 5,
    "order": 5,
    "problem": "You expect people to know what you need, then resent them when they don't.",
    "learnTitle": "Nobody's reading your mind",
    "learnBody": "Unspoken needs turn into resentment fast. Naming a need out loud feels risky, but it's the only way it can get met. The shape is simple: 'I need ___. Can you ___?' — one need, one request, no build-up.",
    "activity": {
      "kind": "reflection",
      "title": "What do you actually need right now?",
      "prompt": "Tap anything true.",
      "cards": [
        "Space",
        "Someone to listen without fixing",
        "Help with something practical",
        "To be believed",
        "Time to think",
        "A check-in every day",
        "To be left alone tonight"
      ]
    },
    "adelReflection": "Those are all reasonable. None of them are obvious to anyone else.",
    "adelQuestion": "Which one would you feel most awkward saying out loud?",
    "insight": "An unspoken need becomes a resentment.",
    "action": "Say one need out loud to one person today.",
    "toolkitLabel": "My needs list"
  },
  {
    "id": "support-team-difficult-relationships",
    "categoryId": "support-team",
    "title": "Handling Difficult Relationships",
    "minutes": 6,
    "order": 6,
    "problem": "Some people in your life aren't good for your recovery, but you can't just delete them.",
    "learnTitle": "Distance comes in degrees",
    "learnBody": "It's rarely all-or-nothing. You can change how often, how long, where, and what you talk about. Family and co-parents especially need managed contact rather than a clean break — shorter visits, public places, no rides, no money.",
    "activity": {
      "kind": "sort",
      "prompt": "What can you actually change? — Sort what's in your control.",
      "buckets": [
        "In my control",
        "Not in my control"
      ],
      "cards": [
        "How often I see them",
        "Where we meet",
        "Whether they change",
        "How long I stay",
        "Whether I lend money",
        "Their opinion of me"
      ]
    },
    "adelReflection": "You have more levers than you thought — just none of them are about changing them.",
    "adelQuestion": "Which lever could you pull this week?",
    "insight": "You can't change them. You can change the terms.",
    "action": "Change one term of contact with a difficult person this week.",
    "toolkitLabel": "My contact terms"
  },
  {
    "id": "support-team-positive-connections",
    "categoryId": "support-team",
    "title": "Finding Positive Connections",
    "minutes": 5,
    "order": 7,
    "problem": "Most people you know are tied to the life you're leaving.",
    "learnTitle": "New people come from new rooms",
    "learnBody": "You can't meet different people in the same places. Meetings, work, classes, volunteering, gyms, churches — connection comes from repeated exposure, not from one good conversation. Show up to the same room three times and it starts happening on its own.",
    "activity": {
      "kind": "reflection",
      "title": "Rooms you could show up in",
      "prompt": "Tap any that feel possible.",
      "cards": [
        "A recovery meeting",
        "A class or training",
        "Volunteering",
        "A gym or rec center",
        "Church or a faith group",
        "A job with steady coworkers",
        "A peer support group"
      ]
    },
    "adelReflection": "Pick one room and go three times before you judge it.",
    "adelQuestion": "Which room feels most doable this month?",
    "insight": "New life, new rooms, same face showing up.",
    "action": "Show up in one new room this week.",
    "toolkitLabel": "My new rooms"
  },
  {
    "id": "support-team-my-community",
    "categoryId": "support-team",
    "title": "Building My Community",
    "minutes": 6,
    "order": 8,
    "problem": "You have a few people, but no sense of belonging anywhere.",
    "learnTitle": "Belonging is built by being useful",
    "learnBody": "Community isn't just people who help you. It's a place where you're expected and where you contribute — setting up chairs, giving someone a ride, checking in on someone newer. Contribution is what turns attendance into belonging.",
    "activity": {
      "kind": "decision",
      "title": "You've been to the same meeting four times. Next step?",
      "prompt": "Pick the move that builds belonging.",
      "choices": [
        {
          "label": "Keep sitting in the back",
          "feedback": "Fine for a while, but the room stays strangers."
        },
        {
          "label": "Get there early and help set up",
          "feedback": "That's how people learn your name — through doing something with them.",
          "good": true
        },
        {
          "label": "Try a different meeting",
          "feedback": "Sometimes right, but belonging usually comes from repetition in one place."
        }
      ]
    },
    "adelReflection": "You don't have to talk much. Showing up early and helping does most of it.",
    "adelQuestion": "Where could you contribute something small?",
    "insight": "You belong to the places you contribute to.",
    "action": "Do one small useful thing in a group this week.",
    "toolkitLabel": "How I contribute"
  },
  {
    "id": "support-team-give-receive",
    "categoryId": "support-team",
    "title": "Giving and Receiving Support",
    "minutes": 5,
    "order": 9,
    "problem": "You either give everything away or take without knowing how to accept.",
    "learnTitle": "Support has to run both ways",
    "learnBody": "Only giving burns you out and keeps you from being known. Only taking makes you feel like a debt. Balanced support means being able to say 'I need help' and 'let me help you' in the same week — and letting people do things for you without paying it back immediately.",
    "activity": {
      "kind": "sliders",
      "title": "Your balance right now",
      "prompt": "Move each slider honestly.",
      "sliders": [
        {
          "id": "give",
          "label": "How much I give",
          "minLabel": "None",
          "maxLabel": "Everything"
        },
        {
          "id": "receive",
          "label": "How much I let in",
          "minLabel": "None",
          "maxLabel": "Easily"
        }
      ]
    },
    "adelReflection": "Most people are lopsided in one direction. Knowing which one is useful.",
    "adelQuestion": "Which side is harder for you — giving or receiving?",
    "insight": "Letting someone help you is a gift to them too.",
    "action": "Accept one offer of help this week without paying it back.",
    "toolkitLabel": "My give/receive balance"
  },
  {
    "id": "support-team-support-plan",
    "categoryId": "support-team",
    "title": "Creating My Support Plan",
    "minutes": 6,
    "order": 10,
    "problem": "On a bad night you don't know who to call first.",
    "learnTitle": "Write it before you need it",
    "learnBody": "A support plan is a short written list: who to call in order, what to say, and what to do if nobody picks up. Written ahead of time, it works when you're at your worst — which is exactly when you'll need it.",
    "activity": {
      "kind": "timeline",
      "title": "Your call order",
      "prompt": "Put your plan in order.",
      "steps": [
        "Person 1 — my first call",
        "Person 2 — if no answer",
        "My group or meeting",
        "Peer specialist or counselor",
        "988 or crisis line",
        "What I do while I wait"
      ]
    },
    "adelReflection": "The last step matters most — what you do while you're waiting for a call back.",
    "adelQuestion": "What will you do while you wait?",
    "insight": "The plan you wrote calm is the plan that works at 2am.",
    "action": "Write your call order into your phone today.",
    "toolkitLabel": "My support plan"
  },
  {
    "id": "back-on-feet-housing",
    "categoryId": "back-on-feet",
    "title": "Finding Stable Housing",
    "minutes": 7,
    "order": 1,
    "problem": "You don't have a stable place, or the one you have won't last.",
    "learnTitle": "Housing runs on paperwork and lead time",
    "learnBody": "Most housing loss is predictable — the notice comes weeks before the move. The people who land somewhere are the ones who start early, keep their documents together, and have one person helping them navigate. Records are a barrier, but not every landlord and program screens the same way.",
    "activity": {
      "kind": "decision",
      "title": "You have 30 days before you're out. Best first move?",
      "prompt": "Pick the strongest first step.",
      "choices": [
        {
          "label": "Wait and see if something works out",
          "feedback": "30 days disappears fast. Every day early is more options."
        },
        {
          "label": "Call my case manager and ask for the two best options today",
          "feedback": "Yes. One call turns a huge problem into two real choices.",
          "good": true
        },
        {
          "label": "Apply to twenty places online",
          "feedback": "Volume without a plan usually ends in twenty no's and no energy left."
        }
      ]
    },
    "adelReflection": "Housing is a logistics problem. Logistics problems have steps.",
    "adelQuestion": "What documents do you have, and what's missing?",
    "insight": "Start 30 days early and you have options. Start day-of and you have a shelter.",
    "action": "Make one housing call or gather one document today.",
    "toolkitLabel": "My housing next step"
  },
  {
    "id": "back-on-feet-work",
    "categoryId": "back-on-feet",
    "title": "Finding Work and Purpose",
    "minutes": 7,
    "order": 2,
    "problem": "You need a job and you're worried about your record.",
    "learnTitle": "The record isn't the whole story",
    "learnBody": "Some employers screen hard; many don't, and some hire specifically from re-entry programs. What works is a short, steady answer about your record — own it, don't over-explain, pivot to what you can do now. Practice it out loud until it's boring to say.",
    "activity": {
      "kind": "decision",
      "title": "At an interview they ask about your record. Best response?",
      "prompt": "Pick the strongest answer.",
      "choices": [
        {
          "label": "Give the whole story with all the context",
          "feedback": "Too much detail puts the interview back in the past. Keep it short."
        },
        {
          "label": "'I have a conviction from 2021. I've done the work since, and here's what I can do for you.'",
          "feedback": "Short, honest, forward. That's the answer that gets hired.",
          "good": true
        },
        {
          "label": "Hope it doesn't come up",
          "feedback": "Risky — if it surfaces later it looks like hiding. Better to have your line ready."
        }
      ]
    },
    "adelReflection": "Say it plain, then talk about the work. Most interviewers follow your lead.",
    "adelQuestion": "What can you do that an employer needs?",
    "insight": "Own it in one sentence, then move to what you bring.",
    "action": "Say your one-sentence answer out loud three times today.",
    "toolkitLabel": "My interview answer",
    "populations": [
      "pre_release_ji",
      "post_release_ji"
    ]
  },
  {
    "id": "back-on-feet-money-basics",
    "categoryId": "back-on-feet",
    "title": "Managing Money Basics",
    "minutes": 6,
    "order": 3,
    "problem": "Money comes in and disappears before the important stuff is covered.",
    "learnTitle": "Order beats budgeting",
    "learnBody": "Most budgets fail because they're too detailed. What works is an order of operations: housing first, then transportation to work or appointments, then food, then everything else. Cash-only for the 'everything else' pile keeps it honest.",
    "activity": {
      "kind": "timeline",
      "title": "Your money order",
      "prompt": "Put your spending in the order it should happen.",
      "steps": [
        "Rent or housing",
        "Transportation to work/appointments",
        "Food",
        "Phone",
        "Debts and fines",
        "Everything else"
      ]
    },
    "adelReflection": "Payday order is more powerful than any app. Do the top three the day money lands.",
    "adelQuestion": "Where does your money usually leak?",
    "insight": "Pay the things that keep you stable first, same day, every time.",
    "action": "On your next payday, handle the top two before anything else.",
    "toolkitLabel": "My payday order"
  },
  {
    "id": "back-on-feet-food-resources",
    "categoryId": "back-on-feet",
    "title": "Accessing Food Resources",
    "minutes": 5,
    "order": 4,
    "problem": "Food runs short before the money comes back.",
    "learnTitle": "Food help is a system, not charity",
    "learnBody": "CalFresh, food banks, pantries, and community meals exist because food insecurity is common — using them is what they're funded for. Applying takes documents and a little time, so start before the cupboard is empty.",
    "activity": {
      "kind": "reflection",
      "title": "What's available to you?",
      "prompt": "Tap anything you have or could get.",
      "cards": [
        "CalFresh / SNAP",
        "Local food bank",
        "Church or community pantry",
        "Free community meals",
        "WIC if I have young kids",
        "Meals at a program I attend"
      ]
    },
    "adelReflection": "Stack two or three of those and food stops being a monthly emergency.",
    "adelQuestion": "Which one haven't you used yet?",
    "insight": "Apply before you're empty, not after.",
    "action": "Find the hours of one food resource near you today.",
    "toolkitLabel": "My food resources"
  },
  {
    "id": "back-on-feet-healthcare-support",
    "categoryId": "back-on-feet",
    "title": "Getting Healthcare Support",
    "minutes": 6,
    "order": 5,
    "problem": "You've put off medical stuff for years and don't know where to start.",
    "learnTitle": "One door opens the rest",
    "learnBody": "Medi-Cal, community health centers, and FQHCs handle primary care, behavioral health, and prescriptions on a sliding scale — often in the same building. Getting one appointment usually connects you to the rest of the system.",
    "activity": {
      "kind": "sort",
      "prompt": "Where does each need go? — Sort each one.",
      "buckets": [
        "Clinic appointment",
        "Emergency now"
      ],
      "cards": [
        "A cough that won't quit",
        "Chest pain right now",
        "Refill on my medication",
        "Dental pain for a week"
      ]
    },
    "adelReflection": "Knowing which door to use saves you hours and a bill you don't need.",
    "adelQuestion": "What health thing have you been putting off longest?",
    "insight": "One appointment is the doorway to the rest.",
    "action": "Call one clinic and ask about becoming a new patient.",
    "toolkitLabel": "My healthcare doorway"
  },
  {
    "id": "back-on-feet-my-benefits",
    "categoryId": "back-on-feet",
    "title": "Understanding My Benefits",
    "minutes": 6,
    "order": 6,
    "problem": "You've heard about benefits but don't know what you qualify for.",
    "learnTitle": "Benefits are a paperwork game",
    "learnBody": "Medi-Cal, CalFresh, General Relief, SSI, and county programs each have their own forms and timelines. Most denials are paperwork issues, not eligibility issues — missing documents or a missed appointment. Keep a folder, and appeal if you're denied.",
    "activity": {
      "kind": "reflection",
      "title": "What's on your plate?",
      "prompt": "Tap anything you're dealing with.",
      "cards": [
        "Medi-Cal application",
        "CalFresh",
        "General Relief",
        "SSI/SSDI",
        "ID or birth certificate",
        "A denial I need to appeal",
        "Reporting a change"
      ]
    },
    "adelReflection": "Every one of those has someone whose job is to help you finish it.",
    "adelQuestion": "Which one is closest to being finished?",
    "insight": "Most denials are paperwork, and paperwork can be fixed.",
    "action": "Put every document you have into one folder today.",
    "toolkitLabel": "My benefits checklist"
  },
  {
    "id": "back-on-feet-transportation",
    "categoryId": "back-on-feet",
    "title": "Managing Transportation",
    "minutes": 5,
    "order": 7,
    "problem": "Getting places is the thing that makes you miss things.",
    "learnTitle": "Rides break plans more than motivation does",
    "learnBody": "Missed appointments are usually transportation problems in disguise. Options stack: bus passes, Medi-Cal transportation for medical visits, program vans, a ride from a support person, and planning appointments in clusters so one trip covers more.",
    "activity": {
      "kind": "reflection",
      "title": "What rides can you access?",
      "prompt": "Tap all that could work.",
      "cards": [
        "Bus pass or route I know",
        "Medi-Cal medical transportation",
        "Program or shelter van",
        "A support person who drives",
        "Bike or walking distance",
        "Rideshare when it's critical"
      ]
    },
    "adelReflection": "Two backup options is the difference between making it and not.",
    "adelQuestion": "What's your backup if the first ride falls through?",
    "insight": "A plan without a ride isn't a plan.",
    "action": "Set a backup ride for your next appointment.",
    "toolkitLabel": "My ride plan"
  },
  {
    "id": "back-on-feet-community-connections",
    "categoryId": "back-on-feet",
    "title": "Building My Community Connections",
    "minutes": 6,
    "order": 8,
    "problem": "You don't know what's out there in your area.",
    "learnTitle": "Local knowledge is a real asset",
    "learnBody": "Every county has a network — recovery meetings, day centers, workforce boards, libraries with computers and printers, and 211 which can route you to almost anything. Knowing three of them by name makes hard weeks a lot shorter.",
    "activity": {
      "kind": "sort",
      "prompt": "Do you know where this is? — Sort each one.",
      "buckets": [
        "I know",
        "I need to find out"
      ],
      "cards": [
        "Nearest recovery meeting",
        "Where to print documents free",
        "Workforce or job center",
        "Where to get an ID"
      ]
    },
    "adelReflection": "Anything in the 'find out' pile is one phone call or one 211 call away.",
    "adelQuestion": "Which one would help you most this month?",
    "insight": "Knowing your county is a survival skill.",
    "action": "Look up one local resource and save the address in your phone.",
    "toolkitLabel": "My local map"
  },
  {
    "id": "back-on-feet-legal-responsibilities",
    "categoryId": "back-on-feet",
    "title": "Handling Legal Responsibilities",
    "minutes": 6,
    "order": 9,
    "problem": "Court dates, fines, probation requirements — it's a lot to keep straight.",
    "learnTitle": "Missed dates cost more than money",
    "learnBody": "The most expensive thing in re-entry is a missed check-in or court date. Everything else can usually be negotiated — fines can go on payment plans, requirements can sometimes be adjusted if you ask early. Communication before a problem is treated very differently than after.",
    "activity": {
      "kind": "decision",
      "title": "You can't make your check-in Thursday. You...",
      "prompt": "Pick the move.",
      "choices": [
        {
          "label": "Just don't go and explain later",
          "feedback": "That's the highest-cost option. A no-show is treated as avoidance."
        },
        {
          "label": "Call ahead, explain, and ask to reschedule",
          "feedback": "Yes. Ahead of time, it's a scheduling issue instead of a violation.",
          "good": true
        },
        {
          "label": "Show up late and hope it's fine",
          "feedback": "Better than nothing, but call first — it takes one minute."
        }
      ]
    },
    "adelReflection": "Calling ahead is the single highest-value habit in this whole area.",
    "adelQuestion": "What's your next legal date, and is it in your phone?",
    "insight": "Call before, not after. Every time.",
    "action": "Put every legal date in your phone with a two-day reminder.",
    "toolkitLabel": "My legal calendar",
    "populations": [
      "pre_release_ji",
      "post_release_ji"
    ]
  },
  {
    "id": "back-on-feet-resource-plan",
    "categoryId": "back-on-feet",
    "title": "Creating My Resource Plan",
    "minutes": 6,
    "order": 10,
    "problem": "You've got pieces but no single place they live.",
    "learnTitle": "One page, everything",
    "learnBody": "A resource plan is one page with the six things you need most: housing contact, food source, clinic, transportation, benefits worker, and legal dates. When a hard week hits, you don't research — you read.",
    "activity": {
      "kind": "reflection",
      "title": "What goes on your page?",
      "prompt": "Tap what belongs on yours.",
      "cards": [
        "Housing contact",
        "Food source and hours",
        "Clinic and pharmacy",
        "Ride options",
        "Benefits worker's number",
        "Court and check-in dates",
        "211",
        "My case manager"
      ]
    },
    "adelReflection": "That's your page. Print it if you can — phones die at the worst times.",
    "adelQuestion": "What's the one line on it you'd need first in an emergency?",
    "insight": "One page beats ten browser tabs on a bad day.",
    "action": "Write your resource page today and put a copy somewhere physical.",
    "toolkitLabel": "My resource page"
  },
  {
    "id": "success-plan-my-vision",
    "categoryId": "success-plan",
    "title": "Creating My Vision for the Future",
    "minutes": 6,
    "order": 1,
    "problem": "You've been surviving so long you stopped picturing anything ahead.",
    "learnTitle": "A picture beats a plan at the start",
    "learnBody": "Before goals, you need a direction. A vision is just a specific picture of an ordinary day a year out: where you wake up, what you do, who you see. Specific pictures pull behavior more than general hopes do.",
    "activity": {
      "kind": "reflection",
      "title": "A year from now, what would you notice?",
      "prompt": "Tap everything you want to be true.",
      "cards": [
        "Steady place to live",
        "Job or purpose I care about",
        "Still in recovery",
        "Reconnected with family",
        "Physically stronger",
        "Calmer inside",
        "Helping someone else through this",
        "Free from a court obligation"
      ]
    },
    "adelReflection": "That's not a wish. That's the person you're already building — one small day at a time.",
    "adelQuestion": "Which one, if you got it, would mean the most?",
    "insight": "You can't walk toward something you've never pictured.",
    "action": "Write one sentence describing an ordinary day a year from now.",
    "toolkitLabel": "My vision"
  },
  {
    "id": "success-plan-goals-that-matter",
    "categoryId": "success-plan",
    "title": "Setting Goals That Matter",
    "minutes": 5,
    "order": 2,
    "problem": "You set goals that sound good and then never touch them.",
    "learnTitle": "Goals stick when they're yours and they're clear",
    "learnBody": "'Do better' isn't a goal. A goal you'll actually chase names what, by when, and why it matters to you personally. Goals borrowed from a probation officer, a parent, or a program tend to stall — connect it to your own reason and it holds.",
    "activity": {
      "kind": "sort",
      "prompt": "Real goal or vague wish? — Sort each one.",
      "buckets": [
        "Real goal",
        "Vague wish"
      ],
      "cards": [
        "Be healthier",
        "Walk 20 minutes, 4 days a week",
        "Fix my life",
        "Get my ID by the end of the month",
        "Be a better parent"
      ]
    },
    "adelReflection": "Vague wishes aren't bad — they just need a date and a number attached.",
    "adelQuestion": "What's one wish you could turn into a goal right now?",
    "insight": "A goal has a number and a date. Everything else is a wish.",
    "action": "Rewrite one wish as a goal with a date.",
    "toolkitLabel": "My real goals",
    "populations": [
      "pre_release_ji",
      "post_release_ji"
    ]
  },
  {
    "id": "success-plan-breaking-goals",
    "categoryId": "success-plan",
    "title": "Breaking Goals Into Steps",
    "minutes": 5,
    "order": 3,
    "problem": "The goal is clear but you still don't start.",
    "learnTitle": "The first step should feel almost too small",
    "learnBody": "People stall when step one is too big. If 'get my ID' feels heavy, step one is 'find out what documents I need' — ten minutes, one call. Momentum is built by finishing things, so make the first thing finishable.",
    "activity": {
      "kind": "timeline",
      "title": "Break down 'get my ID'",
      "prompt": "Put it in the order you'd actually do it.",
      "steps": [
        "Find out what documents are required",
        "Gather what I already have",
        "Request the missing document",
        "Find the office hours and location",
        "Plan the ride",
        "Go"
      ]
    },
    "adelReflection": "Six steps. Any one of them is doable in a day.",
    "adelQuestion": "What's your version of step one?",
    "insight": "Make step one small enough that skipping it feels silly.",
    "action": "Do step one of one goal today.",
    "toolkitLabel": "My step-one list"
  },
  {
    "id": "success-plan-action-plan",
    "categoryId": "success-plan",
    "title": "Building My Action Plan",
    "minutes": 6,
    "order": 4,
    "problem": "You know the steps but the week goes by anyway.",
    "learnTitle": "Steps need days attached",
    "learnBody": "A plan without days on it is a list. Attaching each step to a specific day and time — 'Tuesday after my appointment' — roughly doubles follow-through. Three steps a week is plenty.",
    "activity": {
      "kind": "reflection",
      "title": "When does it actually fit?",
      "prompt": "Tap the times in your week that are realistically free.",
      "cards": [
        "Weekday mornings",
        "After my appointment",
        "Lunch break",
        "Evenings",
        "Saturday morning",
        "Sunday afternoon"
      ]
    },
    "adelReflection": "Now the steps have somewhere to live. That's the difference.",
    "adelQuestion": "Which slot are you putting your first step in?",
    "insight": "A step without a day is a wish with extra words.",
    "action": "Put three steps on specific days this week.",
    "toolkitLabel": "My action plan"
  },
  {
    "id": "success-plan-habits-goals",
    "categoryId": "success-plan",
    "title": "Creating Habits That Support My Goals",
    "minutes": 5,
    "order": 5,
    "problem": "You do well for a week and then it falls apart.",
    "learnTitle": "Habits beat effort",
    "learnBody": "Effort runs out. Habits don't, because they stop requiring a decision. A habit needs a cue (something that already happens), a small action, and a marker you can see — a check on a calendar counts more than you'd think.",
    "activity": {
      "kind": "timeline",
      "title": "Build the habit loop",
      "prompt": "Put the loop in order.",
      "steps": [
        "A cue that already happens daily",
        "The small action",
        "Do it the same way each time",
        "Mark it somewhere I can see",
        "Repeat for two weeks",
        "It stops needing a decision"
      ]
    },
    "adelReflection": "Two weeks of visible marks does more than a month of trying hard.",
    "adelQuestion": "What daily cue could carry your new habit?",
    "insight": "Don't rely on effort. Build a loop.",
    "action": "Pick one habit, attach it to a cue, and mark it today.",
    "toolkitLabel": "My habit loop"
  },
  {
    "id": "success-plan-staying-motivated",
    "categoryId": "success-plan",
    "title": "Staying Motivated When Things Are Hard",
    "minutes": 5,
    "order": 6,
    "problem": "Progress is slow and you're losing steam.",
    "learnTitle": "Motivation follows action",
    "learnBody": "Waiting to feel motivated is backwards — action usually comes first and the feeling follows. On low days, shrink the goal instead of skipping it: five minutes instead of thirty, one call instead of five. Showing up small keeps the streak alive.",
    "activity": {
      "kind": "decision",
      "title": "You planned a 30-minute walk and you've got nothing today. You...",
      "prompt": "Pick your move.",
      "choices": [
        {
          "label": "Skip it, try again tomorrow",
          "feedback": "One skip is fine. Two in a row is how streaks end."
        },
        {
          "label": "Do 5 minutes instead",
          "feedback": "That's the move. The streak matters more than the size.",
          "good": true
        },
        {
          "label": "Force the full 30",
          "feedback": "Sometimes works, often leads to quitting entirely. Small is more durable."
        }
      ]
    },
    "adelReflection": "Shrink it, don't skip it. That's how people get through the slow middle.",
    "adelQuestion": "What's the five-minute version of your goal?",
    "insight": "On hard days, shrink the goal — never the streak.",
    "action": "Do the five-minute version of something today.",
    "toolkitLabel": "My shrink-it rule"
  },
  {
    "id": "success-plan-setbacks",
    "categoryId": "success-plan",
    "title": "Preparing for Challenges",
    "minutes": 5,
    "order": 7,
    "problem": "Something always comes up and knocks the plan over.",
    "learnTitle": "Plan for the obstacle, not the perfect week",
    "learnBody": "If-then planning is one of the most tested tools there is: decide in advance what you'll do when the predictable obstacle shows up. 'If my ride falls through, then I call X.' Deciding ahead means you don't have to decide while stressed.",
    "activity": {
      "kind": "decision",
      "title": "Pick your hardest 'what if' — then choose your then.",
      "prompt": "Which obstacle is most likely?",
      "choices": [
        {
          "label": "My ride falls through",
          "feedback": "Then: line up a backup number today, before you need it.",
          "good": true
        },
        {
          "label": "I get bad news and want to use",
          "feedback": "Then: call your first-call person before you decide anything else.",
          "good": true
        },
        {
          "label": "I lose my job or income",
          "feedback": "Then: call your case manager the same week — benefits and programs move slowly.",
          "good": true
        }
      ]
    },
    "adelReflection": "An if-then written down beats good intentions every time.",
    "adelQuestion": "What's your most likely obstacle in the next 30 days?",
    "insight": "Decide once, calm. Then just follow it.",
    "action": "Write one if-then for your most likely obstacle.",
    "toolkitLabel": "My if-then plans"
  },
  {
    "id": "success-plan-success-system",
    "categoryId": "success-plan",
    "title": "Building My Personal Success System",
    "minutes": 7,
    "order": 8,
    "problem": "You have tools everywhere but nothing that ties them together.",
    "learnTitle": "A system is your tools in one order",
    "learnBody": "A success system is simple: what I do daily, what I do weekly, who checks on me, and what I do when it goes sideways. Written down in one place, it's the thing you hand to a counselor, a sponsor, or your future self.",
    "activity": {
      "kind": "reflection",
      "title": "What's in your system?",
      "prompt": "Tap what belongs.",
      "cards": [
        "My daily anchors",
        "My weekly meeting or group",
        "My check-in person",
        "My grounding tool",
        "My if-then plans",
        "My appointments",
        "My reasons list",
        "My warning signs"
      ]
    },
    "adelReflection": "That's a real system — daily, weekly, people, and a bad-day plan.",
    "adelQuestion": "What's missing from it right now?",
    "insight": "A system is what keeps working when motivation isn't.",
    "action": "Write your daily, weekly, and bad-day lines on one page.",
    "toolkitLabel": "My success system"
  },
  {
    "id": "success-plan-celebrating-progress",
    "categoryId": "success-plan",
    "title": "Celebrating My Progress",
    "minutes": 5,
    "order": 9,
    "problem": "You only notice what you haven't done yet.",
    "learnTitle": "Counting progress is part of the work",
    "learnBody": "The brain records failures more strongly than wins, so progress has to be counted on purpose. Marking small wins isn't soft — it's what keeps the behavior going, and it's what you'll need to read on a low week.",
    "activity": {
      "kind": "reflection",
      "title": "What have you already done?",
      "prompt": "Tap everything true in the last month.",
      "cards": [
        "Made an appointment",
        "Kept an appointment",
        "Asked for help",
        "Told the truth when it was hard",
        "Didn't use today",
        "Helped someone",
        "Started a new routine",
        "Got through a hard day"
      ]
    },
    "adelReflection": "Read that list back. That's not nothing — that's the last month of your life.",
    "adelQuestion": "Which one are you most surprised you did?",
    "insight": "If you don't count the wins, only the losses get recorded.",
    "action": "Tell one person about one thing you did well this week.",
    "toolkitLabel": "My wins list"
  },
  {
    "id": "success-plan-future-roadmap",
    "categoryId": "success-plan",
    "title": "Creating My Future Roadmap",
    "minutes": 7,
    "order": 10,
    "problem": "You want a picture of where this all goes.",
    "learnTitle": "Three horizons",
    "learnBody": "A roadmap works in three layers: the next 30 days (stability), the next 6 months (building), and the next year (growth). Each layer gets two or three items — no more. Reviewing it monthly is what keeps it alive instead of a page in a drawer.",
    "activity": {
      "kind": "timeline",
      "title": "Your horizons",
      "prompt": "Put the roadmap in order and think about what goes in each.",
      "steps": [
        "Next 30 days — keep stable",
        "Next 90 days — one goal finished",
        "6 months — building something",
        "1 year — the vision",
        "Monthly review",
        "Adjust and keep going"
      ]
    },
    "adelReflection": "The monthly review is the step most people skip — and it's the one that keeps the map real.",
    "adelQuestion": "What's the one thing you want done in the next 90 days?",
    "insight": "The future isn't waiting for you. It's being built by what you do today.",
    "action": "Write your 30-day, 90-day, and 1-year line — one sentence each.",
    "toolkitLabel": "My future roadmap"
  }
];
