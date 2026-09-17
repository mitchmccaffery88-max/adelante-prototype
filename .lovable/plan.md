# Crisis copy in Spanish + real language preference sync

## What I found

**Crisis path (item 1).** Detection already fires before the model call and records which
patterns matched. Every Spanish pattern id is prefixed `es_` (`crisisTextDetection.ts`), so
the language signal genuinely already exists at the moment of the match — no new detection
is needed. What is hardcoded English today:
- Adel's canned crisis reply and the "Your care team has been alerted" label (`AdelChat.tsx`)
- Adel's always-visible crisis strip ("Need a person right now?", "Call 988", "Crisis support")
- The front-door live crisis block on "what brings you here" (`start.other-help.tsx`)

The shared `CrisisNotice` banner is already translated through the dictionary, so it needs
no work.

**Language preference (item 2).**
- `Patient.preferredLanguage` is real and stored; `AdelanteEHR.updateProfile` already accepts it.
- The UI language lives only in `localStorage["adelante.lang"]` and never reads or writes the record.
- The Profile "My profile" card shows Language as **display-only** text; editing is possible only
  by opening the staff-style Edit dialog, which already has a working language select.
- Intake's language question is a plain select in a long form section — I will report on its
  prominence after looking at it in the browser rather than changing it in this build.

## What I will build

### 1. Language-aware crisis copy
- `crisisTextDetection.ts`: add a pure `crisisMatchLanguage(patternIds)` returning `"es"` when any
  matched id is an `es_` pattern, otherwise `"en"`. Detection logic itself is untouched.
- New `src/lib/crisisCopy.ts`: one EN/ES copy table for the canned crisis reply, the
  "care team alerted" label, the crisis strip labels, and the front-door crisis block —
  including 988 wording ("Llama o envía un mensaje de texto al 988").
- `AdelChat.tsx` and `start.other-help.tsx` select copy by matched language; when nothing matched
  they fall back to the current UI language. No change to when interception fires.
- The Spanish copy carries a visible, clearly marked note in the source that it is **pending human
  clinical/translation review** — see the flag below.

### 2. Real `preferredLanguage` sync
- On session/patient load, initialize the UI language from the stored `preferredLanguage`
  (a stored value wins over the default English; an explicit in-session toggle still wins for that session).
- The header EN/ES toggle writes back to `preferredLanguage` via `AdelanteEHR.updateProfile`
  for the current patient, so the choice survives a reload.
- The Profile "My profile" card gets a real inline Language control — this is **new UI wiring, not a
  new field**: same record field, same helper the header toggle uses, so the two cannot drift.
- Both paths go through one shared helper so there is a single write site.

### Tests
- A Spanish-pattern match yields Spanish reply copy; an English match yields English.
- `crisisMatchLanguage` on mixed/no matches.
- Toggle and Profile control both write the same `preferredLanguage`; load initializes from it.

## Flag for you — Spanish crisis copy quality
I can produce accurate, plain, 5th-grade-level Spanish for this copy, but this is the highest-stakes
text in the product. I will mark it in the source as **pending review by a bilingual clinician
(Christi / Dr. Bagga's team)** and will not present it as validated. 988 does answer in Spanish, so
the number itself is unchanged.

## Not in this build
Library/Recovery/resource translation, Adel's own conversational language, and the English
ACTION-button labels.
