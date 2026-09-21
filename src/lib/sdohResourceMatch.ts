// §Intake/SDOH Redesign Phase 4 — matching a real SDOH plan item to real
// directory categories.
//
// This module is PURE and does NOT read the directory store. It answers one
// question: "which of the 14 real `RESOURCE_CATEGORIES` does this need belong
// to, and is it honest to name specific organisations for it?" The screen then
// reads the actual listings through the existing `patientBrowsableResources`.
//
// PART 2 CONSTRAINT, HONESTLY STATED. No organisation in the directory carries
// any Part 2 classification today — `CommunityResource` has no such field and
// no entry is flagged. So for any need that could plausibly touch a Part 2
// sensitive service (recovery meetings, SUD support groups) we surface the
// CATEGORY ONLY and never a named organisation, until the real classification
// workbook lands. Interpersonal safety is treated the same way for a different
// reason: naming a specific shelter or legal office to someone who may be
// living with the person who hurt them is a staff conversation, not a list.
import { RESOURCE_CATEGORIES } from "@/lib/communityResources";
import { INTAKE_NEED_KEYS, itemMatchesIntakeKey } from "@/lib/intakeNeedsReconcile";
import type { IntakeNeedKey } from "@/lib/sdohMapping";
import type { SdohPlanItem } from "@/lib/ehr";

/**
 * Categories that may hold Part 2 sensitive organisations. Category-only
 * display until a real classification exists per organisation.
 */
export const PART2_CAUTION_CATEGORY_IDS: readonly string[] = [
  "recovery_meetings",
  "support_groups",
];

/** Categories we deliberately never name an organisation for at intake. */
const CATEGORY_ONLY_IDS: readonly string[] = [...PART2_CAUTION_CATEGORY_IDS];

/** The four intake categories, mapped to real directory category ids. */
export const INTAKE_KEY_CATEGORIES: Record<IntakeNeedKey, string[]> = {
  housing: ["housing", "emergency_shelter"],
  food: ["food"],
  employment: ["employment", "education"],
  transport: ["transportation"],
};

interface KeywordRule {
  /** Lowercase substrings; any match selects this rule. */
  match: string[];
  categoryIds: string[];
  /** Force category-only display regardless of Part 2 caution. */
  categoryOnly?: boolean;
  reason?: string;
}

/**
 * For needs that did not come from the four intake checkboxes: HRSN-only
 * domains (utilities, interpersonal safety) and free-text needs written by
 * staff or an advocate. Deliberately conservative — no match is a real answer.
 */
export const NEED_KEYWORD_RULES: KeywordRule[] = [
  { match: ["utilit", "shut-off", "shut off", "electric", "power bill"], categoryIds: ["financial"] },
  {
    match: ["safety", "violence", "abuse", "hits"],
    categoryIds: ["legal", "healthcare"],
    categoryOnly: true,
    reason:
      "Interpersonal safety is worked with a person, not a list — your team will go through the options with you.",
  },
  { match: ["child care", "childcare", "parent", "diaper"], categoryIds: ["parenting"] },
  { match: ["family", "reunif", "custody"], categoryIds: ["family_reunification"] },
  { match: ["legal", "probation", "parole", "court", "expunge"], categoryIds: ["legal"] },
  { match: ["benefit", "income", "money", "financial", "bill"], categoryIds: ["financial"] },
  { match: ["school", "ged", "education", "class"], categoryIds: ["education"] },
  { match: ["doctor", "clinic", "health", "medical", "dental"], categoryIds: ["healthcare"] },
  { match: ["life skill", "id card", "identification", "documents"], categoryIds: ["life_skills"] },
  {
    match: ["recovery", "meeting", "sober", "substance", "sud", "aa ", "na ", "support group"],
    categoryIds: ["recovery_meetings", "support_groups"],
    reason:
      "We show the category rather than a named group: recovery services can be confidential under federal Part 2 rules and that classification is not finished.",
  },
];

export interface NeedResourceMatch {
  /** Real directory category ids, in `RESOURCE_CATEGORIES` order. */
  categoryIds: string[];
  /** False when only the category may be shown, never a named organisation. */
  showOrgs: boolean;
  /** Plain-language explanation shown when `showOrgs` is false. */
  reason?: string;
}

const order = (id: string) => RESOURCE_CATEGORIES.find((c) => c.id === id)?.order ?? 999;

function finalize(ids: string[], categoryOnly: boolean, reason?: string): NeedResourceMatch {
  const unique = [...new Set(ids)].filter((id) => RESOURCE_CATEGORIES.some((c) => c.id === id));
  unique.sort((a, b) => order(a) - order(b));
  const caution = unique.some((id) => CATEGORY_ONLY_IDS.includes(id));
  const showOrgs = !(categoryOnly || caution);
  return {
    categoryIds: unique,
    showOrgs,
    ...(showOrgs
      ? {}
      : {
          reason:
            reason ??
            "We show the category rather than a named organisation until our team has finished confirming which services are confidential.",
        }),
  };
}

/**
 * The real match for one plan item. Intake-category items resolve through the
 * Phase 2/3 mapping; everything else falls through to the keyword rules.
 * Returns `null` when nothing matches honestly — the screen says so rather
 * than guessing.
 */
export function matchResourcesForNeed(item: SdohPlanItem): NeedResourceMatch | null {
  for (const key of INTAKE_NEED_KEYS) {
    if (itemMatchesIntakeKey(item, key)) return finalize(INTAKE_KEY_CATEGORIES[key], false);
  }
  const hay = ` ${item.need.toLowerCase()} `;
  for (const rule of NEED_KEYWORD_RULES) {
    if (rule.match.some((m) => hay.includes(m))) {
      return finalize(rule.categoryIds, rule.categoryOnly ?? false, rule.reason);
    }
  }
  return null;
}

/** Drift guard for the tests: every category id named here must be real. */
export function unknownCategoryIds(): string[] {
  const declared = new Set(RESOURCE_CATEGORIES.map((c) => c.id));
  const used = [
    ...Object.values(INTAKE_KEY_CATEGORIES).flat(),
    ...NEED_KEYWORD_RULES.flatMap((r) => r.categoryIds),
    ...PART2_CAUTION_CATEGORY_IDS,
  ];
  return [...new Set(used)].filter((id) => !declared.has(id));
}
