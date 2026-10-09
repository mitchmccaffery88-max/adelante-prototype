# SculptSoft handoff — consent workflow (Draft — pending counsel review)

All consent wording is **placeholder — pending counsel**. No counsel is engaged; sys_admin approval records "Counsel: pending".

## What the prototype does (in memory, `src/lib/consentForms.ts`)
- Versioned form library (10 forms), Draft → Legal review → Approved → Published; editing a published form creates a new version.
- Send one form or the pathway intake packet; neutral patient notice + Simulated SMS ("You have a form to review").
- Patient "Forms to sign": per-form checkbox, one signature step, Part 2 card, save/resume, decline, in-person tablet mode, guardian/proxy.
- Status Sent / Viewed / Signed / Declined / Expired; 3-day unsigned task; 30-day renewal task.
- Signed copy: frozen object with form id + version, language, full text, FNV-1a hash, method, signer + relationship, time, channel, sender; retainUntil = end + 10 years.
- Revoke: patient confirm step (optional reason) and staff revoke (reason required), care-impact warning; Part 2 re-locks SUD live.
- Group gate on group booking and group-join approval.

## What SculptSoft must provide
1. **E-signature vendor under a BAA** — replace the typed-name/checkbox/drawn stub with a vendor (e.g. DocuSign/Adobe Sign Healthcare) that returns an audit certificate; keep our one-signature-step UX.
2. **Document storage for signed copies** — write-once (WORM) object storage, encrypted, with the rendered PDF, the exact text and a SHA-256 hash (the prototype uses FNV-1a). Copies must never be editable.
3. **Retention jobs** — keep each copy until 10 years after the consent ends (revoked, expired or superseded), per WIC 14124.1 (Draft). Legal hold support; no deletion before retainUntil.
4. **Counsel approval workflow** — real reviewer identity, approval comments, and a block on publishing without counsel once counsel exists.
5. **Part 2 required-elements check** — validate every Part 2 form has the 42 CFR 2.31 elements (patient name, recipients, amount/kind, purpose, right to revoke, expiration, signature/date, re-disclosure notice) before publish.
6. **SMS delivery** — real sender (Twilio or similar) gated on SMS consent; neutral text only, never form names.
7. **Durable store** — requests, versions, signed copies and the ledger in a database with row-level access; sweeps (3-day task, expiry, renewal) as scheduled jobs.
8. **Legacy migration** — run `migrateLegacyConsents` once for every patient server-side (the prototype migrates lazily on first form action).
