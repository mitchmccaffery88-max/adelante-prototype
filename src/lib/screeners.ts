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
    name: "AUDIT-C",
    description: "Alcohol use — protected by 42 CFR Part 2",
    isSud: true,
    questions: [
      "How often do you have a drink containing alcohol?",
      "How many drinks on a typical day when drinking?",
      "How often do you have 6 or more drinks on one occasion?",
    ],
    options: [
      { label: "Never", value: 0 },
      { label: "Monthly or less", value: 1 },
      { label: "2–4 times a month", value: 2 },
      { label: "2–3 times a week", value: 3 },
      { label: "4+ times a week", value: 4 },
    ],
    bands: [
      { max: 3, label: "Low risk" },
      { max: 6, label: "Moderate risk" },
      { max: 12, label: "High risk" },
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