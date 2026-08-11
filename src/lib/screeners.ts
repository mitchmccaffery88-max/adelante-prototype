export interface ScreenerDef {
  key: string;
  name: string;
  description: string;
  isSud?: boolean;
  questions: string[];
  options: { label: string; value: number }[];
  bands: { max: number; label: string }[];
  /**
   * §Pre-release build 2 — the standard clinical cutoff at or above which the
   * instrument counts as a POSITIVE screen. Optional because not every
   * instrument has one (PCL-5 short form here does not). Adding it to the
   * base def — rather than to a parallel type — is what makes
   * positive-screen-rate reporting possible across every instrument at once.
   */
  positiveCutoff?: number;
  /**
   * Per-item option override, by question index. The shared `options` list
   * stays the default; instruments whose items genuinely use different
   * anchors (AHC-HRSN) declare only the ones that differ. Every existing
   * consumer that reads `options` keeps working unchanged.
   */
  itemOptions?: Record<number, { label: string; value: number }[]>;
}

/** The option list to render/score for a given item of any instrument. */
export function optionsForItem(def: ScreenerDef, index: number) {
  return def.itemOptions?.[index] ?? def.options;
}

const standard4 = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export const SCREENERS: ScreenerDef[] = [
  {
    key: "phq-9",
    name: "PHQ-9",
    description: "Depression — past 2 weeks",
    positiveCutoff: 10,
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you are a failure",
      "Trouble concentrating on things",
      "Moving or speaking so slowly that others noticed — or being restless",
      "Thoughts that you would be better off dead, or of hurting yourself",
    ],
    options: standard4,
    bands: [
      { max: 4, label: "Minimal" },
      { max: 9, label: "Mild" },
      { max: 14, label: "Moderate" },
      { max: 19, label: "Moderately Severe" },
      { max: 27, label: "Severe" },
    ],
  },
  {
    key: "gad-7",
    name: "GAD-7",
    description: "Anxiety — past 2 weeks",
    positiveCutoff: 10,
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless it's hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid as if something awful might happen",
    ],
    options: standard4,
    bands: [
      { max: 4, label: "Minimal" },
      { max: 9, label: "Mild" },
      { max: 14, label: "Moderate" },
      { max: 21, label: "Severe" },
    ],
  },
  {
    key: "audit",
    name: "AUDIT-10",
    description:
      "Alcohol use — past year. One drink = one beer, one glass of wine, or one shot. Protected by 42 CFR Part 2.",
    isSud: true,
    // Standard AUDIT cutoff for hazardous / harmful drinking.
    positiveCutoff: 8,
    questions: [
      "How often do you have a drink containing alcohol?",
      "How many drinks containing alcohol do you have on a typical day when you are drinking?",
      "How often do you have six or more drinks on one occasion?",
      "How often during the last year have you found that you were not able to stop drinking once you had started?",
      "How often during the last year have you failed to do what was normally expected of you because of drinking?",
      "How often during the last year have you needed a first drink in the morning to get yourself going after a heavy drinking session?",
      "How often during the last year have you had a feeling of guilt or remorse after drinking?",
      "How often during the last year have you been unable to remember what happened the night before because you had been drinking?",
      "Have you or someone else been injured because of your drinking?",
      "Has a relative, friend, doctor, or other health worker been concerned about your drinking or suggested you cut down?",
    ],
    // Per-item anchors vary in the validated AUDIT; for plain-language scoring
    // we use the standard 0–4 mapping. Items 9 and 10 are 0/2/4 in the original
    // instrument — we keep the 0–4 scale so the trend/severity bands hold.
    options: [
      { label: "Never", value: 0 },
      { label: "Less than monthly", value: 1 },
      { label: "Monthly", value: 2 },
      { label: "Weekly", value: 3 },
      { label: "Daily or almost daily", value: 4 },
    ],
    bands: [
      { max: 7, label: "Low risk" },
      { max: 15, label: "Risky / hazardous" },
      { max: 19, label: "High risk / harmful" },
      { max: 40, label: "Likely dependence" },
    ],
  },
  {
    key: "dast-10",
    name: "DAST-10",
    description: "Drug use — protected by 42 CFR Part 2",
    isSud: true,
    // Standard DAST-10 cutoff: 3+ indicates a probable drug problem.
    positiveCutoff: 3,
    questions: [
      "Used drugs other than those required for medical reasons",
      "Abused prescription drugs",
      "Used more than one drug at a time",
      "Tried to stop using drugs but couldn't",
      "Felt bad or guilty about your drug use",
      "Family/partner complained about your drug use",
      "Neglected your family because of your drug use",
      "Engaged in illegal activities to obtain drugs",
      "Experienced withdrawal symptoms when stopping",
      "Had medical problems due to drug use",
    ],
    options: [
      { label: "No", value: 0 },
      { label: "Yes", value: 1 },
    ],
    bands: [
      { max: 0, label: "No problems" },
      { max: 2, label: "Low" },
      { max: 5, label: "Moderate" },
      { max: 8, label: "Substantial" },
      { max: 10, label: "Severe" },
    ],
  },
  {
    key: "pcl-5",
    name: "PCL-5 (short)",
    description: "PTSD symptoms — past month",
    questions: [
      "Repeated, disturbing memories of the stressful experience",
      "Repeated, disturbing dreams of the stressful experience",
      "Suddenly feeling or acting as if it were happening again",
      "Feeling very upset when reminded of the experience",
      "Avoiding memories, thoughts, or feelings about it",
    ],
    options: [
      { label: "Not at all", value: 0 },
      { label: "A little bit", value: 1 },
      { label: "Moderately", value: 2 },
      { label: "Quite a bit", value: 3 },
      { label: "Extremely", value: 4 },
    ],
    bands: [
      { max: 5, label: "Minimal" },
      { max: 10, label: "Mild" },
      { max: 15, label: "Moderate" },
      { max: 20, label: "Severe" },
    ],
  },
];

