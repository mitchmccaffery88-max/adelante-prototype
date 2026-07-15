## Replace time text input with a friendly time picker + inline validation

Both check-in entry points (`CheckInCard` in `src/routes/case-manager.tsx` and `CheckInsTab` in `src/components/ClientRecordDrawer.tsx`) currently use a raw `<Input type="time" />`. On some browsers this renders as a bare text field where users can type "9pm" or "25:00", and errors only surface as a generic toast after clicking Save.

### New component: `src/components/TimePicker.tsx`

A small controlled component built from shadcn primitives:

- Two `Select` dropdowns side by side — Hour (1–12) and Minute (00, 05, 10 … 55) — plus an AM/PM toggle (`ToggleGroup` or a third `Select`).
- Value in/out is a canonical `HH:mm` 24-hour string so downstream `combineDateTime` / `new Date(\`${date}T${time}\`)` code is unchanged.
- Props: `value: string`, `onChange: (v: string) => void`, `error?: string`, `id?`, `aria-label?`.
- Renders a red ring + `<p className="text-xs text-destructive">` beneath when `error` is set (aria-invalid, aria-describedby).
- Nothing invalid is representable, so bad free-text formats can't be produced.

### Wire it into both check-in forms

In `CheckInCard` (case-manager.tsx, ~line 374) and `CheckInsTab` (ClientRecordDrawer.tsx, ~line 296):

1. Replace `<Input type="time" … />` with `<TimePicker value={time} onChange={setTime} error={timeError} />`.
2. Add `const [timeError, setTimeError] = useState<string | undefined>()` and a matching `dateError` for consistency (invalid `date` string).
3. Change the submit handler:
   - Clear both errors at start.
   - If `!date` → `setDateError("Pick a date")` and return (no toast).
   - If `!time` → `setTimeError("Pick a time")` and return.
   - If `combineDateTime` / `new Date(...)` yields `NaN` → `setTimeError("That time isn't valid")` and return.
   - Only fall back to `toast.error` for unexpected save failures, not for format issues.
4. Reset errors when the form resets after a successful save.

### Out of scope

- No changes to `AdelanteEHR.addCheckIn` or the stored `CheckIn.date` shape.
- No date-picker replacement — `<Input type="date">` stays; only its inline error is added.
- No i18n string additions beyond the two new English error messages (matches surrounding copy).
- No changes to any other `type="time"` usage outside these two check-in forms.
