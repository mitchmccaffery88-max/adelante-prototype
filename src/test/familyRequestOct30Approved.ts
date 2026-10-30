import { createHash } from "node:crypto";
// 30 Oct closeout (Mitch, Draft): family/collateral requests get their own
// request kind. Pre-approved exact-once re-pin; every anchor occurs once.
const APPROVED: Record<string, { prior: string; updated: string; pairs: [string, string][] }> = {
 "src/lib/ehr.ts": {
  "prior": "261983d2b85abbe687ef7d8b629a324ee82e36e5e149f3c9230212110e6c1269",
  "updated": "c5da74903895df783555c7678f0aae0d367dfa3ee2a1755d21e8559be7a91309",
  "pairs": [
   [
    "export type AppointmentRequestKind = \"therapy\" | \"medication\" | \"help_choose\";",
    "export type AppointmentRequestKind = \"therapy\" | \"medication\" | \"help_choose\" | \"family\";"
   ],
   [
    "  therapy: [\"therapy_individual\", \"intake\", \"family_collateral\"],\n  medication: [\"med_management\", \"controlled_med_moud\", \"psychiatric_evaluation\"],\n  help_choose: [\"care_coordination\", \"case_management\"],\n",
    "  therapy: [\"therapy_individual\", \"intake\"],\n  medication: [\"med_management\", \"controlled_med_moud\", \"psychiatric_evaluation\"],\n  help_choose: [\"care_coordination\", \"case_management\"],\n  family: [\"family_collateral\"],\n"
   ],
   [
    "  help_choose: \"care_coordination\",\n};",
    "  help_choose: \"care_coordination\",\n  family: \"family_collateral\",\n};"
   ],
   [
    "  help_choose: \"Help me choose (care coordination)\",\n};",
    "  help_choose: \"Help me choose (care coordination)\",\n  family: \"Family or collateral session\",\n};"
   ],
   [
    "patientAccess: \"request\", patientRequestKind: \"therapy\", deliverySystemDraft: { tag: \"smhs_or_nsmhs\", confirm: \"Collateral billing",
    "patientAccess: \"request\", patientRequestKind: \"family\", deliverySystemDraft: { tag: \"smhs_or_nsmhs\", confirm: \"Collateral billing"
   ],
   [
    "    sel: { mentalHealth?: boolean; medication?: boolean; substanceUse?: boolean; notSure?: boolean },",
    "    sel: { mentalHealth?: boolean; medication?: boolean; substanceUse?: boolean; notSure?: boolean; family?: boolean },"
   ],
   [
    "          ...(sel.medication ? ([\"medication\"] as const) : []),\n          // Substance",
    "          ...(sel.medication ? ([\"medication\"] as const) : []),\n          ...(sel.family ? ([\"family\"] as const) : []),\n          // Substance"
   ]
  ]
 },
 "src/lib/apptRequestStatus.ts": {
  "prior": "b00e75f43ffc4b1623cec6a80976a07738dd89d979de77ab277574136ab6a7b2",
  "updated": "d3b87466b0c8d724fe22f54f3bc5ff34bb2f2c43dd0b53b6d679a73e92bad5fa",
  "pairs": [
   [
    "  help_choose: { en: \"Help choosing the right care\", es: \"Ayuda para elegir la atención adecuada\" },\n};",
    "  help_choose: { en: \"Help choosing the right care\", es: \"Ayuda para elegir la atención adecuada\" },\n  family: { en: \"Family session\", es: \"Sesión familiar\" },\n};"
   ],
   [
    "for (const kind of [\"therapy\", \"medication\", \"help_choose\"] as const)",
    "for (const kind of [\"therapy\", \"medication\", \"help_choose\", \"family\"] as const)"
   ]
  ]
 }
};
export function withApprovedFamilyRequestOct30(path: string, source: string): string {
  const entry = APPROVED[path];
  if (!entry) return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== entry.prior) throw new Error(`Family request Oct 30 prior source changed: ${path}`);
  let s = source;
  for (const [from, to] of entry.pairs) {
    if (s.split(from).length !== 2) throw new Error(`Family request Oct 30 anchor not exactly once: ${path}`);
    s = s.replace(from, () => to);
  }
  if (digest(s) !== entry.updated) throw new Error(`Family request Oct 30 replacement changed: ${path}`);
  return s;
}