export function severityFor(def: ScreenerDef, score: number) {
  for (const b of def.bands) if (score <= b.max) return b.label;
  return def.bands[def.bands.length - 1].label;
}

// ---------------------------------------------------------------------------
// §Adelante Journey Phase 7 part 2 — PHQ-2 / GAD-2 weekly quick check.
//
// These are NOT a parallel screening system. They are the validated SHORT
// FORMS of the PHQ-9 / GAD-7 already defined above, and they are stored,
// scored, trended and audited through the exact same `ScreenerResult` /
// `recordScreener` path (record class `screeners_mh`). The only thing that is
// new is the CADENCE (weekly, patient-facing) and the GATEWAY behaviour: at or
// above the standard cutoff of 3 the short form hands off to the full
// instrument rather than trying to grade severity itself.
// ---------------------------------------------------------------------------

export interface ShortFormScreenerDef extends ScreenerDef {
  /** Key of the full instrument this short form is a gateway into. */
  fullFormKey: string;
  /** Standard clinical cutoff for a positive short-form result. */
  positiveCutoff: number;
}

export const SHORT_FORM_SCREENERS: ShortFormScreenerDef[] = [
  {
    key: "phq-2",
    name: "PHQ-2",
    description: "Depression quick check — past 2 weeks",
    fullFormKey: "phq-9",
    positiveCutoff: 3,
    // Verbatim PHQ-2 items (= PHQ-9 items 1 and 2).
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
    ],
    options: standard4,
    bands: [
      { max: 2, label: "Negative" },
      { max: 6, label: "Positive — full PHQ-9 indicated" },
    ],
  },
  {
    key: "gad-2",
    name: "GAD-2",
    description: "Anxiety quick check — past 2 weeks",
    fullFormKey: "gad-7",
    positiveCutoff: 3,
    // Verbatim GAD-2 items (= GAD-7 items 1 and 2).
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
    ],
    options: standard4,
    bands: [
      { max: 2, label: "Negative" },
      { max: 6, label: "Positive — full GAD-7 indicated" },
    ],
  },
];

