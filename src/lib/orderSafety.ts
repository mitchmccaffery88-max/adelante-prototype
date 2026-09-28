// §Order safety (turn B) — pure rules, no store import.
//
// B1 allergy cross-check: same ingredient, or same drug class where our small
// class map knows both sides. The class map is DRAFT — pending clinical sign-off.
// B2 CURES/PDMP step: DEA Schedule II–V drugs and all MOUD orders need a
// recorded CURES check before signing. CURES integration placeholder — no live query.
import { SUD_MEDICATION_NAMES } from "./sudMedClassifier";

export const ALLERGY_CLASS_DRAFT_LABEL = "Drug-class matching: Draft — pending clinical sign-off";
export const CURES_PLACEHOLDER_LABEL = "CURES integration placeholder — no live query";

/** DRAFT class map: class → member ingredients (lower-case). */
export const DRUG_CLASSES: Record<string, string[]> = {
  penicillins: ["penicillin", "amoxicillin", "ampicillin", "dicloxacillin", "piperacillin", "nafcillin"],
  cephalosporins: ["cephalexin", "cefazolin", "ceftriaxone", "cefuroxime", "cefdinir"],
  sulfonamides: ["sulfamethoxazole", "sulfasalazine", "sulfa"],
  nsaids: ["ibuprofen", "naproxen", "aspirin", "ketorolac", "meloxicam", "diclofenac", "celecoxib"],
  opioids: ["morphine", "codeine", "hydrocodone", "oxycodone", "hydromorphone", "fentanyl", "tramadol", "buprenorphine", "methadone"],
  benzodiazepines: ["lorazepam", "diazepam", "alprazolam", "clonazepam", "chlordiazepoxide"],
  ssris: ["sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine"],
  phenothiazines: ["chlorpromazine", "prochlorperazine", "fluphenazine", "perphenazine"],
  anticonvulsants_aromatic: ["carbamazepine", "oxcarbazepine", "phenytoin", "lamotrigine"],
};

/** Class name typed as an allergy ("Penicillin", "sulfa drugs", "NSAIDs") → class key. */
const CLASS_ALIASES: Record<string, string> = {
  penicillin: "penicillins", penicillins: "penicillins", pcn: "penicillins",
  cephalosporin: "cephalosporins", cephalosporins: "cephalosporins",
  sulfa: "sulfonamides", "sulfa drugs": "sulfonamides", sulfonamides: "sulfonamides",
  nsaid: "nsaids", nsaids: "nsaids",
  opioid: "opioids", opioids: "opioids", opiates: "opioids",
  benzodiazepine: "benzodiazepines", benzodiazepines: "benzodiazepines", benzos: "benzodiazepines",
  ssri: "ssris", ssris: "ssris",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

export interface OrderLike {
  drugName: string;
  productName?: string;
  ingredientNames?: string[];
  isControlled?: boolean;
  deaSchedule?: string;
  sudRelated?: boolean;
}
export interface AllergyLike {
  substance: string;
  active: boolean;
}

function orderIngredients(o: OrderLike): string[] {
  const words = [o.drugName, o.productName ?? "", ...(o.ingredientNames ?? [])].map(norm).join(" ");
  return Array.from(new Set(words.split(" ").filter((w) => w.length > 2)));
}
function classesOf(ingredient: string): string[] {
  return Object.entries(DRUG_CLASSES)
    .filter(([, m]) => m.includes(ingredient))
    .map(([k]) => k);
}

export interface AllergyMatch {
  substance: string;
  kind: "ingredient" | "class";
  className?: string;
}

/** Active allergies that match this order by ingredient or (DRAFT) class. */
export function findAllergyMatches(o: OrderLike, allergies: AllergyLike[]): AllergyMatch[] {
  const ing = orderIngredients(o);
  const out: AllergyMatch[] = [];
  for (const a of allergies) {
    if (!a.active) continue;
    const s = norm(a.substance);
    if (!s || /no known|nkda|nka/.test(s)) continue;
    if (ing.some((i) => s.split(" ").includes(i))) {
      out.push({ substance: a.substance, kind: "ingredient" });
      continue;
    }
    const allergyClasses = new Set<string>();
    if (CLASS_ALIASES[s]) allergyClasses.add(CLASS_ALIASES[s]);
    for (const w of s.split(" ")) {
      if (CLASS_ALIASES[w]) allergyClasses.add(CLASS_ALIASES[w]);
      classesOf(w).forEach((c) => allergyClasses.add(c));
    }
    const hit = ing.flatMap(classesOf).find((c) => allergyClasses.has(c));
    if (hit) out.push({ substance: a.substance, kind: "class", className: hit });
  }
  return out;
}

/** True when the chart has NO allergy information at all (not even NKDA). */
export function allergiesNotRecorded(allergies: AllergyLike[] | undefined): boolean {
  return !(allergies ?? []).some((a) => a.active);
}

const MOUD = ["buprenorphine", "suboxone", "zubsolv", "sublocade", "brixadi", "methadone", "naltrexone", "vivitrol"];
/** MOUD order (buprenorphine, methadone, naltrexone products). */
export function isMoudOrder(o: OrderLike): boolean {
  const ing = orderIngredients(o);
  return ing.some((i) => MOUD.includes(i));
}
const SCHEDULED: Record<string, string> = {
  oxycodone: "CII", hydrocodone: "CII", morphine: "CII", fentanyl: "CII", methadone: "CII",
  methylphenidate: "CII", amphetamine: "CII", dextroamphetamine: "CII", lisdexamfetamine: "CII",
  buprenorphine: "CIII", testosterone: "CIII", ketamine: "CIII",
  lorazepam: "CIV", alprazolam: "CIV", clonazepam: "CIV", diazepam: "CIV", zolpidem: "CIV",
  tramadol: "CIV", modafinil: "CIV", phenobarbital: "CIV", chlordiazepoxide: "CIV",
  pregabalin: "CV", lacosamide: "CV",
};
/** DEA schedule II–V, from the order's own flag or the known-ingredient list. */
export function deaScheduleOf(o: OrderLike): string | undefined {
  if (o.deaSchedule) return o.deaSchedule;
  return orderIngredients(o).map((i) => SCHEDULED[i]).find(Boolean);
}
export function requiresCuresCheck(o: OrderLike): boolean {
  return !!deaScheduleOf(o) || isMoudOrder(o) || (o.isControlled ?? false);
}

export type CuresResult = "no_concerns" | "concerns_reviewed" | "unable_to_access";
export const CURES_RESULT_LABEL: Record<CuresResult, string> = {
  no_concerns: "No concerns",
  concerns_reviewed: "Concerns reviewed",
  unable_to_access: "Unable to access",
};

// Keep the SUD list import live so MOUD stays in sync with the classifier.
void SUD_MEDICATION_NAMES;
