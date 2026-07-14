export interface ScreenerDef {
  key: string;
  name: string;
  description: string;
  isSud?: boolean;
  questions: string[];
  options: { label: string; value: number }[];
  bands: { max: number; label: string }[];
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