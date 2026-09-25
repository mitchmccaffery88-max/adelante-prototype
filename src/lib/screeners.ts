/**
 * §Phase 10a — instrument provenance. Every definition says where its text
 * came from and whether that text has been checked word-for-word against the
 * published source. `textVerified: false` means "believed correct, source not
 * yet re-checked" — it is shown to staff as "Text pending source check".
 */
export interface InstrumentProvenance {
  /** Published source document the item text is copied from. */
  source: string;
  /** Instrument version as printed on the source (or our label for it). */
  version: string;
  /** Our scoring-rule version. Bump when scoring changes so old results are distinguishable. */
  scoringVersion: string;
  /** True only when the item text + options were checked against the source document. */
  textVerified: boolean;
  /** When `textVerified` was established (ISO date). */
  verifiedOn?: string;
}

export interface ScreenerDef extends Partial<InstrumentProvenance> {
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
   * instrument has one.
   */
  positiveCutoff?: number;
  /** §Phase 10a — the cutoff is a DRAFT value pending clinical sign-off. */
  cutoffDraft?: boolean;
  /**
   * Per-item option override, by question index. The shared `options` list
   * stays the default; instruments whose items genuinely use different
   * anchors (AUDIT, AHC-HRSN) declare only the ones that differ.
   */
  itemOptions?: Record<number, { label: string; value: number }[]>;
  /**
   * §Phase 10a — a gate item (PC-PTSD-5 trauma-exposure question). The gate
   * item is never scored; when it is answered with `stopWhenValue` the
   * instrument is complete with a score of 0 and the remaining items are not
   * asked.
   */
  gate?: { itemIndex: number; stopWhenValue: number };
  /** §Phase 10a — offered by default at intake. False = staff/triggered only. */
  atIntake?: boolean;
  /** §Phase 10a — retired, non-validated form. Kept only to label history. */
  retired?: boolean;
  /** Zero-based item indexes scored in reverse (yes/no: "No" scores 1). */
  reverseItems?: number[];
}

/** The option list to render/score for a given item of any instrument. */
export function optionsForItem(def: ScreenerDef, index: number) {
  return def.itemOptions?.[index] ?? def.options;
}

/** §Phase 10a — should this item be shown, given the answers so far? */
export function itemVisible(def: ScreenerDef, index: number, answers: (number | undefined)[]): boolean {
  if (!def.gate || index === def.gate.itemIndex) return true;
  const g = answers[def.gate.itemIndex];
  return g !== undefined && g !== def.gate.stopWhenValue;
}

/** §Phase 10a — are all REQUIRED items answered (honouring the gate)? */
export function screenerComplete(def: ScreenerDef, answers: (number | undefined)[]): boolean {
  return def.questions.every((_, i) => !itemVisible(def, i, answers) || typeof answers[i] === "number");
}

const standard4 = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

const yesNo = [
  { label: "No", value: 0 },
  { label: "Yes", value: 1 },
];

const PHQ_SOURCE =
  "PHQ-9, Pfizer PHQ Screeners (phqscreeners.com, PHQ-9_English.pdf). No permission required to reproduce.";
const GAD_SOURCE =
  "GAD-7, Pfizer PHQ Screeners (phqscreeners.com, GAD-7_English.pdf). No permission required to reproduce.";

