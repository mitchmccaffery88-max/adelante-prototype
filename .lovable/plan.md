## Add date & time fields to "Log check-in"

Currently `CheckInCard` in `src/routes/case-manager.tsx` stamps the check-in with `new Date().toISOString()` automatically. Staff can't back-date a phone call or record an in-person visit that happened yesterday.

### Change

Add editable **Date** and **Time** inputs to the Weekly check-in card so the logged timestamp reflects when the contact actually occurred.

### Implementation (single file: `src/routes/case-manager.tsx`)

1. In `CheckInCard`, add two new state values:
   - `date` — defaults to today (`YYYY-MM-DD`)
   - `time` — defaults to current local time (`HH:mm`)
2. Render them as a two-column row above the Modality select:
   - `<Input type="date" />` labeled "Date"
   - `<Input type="time" />` labeled "Time"
3. On submit, combine into a local `Date` and pass its ISO string into `AdelanteEHR.addCheckIn(..., { date: combined.toISOString(), ... })`.
4. Validate: if either field is empty, show `toast.error("Add date and time")` and abort.
5. After success, reset date/time back to "now" alongside the existing notes reset.
6. Mirror the same pattern in the `ClientRecordDrawer` check-ins tab if it has an equivalent quick-log form, so both entry points behave the same. (Will confirm during implementation and update only if present.)

### Out of scope

- No EHR model changes (`CheckIn.date` already stores an ISO string).
- No timezone picker — uses the browser's local timezone, same as the rest of the app.
- No edit-after-save UI for existing check-ins.
