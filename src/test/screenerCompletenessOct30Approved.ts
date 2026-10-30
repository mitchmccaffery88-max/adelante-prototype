import { createHash } from "node:crypto";
// 30 Oct R5 (Mitch, Draft — pending clinical sign-off): screener completeness.
// Unanswered shown items stay blank, incomplete screeners are stored apart and
// never scored. Pre-approved exact-once re-pin; every anchor occurs once.
const APPROVED: Record<string, { prior: string; updated: string; pairs: [string, string][] }> = {
 "src/lib/ehr.ts": {
  "prior": "c5da74903895df783555c7678f0aae0d367dfa3ee2a1755d21e8559be7a91309",
  "updated": "68f4a0e7992b43f38102c0bee336071ab090662bf87ff1d52ed04735ba4ffacd",
  "pairs": [
   [
    "} from \"./screeners\";\nexport type { LibraryCategory, LibraryItem, Exercise, SavedToolkitItem } from \"./library\";\n",
    "} from \"./screeners\";\nimport { assessCompleteness } from \"./screenerCompleteness\";\nexport type { LibraryCategory, LibraryItem, Exercise, SavedToolkitItem } from \"./library\";\n"
   ],
   [
    "  screenerHistory?: ScreenerResult[];\n  /** Screeners/assessments that were due and not completed (Tracking). */\n",
    "  screenerHistory?: ScreenerResult[];\n  /**\n   * \u00a7R5 \u2014 screeners with a shown item left blank. No total, no severity band,\n   * never read by severity, reassessment, care-plan, content or report logic.\n   */\n  incompleteScreeners?: IncompleteScreener[];\n  /** Screeners/assessments that were due and not completed (Tracking). */\n"
   ],
   [
    "\nexport interface ScreenerResult {\n",
    "\n/** \u00a7R5 (Draft \u2014 pending clinical sign-off) \u2014 a screener left incomplete. No score. */\nexport interface IncompleteScreener {\n  key: string;\n  status: \"incomplete\";\n  completedAt: string;\n  timepoint?: ScreenerResult[\"timepoint\"];\n  context?: ScreenerResult[\"context\"];\n  instrumentVersion?: string;\n  shownCount: number;\n  answeredCount: number;\n  /** Answered values; null = unanswered or not asked. */\n  responses: (number | null)[];\n  unansweredItems: number[];\n  notAskedItems: number[];\n}\n\nexport interface ScreenerResult {\n"
   ],
   [
    "  responses?: number[];\n  /** True when the total met the instrument's standard positive cutoff. */\n",
    "  responses?: number[];\n  /**\n   * \u00a7R5 (30 Oct, Draft \u2014 pending clinical sign-off) \u2014 stamped on every result\n   * recorded after the screener-completeness fix. Absent = recorded before the\n   * fix (\"may include unanswered items\"). Incomplete screeners are never\n   * ScreenerResults; they live in `Patient.incompleteScreeners`.\n   */\n  completeness?: \"complete\";\n  /** Items hidden by the instrument's own skip logic (scored per the instrument). */\n  notAskedItems?: number[];\n  /** True when the total met the instrument's standard positive cutoff. */\n"
   ],
   [
    "  },\n  recordScreener(patientId: string, result: ScreenerResult) {\n",
    "  },\n  /**\n   * \u00a7R5 (Draft \u2014 pending clinical sign-off) \u2014 store a screener with a shown\n   * item left blank. Never scored, never in `screeners`/`screenerHistory`.\n   * The unchanged crisis rule still fires on an ANSWERED PHQ-9 item 9 > 0.\n   * The item-9-unanswered follow-up task is created by the caller through\n   * the registry (`screener_item9_followup`).\n   */\n  recordIncompleteScreener(patientId: string, rec: IncompleteScreener) {\n    const p = patients.find((x) => x.id === patientId);\n    if (!p) return;\n    const def = _defForResult(rec.key);\n    if (def?.retired) throw new Error(`${def.name} is retired and cannot be recorded.`);\n    const stored: IncompleteScreener = { ...rec, ...(def?.version && !rec.instrumentVersion ? { instrumentVersion: def.version } : {}) };\n    p.incompleteScreeners = [...(p.incompleteScreeners ?? []), stored];\n    appendAudit({\n      category: \"clinical\",\n      action: \"screener_incomplete_recorded\",\n      patientId,\n      actorId: rec.context === \"patient_self\" || rec.context === \"intake\" || !rec.context ? `patient:${patientId}` : \"system\",\n      detail: { screenerKey: rec.key, status: \"incomplete\", answeredCount: rec.answeredCount, shownCount: rec.shownCount, timepoint: rec.timepoint, context: rec.context },\n    });\n    if (rec.key === \"phq-9\" && (rec.responses[8] ?? 0) > 0) {\n      p.crisisFlag = { source: rec.key, raisedAt: rec.completedAt };\n      if (p.caseManagerId) {\n        AdelanteEHR.createCaseTask({\n          patientId: p.id,\n          assignedTo: p.caseManagerId,\n          title: `Crisis flag \u2014 ${rec.key.toUpperCase()}`,\n          detail: `Screener flagged elevated risk. Follow safety protocol and document contact today.`,\n          dueDate: new Date().toISOString().slice(0, 10),\n          origin: \"screener_flag\",\n          dedupeKey: `crisis:${p.id}:${rec.key}`,\n        });\n      }\n      AdelanteEHR.requestCssrs(patientId, \"PHQ-9 item 9 > 0\");\n    }\n    emit();\n  },\n  listIncompleteScreeners(patientId: string): IncompleteScreener[] {\n    return patients.find((x) => x.id === patientId)?.incompleteScreeners ?? [];\n  },\n  recordScreener(patientId: string, result: ScreenerResult) {\n"
   ],
   [
    "    _stampScreenerMeta(result);\n    // \u00a7C3 \u2014 severity flag vs the previous result of the same instrument\n",
    "    _stampScreenerMeta(result);\n    if (!result.completeness) result.completeness = \"complete\";\n    // \u00a7C3 \u2014 severity flag vs the previous result of the same instrument\n"
   ],
   [
    "      responses: input.answers.map((a) => (a === undefined ? -1 : a)),\n      cssrsRisk: risk,\n",
    "      responses: input.answers.map((a) => (a === undefined ? -1 : a)),\n      // \u00a7R5 \u2014 gated items read as \"not asked\", never as a score.\n      notAskedItems: input.answers.flatMap((a, i) => (a === undefined ? [i] : [])),\n      cssrsRisk: risk,\n"
   ],
   [
    "      if (!items || items.length === 0) continue;\n      const score = items.reduce((a, b) => a + (Number(b) || 0), 0);\n",
    "      if (!items || items.length === 0) continue;\n      // \u00a7R5 \u2014 a blank shown item makes the quick check incomplete: no score, no escalation.\n      const qc = assessCompleteness(def, items);\n      if (!qc.complete) {\n        AdelanteEHR.recordIncompleteScreener(patientId, { key: def.key, status: \"incomplete\", completedAt, timepoint: \"adhoc\", shownCount: qc.shownCount, answeredCount: qc.answeredCount, responses: qc.responses, unansweredItems: qc.unansweredItems, notAskedItems: qc.notAskedItems });\n        continue;\n      }\n      const score = items.reduce((a, b) => a + (Number(b) || 0), 0);\n"
   ],
   [
    "      throw new Error(`Please answer all ${def.questions.length} questions.`);\n    // Skipped (gated) items are stored as 0 so answer arrays stay full-length.\n    answers = def.questions.map((_, i) => (typeof answers[i] === \"number\" ? answers[i] : 0));\n    const due = AdelanteEHR.rescreensDue(patientId).find((d) => d.key === key);\n",
    "      throw new Error(`Please answer all ${def.questions.length} questions.`);\n    // \u00a7R5 \u2014 gated items are \"not asked\" and take the instrument's published\n    // value (0) only for scoring; they are listed in notAskedItems.\n    const rc = assessCompleteness(def, answers);\n    answers = rc.scoringAnswers ?? answers;\n    const due = AdelanteEHR.rescreensDue(patientId).find((d) => d.key === key);\n"
   ],
   [
    "      responses: answers,\n      context: \"patient_self\",\n",
    "      responses: answers,\n      ...(rc.notAskedItems.length ? { notAskedItems: rc.notAskedItems } : {}),\n      context: \"patient_self\",\n"
   ],
   [
    "    }\n    if (input.answers.length !== def.questions.length)\n      throw new Error(`${def.name} requires all ${def.questions.length} items.`);\n",
    "    }\n    if (input.answers.length !== def.questions.length || !screenerComplete(def, input.answers))\n      throw new Error(`${def.name} requires all ${def.questions.length} items.`);\n"
   ]
  ]
 }
};
export function withApprovedScreenerCompletenessOct30(path: string, source: string): string {
  const entry = APPROVED[path];
  if (!entry) return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== entry.prior) throw new Error(`Screener completeness Oct 30 prior source changed: ${path}`);
  let s = source;
  for (const [from, to] of entry.pairs) {
    if (s.split(from).length !== 2) throw new Error(`Screener completeness Oct 30 anchor not exactly once: ${path}`);
    s = s.replace(from, () => to);
  }
  if (digest(s) !== entry.updated) throw new Error(`Screener completeness Oct 30 replacement changed: ${path}`);
  return s;
}