export const SCREENERS: ScreenerDef[] = [
  {
    key: "phq-9",
    name: "PHQ-9",
    description: "Depression — over the last 2 weeks",
    positiveCutoff: 10,
    atIntake: true,
    source: PHQ_SOURCE,
    version: "PHQ-9 (Spitzer, Williams, Kroenke)",
    scoringVersion: "sum-v1",
    textVerified: true,
    verifiedOn: "2026-09-25",
    // Verbatim from the source PDF (item text checked 2026-09-25).
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
      "Trouble concentrating on things, such as reading the newspaper or watching television",
      "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
      "Thoughts that you would be better off dead or of hurting yourself in some way",
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
    description: "Anxiety — over the last 2 weeks",
    positiveCutoff: 10,
    atIntake: true,
    source: GAD_SOURCE,
    version: "GAD-7 (Spitzer, Williams, Kroenke, Löwe)",
    scoringVersion: "sum-v1",
    textVerified: true,
    verifiedOn: "2026-09-25",
    questions: [
      "Feeling nervous, anxious or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it is hard to sit still",
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
    atIntake: true,
    // Standard AUDIT cutoff for hazardous / harmful drinking.
    positiveCutoff: 8,
    source: "WHO, AUDIT: Guidelines for Use in Primary Care, 2nd ed. (2001), Box 4.",
    version: "AUDIT (WHO 2001)",
    // §Phase 10a — v2 = validated per-item anchors, items 9/10 scored 0/2/4.
    scoringVersion: "who-anchors-v2",
    // The WHO PDF could not be retrieved from this environment on 2026-09-25;
    // wording and anchors below are believed verbatim but NOT re-checked.
    textVerified: false,
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
    // Items 3–8 anchors.
    options: [
      { label: "Never", value: 0 },
      { label: "Less than monthly", value: 1 },
      { label: "Monthly", value: 2 },
      { label: "Weekly", value: 3 },
      { label: "Daily or almost daily", value: 4 },
    ],
    itemOptions: {
      0: [
        { label: "Never", value: 0 },
        { label: "Monthly or less", value: 1 },
        { label: "2 to 4 times a month", value: 2 },
        { label: "2 to 3 times a week", value: 3 },
        { label: "4 or more times a week", value: 4 },
      ],
      1: [
        { label: "1 or 2", value: 0 },
        { label: "3 or 4", value: 1 },
        { label: "5 or 6", value: 2 },
        { label: "7, 8, or 9", value: 3 },
        { label: "10 or more", value: 4 },
      ],
      8: [
        { label: "No", value: 0 },
        { label: "Yes, but not in the last year", value: 2 },
        { label: "Yes, during the last year", value: 4 },
      ],
      9: [
        { label: "No", value: 0 },
        { label: "Yes, but not in the last year", value: 2 },
        { label: "Yes, during the last year", value: 4 },
      ],
    },
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
    atIntake: true,
    // Standard DAST-10 cutoff: 3+ indicates a probable drug problem.
    positiveCutoff: 3,
    source: "DAST-10, Skinner H.A. (1982); 10-item version as distributed by NIDA.",
    version: "DAST-10",
    // Item wording here is an abbreviated paraphrase of the published
    // questions, NOT verified against the source — flagged. Item order follows
    // the standard DAST-10; item 3 ("always able to stop") is reverse-scored:
    // a "No" answer scores 1.
    textVerified: false,
    scoringVersion: "sum-v2-item3-reversed",
    reverseItems: [2],
    questions: [
      "Used drugs other than those required for medical reasons",
      "Used more than one drug at a time",
      "Always able to stop using drugs when you want to",
      "Had blackouts or flashbacks as a result of drug use",
      "Felt bad or guilty about your drug use",
      "Family/partner complained about your drug use",
      "Neglected your family because of your drug use",
      "Engaged in illegal activities to obtain drugs",
      "Experienced withdrawal symptoms when stopping",
      "Had medical problems due to drug use",
    ],
    options: yesNo,
    bands: [
      { max: 0, label: "No problems" },
      { max: 2, label: "Low" },
      { max: 5, label: "Moderate" },
      { max: 8, label: "Substantial" },
      { max: 10, label: "Severe" },
    ],
  },
  {
    key: "pc-ptsd-5",
    name: "PC-PTSD-5",
    description:
      "Sometimes things happen to people that are unusually or especially frightening, horrible, or traumatic. For example: a serious accident or fire; a physical or sexual assault or abuse; an earthquake or flood; a war; seeing someone be killed or seriously injured; having a loved one die through homicide or suicide.",
    atIntake: true,
    // NCPTSD: a cut-point of 4 balanced false negatives/positives in VA primary
    // care; lower may suit women. DRAFT pending clinical decision.
    positiveCutoff: 4,
    cutoffDraft: true,
    source:
      "Primary Care PTSD Screen for DSM-5 (PC-PTSD-5), National Center for PTSD, version date 2022 (pc-ptsd5-screen.pdf). Public domain.",
    version: "PC-PTSD-5 (2022)",
    scoringVersion: "count-yes-gated-v1",
    textVerified: true,
    verifiedOn: "2026-09-25",
    gate: { itemIndex: 0, stopWhenValue: 0 },
    questions: [
      "Have you ever experienced this kind of event?",
      "In the past month, have you… had nightmares about the event(s) or thought about the event(s) when you did not want to?",
      "In the past month, have you… tried hard not to think about the event(s) or went out of your way to avoid situations that reminded you of the event(s)?",
      "In the past month, have you… been constantly on guard, watchful, or easily startled?",
      "In the past month, have you… felt numb or detached from people, activities, or your surroundings?",
      "In the past month, have you… felt guilty or unable to stop blaming yourself or others for the event(s) or any problems the event(s) may have caused?",
    ],
    options: yesNo,
    bands: [
      { max: 3, label: "Negative (draft cut-point 4)" },
      { max: 5, label: "Positive — further assessment indicated" },
    ],
  },
  {
    key: "pcl-5-20",
    name: "PCL-5",
    description:
      "Keeping your worst event in mind, how much have you been bothered by each problem in the past month?",
    atIntake: false,
    // NCPTSD: a total of 31–33 suggests probable PTSD. DRAFT: 33 chosen.
    positiveCutoff: 33,
    cutoffDraft: true,
    source:
      "PTSD Checklist for DSM-5 (PCL-5) – Standard, National Center for PTSD, version date 29 August 2023. Public domain.",
    version: "PCL-5 Standard (2023)",
    scoringVersion: "sum-v1",
    textVerified: true,
    verifiedOn: "2026-09-25",
    questions: [
      "Repeated, disturbing, and unwanted memories of the stressful experience?",
      "Repeated, disturbing dreams of the stressful experience?",
      "Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)?",
      "Feeling very upset when something reminded you of the stressful experience?",
      "Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)?",
      "Avoiding memories, thoughts, or feelings related to the stressful experience?",
      "Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?",
      "Trouble remembering important parts of the stressful experience?",
      "Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?",
      "Blaming yourself or someone else for the stressful experience or what happened after it?",
      "Having strong negative feelings such as fear, horror, anger, guilt, or shame?",
      "Loss of interest in activities that you used to enjoy?",
      "Feeling distant or cut off from other people?",
      "Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)?",
      "Irritable behavior, angry outbursts, or acting aggressively?",
      "Taking too many risks or doing things that could cause you harm?",
      "Being “superalert” or watchful or on guard?",
      "Feeling jumpy or easily startled?",
      "Having difficulty concentrating?",
      "Trouble falling or staying asleep?",
    ],
    options: [
      { label: "Not at all", value: 0 },
      { label: "A little bit", value: 1 },
      { label: "Moderately", value: 2 },
      { label: "Quite a bit", value: 3 },
      { label: "Extremely", value: 4 },
    ],
    bands: [
      { max: 32, label: "Below draft cut-point (33)" },
      { max: 80, label: "Probable PTSD — draft cut-point 33" },
    ],
  },
];

/**
 * §Phase 10a — RETIRED, non-validated forms. Never offered, never scored for
 * new results, never trended with validated instruments, never counted in
 * reporting totals. Kept only so historical results keep a readable label.
 */
export const RETIRED_SCREENERS: ScreenerDef[] = [
  {
    key: "pcl-5",
    name: "PCL-5 (short, retired)",
    description: "Retired form — not validated. 5 abbreviated PCL-5 items used before Phase 10a.",
    retired: true,
    source: "In-house abbreviation of PCL-5 items 1–4 and 6 (not a published instrument).",
    version: "retired-short-5",
    scoringVersion: "sum-v0",
    textVerified: false,
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

export const RETIRED_FORM_LABEL = "Retired form — not validated";
export const LEGACY_AUDIT_LABEL = "Scored before 0/2/4 fix";
export const UNVERIFIED_TEXT_LABEL = "Text pending source check";
export const DRAFT_LABEL = "Draft — pending clinical sign-off";

export function severityFor(def: ScreenerDef, score: number) {
  for (const b of def.bands) if (score <= b.max) return b.label;
  return def.bands[def.bands.length - 1].label;
}

// ---------------------------------------------------------------------------
// §Phase 10a — ONE draft re-screen schedule per instrument. Every "due" view
// (re-assess, My Work, clinician worklist, Ask Adel, agentic chart review)
// reads `rescreensDue`, which reads this table. DRAFT pending clinical
// sign-off.
//   • `timepoints`: fixed day offsets from the FIRST result (intake).
//   • `repeatEveryDays`: after the timepoints, repeat this long after the last.
// ---------------------------------------------------------------------------
export interface RescreenRule {
  key: string;
  timepoints: number[];
  repeatEveryDays?: number;
  note: string;
}

export const RESCREEN_SCHEDULE: RescreenRule[] = [
  { key: "phq-9", timepoints: [30, 60, 90], repeatEveryDays: 90, note: "Intake, then day 30 / 60 / 90" },
  { key: "gad-7", timepoints: [30, 60, 90], repeatEveryDays: 90, note: "Intake, then day 30 / 60 / 90" },
  { key: "audit", timepoints: [90], repeatEveryDays: 90, note: "Intake, then day 90 (Part 2 consent required)" },
  { key: "dast-10", timepoints: [90], repeatEveryDays: 90, note: "Intake, then day 90 (Part 2 consent required)" },
  { key: "pc-ptsd-5", timepoints: [90], repeatEveryDays: 90, note: "Intake, then day 90" },
  { key: "pcl-5-20", timepoints: [30], repeatEveryDays: 30, note: "After a positive PC-PTSD-5 or on staff request; repeat at day 30" },
  { key: "ahc-hrsn", timepoints: [182], repeatEveryDays: 182, note: "Intake, then every 6 months" },
];
export const RESCREEN_SCHEDULE_STATUS = DRAFT_LABEL;

export function rescreenRule(key: string): RescreenRule | undefined {
  return RESCREEN_SCHEDULE.find((r) => r.key === key);
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
    source: PHQ_SOURCE,
    version: "PHQ-2 (PHQ-9 items 1–2)",
    scoringVersion: "sum-v1",
    textVerified: true,
    verifiedOn: "2026-09-25",
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
    source: GAD_SOURCE,
    version: "GAD-2 (GAD-7 items 1–2)",
    scoringVersion: "sum-v1",
    textVerified: true,
    verifiedOn: "2026-09-25",
    // Verbatim GAD-2 items (= GAD-7 items 1 and 2).
    questions: [
      "Feeling nervous, anxious or on edge",
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

// Order as printed on the CMS tool.
const FOOD_OPTIONS = [
  { label: "Often true", value: 2 },
  { label: "Sometimes true", value: 1 },
  { label: "Never true", value: 0 },
];

/** CMS AHC-HRSN core screening tool — verbatim item text. */
export const AHC_HRSN: DomainScreenerDef = {
  key: "ahc-hrsn",
  name: "AHC-HRSN core",
  description:
    "Health-related social needs — CMS Accountable Health Communities core screening tool (housing, food, transportation, utilities, safety).",
  isSdoh: true,
  atIntake: true,
  source: "CMS Accountable Health Communities HRSN Screening Tool (core questions).",
  version: "AHC-HRSN core",
  scoringVersion: "domain-count-v1",
  // Checked against the CMS PDF (innovation/files/worksheets/ahcm-screeningtool.pdf).
  // Adaptation: item 2 is "choose all that apply" on paper; here it is one
  // choice (none / one or more) — the domain result is identical.
  textVerified: true,
  verifiedOn: "2026-05",
  questions: [
    "What is your living situation today?",
    "Think about the place you live. Do you have problems with any of the following? (Pests such as bugs, ants, or mice; Mold; Lead paint or pipes; Lack of heat; Oven or stove not working; Smoke detectors missing or not working; Water leaks)",
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
          "I do not have a steady place to live (I am temporarily staying with others, in a hotel, in a shelter, living outside on the street, on a beach, in a car, abandoned building, bus or train station, or in a park)",
        value: 1,
      },
    ],
    1: [
      { label: "One or more of the above", value: 1 },
      { label: "None of the above", value: 0 },
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

/**
 * §Part 2 store gate — is THIS instrument 42 CFR Part 2 material?
 *
 * Derived from the instrument definition's existing `isSud` flag, which is
 * already the thing `intake.tsx` filters on, rather than a second hand-kept
 * key list that could drift from it. Only AUDIT-10 and DAST-10 carry it:
 * PHQ-9/GAD-7/PHQ-2/GAD-2 are mental-health, and AHC-HRSN is social-needs —
 * neither is SUD-specific, so neither is Part 2 covered.
 */
export function isPart2Screener(keyOrDef: string | ScreenerDef): boolean {
  const def = typeof keyOrDef === "string" ? screenerByKey(keyOrDef) : keyOrDef;
  return def?.isSud === true;
}

/** Every instrument in one lookup — full, short-form and domain alike. */
export function screenerByKey(key: string): ScreenerDef | undefined {
  return (
    SCREENERS.find((s) => s.key === key) ??
    SHORT_FORM_SCREENERS.find((s) => s.key === key) ??
    DOMAIN_SCREENERS.find((s) => s.key === key) ??
    RETIRED_SCREENERS.find((s) => s.key === key)
  );
}

/** §Phase 10a — an instrument that may be administered for NEW results. */
export function activeScreenerByKey(key: string): ScreenerDef | undefined {
  const d = screenerByKey(key);
  return d && !d.retired ? d : undefined;
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
  if (def.retired) throw new Error(`${def.name} is retired and cannot be scored for new results.`);
  let score: number;
  if (def.gate) {
    // Gate item is never scored; a "stop" answer completes the form at 0.
    const g = answers[def.gate.itemIndex];
    score =
      g === def.gate.stopWhenValue
        ? 0
        : answers.reduce((a, b, i) => (i === def.gate!.itemIndex ? a : a + (Number(b) || 0)), 0);
  } else {
    const rev = new Set(def.reverseItems ?? []);
    score = answers.reduce((a, b, i) => a + (rev.has(i) ? 1 - (Number(b) || 0) : Number(b) || 0), 0);
  }
  const out: { score: number; severity: string; positive?: boolean } = {
    score,
    severity: severityFor(def, score),
  };
  if (def.positiveCutoff !== undefined) out.positive = score >= def.positiveCutoff;
  return out;
}
