import { createHash } from "node:crypto";
// Mitch approved 30 Oct, finished 31 Oct. Draft — pending clinical sign-off.
// Chained after original R5: hash-check prior text and each exact-once hunk.
const APPROVED = {
  "src/lib/ehr.ts": {
    "prior": "68f4a0e7992b43f38102c0bee336071ab090662bf87ff1d52ed04735ba4ffacd",
    "updated": "e954134850e6ccc05dc98e9b1e1f1c2837ffbf8d1851274b39d4a89e0e9891a2",
    "pairs": [
      [
        "// AdelanteEHR \u2014 single seam for all clinical-backend reads/writes.\nimport { disclose } from \"./part2Disclosure\";\nimport { assertIntakeStagingBoundary } from \"./intakeStagingBoundary\";\n",
        "import \"./screenerIntake\";\n// AdelanteEHR \u2014 single seam for all clinical-backend reads/writes.\nimport { disclose } from \"./part2Disclosure\";\nimport { assertIntakeStagingBoundary } from \"./intakeStagingBoundary\";\n"
      ],
      [
        "  LEGACY_AUDIT_LABEL,\n  type ScreenerDomainResult,\n} from \"./screeners\";\nimport { assessCompleteness } from \"./screenerCompleteness\";\nexport type { LibraryCategory, LibraryItem, Exercise, SavedToolkitItem } from \"./library\";\n// \u00a7v3.0 Phase 5 \u2014 patient documents. Pure policy module (scan gate, queue\n// ownership, Part 2 restriction messaging); imports nothing back from here.\n",
        "  LEGACY_AUDIT_LABEL,\n  type ScreenerDomainResult,\n} from \"./screeners\";\nimport { estimateLabel, assessCompleteness, staffItemsRecorded, type ScreenerAnswer } from \"./screenerCompleteness\";\nimport { writeMemberScreener } from \"./screenerWriteBoundary\";\nexport type { LibraryCategory, LibraryItem, Exercise, SavedToolkitItem } from \"./library\";\n// \u00a7v3.0 Phase 5 \u2014 patient documents. Pure policy module (scan gate, queue\n// ownership, Part 2 restriction messaging); imports nothing back from here.\n"
      ],
      [
        "export interface IncompleteScreener {\n  key: string;\n  status: \"incomplete\";\n  completedAt: string;\n  timepoint?: ScreenerResult[\"timepoint\"];\n  context?: ScreenerResult[\"context\"];\n",
        "export interface IncompleteScreener {\n  key: string;\n  status: \"incomplete\";\n  score?: never;\n  severity?: never;\n  positive?: never;\n  domains?: never;\n  episodeId?: string;\n  completedAt: string;\n  timepoint?: ScreenerResult[\"timepoint\"];\n  context?: ScreenerResult[\"context\"];\n"
      ],
      [
        "  responses: (number | null)[];\n  unansweredItems: number[];\n  notAskedItems: number[];\n}\n\nexport interface ScreenerResult {\n",
        "  responses: (number | null)[];\n  unansweredItems: number[];\n  notAskedItems: number[];\n  declinedItems?: number[];\n  skippedItems?: number[];\n}\n\nexport interface ScreenerResult {\n"
      ],
      [
        "   * result written before this build stays valid.\n   */\n  /** Raw item responses, in question order. */\n  responses?: number[];\n  /**\n   * \u00a7R5 (30 Oct, Draft \u2014 pending clinical sign-off) \u2014 stamped on every result\n   * recorded after the screener-completeness fix. Absent = recorded before the\n   * fix (\"may include unanswered items\"). Incomplete screeners are never\n   * ScreenerResults; they live in `Patient.incompleteScreeners`.\n   */\n  completeness?: \"complete\";\n  /** Items hidden by the instrument's own skip logic (scored per the instrument). */\n  notAskedItems?: number[];\n  /** True when the total met the instrument's standard positive cutoff. */\n",
        "   * result written before this build stays valid.\n   */\n  /** Raw item responses, in question order. */\n  responses?: (number | null)[];\n  /**\n   * \u00a7R5 (30 Oct, Draft \u2014 pending clinical sign-off) \u2014 stamped on every result\n   * recorded after the screener-completeness fix. Absent = recorded before the\n   * fix (\"may include unanswered items\"). Incomplete screeners are never\n   * ScreenerResults; they live in `Patient.incompleteScreeners`.\n   */\n  completeness?: \"complete\" | \"estimated\";\n  /** R5 follow-ups: Draft \u2014 pending clinical sign-off. No item is imputed. */\n  estimated?: boolean;\n  missingItems?: number[];\n  unansweredItems?: number[];\n  declinedItems?: number[];\n  skippedItems?: number[];\n  /** Items hidden by the instrument's own skip logic (scored per the instrument). */\n  notAskedItems?: number[];\n  /** True when the total met the instrument's standard positive cutoff. */\n"
      ],
      [
        "export interface CarePlanScreenerHighlight {\n  key: string;\n  name: string;\n  score: number;\n  band: string;\n  takenAt: string;\n  sensitive: boolean;\n",
        "export interface CarePlanScreenerHighlight {\n  key: string;\n  name: string;\n  score?: number;\n  estimated?: boolean;\n  missingItems?: number[];\n  band: string;\n  takenAt: string;\n  sensitive: boolean;\n"
      ],
      [
        "export interface CarePlanMetrics {\n  phq9Latest?: number;\n  gad7Latest?: number;\n  goalsOpen: number;\n  goalsDone: number;\n  sdohOpen: number;\n",
        "export interface CarePlanMetrics {\n  phq9Latest?: number;\n  gad7Latest?: number;\n  phq9Estimated?: boolean;\n  gad7Estimated?: boolean;\n  goalsOpen: number;\n  goalsDone: number;\n  sdohOpen: number;\n"
      ],
      [
        "  const out: string[] = [];\n  const phq = p.screeners[\"phq-9\"];\n  const gad = p.screeners[\"gad-7\"];\n  if (phq) out.push(`Your mood check (PHQ-9) shows ${phq.severity.toLowerCase()} symptoms.`);\n  if (gad) out.push(`Your worry check (GAD-7) shows ${gad.severity.toLowerCase()} anxiety.`);\n  if (parts.goalsOpen)\n    out.push(\n      `You're working on ${parts.goalsOpen} goal${parts.goalsOpen === 1 ? \"\" : \"s\"} with your care team.`,\n",
        "  const out: string[] = [];\n  const phq = p.screeners[\"phq-9\"];\n  const gad = p.screeners[\"gad-7\"];\n  if (phq && !phq.estimated) out.push(`Your mood check (PHQ-9) shows ${phq.severity.toLowerCase()} symptoms.`);\n  if (gad && !gad.estimated) out.push(`Your worry check (GAD-7) shows ${gad.severity.toLowerCase()} anxiety.`);\n  if (parts.goalsOpen)\n    out.push(\n      `You're working on ${parts.goalsOpen} goal${parts.goalsOpen === 1 ? \"\" : \"s\"} with your care team.`,\n"
      ],
      [
        "  const screenerHighlights: CarePlanScreenerHighlight[] = [];\n  for (const key of [\"phq-9\", \"gad-7\", \"audit\", \"dast-10\", \"pc-ptsd-5\", \"pcl-5-20\", CSSRS_KEY, \"pcl-5\"]) {\n    const r = p.screeners[key];\n    if (!r) continue;\n    screenerHighlights.push({\n      key,\n      name: (_defForResult(key)?.name ?? key.toUpperCase()) + (r.retiredForm ? \" \u2014 retired form\" : \"\"),\n      score: r.score,\n      band: r.severity,\n      takenAt: r.completedAt,\n      sensitive: SUD_SCREENER_KEYS.has(key),\n    });\n",
        "  const screenerHighlights: CarePlanScreenerHighlight[] = [];\n  for (const key of [\"phq-9\", \"gad-7\", \"audit\", \"dast-10\", \"pc-ptsd-5\", \"pcl-5-20\", CSSRS_KEY, \"pcl-5\"]) {\n    const r = p.screeners[key];\n    const incomplete = [...(p.incompleteScreeners ?? [])].filter(h => h.key === key).sort((a,b) => b.completedAt.localeCompare(a.completedAt))[0];\n    if (incomplete && (!r || incomplete.completedAt >= r.completedAt)) {\n      screenerHighlights.push({ key, name: _defForResult(key)?.name ?? key.toUpperCase(), band: \"Incomplete\", takenAt: incomplete.completedAt, sensitive: SUD_SCREENER_KEYS.has(key) });\n      continue;\n    }\n    if (!r) continue;\n    screenerHighlights.push({\n      key,\n      name: (_defForResult(key)?.name ?? key.toUpperCase()) + (r.retiredForm ? \" \u2014 retired form\" : \"\"),\n      score: r.score,\n      band: r.severity,\n      estimated: r.estimated, missingItems: r.missingItems,\n      takenAt: r.completedAt,\n      sensitive: SUD_SCREENER_KEYS.has(key),\n    });\n"
      ],
      [
        "  const phq = p.screeners[\"phq-9\"];\n  const gad = p.screeners[\"gad-7\"];\n  if (phq)\n    focusAreas.push({ key: \"mh\", label: \"Mood & anxiety\", severity: `PHQ-9 ${phq.severity}` });\n  else if (gad)\n    focusAreas.push({ key: \"mh\", label: \"Mood & anxiety\", severity: `GAD-7 ${gad.severity}` });\n  const hasSud = p.needs?.substanceUse || p.screeners[\"audit\"] || p.screeners[\"dast-10\"];\n  if (hasSud) focusAreas.push({ key: \"sud\", label: \"Substance use support\", sensitive: true });\n  if (sdohOpen.length)\n",
        "  const phq = p.screeners[\"phq-9\"];\n  const gad = p.screeners[\"gad-7\"];\n  if (phq)\n    focusAreas.push({ key: \"mh\", label: \"Mood & anxiety\", severity: `PHQ-9 ${phq.severity}${phq.estimated ? ` \u00b7 ${estimateLabel(phq)}` : \"\"}` });\n  else if (gad)\n    focusAreas.push({ key: \"mh\", label: \"Mood & anxiety\", severity: `GAD-7 ${gad.severity}${gad.estimated ? ` \u00b7 ${estimateLabel(gad)}` : \"\"}` });\n  const hasSud = p.needs?.substanceUse || p.screeners[\"audit\"] || p.screeners[\"dast-10\"];\n  if (hasSud) focusAreas.push({ key: \"sud\", label: \"Substance use support\", sensitive: true });\n  if (sdohOpen.length)\n"
      ],
      [
        "  const metrics: CarePlanMetrics = {\n    phq9Latest: phq?.score,\n    gad7Latest: gad?.score,\n    goalsOpen,\n    goalsDone,\n    sdohOpen: sdohOpen.length,\n",
        "  const metrics: CarePlanMetrics = {\n    phq9Latest: phq?.score,\n    gad7Latest: gad?.score,\n    phq9Estimated: phq?.estimated, gad7Estimated: gad?.estimated,\n    goalsOpen,\n    goalsDone,\n    sdohOpen: sdohOpen.length,\n"
      ],
      [
        "      // 9/10; the validated anchors are 0/2/4 for the three published choices.\n      // Old choices on items 9/10 cannot be mapped 1:1, so re-score only when\n      // items 9/10 hold a value that is valid under the new anchors.\n      const ok = [8, 9].every((i) => [0, 2, 4].includes(r.responses![i]));\n      if (ok) {\n        const scored = scoreScreener(def, r.responses);\n        if (scored.score !== r.score || scored.severity !== r.severity) {\n          r.rescoredFrom = { score: r.score, severity: r.severity };\n          r.score = scored.score;\n",
        "      // 9/10; the validated anchors are 0/2/4 for the three published choices.\n      // Old choices on items 9/10 cannot be mapped 1:1, so re-score only when\n      // items 9/10 hold a value that is valid under the new anchors.\n      const auditAnswers = r.responses.filter((v): v is number => typeof v === \"number\");\n      const ok = auditAnswers.length === def.questions.length && [8, 9].every((i) => [0, 2, 4].includes(auditAnswers[i]));\n      if (ok) {\n        const scored = scoreScreener(def, auditAnswers);\n        if (scored.score !== r.score || scored.severity !== r.severity) {\n          r.rescoredFrom = { score: r.score, severity: r.severity };\n          r.score = scored.score;\n"
      ],
      [
        "      sdohOpen += cp.metrics.sdohOpen;\n      if (cp.metrics.crisisFlag) crisisFlags += 1;\n      medsSensitive += cp.metrics.medsSensitive;\n      if (cp.metrics.phq9Latest !== undefined) phq.push(cp.metrics.phq9Latest);\n      if (cp.metrics.gad7Latest !== undefined) gad.push(cp.metrics.gad7Latest);\n    }\n    const avg = (arr: number[]) =>\n      arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : undefined;\n",
        "      sdohOpen += cp.metrics.sdohOpen;\n      if (cp.metrics.crisisFlag) crisisFlags += 1;\n      medsSensitive += cp.metrics.medsSensitive;\n      if (!cp.metrics.phq9Estimated && cp.metrics.phq9Latest !== undefined) phq.push(cp.metrics.phq9Latest);\n      if (!cp.metrics.gad7Estimated && cp.metrics.gad7Latest !== undefined) gad.push(cp.metrics.gad7Latest);\n    }\n    const avg = (arr: number[]) =>\n      arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : undefined;\n"
      ],
      [
        "      // Unverified-but-probably-correct wording (AUDIT, DAST-10) IS counted,\n      // with a caveat; only retired forms and placeholder text are held out.\n      const excluded = all.filter((r) => r.retiredForm || r.placeholderText);\n      const results = all.filter((r) => !excluded.includes(r));\n      const positive = results.filter(\n        (r) =>\n          r.positive ?? (def?.positiveCutoff !== undefined ? r.score >= def.positiveCutoff : false),\n",
        "      // Unverified-but-probably-correct wording (AUDIT, DAST-10) IS counted,\n      // with a caveat; only retired forms and placeholder text are held out.\n      const excluded = all.filter((r) => r.retiredForm || r.placeholderText);\n      const results = all.filter((r) => !excluded.includes(r) && !r.estimated);\n      const positive = results.filter(\n        (r) =>\n          r.positive ?? (def?.positiveCutoff !== undefined ? r.score >= def.positiveCutoff : false),\n"
      ],
      [
        "    for (const p of cohort) {\n      for (const r of Object.values(p.screeners ?? {})) {\n        if (!r?.domains) continue;\n        if (r.retiredForm || r.placeholderText) continue;\n        if (opts.keys && !opts.keys.includes(r.key)) continue;\n        for (const d of r.domains) {\n          const row = tally.get(d.key) ?? { label: d.label, positive: 0, screened: 0 };\n",
        "    for (const p of cohort) {\n      for (const r of Object.values(p.screeners ?? {})) {\n        if (!r?.domains) continue;\n        if (r.estimated || r.retiredForm || r.placeholderText) continue;\n        if (opts.keys && !opts.keys.includes(r.key)) continue;\n        for (const d of r.domains) {\n          const row = tally.get(d.key) ?? { label: d.label, positive: 0, screened: 0 };\n"
      ],
      [
        "  // CaseTask for the clinician who administers it.\n  recordQuickCheck(\n    patientId: string,\n    answers: { \"phq-2\"?: number[]; \"gad-2\"?: number[] },\n    opts: { actorRole?: string } = {},\n  ): {\n    results: ScreenerResult[];\n",
        "  // CaseTask for the clinician who administers it.\n  recordQuickCheck(\n    patientId: string,\n    answers: { \"phq-2\"?: ScreenerAnswer[]; \"gad-2\"?: ScreenerAnswer[] },\n    opts: { actorRole?: string } = {},\n  ): {\n    results: ScreenerResult[];\n"
      ],
      [
        "    const completedAt = new Date().toISOString();\n    for (const def of SHORT_FORM_SCREENERS) {\n      const items = answers[def.key as \"phq-2\" | \"gad-2\"];\n      if (!items || items.length === 0) continue;\n      // \u00a7R5 \u2014 a blank shown item makes the quick check incomplete: no score, no escalation.\n      const qc = assessCompleteness(def, items);\n      if (!qc.complete) {\n        AdelanteEHR.recordIncompleteScreener(patientId, { key: def.key, status: \"incomplete\", completedAt, timepoint: \"adhoc\", shownCount: qc.shownCount, answeredCount: qc.answeredCount, responses: qc.responses, unansweredItems: qc.unansweredItems, notAskedItems: qc.notAskedItems });\n        continue;\n      }\n      const score = items.reduce((a, b) => a + (Number(b) || 0), 0);\n      const result: ScreenerResult = {\n        key: def.key,\n        score,\n        severity: _severityFor(def, score),\n        completedAt,\n        timepoint: \"adhoc\",\n      };\n",
        "    const completedAt = new Date().toISOString();\n    for (const def of SHORT_FORM_SCREENERS) {\n      const items = answers[def.key as \"phq-2\" | \"gad-2\"];\n      if (!items) continue;\n      // \u00a7R5 \u2014 a blank shown item makes the quick check incomplete: no score, no escalation.\n      const qc = assessCompleteness(def, items);\n      if (!qc.complete) {\n        AdelanteEHR.recordIncompleteScreener(patientId, { key: def.key, status: \"incomplete\", completedAt, timepoint: \"adhoc\", shownCount: qc.shownCount, answeredCount: qc.answeredCount, responses: qc.responses, unansweredItems: qc.unansweredItems, notAskedItems: qc.notAskedItems, declinedItems: qc.declinedItems, skippedItems: qc.skippedItems });\n        continue;\n      }\n      const score = (qc.scoringAnswers ?? []).reduce((a, b) => a + b, 0);\n      const result: ScreenerResult = {\n        key: def.key,\n        score,\n        severity: _severityFor(def, score),\n        responses: qc.responses,\n        declinedItems: qc.declinedItems, skippedItems: qc.skippedItems,\n        completedAt,\n        timepoint: \"adhoc\",\n      };\n"
      ],
      [
        "  completeRescreen(\n    patientId: string,\n    key: string,\n    answers: number[],\n    actor: { actorId: string; actorRole: string },\n  ): ScreenerResult {\n    const p = patients.find((x) => x.id === patientId);\n    if (!p) throw new Error(\"Patient not found.\");\n    const def = activeScreenerByKey(key);\n    if (!def || !rescreenRule(key)) throw new Error(\"Unknown questionnaire.\");\n    if (def.isSud && !AdelanteEHR.isConsentCategoryAuthorized(patientId, \"sud_treatment\"))\n      throw new Error(\"This questionnaire needs substance-use consent on file.\");\n    if (!screenerComplete(def, answers))\n      throw new Error(`Please answer all ${def.questions.length} questions.`);\n    // \u00a7R5 \u2014 gated items are \"not asked\" and take the instrument's published\n    // value (0) only for scoring; they are listed in notAskedItems.\n    const rc = assessCompleteness(def, answers);\n    answers = rc.scoringAnswers ?? answers;\n    const due = AdelanteEHR.rescreensDue(patientId).find((d) => d.key === key);\n    const scored = scoreScreener(def, answers);\n    const result: ScreenerResult = {\n      key,\n      score: scored.score,\n      severity: scored.severity,\n      completedAt: new Date().toISOString(),\n      timepoint: due ? (`day${due.nextDue}` as const) : \"adhoc\",\n      responses: answers,\n      ...(rc.notAskedItems.length ? { notAskedItems: rc.notAskedItems } : {}),\n      context: \"patient_self\",\n      ...(scored.domains ? { domains: scored.domains } : {}),\n      // Same item-9 rule intake applies.\n      crisisFlag: key === \"phq-9\" && (answers[8] ?? 0) > 0,\n      ...(scored.positive !== undefined ? { positive: scored.positive } : {}),\n    };\n    AdelanteEHR.recordScreener(patientId, result);\n    const closed: string[] = [];\n    for (const t of p.tasks ?? []) {\n      if (t.kind === \"rescreen\" && !t.completedAt && t.screenerKey === key) {\n",
        "  completeRescreen(\n    patientId: string,\n    key: string,\n    answers: ScreenerAnswer[],\n    actor: { actorId: string; actorRole: string },\n  ): ScreenerResult | IncompleteScreener {\n    const p = patients.find((x) => x.id === patientId);\n    if (!p) throw new Error(\"Patient not found.\");\n    const def = activeScreenerByKey(key);\n    if (!def || !rescreenRule(key)) throw new Error(\"Unknown questionnaire.\");\n    if (def.isSud && !AdelanteEHR.isConsentCategoryAuthorized(patientId, \"sud_treatment\"))\n      throw new Error(\"This questionnaire needs substance-use consent on file.\");\n    // R5 follow-ups. Draft \u2014 pending clinical sign-off: member blanks are allowed.\n    const due = AdelanteEHR.rescreensDue(patientId).find((d) => d.key === key);\n    const result = writeMemberScreener(patientId, def, answers, {\n      timepoint: due ? (`day${due.nextDue}` as const) : \"adhoc\", context: \"patient_self\",\n    });\n    if (\"status\" in result) return result;\n    const closed: string[] = [];\n    for (const t of p.tasks ?? []) {\n      if (t.kind === \"rescreen\" && !t.completedAt && t.screenerKey === key) {\n"
      ],
      [
        "\n    episodeId: string;\n    screenerKey: string;\n    answers: number[];\n    attribution: CfAttribution;\n  }): ScreenerResult {\n    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);\n    if (!ep) throw new Error(\"Pre-release episode not found.\");\n    const def = screenerByKey(input.screenerKey);\n",
        "\n    episodeId: string;\n    screenerKey: string;\n    answers: ScreenerAnswer[];\n    attribution: CfAttribution;\n  }): ScreenerResult | IncompleteScreener {\n    const ep = AdelanteEHR.getPreReleaseEpisode(input.episodeId);\n    if (!ep) throw new Error(\"Pre-release episode not found.\");\n    const def = screenerByKey(input.screenerKey);\n"
      ],
      [
        "      const gate = AdelanteEHR.preReleaseCapacityState(ep.id).decision;\n      if (!gate.canProceed) throw new Error(gate.reason);\n    }\n    if (input.answers.length !== def.questions.length || !screenerComplete(def, input.answers))\n      throw new Error(`${def.name} requires all ${def.questions.length} items.`);\n    const scored = scoreScreener(def, input.answers);\n    const result: ScreenerResult = {\n      key: def.key,\n      score: scored.score,\n      severity: scored.severity,\n      completedAt: new Date().toISOString(),\n      timepoint: \"intake\",\n      responses: input.answers,\n      context: \"pre_release\",\n      episodeId: ep.id,\n      administeredBy: input.attribution,\n",
        "      const gate = AdelanteEHR.preReleaseCapacityState(ep.id).decision;\n      if (!gate.canProceed) throw new Error(gate.reason);\n    }\n    if (input.answers.length !== def.questions.length || !staffItemsRecorded(def, input.answers))\n      throw new Error(`${def.name} requires all ${def.questions.length} items.`);\n    // Draft \u2014 pending clinical sign-off: staff must record each shown item, including declines.\n    const evidence = assessCompleteness(def, input.answers);\n    if (!evidence.complete) {\n      const incomplete: IncompleteScreener = { key: def.key, status: \"incomplete\", completedAt: new Date().toISOString(),\n        timepoint: \"intake\", context: \"pre_release\", ...evidence };\n      AdelanteEHR.recordIncompleteScreener(ep.patientId, incomplete);\n      return incomplete;\n    }\n    const scored = scoreScreener(def, evidence.scoringAnswers ?? []);\n    const result: ScreenerResult = {\n      key: def.key,\n      score: scored.score,\n      severity: scored.severity,\n      completedAt: new Date().toISOString(),\n      timepoint: \"intake\",\n      responses: evidence.responses,\n      notAskedItems: evidence.notAskedItems,\n      context: \"pre_release\",\n      episodeId: ep.id,\n      administeredBy: input.attribution,\n"
      ]
    ]
  },
  "src/routes/clinician.tsx": {
    "prior": "39ed372e819d4da271829095c28bca6cbb2d51e40621220281516b74bbcd9de0",
    "updated": "f7b04f574178b1cb07388023a9de3c76a7ad7bd92f5eb3d1062a1370f73b0653",
    "pairs": [
      [
        "import { useConfirmDialog } from \"@/components/staff/use-confirm-dialog\";\nimport { ChartAccessGate } from \"@/components/chart/ChartAccessGate\";\nimport { chartEntryFor } from \"@/lib/chartAccess\";\n",
        "import { estimateLabel } from \"@/lib/screenerCompleteness\";\nimport { useConfirmDialog } from \"@/components/staff/use-confirm-dialog\";\nimport { ChartAccessGate } from \"@/components/chart/ChartAccessGate\";\nimport { chartEntryFor } from \"@/lib/chartAccess\";\n"
      ],
      [
        "                \u00b7 {r.key.toUpperCase()}\n                {latest && (\n                  <span className=\"inline-flex items-center gap-1 text-xs text-muted-foreground\">\n                    \u00b7 {latest.score}\n                    {TrendIcon && <TrendIcon className={`h-3 w-3 ${trendCls}`} />}\n                    {prev && <span>vs {prev.score}</span>}\n                  </span>\n                )}\n                <span className=\"text-xs text-muted-foreground\">(day {r.nextDue} due)</span>\n",
        "                \u00b7 {r.key.toUpperCase()}\n                {latest && (\n                  <span className=\"inline-flex items-center gap-1 text-xs text-muted-foreground\">\n                    \u00b7 {latest.score} {estimateLabel(latest)}\n                    {TrendIcon && <TrendIcon className={`h-3 w-3 ${trendCls}`} />}\n                    {prev && <span>vs {prev.score} {estimateLabel(prev)}</span>}\n                  </span>\n                )}\n                <span className=\"text-xs text-muted-foreground\">(day {r.nextDue} due)</span>\n"
      ]
    ]
  },
  "src/lib/populationHealth.ts": {
    "prior": "6e5c89a30b73ef250aa7b35ded38f0a104fe29f0f0b5eca51ce457f1b271a697",
    "updated": "d170c0c5d1b3f64e2b0a3f0458b2954eeeb26053337e5ce7eafcc2de8f45c38f",
    "pairs": [
      [
        "  return uniq.map((k) => [k, PROGRAM_LABEL[k] ?? k]);\n}\n\nconst usable = (r: ScreenerResult | undefined): r is ScreenerResult => !!r && !r.retiredForm && !r.placeholderText;\n\nexport interface InstrumentTile {\n  key: string;\n",
        "  return uniq.map((k) => [k, PROGRAM_LABEL[k] ?? k]);\n}\n\nconst usable = (r: ScreenerResult | undefined): r is ScreenerResult => !!r && !r.estimated && !r.retiredForm && !r.placeholderText;\n\nexport interface InstrumentTile {\n  key: string;\n"
      ]
    ]
  }
} as Record<string, {prior: string; updated: string; pairs: [string,string][]}>;
export function withApprovedScreenerFollowupsOct30(path: string, source: string): string {
  const entry = APPROVED[path]; if (!entry) return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== entry.prior) throw new Error(`R5 follow-ups prior source changed: ${path}`);
  let text = source;
  for (const [from,to] of entry.pairs) {
    if (text.split(from).length !== 2) throw new Error(`R5 follow-ups anchor not exactly once: ${path}`);
    text = text.replace(from, () => to);
  }
  if (digest(text) !== entry.updated) throw new Error(`R5 follow-ups replacement changed: ${path}`);
  return text;
}
