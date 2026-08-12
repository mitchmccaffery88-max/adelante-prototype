---
name: Weekly recap
description: /weekly-recap real stats + one-off Adel reflection — what is computable, the anti-fabrication prompt contract, and the stats-only fallback
type: feature
---
- `/weekly-recap` shows REAL 7-day stats computed in `src/lib/weeklyRecap.ts`, then a one-off Adel reflection from `src/routes/api/adel-recap.ts` (same gateway/model as `/api/adel-chat`, non-streaming, no history, no ACTION tokens, no crisis path).
- Computable weekly: check-in DAYS (dose self-reports + short-form quick-check dates + daily mood check-in day keys) and medication (real `adherenceWeek` slots, patient self-report layer only).
- NOT computable weekly: lesson/exercise counts — `engagement.ts` stores undated id sets. Recap shows all-time totals + "active this week" from `lastActivityAt`, and says so in the UI. Never claim a weekly lesson count.
- Anti-fabrication: the recap route accepts NUMBERS ONLY (zod) and rebuilds the prompt server-side; prompt says invent nothing, ≤60 words, no clinical/scored words, no questions, no suggestions.
- Gating: no screener content, no drug names, no craving/lapse/emotion data ever reaches the stats or the model. Medication section is omitted entirely when nothing is scheduled.
- If the gateway is unconfigured/rate-limited/unreachable, the page falls back to stats-only with an honest note — never a templated fake "Adel" reflection.
