# Clinician day-to-day readiness check (investigation only)

No code changes. One browser tab, desktop, no reloads. The report covers only what I see on screen, in under 400 words, rated works / partial / missing, plus demo cautions.

## 1. Start-of-day view
- As Dr. Bagga (PMHNP), then Dr. Reyes (therapist), open My work / Worklist / home.
- For each item, record shown or missing and compare the count with the source screen:
  today's visits, unsigned notes, cosigns owed, refill requests, crisis items for their patients, tasks due, reassessments or screeners due.
- To check counts, compare against the Unsigned notes queue, Inbox, Crisis queue, and the rescreen list on a chart.

## 2. Refill review (PMHNP)
- As Dr. Bagga, open a pending refill request. Record what it shows: last fill, adherence, side effects, controlled status or CURES.
- Approve one request and deny one. Note whether a denial reason is required.
- Switch to that patient and check whether they see the outcome.
- Note: this changes demo data for this session only. It resets when the app restarts.

## 3. Problem list and care/treatment plan
- On Luis's chart and Rosa's chart (opened through search): check the problem list for ICD-10 codes, start dates and status.
- Check the care/treatment plan for goals, a review date, and clinician and patient signatures.
- Look for a "plan review due" reminder on the chart, on My work and in tasks.

## 4. Measurement over time
- On a chart, look for PHQ-9 and GAD-7 scores over time (as a trend or a list) with the last-completed date.

## Technical details
- Use the existing Playwright helpers in /tmp/browser/p2/, switching roles with the demo role control.
- Check page text against the store (listUnsignedWork, listRefillRequests, rescreensDue) by reading the code only. Nothing gets edited.
