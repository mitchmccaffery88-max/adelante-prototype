---
name: Adel conversational assistant
description: Real Adel chat — gateway server route, prompt discipline, crisis bypass via Phase 1, and the HELD transcript-retention decision
type: feature
---
- `/adel` is a real streaming chat: `src/routes/api/adel-chat.ts` → Lovable AI Gateway (`google/gemini-2.5-flash`), prompt built in `src/lib/adelPrompt.ts`.
- Prompt rules are clinical policy: non-diagnostic, <120 words, 5th-grade reading level, never shames, 2–4 turns before one (max) suggestion, no scored/clinical words ("elevated", "PHQ").
- Crisis: chat calls the REAL Phase 1 `detectCrisisLanguage`/`scanTextForCrisis`. Never add a second crisis regex. A tripped message never reaches the LLM.
- ACTION tokens must resolve to real destinations (`resolveAdelAction`); unresolvable tokens are dropped, never rendered.
- HELD: warm-handoff auto-notification and Adel transcript logging/retention (Part 2 coverage) are open decisions for Christi / Dr. Bagga. Until resolved: never auto-notify, never persist the transcript.
