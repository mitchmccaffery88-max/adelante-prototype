# B2-3 investigation: consentCaptureB2.spec.ts:45 failure (read-only)

## Already confirmed (read-only, this turn)
- HEAD is `cd1f4bb0`.
- `/tmp/b23-browser.log` no longer exists, and there is no `test-results/*consentCapture*` folder, so the original error text, trace and screenshot are gone. Step 1 has to come from a fresh reproduction (step 2).
- Diff 945a6ba8..HEAD: ConsentCapturePanel.tsx +76/-?, PatientConsentESign.tsx +37, consentCapture.ts +33, ChartExtraSections.tsx +2.

## Leading hypothesis: a deterministic B2-3 regression (still to be proven by the reruns)
- The spec's history-detail step is `e2e/consentCaptureB2.spec.ts:88`: `await row.getByRole("button").click();`, where `row` is `consent-history-telehealth`.
- In 945a6ba8, each history row held exactly one button: the record link.
- B2-3 added two more buttons to every **active** row, at `ConsentCapturePanel.tsx` (history `<li>`, about lines 112–113): `Renew` (`consent-renew-<id>`) and `Revoke` (`consent-revoke-<id>`). The telehealth upload is active, so the row now has 3 buttons. Playwright's strict mode then refuses `getByRole("button")`, so the test should fail every time, not just under timing.
- This would be a locator collision, not a re-render or `_emit()` effect. The gap panel mounts before the capture panel (ChartExtraSections +2 lines), which shifts layout but no locator depends on position.

## Steps to run once approved (no file edits)
1. Start a standalone run of `consentCaptureB2.spec.ts:45` 3x on :8080, `--workers=1`, in the background with `echo "EXIT $?"`, each polled to EXIT. Capture the error, locator, expected/received, and the trace/screenshot path from test-results.
2. Make a git archive of 945a6ba8 into /tmp/rb-945a, symlink node_modules, run vite on :8091, and run the same spec 3x with E2E_BASE_URL=http://localhost:8091. Poll each run to EXIT, then stop that server. No stash.
3. Diff all four files in full and note any other locator collisions: the sheet `getByRole("dialog")` vs the new ConfirmDialog (mounted only when asked); labels such as "Recipient"/"Purpose"; the `consent-esign-waiting` ordering.
4. Classify the cause: B2-3 regression (fails 3/3 on current, passes 3/3 on rollback), timing, or test-order dependence.

## Proposed fix if the hypothesis holds (app-side, restores B2-2 behaviour for that row)
- `ConsentCapturePanel.tsx` history row, current: Renew/Revoke `<Button>`s sit inside the same `<li data-testid="consent-history-<type>">` as the record link.
- Proposed: keep the row's only button as the record link. Move Renew and Revoke out of the history row and into the record-detail sheet (`consent-record-detail`), shown for active records under the same `showRenew`/`showRevoke` gates. The testids, handlers, registry calls and audits stay unchanged.
- Knock-on effect: `e2e/consentLifecycleB2.spec.ts` (new this batch) clicks `consent-renew-*`/`consent-revoke-*` from the row. It would need to open the detail first. That is a spec edit, listed separately for approval below.

## Spec edits (listed separately, not proposed for the B2-2 spec)
- Option, needs approval: `consentCaptureB2.spec.ts:88`, change `row.getByRole("button").click()` to `row.getByRole("button", { name: /Paper|Telehealth/ }).first()`. I don't recommend it, because the app-side fix restores the B2-2 contract.
- Required only with the app-side fix: update `e2e/consentLifecycleB2.spec.ts` to open the detail before Renew/Revoke. This is a this-batch test.

## Deliverable
A chat report with the six run results, the exact error, the trace path, the root cause and the file:line current/proposed. No files changed, no publish, no B2-4.