/** Weekly cadence for the patient-facing quick check. */
export const QUICK_CHECK_INTERVAL_DAYS = 7;

export function shortFormByKey(key: string): ShortFormScreenerDef | undefined {
  return SHORT_FORM_SCREENERS.find((s) => s.key === key);
}

/** True when a short-form total meets the standard escalation cutoff. */
export function isShortFormPositive(def: ShortFormScreenerDef, score: number): boolean {
  return score >= def.positiveCutoff;
}

// ---------------------------------------------------------------------------
// §Pre-release build 2 — real structured SDOH screening.
//
// INSTRUMENT CHOICE: the CMS **Accountable Health Communities Health-Related
// Social Needs (AHC-HRSN) core screening tool**, not PRAPARE. Both are real,
// validated and domain-structured, but this is explicitly a DHCS build, and
// DHCS's own CalAIM / PATH and Community Supports guidance is written against
// the AHC-HRSN core domains (housing instability, food insecurity,
// transportation, utility needs, interpersonal safety) — the same five this
// build was asked for. PRAPARE is a broader 21-item practice-level profile
// (race/ethnicity, incarceration history, migrant status, stress) whose extra
// items are already captured elsewhere in this record, and whose scoring is
// not domain-flag based. AHC-HRSN gives exactly the DHCS domains with real
// item text and real per-domain positive rules.
//
// ARCHITECTURALLY this is a SIBLING, not a one-off: `AHC_HRSN` is a
// `ScreenerDef` like AUDIT-10 and DAST-10, its result is stored through the
// same `recordScreener` / `ScreenerResult` / `screenerHistory` path, and its
// severity comes from the same `severityFor` band walk. The only addition is
// per-domain positivity, which the population-health rollup reads.
// ---------------------------------------------------------------------------

export interface ScreenerDomain {
  key: string;
  label: string;
  /** Indexes into `questions` that belong to this domain. */
  itemIndexes: number[];
  /** The domain screens positive when the sum of its items reaches this. */
  positiveMinSum: number;
}

export interface DomainScreenerDef extends ScreenerDef {
  isSdoh: true;
  domains: ScreenerDomain[];
}

const HITS_OPTIONS = [
  { label: "Never", value: 1 },
  { label: "Rarely", value: 2 },
  { label: "Sometimes", value: 3 },
  { label: "Fairly often", value: 4 },
  { label: "Frequently", value: 5 },
];

const FOOD_OPTIONS = [
  { label: "Never true", value: 0 },
  { label: "Sometimes true", value: 1 },
  { label: "Often true", value: 2 },
];

