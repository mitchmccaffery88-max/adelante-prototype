// GENERATED CONTENT — recovery lessons ported from the Adelante Journey build
// and mapped onto this project's canonical RecoveryLesson schema.
//
// EDITORIAL PASS (Adelante Journey sync Build 3): the original port carried
// generator artifacts in every one of these 80 lessons — `learnBody` repeated
// the same sentences twice, `learnTitle` was the literal string "What's really
// going on" 80 times, `insight` was one identical sentence 80 times, and each
// decision activity's four feedback strings were the same template with the
// choice label spliced in. Those five fields (learnTitle, learnBody, insight,
// activity.prompt, activity.choices[].feedback) were re-edited lesson by
// lesson against the source's real teaching points, so feedback now responds
// to the specific choice in the specific scenario. Every other field —
// problem, checkIn, tool flow, toolkit label — is the ported copy, unchanged.
//
// Module 1 ("My First Days Out") is NOT here: it was transcribed earlier and
// keeps its original lesson ids.
import type { RecoveryLesson } from "@/lib/recovery";

export const PORTED_RECOVERY_LESSONS: RecoveryLesson[] = [
  {
    "id": "finding-my-people-why-can-t-i-do-this-alone",
    "moduleId": "finding-my-people",
    "title": "Why Can't I Do This Alone?",
    "minutes": 5,
    "order": 1,
    "problem": "Why does connection matter so much?",
    "checkIn": "How connected do you feel to people who support your recovery?",
    "learnTitle": "You Can't Do It Alone",
    "learnBody": "Isolation often leads back to old habits. But strong connections help you stay in recovery. You don't need a lot of people in your life. What matters most is having real, supportive connections. Being truly seen and known by others is the key.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today, and you feel that familiar urge to isolate. This is the exact moment we're talking about in this lesson.",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Reaching out to your sponsor is a solid first step. They can offer immediate support and guidance when you feel alone."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Going to a meeting connects you with others who understand your struggles. It's a powerful way to break isolation right away."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Your peer specialist is there to help navigate these moments. They can provide practical tools and encouragement."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up in person somewhere safe and supportive can instantly counter the urge to withdraw. Being present with others makes a difference."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Why Can't I Do This Alone?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Real connection is your strongest shield against relapse.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Reach out to one person today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Connection Plan"
  },
  {
    "id": "finding-my-people-which-recovery-meeting-is-right-for-me",
    "moduleId": "finding-my-people",
    "title": "Which Recovery Meeting Is Right for Me?",
    "minutes": 6,
    "order": 2,
    "problem": "Which meeting should I try?",
    "checkIn": "Right now, how much is \"Which meeting should I try\" a struggle for you?",
    "learnTitle": "Choosing Your Recovery Meeting",
    "learnBody": "There are many paths to recovery, and different meetings work for different people. You might consider options like AA, NA, SMART Recovery, Celebrate Recovery, or Refuge Recovery. Each offers a valid approach to support. It's a good idea to try at least three different meetings before you decide which one feels right for you. Online meetings can also be a great place to start exploring.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're thinking about attending a recovery meeting, but you're not sure which type to pick. This decision feels a bit overwhelming right now. What do you do first?",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Your sponsor has experience with different meetings and can offer personalized advice based on your needs. This is a solid first step to get some guidance."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Jumping into a meeting without research might lead to frustration if it's not the right fit. It's often better to gather information first."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "A peer specialist understands your situation and can help you explore meeting options available in Tulare County. They can connect you with resources and support your decision."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up in person somewhere without knowing what kind of meeting it is could be confusing. It's helpful to know what to expect before attending."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Which Recovery Meeting Is Right for Me?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Exploring different meeting types and trying a few will help you find the best fit for your recovery journey.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Try one new meeting type.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Meeting Match"
  },
  {
    "id": "finding-my-people-what-really-happens-at-a-meeting",
    "moduleId": "finding-my-people",
    "title": "What Really Happens at a Meeting?",
    "minutes": 7,
    "order": 3,
    "problem": "What should I expect?",
    "checkIn": "Right now, how much is \"What should I expect\" a struggle for you?",
    "learnTitle": "Inside a Recovery Meeting",
    "learnBody": "At a meeting, people share their experiences, and you listen. You don't have to talk if you don't want to. There are no fees to pay, no tests to pass, and no judgment. Many people find it helpful to arrive a little early to settle in.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are feeling anxious about attending your first recovery meeting. The thought of walking in for the first time starts to make you nervous.",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Your sponsor can offer encouragement and advice, which might help ease your nerves before you go."
        },
        {
          "label": "Go to a meeting",
          "feedback": "This is the direct action you're learning about. Facing the experience head-on is a good way to see what it's really like."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "A peer specialist can talk through your fears and help you understand what to expect from the meeting."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "While showing up somewhere else is an action, it won't directly address the anxiety about going to a recovery meeting."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Really Happens at a Meeting?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Knowing what to expect can make taking that first step much easier.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Show up 10 minutes early somewhere.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Meeting Prep"
  },
  {
    "id": "finding-my-people-how-do-i-find-a-sponsor",
    "moduleId": "finding-my-people",
    "title": "How Do I Find a Sponsor?",
    "minutes": 5,
    "order": 4,
    "problem": "How do I ask someone?",
    "checkIn": "Right now, how much is \"How do I ask someone\" a struggle for you?",
    "learnTitle": "Asking Someone To Sponsor You",
    "learnBody": "When you're ready to find a sponsor, look for someone who has what you want in recovery. You need to be direct when you ask. Simply say, 'Will you sponsor me?' If they can't commit right away, a temporary sponsor is always an option. Don't be afraid to ask until you find the right fit.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're at a meeting and someone you admire shares their experience. You think they might be a good sponsor. What's your first move?",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "You don't have a sponsor yet, so texting one isn't an option. Focus on the steps you can take to find one."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Going to a meeting is a good step towards finding a sponsor, but it doesn't directly address asking someone. You're already there, so think about what comes next."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Calling your peer specialist is a solid move. They can offer guidance and support on how to approach someone you'd like to ask."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up somewhere in person doesn't make sense if you're already at a meeting. Your goal is to ask someone directly, not just be present."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Find a Sponsor?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Be direct when you ask someone to be your sponsor.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Ask one person to be a temporary sponsor.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Sponsor Ask"
  },
  {
    "id": "finding-my-people-what-does-a-peer-recovery-specialist-do",
    "moduleId": "finding-my-people",
    "title": "What Does a Peer Recovery Specialist Do?",
    "minutes": 6,
    "order": 5,
    "problem": "How can a peer help me?",
    "checkIn": "Right now, how much is \"How can a peer help me\" a struggle for you?",
    "learnTitle": "How Your Peer Can Help",
    "learnBody": "A peer recovery specialist understands what you're going through because they've lived it themselves. They have training to guide you and offer practical support in your recovery journey. You can ask them to join you at appointments. This service is free for you through your care team.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "Imagine you're feeling unsure about how to use the support of a peer recovery specialist. This thought pops up when you're alone and feeling a little stuck.",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Contacting your sponsor is a good step for general support. However, this situation is specifically about understanding your peer specialist's role."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Attending a meeting offers valuable community and sharing. But this particular question needs a direct answer about your peer's function."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Reaching out to your peer specialist directly can give you the clearest answers. They can explain their role and how they can best support you."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up somewhere in person without a plan might not get your question answered. A direct conversation is more effective here."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Does a Peer Recovery Specialist Do?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your peer recovery specialist is there to offer specific support because they understand your experience.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Message your peer specialist.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Peer Support Plan"
  },
  {
    "id": "finding-my-people-who-should-be-on-my-recovery-team",
    "moduleId": "finding-my-people",
    "title": "Who Should Be on My Recovery Team?",
    "minutes": 7,
    "order": 6,
    "problem": "Who belongs on my team?",
    "checkIn": "Right now, how much is \"Who belongs on my team\" a struggle for you?",
    "learnTitle": "Who's On Your Recovery Team",
    "learnBody": "Your recovery team is made up of people who support you. They can include a peer, sponsor, therapist, doctor, or family member. Each person on your team has a clear role to play in your journey. You should know how to reach each one when you need them. Having these connections makes your support system strong.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're having a tough day and need to connect with someone from your support system. This moment catches you off guard.",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Texting your sponsor is a solid first step. They understand your journey and can offer immediate support or guidance."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Going to a meeting is a good idea for connection, but it might not be the fastest way to get direct support right now."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Calling your peer specialist connects you with someone who has walked a similar path. They can help you navigate this moment."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up somewhere in person without a plan might not be the most effective choice. It's better to reach out directly first."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Who Should Be on My Recovery Team?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Build your team and know how to reach each person when you need them.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Fill in one empty spot on your team.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Recovery Team"
  },
  {
    "id": "finding-my-people-how-do-i-learn-to-trust-again",
    "moduleId": "finding-my-people",
    "title": "How Do I Learn to Trust Again?",
    "minutes": 5,
    "order": 7,
    "problem": "How do I let people in?",
    "checkIn": "Right now, how much is \"How do I let people in\" a struggle for you?",
    "learnTitle": "Build Trust, One Step at a Time",
    "learnBody": "Trust can feel hard to offer when you've been hurt. It's not something you give all at once. You build it slowly through small, consistent actions over time. Begin by being honest about low-risk things. Most importantly, start by trusting yourself first through keeping even your smallest promises.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're feeling that old hesitation about letting someone new get close. The thought of trusting them makes you want to pull away.",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Your sponsor can offer a safe space to talk through your doubts and help you see the next small step."
        },
        {
          "label": "Go to a meeting",
          "feedback": "A meeting offers connection and understanding from people who have faced similar trust issues."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Your peer specialist has walked a similar path and can share practical ways to approach this challenge."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up in person, especially to a recovery-focused event, lets you practice being present without the pressure of deep trust right away."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Learn to Trust Again?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Building trust starts small, with yourself and then with others, through consistent honest actions.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Keep one small promise today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Trust Steps"
  },
  {
    "id": "finding-my-people-how-do-i-ask-for-help",
    "moduleId": "finding-my-people",
    "title": "How Do I Ask for Help?",
    "minutes": 6,
    "order": 8,
    "problem": "What do I actually say?",
    "checkIn": "Right now, how much is \"What do I actually say\" a struggle for you?",
    "learnTitle": "How to Ask for Help",
    "learnBody": "Asking for help works best when you keep it clear. Name what you need, how much help you want, and when you need it by. Being short and specific gives someone the information to say yes. For example, 'I need a ride Thursday at 2' gets your point across.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You find yourself in a situation where you need help, and you didn't see it coming. What's your first move?",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Texting your sponsor is a good idea for support, but it doesn't solve the immediate problem of asking for direct help."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Going to a meeting is helpful for long-term recovery. It won't instantly address a surprise need for help right now."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Calling your peer specialist provides a direct line to someone who can guide you. They might help you figure out exactly what to ask for."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up in person can put pressure on someone to help, even if they aren't ready or able. It's usually better to ask clearly beforehand."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Ask for Help?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Be clear, specific, and direct when you ask for help.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Use the script once today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Ask Script"
  },
  {
    "id": "finding-my-people-what-does-recovery-look-like-this-week",
    "moduleId": "finding-my-people",
    "title": "What Does Recovery Look Like This Week?",
    "minutes": 7,
    "order": 9,
    "problem": "What's my week going to look like?",
    "checkIn": "Right now, how much is \"What's my week going to look like\" a struggle for you?",
    "learnTitle": "Plan Your Recovery Week",
    "learnBody": "Your recovery needs a place in your calendar, not just in your thoughts. You should map out your week ahead of time. Schedule at least two meetings, one check-in with your support, and one healthy activity. Write these commitments down where you will see them often.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You wake up on Monday morning feeling a little lost about your recovery plans for the week. You're not sure where to start.",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Texting your sponsor is a good step for immediate support, but it doesn't create a full plan for your whole week."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Going to a meeting is always helpful. However, it's just one activity, and you still need to plan out the rest of your week."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Calling your peer specialist can help you think through your week. They can guide you in making a solid plan."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up somewhere in person, without a specific plan, might not give you the structure you need for the week ahead."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Does Recovery Look Like This Week?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Plan your recovery activities on your calendar each week to stay on track.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Put one recovery event in your week.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Weekly Rhythm"
  },
  {
    "id": "finding-my-people-my-weekly-recovery-plan",
    "moduleId": "finding-my-people",
    "title": "My Weekly Recovery Plan.",
    "minutes": 5,
    "order": 10,
    "problem": "How do I keep this going?",
    "checkIn": "Right now, how much is \"How do I keep this going\" a struggle for you?",
    "learnTitle": "Plan Your Week, Build Your Support",
    "learnBody": "Your recovery plan isn't just about tasks. It's also about the people who support you. Pick one day each week to plan out the next seven days. Make sure you include time to connect with your support system. Review your plan on Sunday night to get ready for the week ahead.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you realize you haven't put together your weekly recovery plan. The week has already started, and you feel a little lost.",
      "choices": [
        {
          "label": "Text my sponsor",
          "feedback": "Texting your sponsor is a good step for immediate support. They might help you get organized for the week."
        },
        {
          "label": "Go to a meeting",
          "feedback": "Going to a meeting can connect you with others. It's a solid way to start building structure for your week."
        },
        {
          "label": "Call my peer specialist",
          "feedback": "Calling your peer specialist provides direct guidance. They can help you create a plan right now."
        },
        {
          "label": "Show up somewhere in person",
          "feedback": "Showing up somewhere in person is helpful for connection. However, it doesn't directly address making your weekly plan."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"My Weekly Recovery Plan.\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Consistently planning your week helps you stay connected to your recovery and the people who support it.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Plan next week now.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Weekly Recovery Plan"
  },
  {
    "id": "understanding-my-addiction-why-can-t-i-stop-thinking-about-using",
    "moduleId": "understanding-my-addiction",
    "title": "Why Can't I Stop Thinking About Using?",
    "minutes": 5,
    "order": 1,
    "problem": "Why won't these thoughts leave?",
    "checkIn": "Right now, how much is \"Why won't these thoughts leave\" a struggle for you?",
    "learnTitle": "Your Brain Remembers Relief",
    "learnBody": "Your brain made a strong connection between using and feeling relief. This memory isn't an order you have to follow. Thoughts about using are just thoughts, not commands. You can weaken these thoughts by simply recognizing them for what they are. This gives you power over them.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "Later today, a strong thought about using comes to mind, catching you off guard. What's the first thing you do?",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming it as a craving is a solid first step. It helps you separate yourself from the thought and start to gain control."
        },
        {
          "label": "Run a HALT check",
          "feedback": "Running a HALT check is always useful, but it might not directly address the thought itself right away. This is a good second step."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger behind is smart, but you first need to identify the thought as separate from you. This choice is more about action than initial thought management."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup is a helpful strategy for support. However, it doesn't teach you how to manage the thought on your own in that moment."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Why Can't I Stop Thinking About Using?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "A thought about using is not a command to use.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Say 'that's a using thought' out loud once.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Thought Plan"
  },
  {
    "id": "understanding-my-addiction-why-are-my-cravings-so-strong",
    "moduleId": "understanding-my-addiction",
    "title": "Why Are My Cravings So Strong?",
    "minutes": 6,
    "order": 2,
    "problem": "What's happening in my body?",
    "checkIn": "Right now, how much is \"What's happening in my body\" a struggle for you?",
    "learnTitle": "Cravings Are a Wave",
    "learnBody": "Your body's response to a craving is like a wave passing through you. It naturally builds in strength, reaches a peak, and then starts to fade. Most intense cravings will crest within 20 minutes. You have the power to let this wave pass without giving in to it.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are caught off guard by a strong craving. It feels overwhelming and you question if you can handle it. What do you do first?",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "This is a solid first step. Recognizing the feeling as a craving helps you separate from it and understand that it will pass with time."
        },
        {
          "label": "Run a HALT check",
          "feedback": "Running a HALT check is smart, as hunger, anger, loneliness, or tiredness often make cravings feel much stronger. Addressing these needs can reduce the craving's power."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Getting away from whatever sparked the craving can weaken its hold and give you space to think clearly. It's a good move to change your environment if possible."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup is a responsible choice when cravings are intense. Reaching out to someone who supports your recovery can provide strength and perspective when you need it most."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Why Are My Cravings So Strong?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Cravings are temporary and most will peak and pass within 20 minutes.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Time one craving instead of acting.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Urge Surfing Plan"
  },
  {
    "id": "understanding-my-addiction-what-keeps-triggering-me",
    "moduleId": "understanding-my-addiction",
    "title": "What Keeps Triggering Me?",
    "minutes": 7,
    "order": 3,
    "problem": "What sets me off?",
    "checkIn": "Right now, how much is \"What sets me off\" a struggle for you?",
    "learnTitle": "Your Triggers and How to Plan",
    "learnBody": "Triggers are specific people, places, things, or even feelings that can set you off. Identifying your personal triggers helps you understand why you feel a certain way. When you know what they are, you can plan strategies to deal with them before they happen. This takes away the element of surprise and gives you more control.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and something suddenly catches you off guard, making you feel like using. What do you do first?",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming it as a craving is a good first step, but it doesn't directly address the trigger itself. You need a more active plan."
        },
        {
          "label": "Run a HALT check",
          "feedback": "Running a HALT check helps you understand your internal state, which is very useful. This gives you valuable information about your vulnerability."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger behind is a strong, direct action you can take to protect your recovery. It removes you from the immediate danger."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup is always a smart move when you feel overwhelmed. Reaching out helps you get support when you need it most."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Keeps Triggering Me?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Knowing your triggers allows you to create a plan and stay in control of your recovery.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "List your top 3 triggers.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Trigger Plan"
  },
  {
    "id": "understanding-my-addiction-what-is-halt-trying-to-tell-me",
    "moduleId": "understanding-my-addiction",
    "title": "What Is HALT Trying to Tell Me?",
    "minutes": 5,
    "order": 4,
    "problem": "Why do I feel off?",
    "checkIn": "Right now, how much is \"Why do I feel off\" a struggle for you?",
    "learnTitle": "HALT: Your Body's Warning Signals",
    "learnBody": "Hungry, Angry, Lonely, Tired. These four states make cravings much stronger. You might feel off, but it's often your body trying to tell you something. Addressing these basic needs can often reduce or even eliminate a craving. Pay attention to what HALT is trying to tell you.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you suddenly feel a strong urge to use. You're caught off guard and unsure why.",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming it as a craving is a good first step, but just waiting it out might leave you struggling. You could miss a chance to deal with the underlying cause."
        },
        {
          "label": "Run a HALT check",
          "feedback": "This is a smart move. Checking for hunger, anger, loneliness, or tiredness helps you understand the true source of your discomfort. Addressing these needs can often reduce the craving's power."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger behind is helpful in many situations, but it won't directly address an internal state. Your body might still be telling you something important."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup is always a good option if you're struggling. It's especially useful after you've tried to figure out what's going on yourself."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Is HALT Trying to Tell Me?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your body uses HALT to signal when a craving is more than just an urge.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Run a HALT check twice today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My HALT Check"
  },
  {
    "id": "understanding-my-addiction-why-does-stress-make-me-want-to-use",
    "moduleId": "understanding-my-addiction",
    "title": "Why Does Stress Make Me Want to Use?",
    "minutes": 6,
    "order": 5,
    "problem": "Why does stress hit so hard?",
    "checkIn": "Right now, how much is \"Why does stress hit so hard\" a struggle for you?",
    "learnTitle": "Stress and Your Urge to Use",
    "learnBody": "When you're under stress, your body releases hormones that push your brain to seek quick comfort. This often makes you want to use substances for fast relief. Learning to take slow, deep breaths can help calm this internal alarm. A well-thought-out plan for managing stress is more effective than just trying to use willpower. You can learn to respond differently when stress hits.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You feel the familiar tightening in your chest as a stressful situation arises, making you want to use. This feeling comes on quickly, catching you off guard.",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming the craving is a good first step, but just waiting it out might not be enough to manage the underlying stress that triggered it. You need more than just passive observation."
        },
        {
          "label": "Run a HALT check",
          "feedback": "Running a HALT check can help identify immediate physical and emotional needs that might be contributing to your stress and urge to use. It gives you a quick snapshot of what's going on."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger behind is a strong proactive move to remove yourself from the source of stress. This can buy you crucial time and space to regroup before the urge grows stronger."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup connects you with support and can help you process the stress and cravings with someone who understands. Don't underestimate the power of reaching out in tough moments."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Why Does Stress Make Me Want to Use?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Stress chemicals in your body make your brain look for fast relief, which often means wanting to use.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Use one stress tool today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Stress Plan"
  },
  {
    "id": "understanding-my-addiction-how-are-my-mental-health-and-recovery-co",
    "moduleId": "understanding-my-addiction",
    "title": "How Are My Mental Health and Recovery Connected?",
    "minutes": 7,
    "order": 6,
    "problem": "Why do both need care?",
    "checkIn": "Right now, how much is \"Why do both need care\" a struggle for you?",
    "learnTitle": "Mental Health and Recovery Go Together",
    "learnBody": "Depression, anxiety, and trauma often come with substance use disorder. When you treat both conditions at the same time, you get better results. Ignoring one while focusing on the other can make recovery harder. Taking medication for either issue is part of your healing, not a weakness. You deserve care for all parts of yourself.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You feel down and anxious, the way you sometimes do when you want to use. This feeling wasn't what you expected today.",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming a feeling as a craving might not fully address the underlying mental health struggle. It could leave you feeling stuck with the discomfort."
        },
        {
          "label": "Run a HALT check",
          "feedback": "A HALT check is useful for physical needs, but mental health struggles are more complex than just hunger or tiredness. This check won't cover everything."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger behind can help in the moment, but it doesn't deal with the deeper connection between your mood and recovery. The feeling may return later."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup gives you support and helps you talk through what's really happening. Someone else can offer a fresh perspective on your mental state."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Are My Mental Health and Recovery Connected?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your mental health and your recovery are deeply linked, so addressing both is essential for lasting change.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Book or confirm one appointment.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Whole-Health Plan"
  },
  {
    "id": "understanding-my-addiction-why-do-i-keep-repeating-the-same-pattern",
    "moduleId": "understanding-my-addiction",
    "title": "Why Do I Keep Repeating the Same Pattern?",
    "minutes": 5,
    "order": 7,
    "problem": "Why does this keep happening?",
    "checkIn": "Right now, how much is \"Why does this keep happening\" a struggle for you?",
    "learnTitle": "Your Pattern's Trigger, Habit, Payoff",
    "learnBody": "Every pattern you have follows a cycle. It starts with a trigger, which leads to a habit, and then you get a payoff. You don't need to change everything about your life. Understanding this cycle helps you see where you can make changes. Changing the middle step, the habit, is often the most effective way to break the pattern.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You feel yourself heading into that familiar, unwanted cycle. The moment catches you off guard.",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming a craving helps you recognize what's happening. Waiting it out gives the urge time to pass without acting on it."
        },
        {
          "label": "Run a HALT check",
          "feedback": "A HALT check is always a good idea when you feel off. It helps you identify immediate needs that might be driving the pattern."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger behind can break the cycle before it gains momentum. This is a strong move when you recognize the start of a pattern."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup connects you to support during a tough moment. Reaching out to someone helps you get through it."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Why Do I Keep Repeating the Same Pattern?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Recognize the trigger, the habit, and the payoff to change your patterns.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Map one pattern you noticed.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Pattern Map"
  },
  {
    "id": "understanding-my-addiction-what-happens-while-my-brain-is-healing",
    "moduleId": "understanding-my-addiction",
    "title": "What Happens While My Brain Is Healing?",
    "minutes": 6,
    "order": 8,
    "problem": "Will I ever feel normal?",
    "checkIn": "Right now, how much is \"Will I ever feel normal\" a struggle for you?",
    "learnTitle": "Your Brain Will Heal",
    "learnBody": "Your brain begins healing within weeks and continues for months. You'll have flat, foggy days, and that's normal. Getting enough sleep and sticking to a routine will help speed up this process.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You feel tired and unfocused today, just like the lesson described. This feeling makes you want to use. What do you do first?",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Recognizing a craving and letting it pass is a good step. Your brain is recovering, and these feelings are part of that."
        },
        {
          "label": "Run a HALT check",
          "feedback": "A HALT check reminds you to address basic needs. This can help you understand if your discomfort comes from hunger, anger, loneliness, or tiredness."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Removing yourself from the situation can be effective. Sometimes a change of scenery is all you need to shift your focus."
        },
        {
          "label": "Call for backup",
          "feedback": "Reaching out for support connects you with others. Sharing what you're going through can provide relief and different perspectives."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Happens While My Brain Is Healing?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Healing your brain takes time, and feeling off is a normal part of that journey.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Protect your sleep tonight.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Healing Plan"
  },
  {
    "id": "understanding-my-addiction-what-am-i-really-running-from",
    "moduleId": "understanding-my-addiction",
    "title": "What Am I Really Running From?",
    "minutes": 7,
    "order": 9,
    "problem": "What's underneath this?",
    "checkIn": "Right now, how much is \"What's underneath this\" a struggle for you?",
    "learnTitle": "Find What's Underneath",
    "learnBody": "Substances don't usually cause pain, they cover it up. When you identify the real issue, it loses some of its control over you. You don't have to carry the burden of fixing this on your own. There are people who can help you face these deeper struggles. Knowing what you're truly running from is a powerful step.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You feel the familiar pull of old habits later today. A strong urge hits you, and you realize something deeper is driving it.",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming it as a craving is a good start, but it might not address the underlying issue here. You're acknowledging the feeling, but not the cause."
        },
        {
          "label": "Run a HALT check",
          "feedback": "A HALT check can help you find immediate needs, which sometimes hide deeper problems. This is a solid approach to understanding what's happening."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger might give you temporary relief from the situation. However, it doesn't help you understand or deal with what you're trying to escape."
        },
        {
          "label": "Call for backup",
          "feedback": "Reaching out for support can give you the strength and perspective you need. This choice brings in help to explore what's really going on beneath the surface."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Am I Really Running From?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Understanding the pain your substance use covers helps take away its power.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Write one honest sentence.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Honest Page"
  },
  {
    "id": "understanding-my-addiction-understanding-my-recovery-story",
    "moduleId": "understanding-my-addiction",
    "title": "Understanding My Recovery Story.",
    "minutes": 5,
    "order": 10,
    "problem": "What's my story so far?",
    "checkIn": "Right now, how much is \"What's my story so far\" a struggle for you?",
    "learnTitle": "Your Story, Your Strength",
    "learnBody": "Your story isn't just about the harm you've experienced. It also holds your inner strength, the ability to get through tough times. Sharing what you've been through can help someone else on their own path. You have the power to decide what happens next in your life. You are writing the future chapters of your story.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're sharing a meal with an old friend, and they ask about your past struggles. This conversation brings up feelings you didn't expect.",
      "choices": [
        {
          "label": "Name it as a craving and wait it out",
          "feedback": "Naming it as a craving might be a misstep here. Your friend's question isn't a substance trigger, it's a prompt to reflect."
        },
        {
          "label": "Run a HALT check",
          "feedback": "A HALT check is always a good tool for understanding your current state. It helps you identify immediate physical or emotional needs in the moment."
        },
        {
          "label": "Leave the trigger behind",
          "feedback": "Leaving the trigger behind isn't possible in this situation without being rude. You're in a conversation, not near an object or place."
        },
        {
          "label": "Call for backup",
          "feedback": "Calling for backup is a solid move if you feel overwhelmed. Reaching out to your support network can provide perspective and calm."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Understanding My Recovery Story.\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your past doesn't define your future, but understanding it helps you write a new story.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Tell one piece of your story to someone safe.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Recovery Story"
  },
  {
    "id": "changing-my-everyday-life-how-do-i-build-a-better-daily-routine",
    "moduleId": "changing-my-everyday-life",
    "title": "How Do I Build a Better Daily Routine?",
    "minutes": 5,
    "order": 1,
    "problem": "What should my day look like?",
    "checkIn": "Right now, how much is \"What should my day look like\" a struggle for you?",
    "learnTitle": "Routine Helps You Decide Less",
    "learnBody": "A solid routine takes away many decisions you don't need to make. When you're trying to stay on track, making fewer choices saves energy. Focus on anchoring your day at three key times: morning, midday, and night. It's more important to stick to the same times each day than to find the perfect schedule. Consistency builds a strong foundation.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're halfway through the day, feeling stressed, and realize your routine has already gone off track. What do you do first?",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Sticking to your routine, even when it feels tough, builds resilience. You're showing yourself that your commitments matter."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "Doing a shorter version keeps you connected to your goals without overwhelming you. Small wins can keep your momentum going."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Asking for support is a smart move when you need it. Doing things with someone can provide accountability and make it feel less daunting."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Sometimes, resetting is the best choice for your well-being. There's no shame in adjusting your plans and starting fresh tomorrow."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Build a Better Daily Routine?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Build your routine around consistent anchors each morning, midday, and night.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Set one alarm for a daily anchor.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Daily Routine"
  },
  {
    "id": "changing-my-everyday-life-why-is-sleep-so-important",
    "moduleId": "changing-my-everyday-life",
    "title": "Why Is Sleep So Important?",
    "minutes": 6,
    "order": 2,
    "problem": "Why does sleep matter this much?",
    "checkIn": "Right now, how much is \"Why does sleep matter this much\" a struggle for you?",
    "learnTitle": "Sleep Helps You Stay Strong",
    "learnBody": "Getting good sleep helps you handle cravings better the next day. A consistent bedtime, a dark room, and no screens for 30 minutes before bed can make a big difference. Naps are fine, but pulling an all-nighter will set you back. You are building healthier habits, and sleep is a foundational one.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's late, and you know you should get ready for bed, but a strong craving hits. You wonder if sleep really matters tonight.",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Sticking to your routine is a good move. Even when it feels hard, your body will thank you for the consistency."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "Doing a shorter version of your bedtime routine might not give you the full benefits. You may still feel the effects of poor sleep tomorrow."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Asking someone for support is smart. They can help you get back on track and remind you why sleep is important."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Resetting tomorrow means you miss out on the benefits of sleep tonight. You might face stronger cravings in the morning."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Why Is Sleep So Important?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Prioritizing good sleep directly reduces your cravings and strengthens your recovery.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Go to bed at the same time tonight.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Sleep Plan"
  },
  {
    "id": "changing-my-everyday-life-how-can-food-help-my-recovery",
    "moduleId": "changing-my-everyday-life",
    "title": "How Can Food Help My Recovery?",
    "minutes": 7,
    "order": 3,
    "problem": "What should I eat?",
    "checkIn": "Right now, how much is \"What should I eat\" a struggle for you?",
    "learnTitle": "Steady Blood Sugar, Steady Recovery",
    "learnBody": "Low blood sugar can feel a lot like a craving. Eating regularly helps keep your blood sugar steady, which reduces those false alarms. Make it a habit to eat something every four to five hours. Always try to choose protein and drink water first.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're feeling a familiar pull, a sense of unease that could lead you off track. Your stomach feels empty, and it's been a while since you ate.",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Sticking to your routine, even when it's tough, builds consistency and reinforces new habits. This choice keeps you moving forward."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "Doing a quicker version of your planned routine still provides a benefit and keeps your commitment alive. Any progress is good progress."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Reaching out for support can make a big difference when you're feeling challenged. Having someone with you can strengthen your resolve."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "It's okay to acknowledge a slip without shame, but resetting tomorrow means you're delaying the chance to practice your new skill today."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Can Food Help My Recovery?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Eating consistently and choosing protein first helps manage cravings by keeping your blood sugar stable.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Eat three times today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Food Plan"
  },
  {
    "id": "changing-my-everyday-life-how-can-exercise-help-me-feel-better",
    "moduleId": "changing-my-everyday-life",
    "title": "How Can Exercise Help Me Feel Better?",
    "minutes": 5,
    "order": 4,
    "problem": "Do I really have to work out?",
    "checkIn": "Right now, how much is \"Do I really have to work out\" a struggle for you?",
    "learnTitle": "Moving Your Body Changes Your Mood",
    "learnBody": "You might wonder if you really need to exercise. The truth is, even ten minutes of movement can change your mood chemistry. Walking or taking the stairs both count as movement. Doing it with someone often helps you stick with it.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you're feeling low. That thought of 'Do I really have to work out?' comes to mind.",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Sticking to your routine is a strong move. You're building consistency and showing up for yourself."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "A quick ten minutes can make a real difference. You're still getting the mood boost without feeling overwhelmed."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Reaching out for support is smart. Having someone alongside you makes it easier to stay on track."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Resetting tomorrow is sometimes necessary. Just be honest with yourself about why you're putting it off."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Can Exercise Help Me Feel Better?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Even short bursts of movement can shift your mood and help you feel better.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Walk for 10 minutes.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Movement Plan"
  },
  {
    "id": "changing-my-everyday-life-what-can-i-do-instead-of-using",
    "moduleId": "changing-my-everyday-life",
    "title": "What Can I Do Instead of Using?",
    "minutes": 6,
    "order": 5,
    "problem": "What fills the space?",
    "checkIn": "Right now, how much is \"What fills the space\" a struggle for you?",
    "learnTitle": "Fill the Space, Avoid Relapse",
    "learnBody": "Boredom can be a serious risk for relapse. When you have empty time, your old habits might try to sneak back in. You need to have ready alternatives to fill that space. Keep a list of at least ten things you can do instead of using. Don't worry about finding the perfect activity, just focus on what's easy and available.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today, and you find yourself with unexpected free time. The thought crosses your mind, 'What can I do instead of using?'",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Sticking to your routine is a strong move. It helps build consistency and keeps you focused on your recovery goals."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "A shorter version keeps you engaged and moving forward. Even a small step is better than doing nothing."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Reaching out for support strengthens your resolve. Doing an activity with someone can make it more enjoyable and accountable."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Sometimes you miss the mark, and that's okay. Acknowledging it and planning for a fresh start tomorrow shows self-awareness."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Can I Do Instead of Using?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Have a plan for filling empty time, even simple activities can make a difference.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Do one thing off your list.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Instead-Of List"
  },
  {
    "id": "changing-my-everyday-life-how-do-i-calm-my-emotions",
    "moduleId": "changing-my-everyday-life",
    "title": "How Do I Calm My Emotions?",
    "minutes": 7,
    "order": 6,
    "problem": "How do I settle myself down?",
    "checkIn": "Right now, how much is \"How do I settle myself down\" a struggle for you?",
    "learnTitle": "Help Your Big Feelings Pass",
    "learnBody": "You can help big feelings pass more quickly. Don't fight them; that just makes them stronger. Try some cold water, slow breathing, or moving your body. It's always better to talk about what's bothering you before you act on it.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "Later today, a strong emotion catches you off guard. You feel overwhelmed and want to calm yourself down. What's the first thing you do?",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "This choice might be tough right now. Sometimes you need to address the emotion directly before you can stick to a routine."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "A shorter version of your coping strategy can still be very effective. Even a few minutes can shift your focus and bring some calm."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Reaching out to someone can provide support and a different perspective. Sharing your feelings often makes them less intense."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Giving up for today means missing an opportunity to practice your coping skills. You can always try to make progress, even small steps, instead of waiting for tomorrow."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Calm My Emotions?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Address strong feelings with simple actions to help them pass.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Use one calming tool today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Calm Plan"
  },
  {
    "id": "changing-my-everyday-life-how-do-i-break-old-habits",
    "moduleId": "changing-my-everyday-life",
    "title": "How Do I Break Old Habits?",
    "minutes": 5,
    "order": 7,
    "problem": "How do I change a habit?",
    "checkIn": "Right now, how much is \"How do I change a habit\" a struggle for you?",
    "learnTitle": "Change Your Habits, Change Your Life",
    "learnBody": "Habits involve three parts: a cue, a routine, and a reward. You can change a habit by keeping the same cue and reward, but swapping out the routine. Make it harder to reach the old habit by putting obstacles in its way. You are building new pathways to healthier actions. This takes consistent effort over time.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you feel the urge to fall back into an old, unhelpful habit. You weren't expecting it right now. What do you do first?",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Choosing to follow your old routine means you'll reinforce the habit you're trying to break. This makes it harder to choose differently next time."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "Doing a shorter version of a new, healthy routine can be a good step. It helps you build consistency without feeling overwhelmed."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Asking for support from someone else strengthens your commitment. They can help you stay accountable and offer encouragement."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Deciding to reset tomorrow without shame means you've given up for today. This can easily become a pattern, making real change more difficult."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Break Old Habits?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "To break a habit, change the routine, keep the reward, and make the old habit harder to do.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Swap one habit today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Habit Swap"
  },
  {
    "id": "changing-my-everyday-life-why-should-i-take-my-medication",
    "moduleId": "changing-my-everyday-life",
    "title": "Why Should I Take My Medication?",
    "minutes": 6,
    "order": 8,
    "problem": "Does medication really help?",
    "checkIn": "Right now, how much is \"Does medication really help\" a struggle for you?",
    "learnTitle": "Medication: Your Recovery Tool",
    "learnBody": "Medications for substance use and mental health significantly lower your chance of relapse. Taking your prescribed medication is a vital part of recovery, not a way to skip the hard work. If you experience side effects, talk to your doctor because adjustments can often help. Your care team can work with you to find the right balance.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you're feeling uncertain about taking your medication. You wonder if it's truly helping you right now.",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Sticking to your routine, even when you question it, builds strong habits. This shows you're committed to your long-term health."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "Doing a shorter version of your routine might feel like a compromise. It's better to address your doubts head-on than to cut corners."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Reaching out for support is always a good idea. Someone else can help you remember why this step is important for your recovery."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Deciding to skip today and reset tomorrow means you're avoiding the issue. You lose a day of progress and might feel more uncertain later."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Why Should I Take My Medication?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Medication is a powerful tool to support your recovery, not a shortcut around it.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Take your meds on time today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Medication Routine"
  },
  {
    "id": "changing-my-everyday-life-how-do-i-have-fun-without-using",
    "moduleId": "changing-my-everyday-life",
    "title": "How Do I Have Fun Without Using?",
    "minutes": 7,
    "order": 9,
    "problem": "Can life still be fun?",
    "checkIn": "Right now, how much is \"Can life still be fun\" a struggle for you?",
    "learnTitle": "Find New Ways to Have Fun",
    "learnBody": "Finding fun in recovery is a skill you can learn, and it helps you stay sober. When you try new things, they might feel dull at first. Stick with them, and sober enjoyment often grows over time. Make a point to try at least three new activities this month.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You find yourself with free time, and the old thought pops up: 'What can I do for fun without using?' It feels like a surprise.",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Sticking to a healthy routine gives you a plan, even when you're caught off guard. This choice means you've already built sober fun into your day."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "Sometimes, a full activity feels too much, but a quick version keeps you engaged. Doing just ten minutes of something new helps build the habit."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Reaching out to someone else makes an activity less isolating and more enjoyable. Shared experiences can make new fun feel less awkward."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Life happens, and sometimes you miss the mark, even with good intentions. Acknowledging that and planning for tomorrow lets you move forward without guilt."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Have Fun Without Using?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "New fun in recovery often feels different at first, but it gets better if you keep trying.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Plan one fun thing this week.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Sober Fun List"
  },
  {
    "id": "changing-my-everyday-life-building-my-daily-recovery-plan",
    "moduleId": "changing-my-everyday-life",
    "title": "Building My Daily Recovery Plan.",
    "minutes": 5,
    "order": 10,
    "problem": "How do I put it all together?",
    "checkIn": "Right now, how much is \"How do I put it all together\" a struggle for you?",
    "learnTitle": "Your Daily Recovery Plan",
    "learnBody": "A daily recovery plan helps you structure your time and stay on track. You can create a simple one-page outline for your morning, day, and night. Make sure to include one person you can connect with and one tool you'll use for support. Post this plan where you'll see it often.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You planned to make your daily recovery plan today. But now you feel overwhelmed, and it's already later than you wanted to start.",
      "choices": [
        {
          "label": "Follow my routine anyway",
          "feedback": "Even if it feels hard right now, sticking to your plan helps build consistency. Finishing what you started strengthens your commitment to recovery."
        },
        {
          "label": "Do the 10-minute version",
          "feedback": "Doing a shorter version is a smart way to adapt without giving up. This keeps you moving forward, even when time is tight or you feel drained."
        },
        {
          "label": "Ask someone to do it with me",
          "feedback": "Reaching out for help strengthens your network and makes the task feel less daunting. Sharing the load with someone can make a big difference."
        },
        {
          "label": "Reset tomorrow, no shame",
          "feedback": "Deciding to reset tomorrow might feel easier now, but it's a missed chance to practice commitment. You're simply delaying the work you need to do."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Building My Daily Recovery Plan.\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Building a recovery plan helps you manage your day and stay focused on what matters.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Post your plan somewhere visible.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Daily Recovery Plan"
  },
  {
    "id": "healing-my-relationships-can-people-trust-me-again",
    "moduleId": "healing-my-relationships",
    "title": "Can People Trust Me Again?",
    "minutes": 5,
    "order": 1,
    "problem": "Is trust even possible?",
    "checkIn": "Right now, how much is \"Is trust even possible\" a struggle for you?",
    "learnTitle": "Trust Comes From What You Do",
    "learnBody": "Building trust again takes consistent action, not just words. Each small promise you keep shows people you're reliable. These small, dependable acts quickly accumulate, proving your commitment. Some people might need more time to see your change, and that's okay. You can't rush their process, but you can keep showing up.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You feel that familiar sting of doubt when someone questions your word. They look at you, clearly wondering if they can rely on you.",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Pausing gives you a moment to collect yourself and think before you react. This helps you respond thoughtfully instead of impulsively."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement can help you express your feelings without blaming the other person. It lets them hear your perspective directly and calmly."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud clearly communicates your limits and expectations. This can be important for protecting your own recovery and space."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away lets you manage overwhelming emotions and return when you're calmer. You can then address the situation more effectively and with a clear head."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Can People Trust Me Again?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Trust is rebuilt through your actions and the small promises you consistently keep.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Keep one promise today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Trust Plan"
  },
  {
    "id": "healing-my-relationships-how-do-i-communicate-better",
    "moduleId": "healing-my-relationships",
    "title": "How Do I Communicate Better?",
    "minutes": 6,
    "order": 2,
    "problem": "How do I say what I mean?",
    "checkIn": "Right now, how much is \"How do I say what I mean\" a struggle for you?",
    "learnTitle": "Speak Your Mind Clearly",
    "learnBody": "Good communication starts with understanding yourself. Try using 'I feel… when… I need…' to express what's going on inside. It helps you share your feelings and needs directly. You'll also want to speak up before your emotions take over. Remember, truly listening is just as important as talking.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and a difficult conversation comes up. You feel your anger rising.",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a moment to pause before you speak can help you gather your thoughts. This lets you respond more thoughtfully instead of reacting impulsively."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement can help you express your feelings without blaming the other person. It focuses on your experience and what you need from the situation."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud clearly defines what you will and won't accept. This action can prevent the situation from escalating further."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away and returning later gives everyone time to cool down. It allows for a more productive conversation when emotions aren't running so high."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Communicate Better?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Say what you mean using 'I' statements and listen carefully to the other person.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Use one 'I' statement today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Talking Tool"
  },
  {
    "id": "healing-my-relationships-how-do-i-set-healthy-boundaries",
    "moduleId": "healing-my-relationships",
    "title": "How Do I Set Healthy Boundaries?",
    "minutes": 7,
    "order": 3,
    "problem": "How do I say no?",
    "checkIn": "Right now, how much is \"How do I say no\" a struggle for you?",
    "learnTitle": "Boundaries Protect Your Peace",
    "learnBody": "Setting a boundary isn't an attack on someone else. It's a way to protect your connection with them and yourself. You can say 'I can't do that' without a long explanation. A short, direct answer is enough. You don't owe anyone a detailed reason.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "Someone just asked you for something you're not ready to give. You feel that familiar pressure to say yes, even though you don't want to.",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a moment to breathe gives you time to think. This helps you avoid an automatic 'yes' you might regret later."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Deciding what you need to say to yourself first helps solidify your boundary. You can then communicate it more clearly to the other person."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Stating your boundary aloud is the final step in protecting your space. This choice makes your limit clear to others."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away helps if you feel overwhelmed in the moment. You can then decide how to respond when you feel calmer."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Set Healthy Boundaries?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "A boundary protects you and your relationships, not just from others but also from your own old habits.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Set one boundary today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Boundary Script"
  },
  {
    "id": "healing-my-relationships-how-can-i-repair-family-relationships",
    "moduleId": "healing-my-relationships",
    "title": "How Can I Repair Family Relationships?",
    "minutes": 5,
    "order": 4,
    "problem": "How do I start fixing things?",
    "checkIn": "Right now, how much is \"How do I start fixing things\" a struggle for you?",
    "learnTitle": "Actions Speak Louder Than Words",
    "learnBody": "Your family has heard promises before. They need to see real change in your actions, not just hear more words. Let them decide when they are ready to engage, and be patient with their timeline. Show up consistently, even for small, everyday moments, not only when something big happens.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are at your family's home for a short visit. Your brother starts bringing up past hurts, and you feel yourself getting defensive. What do you do first?",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a pause gives you a moment to collect your thoughts and decide on a response that shows you are listening. This helps you avoid reacting defensively and keeps the conversation on track."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement can be effective, but in this specific moment, it might feel like you are still focused on your own perspective rather than acknowledging theirs. It's a good tool, just maybe not the very first step here."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud might escalate the tension if your brother feels you are shutting him down. You want to show you are willing to listen, even if it's uncomfortable right now."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away and coming back later can give both of you space to cool down, which is often helpful. However, it might also feel like you are avoiding the conversation entirely, which could be perceived negatively in this situation."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Can I Repair Family Relationships?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your family needs to see consistent action, not just hear words, to start rebuilding trust.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Reach out to one family member.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Repair Plan"
  },
  {
    "id": "healing-my-relationships-how-can-i-be-the-parent-i-want-to-be",
    "moduleId": "healing-my-relationships",
    "title": "How Can I Be the Parent I Want to Be?",
    "minutes": 6,
    "order": 5,
    "problem": "How do I show up for my kids?",
    "checkIn": "Right now, how much is \"How do I show up for my kids\" a struggle for you?",
    "learnTitle": "Be Present for Your Kids",
    "learnBody": "Your children don't need you to be a perfect parent. They need you to show up consistently, even in small ways. Giving them regular, focused time means more than big, occasional gifts or promises. You should also take responsibility for your actions, explaining things in ways they can understand.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are with your child, and a situation comes up that challenges your ability to be the parent you want to be. You feel yourself getting flustered.",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a pause gives you a moment to collect yourself and think clearly. This can prevent you from reacting impulsively."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement helps you express your feelings without blaming your child. This keeps communication open and honest."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud clearly communicates your limits and expectations. It teaches your child about respect and appropriate behavior."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away and coming back can give both you and your child space. This move helps you calm down and approach the situation with a clearer head."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Can I Be the Parent I Want to Be?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your consistent presence and honesty are the most powerful gifts you can give your children.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Spend 15 focused minutes with your child.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Parenting Plan"
  },
  {
    "id": "healing-my-relationships-what-makes-a-healthy-friendship",
    "moduleId": "healing-my-relationships",
    "title": "What Makes a Healthy Friendship?",
    "minutes": 7,
    "order": 6,
    "problem": "Who is safe to be around?",
    "checkIn": "Right now, how much is \"Who is safe to be around\" a struggle for you?",
    "learnTitle": "Friendships That Support You",
    "learnBody": "Think about the people you spend time with. Safe people respect your recovery journey and your choices. Look at what they do, not just what they say. It's okay if some relationships change as you grow and heal. You deserve friends who truly support your new life.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're at a gathering, and an old acquaintance starts pushing you to do something you know isn't good for your recovery. They say, \"Just like old times.\" What do you do first?",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a pause gives you a moment to collect yourself and think clearly. This keeps you from reacting impulsively to the pressure."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement helps you communicate your feelings and needs directly. This choice lets you express yourself without blaming the other person."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud clearly states what you will and won't do. This choice firmly protects your recovery in the moment."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away and coming back lets you remove yourself from the immediate pressure. You can then decide how to handle the situation when you feel more grounded."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Makes a Healthy Friendship?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your true friends will always respect your choices and support your recovery, no matter what.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Text one healthy friend.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Safe People List"
  },
  {
    "id": "healing-my-relationships-when-should-i-walk-away",
    "moduleId": "healing-my-relationships",
    "title": "When Should I Walk Away?",
    "minutes": 5,
    "order": 7,
    "problem": "How do I know it's time?",
    "checkIn": "Right now, how much is \"How do I know it's time\" a struggle for you?",
    "learnTitle": "Knowing When to Leave",
    "learnBody": "Sometimes, you need to decide if a relationship threatens your sobriety. If being with someone puts your recovery at risk, that's a clear sign. You might need to create some distance. Taking a step back doesn't always mean it's permanent. Your well-being and recovery must always come first.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you find yourself in a situation where you feel your recovery is being tested. You didn't expect it, and you're caught off guard.",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a moment to collect yourself lets you think clearly before reacting. This pause can give you the space to decide your next best move."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement helps you express your feelings without blaming the other person. This is good for setting boundaries when you decide to stay in the conversation."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud clearly communicates your needs to the other person. This choice works well when you're ready to address the situation directly and firmly."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away from the situation physically removes you from the immediate risk. You can return later when you feel more grounded and ready to talk."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"When Should I Walk Away?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "If a relationship puts your recovery at risk, you might need to step away, even if it's just for a while.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Mute or block one risky contact.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Walk-Away Plan"
  },
  {
    "id": "healing-my-relationships-how-do-i-make-things-right",
    "moduleId": "healing-my-relationships",
    "title": "How Do I Make Things Right?",
    "minutes": 6,
    "order": 8,
    "problem": "How do I make amends?",
    "checkIn": "Right now, how much is \"How do I make amends\" a struggle for you?",
    "learnTitle": "Amends Means Changed Behavior",
    "learnBody": "Making amends means showing up with different behavior, not just saying you're sorry. You don't want to make an amends that causes more pain for someone else. Always talk it over with your sponsor before you act. They can help you figure out the best way forward.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are face-to-face with someone you hurt in the past. The moment feels tense, and you're not sure how to begin making things right.",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a pause gives you crucial time to think. This helps you avoid saying something you might regret later."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using 'I' statements is a good way to express your feelings without blaming the other person. It keeps the focus on your experience."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud might be too soon for this situation. It could make the other person feel defensive before you've even started to make amends."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away and coming back later can give both of you space. This allows emotions to cool down before you try to address the situation."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Make Things Right?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "True amends show up as changed behavior, not just words.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "List one amends you could make.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Amends List"
  },
  {
    "id": "healing-my-relationships-how-do-i-forgive-myself",
    "moduleId": "healing-my-relationships",
    "title": "How Do I Forgive Myself?",
    "minutes": 7,
    "order": 9,
    "problem": "Can I let go of the guilt?",
    "checkIn": "Right now, how much is \"Can I let go of the guilt\" a struggle for you?",
    "learnTitle": "Let Go of Guilt, Not Accountability",
    "learnBody": "Guilt is a feeling that says you did something wrong. Shame, however, tells you that you are a bad person. Only guilt can be useful because it allows for accountability and compassion at the same time. Holding yourself accountable while still showing yourself compassion makes relapse less likely.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today, and a feeling of deep regret washes over you. You start to think about all the mistakes you've made. What do you do first to find a path to self-forgiveness?",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a pause gives you space to recognize the feeling without judgment. This helps you avoid an automatic, unhelpful reaction."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement here helps you acknowledge your feelings internally. It's a good way to label what's happening without letting it overwhelm you."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud isn't quite right for an internal feeling. This tool is best for managing interactions with other people."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away helps you reset your environment and your thoughts. You can return to the feeling when you're ready to process it calmly."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Forgive Myself?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "You can acknowledge your past actions without letting them define who you are now.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Write yourself one kind sentence.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Self-Forgiveness Note"
  },
  {
    "id": "healing-my-relationships-building-my-relationship-plan",
    "moduleId": "healing-my-relationships",
    "title": "Building My Relationship Plan.",
    "minutes": 5,
    "order": 10,
    "problem": "How do I keep relationships healthy?",
    "checkIn": "Right now, how much is \"How do I keep relationships healthy\" a struggle for you?",
    "learnTitle": "Build Your Relationship Plan",
    "learnBody": "Think about the people you want to reconnect with and how you'll do it. You should also decide on clear boundaries for each relationship. Plan for regular check-ins to make sure things stay on track. Review your plan every month to see what's working and what needs adjustment.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're at home, and a challenging moment with a loved one comes up unexpectedly. You need to use your new relationship plan right now.",
      "choices": [
        {
          "label": "Take a pause before responding",
          "feedback": "Taking a pause gives you a chance to think about your plan before you react. It helps you decide your next move instead of just letting things happen."
        },
        {
          "label": "Use my 'I' statement",
          "feedback": "Using an 'I' statement can help you express your feelings without blaming the other person. This approach often makes conversations more open and less confrontational."
        },
        {
          "label": "Set the boundary out loud",
          "feedback": "Setting a boundary out loud lets others know what you need from them. It's a direct way to protect yourself and communicate your limits clearly."
        },
        {
          "label": "Step away and come back",
          "feedback": "Stepping away and coming back can give both of you space to cool down. You can return to the conversation when you're calmer and ready to use your plan effectively."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Building My Relationship Plan.\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your relationship plan helps you navigate tough moments and keep your connections strong.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Share one part of your plan with someone.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Relationship Plan"
  },
  {
    "id": "building-a-life-that-works-where-am-i-going-to-live",
    "moduleId": "building-a-life-that-works",
    "title": "Where Am I Going to Live?",
    "minutes": 5,
    "order": 1,
    "problem": "How do I get stable housing?",
    "checkIn": "Right now, how much is \"How do I get stable housing\" a struggle for you?",
    "learnTitle": "Housing Is Key to Your Recovery",
    "learnBody": "Finding a stable place to live is a core part of your recovery, not something extra. Always ask about housing options specifically for reentry or recovery programs. Make sure you bring your ID and any other important paperwork to every appointment you have. Being prepared helps you move forward with less hassle.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're suddenly faced with the immediate need to find a place to stay. You feel a wave of anxiety hit you. What's the very first thing you do?",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making the call without a plan often leads to frustration and wasted effort. It's better to prepare before you dial."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Your case manager has resources and knowledge to guide you through this process. Reaching out for their help is a smart first step."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking down a big task like finding housing into smaller steps makes it feel less overwhelming. This approach helps you get started and build momentum."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone with you for support can make a difficult situation easier to handle. They can help you remember details or offer a different perspective."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Where Am I Going to Live?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Stable housing is a foundation for your recovery, so prioritize finding it and be ready for appointments.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Call one housing resource.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Housing Plan"
  },
  {
    "id": "building-a-life-that-works-how-do-i-find-a-job",
    "moduleId": "building-a-life-that-works",
    "title": "How Do I Find a Job?",
    "minutes": 6,
    "order": 2,
    "problem": "Who will hire me?",
    "checkIn": "Right now, how much is \"Who will hire me\" a struggle for you?",
    "learnTitle": "Finding Work With a Record",
    "learnBody": "Many employers are open to hiring people with past convictions. These fair-chance employers are becoming more common. Begin your search by looking into staffing agencies and skilled trades. You should also practice how you'll talk about your record with potential employers. Knowing what to say will help you feel more confident.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're looking for work and an employer asks about your background. You didn't expect the question so soon.",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making the call without preparation might feel brave, but it could also lead to a poor outcome. You might stumble over your words or miss important details."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Asking your case manager for help is a smart move. They often have resources or advice tailored to your situation and can help you prepare."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking down the task into small, manageable steps makes it less overwhelming. This approach helps you tackle the challenge one piece at a time."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone with you for support can give you confidence. However, remember that the employer will want to hear directly from you about your experience."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Find a Job?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Fair-chance employers exist, and preparing how you'll discuss your past is key to finding a job.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Apply to one job.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Job Search Plan"
  },
  {
    "id": "building-a-life-that-works-how-do-i-manage-my-money",
    "moduleId": "building-a-life-that-works",
    "title": "How Do I Manage My Money?",
    "minutes": 7,
    "order": 3,
    "problem": "How do I stay on top of money?",
    "checkIn": "Right now, how much is \"How do I stay on top of money\" a struggle for you?",
    "learnTitle": "Manage Your Money, Not the Other Way",
    "learnBody": "Having cash on hand can be a real trigger for some people. It's smart to plan ahead for how you'll handle it. A simple budget is always better than no budget at all. Divide your money into categories like needs, savings, and even a small amount for something you enjoy. This helps you stay in control of your finances.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You just got paid and have some cash in your pocket. You feel the familiar urge to spend it on something you know you shouldn't.",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making that call on impulse is exactly what you're trying to avoid. Take a moment to think about your plan first."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Your case manager can help you sort through your options and create a better strategy. This choice connects you to support."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking down your money management into a small step, like setting aside a specific amount for bills, makes it less overwhelming. It's a good way to start."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone with you to handle money may avoid a bad decision in the moment. This helps you stay accountable."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Manage My Money?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Plan your money use before cash becomes a problem.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Write down what you spent today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Money Plan"
  },
  {
    "id": "building-a-life-that-works-should-i-go-back-to-school",
    "moduleId": "building-a-life-that-works",
    "title": "Should I Go Back to School?",
    "minutes": 5,
    "order": 4,
    "problem": "Is school worth it for me?",
    "checkIn": "Right now, how much is \"Is school worth it for me\" a struggle for you?",
    "learnTitle": "School Can Pay Off",
    "learnBody": "Think about what a short certificate can do for you. These programs often lead to quicker job opportunities and better pay. Community colleges in Tulare County offer specific help for people coming home from custody. You may also qualify for financial aid to help cover your costs.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are talking with a friend about your future, and they ask if you've thought about going back to school. The question makes you freeze up.",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making the call without a plan might leave you feeling overwhelmed. It's better to prepare before you reach out."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Your case manager can connect you with resources and help you sort through your options. This is a smart first step."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking it down helps you avoid getting stuck before you even start. This makes the big picture feel more manageable."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone along for support is a good idea when you're ready to explore options. They can help you stay focused."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Should I Go Back to School?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Even short educational programs can open doors and improve your financial situation.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Look up one program.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Education Plan"
  },
  {
    "id": "building-a-life-that-works-how-do-i-get-where-i-need-to-go",
    "moduleId": "building-a-life-that-works",
    "title": "How Do I Get Where I Need to Go?",
    "minutes": 6,
    "order": 5,
    "problem": "How do I solve transportation?",
    "checkIn": "Right now, how much is \"How do I solve transportation\" a struggle for you?",
    "learnTitle": "Plan Your Ride, Keep Your Appointments",
    "learnBody": "Missed rides can derail your progress. They cause you to miss important appointments and create unnecessary setbacks. Many resources exist to help you with transportation, like bus passes or ride vouchers. Always ask your support system or case manager what's available. Make planning your ride part of booking any appointment.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You need to get to an important meeting across town in an hour. You just realized you have no way to get there.",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Calling for a ride at the last minute might work sometimes, but it's often too late. You might miss your meeting and feel frustrated."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Asking your case manager for help is a good first step, especially if you have a little time. They can help you find transportation options or reschedule."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking it down can help you think clearly, but a 10-minute step won't solve an immediate transportation crisis. This is a good strategy for planning ahead."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone with you is helpful for support, but it doesn't solve the core problem of how you'll get there. You still need a way to travel."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Get Where I Need to Go?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Plan your transportation when you schedule your appointment, not when you're walking out the door.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Set up a ride for your next appointment.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Transportation Plan"
  },
  {
    "id": "building-a-life-that-works-how-do-i-take-care-of-my-health",
    "moduleId": "building-a-life-that-works",
    "title": "How Do I Take Care of My Health?",
    "minutes": 7,
    "order": 6,
    "problem": "How do I get healthcare?",
    "checkIn": "Right now, how much is \"How do I get healthcare\" a struggle for you?",
    "learnTitle": "Connect to Your Health Care",
    "learnBody": "Medi-Cal helps cover most of your health needs once you're back in the community. This includes dental and vision care, which are important parts of your overall well-being. It's best to choose one primary doctor and continue seeing them. This helps you build a relationship and get consistent care.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You realize you need to see a doctor for a lingering cough. You feel overwhelmed just thinking about where to start.",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making the call without a plan often leads to frustration and giving up. It's hard to make progress when you're not prepared."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Your case manager is there to help you navigate the system. Asking them for support is a smart move that saves you time and stress."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking a big task into a small, manageable step makes it less daunting. You can handle a short step, even if the whole process feels big."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone with you offers support and a second set of ears. They can help you stay focused and remember important details."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Take Care of My Health?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Getting your health care set up starts with using the resources available to you.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Confirm your insurance is active.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Health Plan"
  },
  {
    "id": "building-a-life-that-works-what-resources-can-help-me",
    "moduleId": "building-a-life-that-works",
    "title": "What Resources Can Help Me?",
    "minutes": 5,
    "order": 7,
    "problem": "What's out there for me?",
    "checkIn": "Right now, how much is \"What's out there for me\" a struggle for you?",
    "learnTitle": "Find Resources: Food, ID, Support",
    "learnBody": "Many basic needs like food, clothing, and phones are available at no cost. You can also get help with essential documents like IDs. Often, one agency you contact will connect you to several other helpful programs. Your community health worker can also guide you to these resources. Don't hesitate to ask for directions to what you need.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You realize you need help finding some basic resources but feel unsure where to start. What do you do first?",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making the call without a plan might leave you feeling frustrated. You could end up wasting time if you don't know who to ask for."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Your case manager is there to help you navigate these systems. They can often point you directly to the best resources for your situation."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking it down into a small step, like finding one phone number, makes the task less overwhelming. This approach helps you get started without feeling defeated."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone along provides support and another set of ears. They might remember details or ask questions you wouldn't think of alone."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Resources Can Help Me?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Knowing where to find help for basic needs is a key part of building a stable life.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Contact one resource today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Resource List"
  },
  {
    "id": "building-a-life-that-works-what-can-i-do-instead-of-using",
    "moduleId": "building-a-life-that-works",
    "title": "What Can I Do Instead of Using?",
    "minutes": 6,
    "order": 8,
    "problem": "How do I fill my time well?",
    "checkIn": "Right now, how much is \"How do I fill my time well\" a struggle for you?",
    "learnTitle": "Fill Your Free Time Well",
    "learnBody": "Having a purpose protects you. It keeps your mind focused on positive goals and away from old patterns. Build a strong routine and structure your free time before you end up drifting. Volunteering helps you build both a resume and a network of supportive people.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you have unexpected free time. Old urges start to surface, catching you off guard. What do you do first?",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making the call won't help you find new ways to spend your time. It might lead you back to old habits."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Your case manager can definitely help you plan, but they may not be available right this second. This choice delays taking immediate action."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking it down into a small, manageable step gives you something to do right now. It prevents you from feeling overwhelmed and lets you take control."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone with you could be a good idea for support. However, it doesn't directly address the problem of how to fill your time productively."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Can I Do Instead of Using?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Structuring your free time with purpose protects you from relapse.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Sign up for one activity.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Purpose List"
  },
  {
    "id": "building-a-life-that-works-what-kind-of-life-do-i-want",
    "moduleId": "building-a-life-that-works",
    "title": "What Kind of Life Do I Want?",
    "minutes": 7,
    "order": 9,
    "problem": "What am I building?",
    "checkIn": "Right now, how much is \"What am I building\" a struggle for you?",
    "learnTitle": "Design Your Future Life",
    "learnBody": "Think about a typical Tuesday one year from now. Imagine it clearly, including what you're doing, who you're with, and how you feel. Write down the details of that day. Then, figure out the steps you need to take to get there.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're thinking about your future and what kind of life you want. This thought feels big and overwhelming.",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "You're not facing a choice to call someone, so this action doesn't fit the situation. Focus on the actual problem you're trying to solve right now."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Your case manager is a good resource, but this thought is about your personal vision. You can start by thinking for yourself before bringing in others."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking down a big idea into a small, manageable step is a smart way to begin. This helps you avoid getting overwhelmed and makes progress possible."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone in too early might make it harder to define what *you* truly want. This is a personal vision you need to establish first."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Kind of Life Do I Want?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Start building your future by clearly imagining what you want and then breaking it into small steps.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Describe your future Tuesday.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Life Vision"
  },
  {
    "id": "building-a-life-that-works-building-my-stability-plan",
    "moduleId": "building-a-life-that-works",
    "title": "Building My Stability Plan.",
    "minutes": 5,
    "order": 10,
    "problem": "How do I keep it all standing?",
    "checkIn": "Right now, how much is \"How do I keep it all standing\" a struggle for you?",
    "learnTitle": "Four Steps to Your Stability Plan",
    "learnBody": "Your stability plan covers housing, income, health, and transport. Pick one action for each area that moves you forward. Set clear deadlines for these actions, because deadlines are more powerful than just wishing. Review your progress and plans with your case manager regularly.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You realize you haven't started on your stability plan and feel overwhelmed. The thought of all the steps makes you want to put it off.",
      "choices": [
        {
          "label": "Make the call anyway",
          "feedback": "Making the call even when you're caught off guard shows commitment. It's a good first step, but you might need more support for the whole plan."
        },
        {
          "label": "Ask my case manager for help",
          "feedback": "Asking your case manager for help is a solid move. They can help you break down the plan and keep you accountable."
        },
        {
          "label": "Break it into one 10-minute step",
          "feedback": "Breaking it into a small 10-minute step makes the task less daunting. This can help you get started and build momentum."
        },
        {
          "label": "Bring someone with me",
          "feedback": "Bringing someone with you offers support and a different perspective. This can make a difficult task feel more manageable."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Building My Stability Plan.\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Building a stable life requires concrete actions with deadlines, not just good intentions.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Do one action off your stability plan.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Stability Plan"
  },
  {
    "id": "when-recovery-gets-hard-how-do-i-know-i-m-slipping",
    "moduleId": "when-recovery-gets-hard",
    "title": "How Do I Know I'm Slipping?",
    "minutes": 5,
    "order": 1,
    "problem": "What are my warning signs?",
    "checkIn": "Right now, how much is \"What are my warning signs\" a struggle for you?",
    "learnTitle": "Spotting Your Own Warning Signs",
    "learnBody": "Relapse doesn't just happen; it starts long before you pick up. You'll often see changes in your thoughts, feelings, or actions first. Things like isolating yourself, missing meetings, or keeping secrets are common red flags. Recognizing these signs early gives you a chance to change course. This isn't a judgment; it's an opportunity to act.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're feeling off today, restless and a bit alone. Your mind drifts to old habits. How do you respond to this feeling of a potential slip?",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor right away is a strong move. They can help you talk through what you're feeling and offer immediate support."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Getting yourself to a safe place physically can create distance from triggers. This buys you time to think and make a plan."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Pulling out your relapse prevention plan helps you remember specific strategies you've already committed to using. It's a structured way to confront the moment."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "While getting to a meeting is a good long-term goal, it might not be the fastest way to address an immediate urge. You need a quicker action first."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Know I'm Slipping?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your warning signs are personal alerts, giving you a chance to intervene before a slip becomes a relapse.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "List your top 3 warning signs.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Warning Signs"
  },
  {
    "id": "when-recovery-gets-hard-what-happens-before-a-relapse",
    "moduleId": "when-recovery-gets-hard",
    "title": "What Happens Before a Relapse?",
    "minutes": 6,
    "order": 2,
    "problem": "What's the chain of events?",
    "checkIn": "Right now, how much is \"What's the chain of events\" a struggle for you?",
    "learnTitle": "How Relapse Develops",
    "learnBody": "Relapse often follows a pattern, moving from emotional changes to mental struggles, and then to physical actions. You can think of it as a chain of events with distinct links. The best time to intervene and stop this process is always at the earliest possible stage. Recognizing these signs early gives you more power to change course.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "Imagine it's later today and you notice the early signs of emotional unease, the kind that can lead to relapse. It catches you off guard. What do you do first?",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor is a solid step for support and accountability when you feel off track. They can help you talk through what's happening."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Physically removing yourself from a triggering situation can create immediate safety. This buys you time to think and make better choices."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Your relapse prevention plan holds specific strategies tailored for moments like these. It reminds you of your agreed-upon actions."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Attending a meeting can offer immediate peer support and connection. This helps shift your focus and reminds you you're not alone."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Happens Before a Relapse?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Understanding the stages of relapse gives you specific points where you can intervene effectively.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Name where you usually get stuck.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Relapse Chain"
  },
  {
    "id": "when-recovery-gets-hard-what-should-i-do-when-my-thoughts-change",
    "moduleId": "when-recovery-gets-hard",
    "title": "What Should I Do When My Thoughts Change?",
    "minutes": 7,
    "order": 3,
    "problem": "What if I start romanticizing using?",
    "checkIn": "Right now, how much is \"What if I start romanticizing using\" a struggle for you?",
    "learnTitle": "When Romantic Thoughts About Using Start",
    "learnBody": "When you find yourself romanticizing past use, play that tape all the way forward. Remember how bad things truly got. Tell on the thought by saying it out loud to someone you trust. Thoughts lose a lot of their power once they are out in the open. This simple act can help break their hold.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are having a good day, but then a memory of using pops into your head. It feels appealing, and you start to think about it more. What do you do first to stop this thought from taking over?",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor is a solid move. They can help you talk through the romanticized thought before it gets stronger."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Leaving to go somewhere safe can change your environment. This might disrupt the thought pattern and help you clear your head."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Opening your relapse prevention plan puts your tools right in front of you. It's a proactive way to remind yourself of your strategies."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Getting to a meeting today is a good long-term plan. However, for an immediate thought, it might not be the fastest way to get help right now."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Should I Do When My Thoughts Change?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Talking out loud about romantic thoughts of using helps to disarm them.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Tell someone about one using thought.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Play-the-Tape Tool"
  },
  {
    "id": "when-recovery-gets-hard-how-do-i-get-through-high-risk-situation",
    "moduleId": "when-recovery-gets-hard",
    "title": "How Do I Get Through High-Risk Situations?",
    "minutes": 5,
    "order": 4,
    "problem": "How do I handle risky places?",
    "checkIn": "Right now, how much is \"How do I handle risky places\" a struggle for you?",
    "learnTitle": "Handle Risky Places Safely",
    "learnBody": "Some places can threaten your recovery. You can avoid some, but others you can't. For those you can't, make a plan. Always have a way to leave and a ride lined up before you go. Bringing a sober person with you is also a strong move.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you find yourself in a risky situation, caught off guard. You need to act fast.",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor is a good idea for support and guidance. They can help you think through your next steps."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Leaving immediately removes you from danger. This action directly addresses the immediate threat to your recovery."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Opening your relapse prevention plan gives you concrete strategies. You can use it to guide your actions and choices in the moment."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Getting to a meeting can offer support and structure. However, it might not be the most immediate or safe first step if you are currently in a high-risk place."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Get Through High-Risk Situations?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Plan ahead for risky places by knowing how you'll leave and who you'll bring.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Plan an exit for one event.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My High-Risk Plan"
  },
  {
    "id": "when-recovery-gets-hard-what-if-i-slip",
    "moduleId": "when-recovery-gets-hard",
    "title": "What If I Slip?",
    "minutes": 6,
    "order": 5,
    "problem": "What do I do right after?",
    "checkIn": "Right now, how much is \"What do I do right after\" a struggle for you?",
    "learnTitle": "After a Slip: Safety and Honesty",
    "learnBody": "If you slip, your first step is to get yourself to a safe place. Then, be honest about what happened, even if it feels difficult. Hiding a slip can make it worse and turn it into a full relapse. You'll find understanding and support here, not judgment. Remember, one slip doesn't mean you've failed.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you're caught off guard by a slip. This moment feels real and immediate. What do you do first?",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor is a good step, but there's something you should do even before that. Your immediate safety is the first priority."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Getting to a safe location is the most important thing you can do right away. This protects you and creates space to think clearly."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Opening your relapse prevention plan is a good idea for later steps. However, your immediate concern is your safety in that very moment."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Attending a meeting offers crucial support, but it's not always possible to get there instantly. Prioritize your immediate safety and then seek support."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What If I Slip?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your immediate safety and honest communication are your most powerful tools after a slip.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Save your slip-response steps.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Slip Response"
  },
  {
    "id": "when-recovery-gets-hard-how-do-i-start-again",
    "moduleId": "when-recovery-gets-hard",
    "title": "How Do I Start Again?",
    "minutes": 7,
    "order": 6,
    "problem": "How do I come back?",
    "checkIn": "Right now, how much is \"How do I come back\" a struggle for you?",
    "learnTitle": "Getting Back on Track",
    "learnBody": "When you need to start over, focus on the basics. This means making sure you get enough sleep, eat regular meals, and attend a meeting. Reaching out to your support network is also a key first step. Making the choice to start again isn't a punishment, it's a decision to protect your recovery. Taking action quickly helps you keep everything you've built.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you realize you need to start fresh. The feeling catches you off guard. What do you do first?",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor is a solid first step. They can offer immediate support and guidance during a tough moment."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Leaving to go somewhere safe gives you space and time to think. This helps you figure out your next moves."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Opening your relapse prevention plan puts your tools right in front of you. It reminds you of the strategies you've already prepared."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Getting to a meeting today connects you with your recovery community. That support can be exactly what you need to restart."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Start Again?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Starting over is a decision you make to protect your recovery.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Do one basics thing today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Restart Plan"
  },
  {
    "id": "when-recovery-gets-hard-when-should-i-ask-for-help",
    "moduleId": "when-recovery-gets-hard",
    "title": "When Should I Ask for Help?",
    "minutes": 5,
    "order": 7,
    "problem": "How do I know it's time?",
    "checkIn": "Right now, how much is \"How do I know it's time\" a struggle for you?",
    "learnTitle": "When to Ask for Support",
    "learnBody": "Often, you need help sooner than you think. If you're even wondering if it's time to ask, that's your sign. Reaching out early is a powerful step in your recovery. Don't wait until things feel overwhelming to connect with someone.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today, and you find yourself struggling. You feel that familiar pull, and it catches you by surprise. What's your first move?",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor right away is a direct way to get support. They can help you talk through what's happening in the moment."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Leaving the situation and finding a safe place gives you space to think. This can break the cycle of craving and help you decide your next step."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Opening your relapse prevention plan reminds you of strategies you already committed to. It helps you remember what has worked for you before."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Getting to a meeting provides a community of support. You'll be among people who understand and can offer encouragement when you need it."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"When Should I Ask for Help?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "If you're asking if you need help, the answer is always yes.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Reach out before you 'need' to.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Early-Ask Rule"
  },
  {
    "id": "when-recovery-gets-hard-which-recovery-tools-work-best-for-me",
    "moduleId": "when-recovery-gets-hard",
    "title": "Which Recovery Tools Work Best for Me?",
    "minutes": 6,
    "order": 8,
    "problem": "What actually works for me?",
    "checkIn": "Right now, how much is \"What actually works for me\" a struggle for you?",
    "learnTitle": "Find Your Best Recovery Tools",
    "learnBody": "Not every recovery tool will work for everyone, or even for you all the time. Pay attention to what helps you stay on track and what doesn't. Your most effective tools should be easy to access when you need them most. What helps you today might change tomorrow, and that's completely normal.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are feeling stressed and overwhelmed, and old cravings start to surface. You know you need to use a recovery tool right now.",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor can be a powerful first step, especially if they are good at helping you think through your options. This connects you with support immediately."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Removing yourself from a tough situation is often smart. Getting to a safe place gives you space to think clearly about your next move."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Your relapse prevention plan holds your personalized strategies for moments like this. Opening it helps you remember what you've already decided works for you."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Attending a meeting offers support and connection, but it might not be fast enough when you need an immediate tool. Consider if this meets your urgent need."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Which Recovery Tools Work Best for Me?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Regularly check in with yourself to see if your recovery tools are still serving you effectively.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Pick your top 3 tools.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Top Tools"
  },
  {
    "id": "when-recovery-gets-hard-how-do-i-celebrate-small-wins",
    "moduleId": "when-recovery-gets-hard",
    "title": "How Do I Celebrate Small Wins?",
    "minutes": 7,
    "order": 9,
    "problem": "Why does celebrating matter?",
    "checkIn": "Right now, how much is \"Why does celebrating matter\" a struggle for you?",
    "learnTitle": "Reward Your Brain, Build Recovery",
    "learnBody": "Your brain learns by repeating actions that get rewarded. When you notice a small win, make it real by naming it out loud. Sharing it with someone who cares reinforces that positive step. This helps your brain understand that these actions are worth repeating, building stronger recovery habits.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you've just handled a tough situation in a new way. You feel a small sense of accomplishment, but it's easy to just move on. What do you do first?",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor is a good move for support, but it might not be the immediate way to mark your personal achievement right then."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Leaving to go somewhere safe is important if you feel threatened or at risk. This situation is about recognizing a positive step you've already taken."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "Your relapse prevention plan is a valuable tool for high-risk moments. This situation calls for celebrating a success, not preventing a relapse."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "Attending a meeting today is a great way to stay connected and get support. You can share your win there, but you can also acknowledge it right now."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Celebrate Small Wins?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Recognizing and acknowledging your small wins trains your brain to value your recovery efforts.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Celebrate one win today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Wins List"
  },
  {
    "id": "when-recovery-gets-hard-building-my-relapse-prevention-plan",
    "moduleId": "when-recovery-gets-hard",
    "title": "Building My Relapse Prevention Plan.",
    "minutes": 5,
    "order": 10,
    "problem": "What's my full plan?",
    "checkIn": "Right now, how much is \"What's my full plan\" a struggle for you?",
    "learnTitle": "Your Plan for Staying Strong",
    "learnBody": "Your relapse prevention plan covers several key areas. It lists your triggers and warning signs, then outlines the tools and people who support you. You also need clear emergency steps for tough moments. Share this plan with two trusted people and update it after every challenging week to keep it effective.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you feel a strong urge to use. You didn't expect it to hit so hard right now.",
      "choices": [
        {
          "label": "Call my sponsor immediately",
          "feedback": "Calling your sponsor is a solid step. They can offer immediate support and help you think clearly about your next move."
        },
        {
          "label": "Leave and go somewhere safe",
          "feedback": "Getting to a safe place is good for creating distance from the urge. However, you'll still need a plan for what to do once you're there."
        },
        {
          "label": "Open my relapse prevention plan",
          "feedback": "This is the most direct action you can take right now. Opening your plan reminds you of the specific steps you've already decided to follow."
        },
        {
          "label": "Get to a meeting today",
          "feedback": "While attending a meeting is a good long-term strategy, waiting for one might leave you struggling alone for too long in this immediate situation."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Building My Relapse Prevention Plan.\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your prevention plan is your personal guide when urges hit hard.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Share your plan with one person.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Relapse Prevention Plan"
  },
  {
    "id": "becoming-someone-new-what-am-i-good-at",
    "moduleId": "becoming-someone-new",
    "title": "What Am I Good At?",
    "minutes": 5,
    "order": 1,
    "problem": "What are my strengths?",
    "checkIn": "Right now, how much is \"What are my strengths\" a struggle for you?",
    "learnTitle": "Your Strengths Are Your Power",
    "learnBody": "You've already built skills for survival. Things like loyalty, hustle, and reading people are real strengths. You can use these same qualities to build a new life for yourself. These strengths prove you're capable of changing and growing. Recognize what you're already good at to see your potential.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're feeling down, wondering if you have what it takes to stay on track. This thought catches you off guard. What's the first thing you do?",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about what your future self would do can help you find a path forward. It gives you a chance to see your choices from a different perspective."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Doing one small, brave thing can show you what you're capable of right now. This action reminds you of your inner strength and builds confidence."
        },
        {
          "label": "Write it down",
          "feedback": "Writing it down helps you process the feeling and identify the specific strength you need. This practice can clarify your thoughts and make them less overwhelming."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Telling someone your goal holds you accountable and lets them support you. Sharing your intentions can make them feel more real and achievable."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Am I Good At?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your past survival skills are strengths you can use to build your future.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Name three strengths out loud.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Strengths List"
  },
  {
    "id": "becoming-someone-new-how-do-i-believe-in-myself-again",
    "moduleId": "becoming-someone-new",
    "title": "How Do I Believe in Myself Again?",
    "minutes": 6,
    "order": 2,
    "problem": "How do I rebuild confidence?",
    "checkIn": "Right now, how much is \"How do I rebuild confidence\" a struggle for you?",
    "learnTitle": "Build Confidence Through Action",
    "learnBody": "Belief in yourself doesn't come from just talking about it. You build confidence by gathering small bits of proof each day. Don't wait until you feel completely ready to start. Take action and watch the evidence of your capability grow.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're facing a moment where you doubt your ability to handle things. This feeling catches you by surprise.",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about your future self can offer perspective. This helps you step back and consider a different approach before acting."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Doing one small brave thing creates immediate evidence of your strength. This choice directly builds your confidence in the moment."
        },
        {
          "label": "Write it down",
          "feedback": "Writing it down helps you process what you're feeling. This can be a useful step, but it doesn't directly build confidence through action."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Sharing your goal with someone offers accountability and support. While valuable, this doesn't directly address the feeling of self-doubt with an action from you."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Believe in Myself Again?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Confidence grows from small actions you take, not from wishing you felt more confident.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Write one piece of proof.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Confidence Log"
  },
  {
    "id": "becoming-someone-new-what-gives-my-life-meaning",
    "moduleId": "becoming-someone-new",
    "title": "What Gives My Life Meaning?",
    "minutes": 7,
    "order": 3,
    "problem": "Why am I doing this?",
    "checkIn": "Right now, how much is \"Why am I doing this\" a struggle for you?",
    "learnTitle": "Meaning Protects Your Recovery",
    "learnBody": "Your recovery needs strong protection. A sense of meaning is one of the best defenses against relapse. You find meaning in things like people, a purpose, your faith, or helping others. This feeling grows stronger when you act on it. What gives your life meaning today can keep you moving forward.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you feel adrift, wondering why you're even trying. This moment catches you off guard.",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about your future self can help you connect to the reasons you started this journey. It reminds you of the person you're working to become."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Doing one small brave thing, like making a difficult call or leaving the house, can break the spell. Taking action, however small, often builds momentum."
        },
        {
          "label": "Write it down",
          "feedback": "Writing down your thoughts can help you sort through them when you feel lost. You might discover what's truly bothering you or what you value most."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Sharing your goal with someone you trust gives it more power and makes it real. Others can offer support and help you remember your reasons for recovery."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Gives My Life Meaning?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Finding meaning in your life helps protect your recovery.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Do one meaningful thing today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Meaning Statement"
  },
  {
    "id": "becoming-someone-new-what-kind-of-person-do-i-want-to-become",
    "moduleId": "becoming-someone-new",
    "title": "What Kind of Person Do I Want to Become?",
    "minutes": 5,
    "order": 4,
    "problem": "Who am I becoming?",
    "checkIn": "Right now, how much is \"Who am I becoming\" a struggle for you?",
    "learnTitle": "Act Like Your Future Self",
    "learnBody": "Think about the kind of person you want to become. Don't just list goals; describe who that person is and how they act. When you face a decision, ask yourself what that version of you would do right now. Changing your identity in this way makes it much easier for new habits to stick. Your actions today build the person you're becoming.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're in a tough spot and feel stuck. This is a chance to act like the person you want to be.",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about your future self's actions is a powerful way to guide your current choices. It connects your present moment to your bigger vision."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Doing one small brave thing can build momentum and confidence. It shows you're capable of stepping outside your comfort zone."
        },
        {
          "label": "Write it down",
          "feedback": "Writing it down helps you clarify your thoughts and commit to your intentions. This can make your decision feel more real and actionable."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Telling someone your goal creates accountability and support. While good for goals, it's less direct than acting like that person right now."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Kind of Person Do I Want to Become?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your actions today are shaping the person you will become.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Act like that person once today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Future Self"
  },
  {
    "id": "becoming-someone-new-how-can-gratitude-help-me",
    "moduleId": "becoming-someone-new",
    "title": "How Can Gratitude Help Me?",
    "minutes": 6,
    "order": 5,
    "problem": "Does gratitude actually work?",
    "checkIn": "Right now, how much is \"Does gratitude actually work\" a struggle for you?",
    "learnTitle": "Shift Your Focus With Gratitude",
    "learnBody": "Practicing gratitude shifts what your brain looks for. Instead of dwelling on what's missing, you'll start noticing good things around you. Pick three specific things you're grateful for each day, rather than just one general idea. Doing this at the same time daily helps build a strong new habit.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're having a tough day, and your usual negative thoughts start to circle. This is exactly when you planned to try using gratitude.",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about what your future self would do can help you make a better choice in the moment. It gives you a clear direction when you feel stuck."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Doing one small brave thing can break the cycle of negative thinking. This action, no matter how minor, can be a step towards shifting your mood."
        },
        {
          "label": "Write it down",
          "feedback": "Writing down your thoughts and feelings can provide a sense of control. You might notice patterns or find clarity in what you're experiencing."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Telling someone your goal can create accountability and support. Sharing your intention to practice gratitude might help you follow through."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Can Gratitude Help Me?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Gratitude changes your focus by training your brain to see what is good.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Write three gratitudes.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Gratitude Practice"
  },
  {
    "id": "becoming-someone-new-how-do-i-find-peace",
    "moduleId": "becoming-someone-new",
    "title": "How Do I Find Peace?",
    "minutes": 7,
    "order": 6,
    "problem": "How do I quiet my mind?",
    "checkIn": "Right now, how much is \"How do I quiet my mind\" a struggle for you?",
    "learnTitle": "Practice Peace One Moment at a Time",
    "learnBody": "Finding peace isn't like finding a lost object. You practice it, you don't just stumble upon it. Even a small step toward stillness, like five minutes, makes a difference. It might feel strange or uncomfortable when you first try to quiet your mind. Stick with it; that feeling usually fades.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "Later today, you feel your mind racing, and you need to find some calm. What's the very first thing you do?",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Consider what the person you're becoming would do in this moment. That thought can help guide your actions."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Sometimes the best way to quiet your mind is to do something small but courageous. This choice helps build your confidence."
        },
        {
          "label": "Write it down",
          "feedback": "Writing down what's on your mind can help you sort through your thoughts. It gives you a way to externalize the internal noise."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Sharing your goal with someone else creates accountability. It can also bring you support when you need to quiet your mind. "
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Do I Find Peace?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Peace is something you build through small, consistent actions, not something you discover fully formed.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Sit quietly for five minutes.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Peace Practice"
  },
  {
    "id": "becoming-someone-new-what-does-spiritual-recovery-mean-to-me",
    "moduleId": "becoming-someone-new",
    "title": "What Does Spiritual Recovery Mean to Me?",
    "minutes": 5,
    "order": 7,
    "problem": "Do I need to be religious?",
    "checkIn": "Right now, how much is \"Do I need to be religious\" a struggle for you?",
    "learnTitle": "Spiritual Recovery: It's Your Call",
    "learnBody": "Spiritual recovery doesn't require you to be religious. Many people find meaning in nature, through service to others, or even by connecting with music. It’s about feeling a bond with something larger than yourself. You define what this connection looks like for you. There is no single right way to find it.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you feel a moment of doubt about what spiritual recovery means for you. This question catches you off guard.",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about your future self can offer perspective and help guide your actions. This choice helps you act with intention."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Doing one small brave thing can build momentum and confidence in facing uncertainty. It shows you're capable of moving forward."
        },
        {
          "label": "Write it down",
          "feedback": "Writing down your thoughts helps you process what you're feeling and gain clarity. This is a good way to understand your own definition."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Sharing your goal with someone creates accountability and support for your journey. It also helps others understand your path."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Does Spiritual Recovery Mean to Me?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your spiritual recovery is deeply personal and you get to decide what it means.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Do one spiritual practice.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Spiritual Plan"
  },
  {
    "id": "becoming-someone-new-how-can-i-help-other-people",
    "moduleId": "becoming-someone-new",
    "title": "How Can I Help Other People?",
    "minutes": 6,
    "order": 8,
    "problem": "What do I have to give?",
    "checkIn": "Right now, how much is \"What do I have to give\" a struggle for you?",
    "learnTitle": "You Can Help Others",
    "learnBody": "Giving back can feel difficult, especially when you're working on your own recovery. But your experiences hold value, and sharing them strengthens your path forward. You don't have to do much to make a difference. Start with simple acts like offering a ride, providing a seat, or just listening to someone. These small gestures show you have something important to give.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You are out and about, and someone you know looks like they could use some help. You recognize the opportunity to offer support.",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Asking what your future self would do can help you think through how you want to show up in the world. It gives you a moment to decide your next move."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Choosing to do one small brave thing puts you into action immediately. You don't have to wait to make a positive impact on someone's day."
        },
        {
          "label": "Write it down",
          "feedback": "Writing it down lets you process the moment later, but it doesn't help the person in front of you right now. The opportunity to assist might pass you by."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Telling someone your goal helps you stay accountable, but it doesn't directly address the situation at hand. You want to offer help when the chance arises."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"How Can I Help Other People?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your past experiences give you a unique ability to help others on their own journey.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Help one person today.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Service Plan"
  },
  {
    "id": "becoming-someone-new-what-future-am-i-building",
    "moduleId": "becoming-someone-new",
    "title": "What Future Am I Building?",
    "minutes": 7,
    "order": 9,
    "problem": "Where is this going?",
    "checkIn": "Right now, how much is \"Where is this going\" a struggle for you?",
    "learnTitle": "Map Your Future Now",
    "learnBody": "Think about what your life could look like one year from now, then five years out. Write down a clear picture for each timeframe. Now, identify one immediate step you can take for each of those visions. When things get tough, look at what you wrote to keep your path clear.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're hit with a feeling of uncertainty about your future, and it throws you off your game. What's the very first thing you do?",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about your future self is a good way to gain perspective. This choice helps you align your current actions with your long-term goals."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Taking a small, brave step can help you regain momentum and move forward. Even a tiny action shows you're committed to building your future."
        },
        {
          "label": "Write it down",
          "feedback": "Writing things down helps organize your thoughts and makes your plans more concrete. This can be a powerful way to clarify your next move."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Sharing your goals with someone can provide accountability and support. While good, this might not be the absolute first thing you do when caught off guard."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"What Future Am I Building?\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your future isn't just a dream; it's something you build with today's actions.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Write your one-year picture.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Future Plan"
  },
  {
    "id": "becoming-someone-new-creating-my-vision-for-life",
    "moduleId": "becoming-someone-new",
    "title": "Creating My Vision for Life.",
    "minutes": 5,
    "order": 10,
    "problem": "What's my vision?",
    "checkIn": "Right now, how much is \"What's my vision\" a struggle for you?",
    "learnTitle": "Build Your Vision Today",
    "learnBody": "Your vision for life isn't just a dream. It's a combination of your core values, a clear picture of what you want, and the steps to get there. Keep your vision brief enough to easily recall when you need it. Share it with someone who genuinely supports you. This helps make it real and keeps you accountable.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You're thinking about your future and the idea of creating a vision for your life comes up. It feels a little overwhelming. What's your first move?",
      "choices": [
        {
          "label": "Ask what my future self would do",
          "feedback": "Thinking about what your future self would do can provide immediate direction. It connects you to your long-term goals and helps guide your current actions."
        },
        {
          "label": "Do one small brave thing",
          "feedback": "Doing one small brave thing is a powerful start. It builds momentum and shows you that you can take action toward your vision, even if it feels small."
        },
        {
          "label": "Write it down",
          "feedback": "Writing down your thoughts helps clarify what you want. This makes your vision more concrete and easier to understand for yourself."
        },
        {
          "label": "Tell someone my goal",
          "feedback": "Telling someone your goal can create accountability. Sharing your intentions makes them more real and can provide you with needed support."
        }
      ]
    },
    "adelReflection": "Adel can help you go deeper on \"Creating My Vision for Life.\" — or just listen. Nothing you say here gets you in trouble.",
    "adelQuestion": "What part of this feels hardest for you?",
    "insight": "Your vision is a guide built from your values, your future picture, and the steps you'll take.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Read your vision out loud.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Life Vision Card"
  },
  {
    "id": "living-recovery-how-do-i-stay-in-recovery",
    "moduleId": "living-recovery",
    "title": "How Do I Stay in Recovery?",
    "minutes": 5,
    "order": 1,
    "problem": "How do I keep this going long-term?",
    "checkIn": "",
    "learnTitle": "Recovery Lasts a Lifetime",
    "learnBody": "Recovery is something you actively maintain each day, not a goal you simply finish. You need to stay connected and avoid letting your guard down, because complacency is a quiet risk. Anchor yourself with three key areas: the people in your life, your daily routines, and a clear sense of purpose. These anchors give you stability and direction over time.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You find yourself questioning how you'll keep up your recovery in the long term. This thought comes out of nowhere and feels heavy.",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Going back to basics is always a strong move. It helps you ground yourself and remember the fundamental steps that got you here."
        },
        {
          "label": "Call my people",
          "feedback": "Reaching out to your support system is vital. Your people can offer encouragement and help you regain perspective when you feel uncertain."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your recovery plan reminds you of the strategies you've committed to. This can help you address specific challenges you might be facing right now."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Attending a meeting connects you with others who understand your journey. Their shared experiences and support can be a powerful antidote to doubt."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "True recovery isn't a destination; it's a daily commitment you actively maintain.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Check your three anchors.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Maintenance Plan"
  },
  {
    "id": "living-recovery-why-should-i-keep-going-to-meetings",
    "moduleId": "living-recovery",
    "title": "Why Should I Keep Going to Meetings?",
    "minutes": 6,
    "order": 2,
    "problem": "Do I still need meetings?",
    "checkIn": "",
    "learnTitle": "Meetings Keep You Strong and Connected",
    "learnBody": "Regular meetings are essential for your ongoing recovery. They help you stay honest with yourself and connected to a supportive community. You become a role model, someone newer members can look to for guidance. Attending just one meeting a week provides substantial protection for your sobriety.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and you find yourself questioning if you still need to go to meetings. This thought catches you by surprise.",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Returning to your foundations reminds you of the core reasons you started recovery and the role meetings play in it. This can help re-anchor your commitment."
        },
        {
          "label": "Call my people",
          "feedback": "Reaching out to your support network can provide encouragement and a fresh perspective when you're feeling uncertain. Others in recovery often share similar experiences."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your personalized recovery plan helps you remember the strategies and tools you've committed to using. You'll see meetings are a vital part of that plan."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Making the effort to attend a meeting, even when you doubt its necessity, often dispels those doubts once you're there. Just showing up is a win."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Meetings are a foundation for staying connected and honest in your recovery.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Go to one meeting this week.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Meeting Commitment"
  },
  {
    "id": "living-recovery-how-does-sponsorship-change-recovery",
    "moduleId": "living-recovery",
    "title": "How Does Sponsorship Change Recovery?",
    "minutes": 7,
    "order": 3,
    "problem": "What changes with a sponsor?",
    "checkIn": "",
    "learnTitle": "Sponsorship Changes Your Recovery",
    "learnBody": "Working with a sponsor adds structure and honesty to your recovery journey. They share their experience to help you navigate challenges and stay on track. When you sponsor others, you deepen your own commitment and understanding of recovery principles. This two-way street strengthens everyone involved, building a stronger foundation for lasting change.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You feel overwhelmed by a tough situation, and the thought of sponsorship comes to mind. This is your chance to put what you've learned into practice.",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Returning to your core recovery principles can provide a steady foundation in unexpected moments. It helps ground you before taking further action."
        },
        {
          "label": "Call my people",
          "feedback": "Reaching out to trusted friends or your sponsor for support is often the most effective first step. They can offer perspective and help you decide what to do next."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your personalized recovery plan can remind you of the specific tools and strategies you have. This may give you direction and confidence."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Attending a meeting connects you with a supportive community and shared experiences. While helpful, it might not be the most immediate solution in every situation."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Sponsorship offers structure, truth, and a deeper commitment to your own recovery by helping others.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Talk to your sponsor this week.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Sponsorship Plan"
  },
  {
    "id": "living-recovery-how-can-helping-others-help-me",
    "moduleId": "living-recovery",
    "title": "How Can Helping Others Help Me?",
    "minutes": 5,
    "order": 4,
    "problem": "Why does service work?",
    "checkIn": "",
    "learnTitle": "Help Others, Help Yourself",
    "learnBody": "When you help others, you step outside your own thoughts. This act quickly rebuilds your self-respect. You maintain that good feeling by continuing to give back. It's a cycle that strengthens your recovery every time.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today, and you're feeling down, caught off guard by a wave of negative thoughts. You remember this lesson about helping others. What do you do first?",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Thinking about the core idea of service can ground you. It helps you remember why helping others matters for your own well-being."
        },
        {
          "label": "Call my people",
          "feedback": "Reaching out to your support network can give you the push you need. They might even know someone you could assist, turning your focus outward."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your personalized recovery plan ensures you stay on track. This lets you see if there's a planned service activity you can do right now."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Attending a meeting connects you with others who understand your journey. You'll likely find opportunities to offer support or share your experience there."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Helping someone else can be the most direct way to get out of your own head and feel better about yourself.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Do one act of service.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Service Commitment"
  },
  {
    "id": "living-recovery-how-do-i-give-back",
    "moduleId": "living-recovery",
    "title": "How Do I Give Back?",
    "minutes": 6,
    "order": 5,
    "problem": "What can I offer my community?",
    "checkIn": "",
    "learnTitle": "Give Back, Build Your Recovery",
    "learnBody": "You might wonder what you have to offer. Giving back doesn't always mean big gestures or lots of time. Share your story when it feels right and you know it's welcome. You can also offer practical help like driving, cooking, or setting up for events. Give only what you can consistently sustain without burning out.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You find yourself with some free time later today. The thought crosses your mind: 'How can I give back to my community?' It feels like a moment to act, but you're not sure where to start.",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Going back to basics is a solid first step. It helps you remember what's truly important for your personal well-being before you commit to helping others."
        },
        {
          "label": "Call my people",
          "feedback": "Connecting with your support network can provide encouragement and ideas. They might also suggest opportunities where your contributions would be especially valued."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your plan helps you align giving back with your recovery goals. This way, you make sure your efforts are sustainable and meaningful for you."
        },
        {
          "label": "Get to a meeting",
          "feedback": "While a meeting offers support, it might not directly address how you can give back right now. Consider if this action truly moves you forward on that specific question."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Start with small, sustainable acts of kindness that you can consistently offer.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Volunteer for one thing.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Give-Back Plan"
  },
  {
    "id": "living-recovery-how-do-i-protect-everything-i-ve-built",
    "moduleId": "living-recovery",
    "title": "How Do I Protect Everything I've Built?",
    "minutes": 7,
    "order": 6,
    "problem": "How do I not lose this?",
    "checkIn": "",
    "learnTitle": "Keep Your Recovery Secure",
    "learnBody": "You've worked hard to build your recovery. Now you need to protect it. That means guarding your sleep, choosing your companions wisely, and sticking to a healthy schedule. Say no to anything that puts your progress at risk. Take time each month to look over your plan and make sure it still works for you.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You find yourself questioning how to keep everything you've built. This feeling catches you off guard.",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Going back to basics is a solid first step. It helps you ground yourself and remember the fundamentals of your recovery."
        },
        {
          "label": "Call my people",
          "feedback": "Connecting with your support network is always a good idea. They can offer perspective and help you think through your next move."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your plan is a smart, proactive choice. It reminds you of the steps you've committed to taking and helps reinforce your strategy."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Attending a meeting can provide immediate support and a sense of community. It's a great way to feel less isolated and hear from others who understand."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Protect your recovery by actively guarding your sleep, your people, and your schedule, and by regularly reviewing your plan.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Say no to one risky thing.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Protection Plan"
  },
  {
    "id": "living-recovery-what-do-i-do-when-life-gets-hard-again",
    "moduleId": "living-recovery",
    "title": "What Do I Do When Life Gets Hard Again?",
    "minutes": 5,
    "order": 7,
    "problem": "What about the next crisis?",
    "checkIn": "",
    "learnTitle": "Prepare for Life's Challenges",
    "learnBody": "Hard times will come again, that's just how life works. Having a clear plan helps you navigate them without losing your way. You can use the same core strategies that helped you before. Reach out for support as soon as trouble starts. Don't wait until things get overwhelming.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "It's later today and something unexpected hits you hard. You feel that familiar tightness and worry creeping in. What do you do first?",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Going back to basics is a solid first step. This choice reminds you of the fundamental tools that have worked for you in the past."
        },
        {
          "label": "Call my people",
          "feedback": "Connecting with your support network quickly is wise. Your people can offer encouragement and practical help when you need it most."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your plan ensures you're following the steps you already laid out for moments like these. It's a proactive way to stay on track."
        },
        {
          "label": "Get to a meeting",
          "feedback": "While meetings are crucial for recovery, they might not be the immediate first action when a crisis hits. Your personal plan or support system might offer more immediate guidance."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Anticipate that hard times will return and have a plan ready to put into action.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Write your crisis basics.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Hard-Times Plan"
  },
  {
    "id": "living-recovery-how-should-i-celebrate-my-progress",
    "moduleId": "living-recovery",
    "title": "How Should I Celebrate My Progress?",
    "minutes": 6,
    "order": 8,
    "problem": "How do I mark milestones?",
    "checkIn": "",
    "learnTitle": "Mark Your Milestones",
    "learnBody": "Marking your milestones helps you see your progress. Each step forward, like 30, 60, or 90 days sober, shows how far you've come. These markers are important reminders of your hard work. You should celebrate your achievements, but always do it sober and with your support network. Recognizing these moments strengthens your commitment to recovery.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You just hit a new milestone in your recovery, and you want to acknowledge it. What's the first thing you do?",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Returning to your basic recovery tools can ground you. It reminds you of the foundation that got you to this point."
        },
        {
          "label": "Call my people",
          "feedback": "Reaching out to your support system helps you share your success. They can celebrate with you and reinforce your progress."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your recovery plan helps you see your journey. You can adjust it for the next phase of your progress."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Attending a meeting connects you with others who understand. It's a good way to share your milestone and hear from peers."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Acknowledge every step you take in your recovery, and celebrate it sober with your support network.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Plan your next milestone.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Milestone Plan"
  },
  {
    "id": "living-recovery-how-far-have-i-come",
    "moduleId": "living-recovery",
    "title": "How Far Have I Come?",
    "minutes": 7,
    "order": 9,
    "problem": "What have I actually done?",
    "checkIn": "",
    "learnTitle": "See How Far You've Come",
    "learnBody": "Take a moment to reflect on your journey. Think about where you started and everything you have accomplished since then. Notice the new tools you've learned, the days you've stayed committed, and the stronger connections you've built. Recognizing your real progress helps you keep moving forward.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "Later today, you feel like you haven't made much progress in your recovery. This thought catches you by surprise. What do you do first?",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Going back to basics can steady you, but it might not directly address your feeling of not having made progress. You could use this time to recall past successes."
        },
        {
          "label": "Call my people",
          "feedback": "Connecting with your support network is always a good move. They can remind you of your strength and how much you've changed."
        },
        {
          "label": "Review my plan",
          "feedback": "Reviewing your recovery plan helps you see the steps you've taken and the goals you've achieved. This offers concrete proof of your efforts."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Attending a meeting connects you with others, but it doesn't directly help you see your personal past progress in the moment."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Your past successes are real proof of your strength and dedication.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Read your first lesson notes.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Progress Review"
  },
  {
    "id": "living-recovery-my-lifelong-recovery-plan",
    "moduleId": "living-recovery",
    "title": "My Lifelong Recovery Plan.",
    "minutes": 5,
    "order": 10,
    "problem": "What's my forever plan?",
    "checkIn": "",
    "learnTitle": "Build Your Lasting Recovery Plan",
    "learnBody": "A lifelong recovery plan helps you stay on track. It includes your support people, your daily routines, and your warning signs. You also write down your purpose for living sober. Make sure you update this plan regularly, about every three months, and share a copy with someone you trust.",
    "activity": {
      "kind": "decision",
      "title": "Practice in real life",
      "prompt": "You wake up feeling restless and unfocused, a feeling you recognize as a potential trigger. Your mind races with old thoughts.",
      "choices": [
        {
          "label": "Go back to the basics",
          "feedback": "Going back to basics is always a good idea. This choice sets you up to use the tools you've already learned for recovery."
        },
        {
          "label": "Call my people",
          "feedback": "Reaching out to your support system is smart. Your people can offer encouragement and help you think through next steps."
        },
        {
          "label": "Review my plan",
          "feedback": "Looking at your plan reminds you of the steps you've committed to taking. This helps you recenter and choose your next action wisely."
        },
        {
          "label": "Get to a meeting",
          "feedback": "Attending a meeting connects you with others who understand your struggles. This can provide immediate support and a sense of belonging."
        }
      ]
    },
    "adelReflection": "",
    "adelQuestion": "",
    "insight": "Your lifelong recovery plan is a living document that guides you through challenges and celebrates your progress.",
    "toolFlow": {
      "warningSigns": [
        "Restless",
        "Angry",
        "Isolating",
        "Skipping meals",
        "Not sleeping",
        "Avoiding calls"
      ],
      "supportPeople": [
        "Sponsor",
        "Peer specialist",
        "Community health worker",
        "Therapist",
        "Family"
      ],
      "todayActions": [
        "Finish your lifelong plan.",
        "Attend a meeting",
        "Call someone who supports me",
        "Practice my recovery skill",
        "Complete one important task"
      ]
    },
    "toolkitLabel": "My Lifelong Recovery Plan"
  }
];
