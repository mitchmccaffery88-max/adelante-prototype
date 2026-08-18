# Import Adelante Journey patient experience into Adelante Pathways

Bring the Journey build's full patient content, layout and interaction fidelity into this project, without disturbing the clinical/staff side (RBAC, population gating, consent, content catalog all stay).

## What the comparison actually shows

| Area | Journey (source) | This build today |
| --- | --- | --- |
| Library | 9 categories, 90 lessons | 2 categories, 11 lessons |
| Exercises | 10 full exercises (trigger map, thought record, support circle, budget, communication script, slip plan, warning signs, milestone reward, urge surfing, box breathing) | small subset |
| Recovery Journey | 9 modules, all with generated lessons (learn / peer story / build-a-tool / practice / action / tool) | 9 modules, 7 marked "content pending", 10 lessons total |
| Resources | category → org browse + detail + saved, with search | single-page list |
| Adel chat | dedicated chat surface | present but thinner |
| Colors/typography | warm cream + deep teal + sage/amber OKLCH | already matched in `.patient-theme` |

So the color tokens already line up; the real gaps are **content volume, activity interactions, resource browse flow, and shell chrome**.

## Plan

### 1. Library — full 90-lesson port
- Port all 9 categories and 90 lessons from the Journey data files into `src/lib/library.ts`, mapped onto this project's stricter lesson schema (adds `categoryId`, `order`, population gate — left absent unless the copy genuinely references custody/release).
- Extend the activity renderer in `ModuleTemplate.tsx` to cover the Journey activity kinds this build doesn't render yet: card-sort buckets, decision-path with per-choice feedback, multi-slider states, reflection card tapping, scenario response, ordered timeline, paced breathing, 5-4-3-2-1 grounding.
- Port the remaining exercises into the exercise player.

### 2. Recovery Journey — remove every "content pending"
- Port the Journey module/lesson generator output into `src/lib/recovery.ts` so all 9 modules ship real lessons with the full five-step flow.
- Keep the existing progress, toolkit, Spanish-review flag and Module 1 reentry gate.

### 3. Resources — replace with the Journey set
- Replace the resource dataset with Journey's categories and org listings.
- Rebuild the surface as category grid → category listing → org detail, plus search and Saved, matching Journey's layout.
- Note: Journey's own file marks these listings as needing re-verification, so each imported org lands as **unverified** and flows through this build's existing staff verification queue rather than being presented to patients as confirmed.

### 4. Adel chat
- Match Journey's chat layout, message styling, suggestion chips and empty state, keeping this build's real streaming endpoint and crisis-detection bypass.

### 5. Shell and typography
- Align the patient-facing shell chrome to Journey's: sidebar wordmark, crisis-support pill header, mobile tab bar treatment, page heading scale and spacing rhythm.
- Keep this build's RBAC/population-aware nav filtering and role/context switching — only the chrome and type scale change.
- Add the soft-shadow / motion utilities Journey uses so cards and transitions feel identical.

### 6. Publish into the content catalog
- Every imported lesson and recovery lesson is also registered as a **published** catalog entry, so admins see and can edit the full set in `/admin-content` immediately, with the code modules as the baseline.

### 7. Verification
- Unit tests for content integrity (every lesson has all required steps; every module has lessons; no orphan category).
- Browser pass over Library, Recovery Journey, Resources, Adel and Home at mobile and desktop widths, checking for console errors and dead ends.

## Technical notes
- Staff, admin and advocate surfaces are untouched; imported content is patient-facing only.
- Population gating, 42 CFR Part 2 masking, and advocate progress rules continue to apply to all new content.
- Content is ported into this project's existing schemas rather than copying Journey's loose types, so nothing regresses on type safety or catalog compatibility.