/** CMS AHC-HRSN core screening tool — verbatim item text. */
export const AHC_HRSN: DomainScreenerDef = {
  key: "ahc-hrsn",
  name: "AHC-HRSN core",
  description:
    "Health-related social needs — CMS Accountable Health Communities core screening tool (housing, food, transportation, utilities, safety).",
  isSdoh: true,
  questions: [
    "What is your living situation today?",
    "Think about the place you live. Do you have problems with any of the following? (bug infestation; mold; lead paint or pipes; inadequate heat; oven or stove not working; no or not working smoke detectors; water leaks)",
    "Within the past 12 months, you worried that your food would run out before you got money to buy more.",
    "Within the past 12 months, the food you bought just didn't last and you didn't have money to get more.",
    "In the past 12 months, has lack of reliable transportation kept you from medical appointments, meetings, work or from getting things needed for daily living?",
    "In the past 12 months has the electric, gas, oil, or water company threatened to shut off services in your home?",
    "How often does anyone, including family and friends, physically hurt you?",
    "How often does anyone, including family and friends, insult or talk down to you?",
    "How often does anyone, including family and friends, threaten you with harm?",
    "How often does anyone, including family and friends, scream or curse at you?",
  ],
  // Default anchors (yes/no items 5 and 6 fall through to this list).
  options: [
    { label: "No", value: 0 },
    { label: "Yes", value: 1 },
  ],
  itemOptions: {
    0: [
      { label: "I have a steady place to live", value: 0 },
      {
        label: "I have a place to live today, but I am worried about losing it in the future",
        value: 1,
      },
      {
        label:
          "I do not have a steady place to live (temporarily staying with others, in a hotel, in a shelter, living outside, in a car, abandoned building, bus or train station, or in a park)",
        value: 1,
      },
    ],
    1: [
      { label: "None of the above", value: 0 },
      { label: "One or more of the above", value: 1 },
    ],
    2: FOOD_OPTIONS,
    3: FOOD_OPTIONS,
    5: [
      { label: "No", value: 0 },
      { label: "Yes", value: 1 },
      { label: "Already shut off", value: 1 },
    ],
    6: HITS_OPTIONS,
    7: HITS_OPTIONS,
    8: HITS_OPTIONS,
    9: HITS_OPTIONS,
  },
  domains: [
    { key: "housing", label: "Housing instability & quality", itemIndexes: [0, 1], positiveMinSum: 1 },
    { key: "food", label: "Food insecurity", itemIndexes: [2, 3], positiveMinSum: 1 },
    { key: "transportation", label: "Transportation", itemIndexes: [4], positiveMinSum: 1 },
    { key: "utilities", label: "Utility needs", itemIndexes: [5], positiveMinSum: 1 },
    // HITS: 4 items scored 1–5; the validated positive threshold is > 10.
    { key: "safety", label: "Interpersonal safety", itemIndexes: [6, 7, 8, 9], positiveMinSum: 11 },
  ],
  // The instrument "score" is the COUNT of positive domains (0–5) — that is
  // the number DHCS reporting asks for, and it bands cleanly.
  positiveCutoff: 1,
  bands: [
    { max: 0, label: "No identified social needs" },
    { max: 1, label: "One identified need" },
    { max: 2, label: "Two identified needs" },
    { max: 5, label: "Multiple identified needs" },
  ],
};

export const DOMAIN_SCREENERS: DomainScreenerDef[] = [AHC_HRSN];

export function isDomainScreener(def: ScreenerDef): def is DomainScreenerDef {
  return (def as DomainScreenerDef).isSdoh === true;
}

/** Every instrument in one lookup — full, short-form and domain alike. */
export function screenerByKey(key: string): ScreenerDef | undefined {
  return (
    SCREENERS.find((s) => s.key === key) ??
    SHORT_FORM_SCREENERS.find((s) => s.key === key) ??
    DOMAIN_SCREENERS.find((s) => s.key === key)
  );
}

export interface ScreenerDomainResult {
  key: string;
  label: string;
  positive: boolean;
}

export function domainResults(
  def: DomainScreenerDef,
  answers: number[],
): ScreenerDomainResult[] {
  return def.domains.map((d) => {
    const sum = d.itemIndexes.reduce((a, i) => a + (Number(answers[i]) || 0), 0);
    return { key: d.key, label: d.label, positive: sum >= d.positiveMinSum };
  });
}

/**
 * PURE scoring for ANY instrument. Sum-of-items for ordinary screeners;
 * count-of-positive-domains for domain instruments. One function so
 * pre-release, intake and the quick check cannot drift apart.
 */
export function scoreScreener(
  def: ScreenerDef,
  answers: number[],
): { score: number; severity: string; positive?: boolean; domains?: ScreenerDomainResult[] } {
  if (isDomainScreener(def)) {
    const domains = domainResults(def, answers);
    const score = domains.filter((d) => d.positive).length;
    return { score, severity: severityFor(def, score), positive: score >= 1, domains };
  }
  const score = answers.reduce((a, b) => a + (Number(b) || 0), 0);
  const out: { score: number; severity: string; positive?: boolean } = {
    score,
    severity: severityFor(def, score),
  };
  if (def.positiveCutoff !== undefined) out.positive = score >= def.positiveCutoff;
  return out;
}
