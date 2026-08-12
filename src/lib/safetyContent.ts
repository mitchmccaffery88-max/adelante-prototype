// §Patient portal Tier 1 Build A — overdose-prevention / naloxone safety content.
//
// SOURCE DISCIPLINE: every string below is transcribed from the real source
// content file (itself transcribed from SAMHSA, CDC and California DHCS
// materials). It is NOT generated or paraphrased here, and it is NOT reviewed
// clinical guidance for this deployment. Same rule as the Safety Plan
// (src/lib/safetyPlan.ts): the review flag is real state read by the UI and by
// the admin content-review panel — do not clear it in code without sign-off,
// and do not flip any `verified` field without a real verification pass.

// TWO SEPARATE REVIEW TRACKS. Confirming that an organisation's phone number
// and program still exist is a contact-verification task; approving how to
// respond to an overdose is clinical sign-off. They are not the same event and
// must not clear each other.
//
// 1. SAFETY_CONTENT_REVIEW — CLINICAL track. Covers the administration steps
//    and the tolerance warning only. Still pending Christi / Dr. Bagga.
// 2. NALOXONE_ACCESS_REVIEW — CONTACT-VERIFICATION track. Cathy called each
//    access point and confirmed it. Done.
export const SAFETY_CONTENT_REVIEW = {
  pending: true,
  reviewers: "Christi / Dr. Bagga",
  scope:
    "Overdose administration steps and the tolerance warning — transcribed from SAMHSA / CDC / California DHCS materials, not yet clinically approved for this deployment. Access-point contact details are tracked separately and are not covered by this flag.",
  notice:
    "Pending clinical review by Christi / Dr. Bagga. Transcribed public-health guidance — not yet approved as clinical instruction for this deployment.",
} as const;

/** The contact-verification track — a real human pass, not clinical sign-off. */
export const NALOXONE_ACCESS_REVIEW = {
  pending: false,
  verifiedBy: "Cathy",
  verifiedByStaffId: "s-cc2",
  verifiedOn: "2026-08-12",
  scope:
    "Naloxone access points and the Never Use Alone line — phone numbers, program details and availability confirmed directly with each organisation.",
  notice:
    "Access points confirmed by Cathy — phone numbers and program details were verified directly with each organisation. This does not cover the overdose-response steps below, which remain in clinical review.",
} as const;

export interface NaloxoneAccessPoint {
  id: string;
  name: string;
  what: string;
  city?: string;
  phone?: string;
  website?: string;
  source?: string;
  /** Only true after a real verification pass. */
  verified: boolean;
  verifiedBy?: string;
  verifiedOn?: string;
}

const CATHY = { verified: true, verifiedBy: "Cathy", verifiedOn: "2026-08-12" } as const;

export const NALOXONE_ACCESS_POINTS: readonly NaloxoneAccessPoint[] = [
  {
    id: "tchhsa",
    name: "Tulare County Health & Human Services Agency",
    what: "Ask for the naloxone (Narcan) distribution program.",
    city: "Visalia, CA",
    phone: "(559) 624-8000",
    website: "tchhsa.org",
    ...CATHY,
  },
  {
    id: "fhcn",
    name: "Family HealthCare Network",
    what:
      "Community health centers across Visalia, Tulare, Porterville and Dinuba. Ask any clinic staff member — no appointment needed.",
    phone: "(877) 960-3426",
    website: "fhcn.org",
    ...CATHY,
  },
  {
    id: "ca-ndp",
    name: "California Naloxone Distribution Project (DHCS)",
    what:
      "State program supplying free naloxone to eligible organizations, including reentry, county and community programs. Your case manager or peer specialist can request it.",
    website: "dhcs.ca.gov — naloxone distribution project page",
    ...CATHY,
  },
  {
    id: "ca-pharmacy",
    name: "Any California pharmacy",
    what:
      "No prescription needed. Pharmacists can furnish naloxone without a prescription, and over-the-counter nasal naloxone is also sold directly.",
    source: 'CDC, "Reversing an Overdose"',
    ...CATHY,
  },
  {
    id: "next-distro",
    name: "NEXT Distro",
    what: "Mails free naloxone nationwide in plain packaging.",
    website: "nextdistro.org",
    ...CATHY,
  },
];

export interface NaloxoneStep {
  step: number;
  title: string;
  body: string;
}

export const NALOXONE_STEPS_SOURCE =
  'SAMHSA Opioid Overdose Prevention Toolkit; CDC, "Reversing an Overdose"';

export const NALOXONE_STEPS: readonly NaloxoneStep[] = [
  {
    step: 1,
    title: "Check if they respond",
    body:
      "Shout their name and rub your knuckles hard on the center of their chest. Signs of overdose: won't wake up, slow or stopped breathing, blue or gray lips or fingertips, snoring or gurgling sound.",
  },
  {
    step: 2,
    title: "Call 911",
    body:
      'Say "someone is not breathing." You do not need to mention drugs. California\'s 911 Good Samaritan law protects callers from simple-possession charges.',
  },
  {
    step: 3,
    title: "Give naloxone",
    body:
      "Nasal spray: tilt their head back, put the nozzle fully into one nostril, and press the plunger firmly — one device, one spray.",
  },
  {
    step: 4,
    title: "Help them breathe",
    body:
      "Give rescue breaths (head tilted, chin lifted, one breath every 5 seconds) or chest compressions.",
  },
  {
    step: 5,
    title: "Give a second dose if nothing changes",
    body:
      "After 2–3 minutes with no change, give another dose in the other nostril. Repeat every 2–3 minutes until they respond or help arrives.",
  },
  {
    step: 6,
    title: "Stay with them",
    body:
      "Naloxone wears off in 30–90 minutes and the overdose can come back. Roll them onto their side and don't leave until paramedics arrive.",
  },
];

/** National line only — no local Tulare County line has been confirmed. */
export const NEVER_USE_ALONE = {
  name: "Never Use Alone",
  phone: "1-800-484-3731",
  hours: "24/7",
  what:
    "National confidential line. Call before you use, tell them your location, and stay on the line. If you stop responding, they send help.",
  localLineConfirmed: false,
  verified: true,
  verifiedBy: "Cathy",
  verifiedOn: "2026-08-12",
} as const;

/** Verbatim — do not rewrite. */
export const TOLERANCE_WARNING =
  "If you've been locked up, in treatment, or off for even a few days, your tolerance has dropped. The amount that used to be normal for you can stop your breathing now. The first two weeks after release are the highest-risk stretch there is. If you're going to use, use less than you think you need, don't mix with alcohol or pills, and don't use alone.";
