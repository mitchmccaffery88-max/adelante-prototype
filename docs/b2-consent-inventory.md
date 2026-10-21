# B2-0 — Consent inventory freeze (Oct 21)

Rollback SHA (HEAD before B2-0): ee589ba213927052c26ffa6acaba8da20f1ad6f9. No behaviour change in this batch. Pinned by `src/lib/__tests__/consentInventoryB2.test.ts`.

Read sources: **flag** = legacy Patient fields (`consents.*`, `consentState`, `sudCoordinationConsent`, `sudCounselingNotesRelease`); **ledger** = ConsentRecord store (`isConsentCategoryAuthorized`, `activeConsentRecord`, …); **mixed** = writes a flag and mirrors it into the ledger; **separate store** = referrer authorization, group-consent gate, coordinator emergency grants; **consent-form store** = `consentForms.ts` requests/versions/signed copies, which write the ledger.

## Section A — enforcement points (hand-reviewed)

| Gate | File:line | Reads |
|---|---|---|
| Central category check (live) | src/lib/ehr.ts:12697 | ledger; LEGACY FALLBACK at :12703-12708 grants `sud_treatment` from flag when no record exists |
| getConsentState (part2Sud derived; sms, ecmShare) | src/lib/ehr.ts:12657-12676 | part2Sud ledger; sms/ecmShare flag (`consentState`) |
| SMS allowed | src/lib/ehr.ts:12941 | flag `consentState.sms` / `smsFallback` |
| ECM share prompt | src/lib/ehr.ts:12979, :12992 | flag `consentState.ecmShare` |
| Coordinator SUD access (TPO / specific) | src/lib/coordinatorSudAccess.ts:32 | **flag** `sudCoordinationConsent` OR separate store (emergency grant) |
| Coordinator counseling notes | src/lib/coordinatorSudAccess.ts:30 | **flag** `sudCounselingNotesRelease` |
| Coordinator emergency path | src/lib/coordinatorSudAccess.ts:22-54, src/lib/coordinatorSudEmergency.ts | separate store (stays separate in B2) |
| Coordinator panel refresh key | src/components/chart/CoordinatorSudPanel.tsx:23 | flag (re-render key only) |
| ASAM consent cohort (sys_admin aggregates) | src/lib/asamReporting.ts:92 | **flag** `sudCoordinationConsent` AND `consents.part2Sud` |
| Coordination tab Part 2 prop | src/components/clinical/recordSections.tsx:500 | **flag** `consents.part2Sud` (not the ledger) |
| Onboarding complete | src/lib/onboarding.ts:18 | flag `consents.hipaa` + `signedAt` |
| Intake consent recap | src/routes/intake.tsx:590-593 | flag hipaa/signedAt; part2 via ledger |
| Consent page HIPAA line | src/routes/consent.tsx:140 | flag `consents.hipaa` |
| Adel brief Part 2 missing / cache keys | src/lib/adelBrief.ts:297, :361, :408; adelBriefCheck.ts:250 | getConsentState (ledger) + flag key at :408 |
| Role access (screeners_sud etc.) | src/lib/roles.ts | ledger |
| Part 2 disclosure | src/lib/part2Disclosure.ts:143-175 `part2ConsentFor` | ledger + legal disclosure list |
| Care-partner link | src/lib/carePartners.ts:182 | ledger via part2ConsentFor |
| Advocate SUD disclosure | src/lib/ehr.ts:6288 | ledger `advocate_sud_disclosure` |
| Advocate invite delivery | src/lib/advocateInviteDelivery.ts:12-13 | ledger `roi_collateral` / `advocate_sud_disclosure` |
| AB 133 third-party | src/lib/ab133.ts:119 | ledger |
| PO voluntary | src/lib/poDisclosure.ts:201 | ledger |
| Telehealth booking | src/lib/ehr.ts:9241; bookingFlow.ts:82 | ledger |
| Group booking / join | src/lib/ehr.ts:9244; bookingFlow.ts:85 (gate injected at consentForms.ts:556) | separate store (form requests) |
| Legal Part 2 disclosure | src/lib/ehr.ts:10090 | ledger |
| SUD treatment reads | src/lib/ehr.ts:11351, :11446; chartOrders.ts:194; hie.ts:120-181; outpatientCare.ts | ledger |
| AI recording | src/lib/scribe.ts:186-266 | ledger |
| Referrer updates (P3) | src/lib/referrerUpdateGate.ts:23-40; referrerAuthorizationStore.ts:21-55; ReferrerAuthorizationCard.tsx | separate store |
| Disclosure audit | src/lib/consentAudit.ts:19; printRecord.ts | ledger |

## Section B — writers

| Writer | File:line | Writes |
|---|---|---|
| createConsentRecord (supersedes prior active) | src/lib/ehr.ts:12714-12750 | ledger |
| revokeConsentRecord | src/lib/ehr.ts:12771; registry chartActions.ts:753 | ledger |
| setConsent / staffSetConsent / patientWithdrawConsent | src/lib/ehr.ts:12807-12880; registry chartActions.ts:1021 | mixed (flag + ledger mirror; `consents.part2Sud =` at :12874) |
| Intake completion | src/lib/ehr.ts:8747-8752 | flag (`consents` hipaa/part2Sud/signedAt) |
| Forms signing / revoke / legacy migration | src/lib/consentForms.ts:285-426 (`signChecked`, `migrateLegacyConsents` :377-390 reads hipaa flag) | ledger + mixed |
| AI consent capture | src/lib/scribe.ts:243, :266 | ledger |
| Demo seeds | src/lib/ehr.ts:6466 (ledger seed); patient `consents:` literals; identityDemoSeed.ts:51; billingLifecycleScenario.ts:48; DemoStateSwitcher.tsx | ledger / flag / mixed |
| Referrer authorization | src/lib/referrerAuthorizationStore.ts:26, :39 | separate store |

## Findings for B2-1 onward
- `sudCoordinationConsent` and `sudCounselingNotesRelease` have **no production writer**; only tests set them. In the default seed no patient has them, so coordinator non-emergency SUD access and counseling-note access are already zero in demos. Migrating them to legacyUnverified changes no default-seed access.
- Flag-based gates that must switch to the record: coordinatorSudAccess.ts:30/:32, asamReporting.ts:92, recordSections.tsx:500, onboarding.ts:18, intake.tsx:590, consent.tsx:140, ehr.ts:12941/:12979/:12992, and the legacy fallback ehr.ts:12703-12708.
- Every reader was classifiable (Appendix A: 0 unclassified). No stop.


## Appendix A — every matching line (generated, B2-0 freeze)

Kind is a text heuristic; Section A rows above are hand-reviewed and take precedence.

| File:line | Kind | Reads | Code |
|---|---|---|---|
| src/components/DemoStateSwitcher.tsx:239 | gate/reader | ledger | `if (AdelanteEHR.isConsentCategoryAuthorized(patientId, COLLATERAL_ROI_CATEGORY)) return;` |
| src/components/DemoStateSwitcher.tsx:240 | reader | ledger | `const prior = AdelanteEHR.activeConsentRecord(patientId);` |
| src/components/DemoStateSwitcher.tsx:245 | writer | ledger | `AdelanteEHR.createConsentRecord({` |
| src/components/PatientHome.tsx:2 | import | consent-form store (writes ledger) | `import { FormsToSign } from "@/components/consent/FormsToSign";` |
| src/components/PatientHome.tsx:3 | import | consent-form store (writes ledger) | `import { GroupConsentPrompt } from "@/components/consent/PatientSignedForms";` |
| src/components/PatientHome.tsx:4 | import | label/UI text or type only | `import { AdvocateConsentStatus } from "@/components/consent/AdvocateConsentStatus";` |
| src/components/PatientHome.tsx:295 | reader | label/UI text or type only | `{/* §Group 2 O2 — "Sign later": the waiting advocate consent shows here. */}` |
| src/components/PatientHome.tsx:296 | gate/reader | consent-form store (writes ledger) | `<FormsToSign patientId={patient.id} lang={patient.preferredLanguage === "es" ? "es" : "en"} />` |
| src/components/PatientHome.tsx:297 | gate/reader | label/UI text or type only | `<GroupConsentPrompt patientId={patient.id} lang={patient.preferredLanguage === "es" ? "es" : "en"} />` |
| src/components/PatientHome.tsx:298 | reader | label/UI text or type only | `<AdvocateConsentStatus patientId={patient.id} />` |
| src/components/PatientHome.tsx:376 | reader | label/UI text or type only | `{t("homeConsentNote")}` |
| src/components/PatientHome.tsx:433 | comment | label/UI text or type only | `// Same consent field the Privacy & Consent card reads/writes.` |
| src/components/PatientHome.tsx:434 | reader | mixed (flag + ledger mirror) | `const part2Consent = useEhr(() => AdelanteEHR.getConsentState(patientId).part2Sud);` |
| src/components/PatientHome.tsx:512 | gate/reader | label/UI text or type only | `{sensitive && !part2Consent && (` |
| src/components/PatientHome.tsx:514 | reader | label/UI text or type only | `{t("msgSensitiveConsentOff")}` |
| src/components/PatientProfileDialog.tsx:95 | reader | label/UI text or type only | `"en": "Consents",` |
| src/components/PatientProfileDialog.tsx:96 | reader | label/UI text or type only | `"es": "Consentimientos"` |
| src/components/PatientProfileDialog.tsx:107 | reader | label/UI text or type only | `"en": "Recent consent changes",` |
| src/components/PatientProfileDialog.tsx:108 | reader | label/UI text or type only | `"es": "Cambios recientes en el consentimiento"` |
| src/components/PatientProfileDialog.tsx:129 | comment | label/UI text or type only | `/** When true, also surface read-only program/consent summary (admin view). */` |
| src/components/PatientProfileDialog.tsx:137 | reader | label/UI text or type only | `const consentEvents = useEhr(() => AdelanteEHR.listAllConsentEvents());` |
| src/components/PatientProfileDialog.tsx:208 | reader | mixed (flag + ledger mirror) | `const consent = AdelanteEHR.getConsentState(patient.id);` |
| src/components/PatientProfileDialog.tsx:209 | reader | label/UI text or type only | `const eventsForPatient = consentEvents` |
| src/components/PatientProfileDialog.tsx:383 | gate/reader | derived key (getConsentState / intake payload / withdraw purpose) | `className={consent.part2Sud ? "border-teal/40 text-teal" : ""}` |
| src/components/PatientProfileDialog.tsx:385 | gate/reader | derived key (getConsentState / intake payload / withdraw purpose) | `Part 2 SUD: {consent.part2Sud ? "On" : "Off"}` |
| src/components/PatientProfileDialog.tsx:389 | gate/reader | label/UI text or type only | `className={consent.ecmShare ? "border-teal/40 text-teal" : ""}` |
| src/components/PatientProfileDialog.tsx:391 | gate/reader | label/UI text or type only | `{SCREEN_COPY["ui.b8a08bcacf48"][screenLang]} {consent.ecmShare ? "On" : "Off"}` |
| src/components/PatientProfileDialog.tsx:393 | gate/reader | label/UI text or type only | `<Badge variant="outline" className={consent.sms ? "border-teal/40 text-teal" : ""}>` |
| src/components/PatientProfileDialog.tsx:394 | gate/reader | label/UI text or type only | `{SCREEN_COPY["ui.d0a79c78aca0"][screenLang]} {consent.sms ? "On" : "Off"}` |
| src/components/admin/ConsentFormLibrary.tsx:3 | comment | label/UI text or type only | `// §Consent W1 — Legal & consent: versioned form templates.` |
| src/components/admin/ConsentFormLibrary.tsx:11 | import | consent-form store (writes ledger) | `import { listFormVersions, CONSENT_DRAFT_LABEL, PLACEHOLDER_WORDING, type FormKey, type FormVersion } from "@/` |
| src/components/admin/ConsentFormLibrary.tsx:20 | definition | consent-form store (writes ledger) | `export function ConsentFormLibrary() {` |
| src/components/admin/ConsentFormLibrary.tsx:24 | reader | consent-form store (writes ledger) | `const all = JSON.parse(useEhr(() => JSON.stringify(listFormVersions()))) as FormVersion[];` |
| src/components/admin/ConsentFormLibrary.tsx:35 | reader | label/UI text or type only | `<Card className="space-y-3 p-4" data-testid="consent-form-library">` |
| src/components/admin/ConsentFormLibrary.tsx:37 | reader | label/UI text or type only | `<h2 className="font-semibold text-navy">Legal &amp; consent forms</h2>` |
| src/components/admin/ConsentFormLibrary.tsx:46 | reader | label/UI text or type only | `<li key={k} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid={'consent-form-${k}` |
| src/components/admin/ConsentFormLibrary.tsx:51 | gate/reader | consent-form store (writes ledger) | `{latest.status === "draft" && <Button size="sm" variant="outline" onClick={() => run("consent_form_author", "s` |
| src/components/admin/ConsentFormLibrary.tsx:52 | gate/reader | consent-form store (writes ledger) | `{latest.status === "legal_review" && <Button size="sm" variant="outline" onClick={() => run("consent_form_publ` |
| src/components/admin/ConsentFormLibrary.tsx:60 | reader | label/UI text or type only | `title="Publish this consent form?" confirmLabel="Publish consent form" keepLabel="Keep consent form" requireRe` |
| src/components/admin/ConsentFormLibrary.tsx:64 | reader | consent-form store (writes ledger) | `const r = runAction("consent_form_publish", actor, undefined, { via: "publishForm", args: [publishId, storeAct` |
| src/components/admin/ConsentFormLibrary.tsx:73 | reader | consent-form store (writes ledger) | `<Button className="mt-3 w-full" onClick={() => { run("consent_form_author", "editForm", [edit, { summary: { en` |
| src/components/chart/ChartTabView.tsx:187 | reader | ledger | `const n = AdelanteEHR.listConsentRecords(p.id).length;` |
| src/components/chart/CoordinatorSudPanel.tsx:5 | import | separate store | `import { coordinatorEmergencyFor, coordinatorSudCanRead, EMERGENCY_REASONS, COORDINATOR_SUD_DRAFT, type Emerge` |
| src/components/chart/CoordinatorSudPanel.tsx:23 | reader | flag, separate store | `const version = useEhr(() => JSON.stringify([patient.sudCoordinationConsent, patient.sudCounselingNotesRelease` |
| src/components/chart/CoordinatorSudPanel.tsx:27 | gate/reader | separate store | `const grant = now === null ? undefined : coordinatorEmergencyFor(actor, patient.id, now);` |
| src/components/clinical/recordSections.tsx:434 | comment | label/UI text or type only | `// §Advocate build 1 — advocate connections are consent instruments, so they` |
| src/components/clinical/recordSections.tsx:435 | comment | label/UI text or type only | `// ride the consent-ledger class: ECM Provider and Administrator write (the` |
| src/components/clinical/recordSections.tsx:437 | reader | label/UI text or type only | `add("consent_ledger", {` |
| src/components/clinical/recordSections.tsx:500 | reader | flag | `<CoordinationTab patientId={pid} part2Consent={patient.consents.part2Sud} />` |
| src/components/consent/AdvocateConsentStatus.tsx:1 | comment | label/UI text or type only | `// §F1 — the ONE advocate consent path. The old typed-name advocate card` |
| src/components/consent/AdvocateConsentStatus.tsx:2 | comment | label/UI text or type only | `// is retired; advocate consent is the versioned "advocate_patient" form signed` |
| src/components/consent/AdvocateConsentStatus.tsx:4 | comment | label/UI text or type only | `// to the chart Consents section (staff). It never writes.` |
| src/components/consent/AdvocateConsentStatus.tsx:7 | import | consent-form store (writes ledger) | `import { advocateConsentFormStatus, CONSENT_DRAFT_LABEL, type AdvocateFormStatus } from "@/lib/consentForms";` |
| src/components/consent/AdvocateConsentStatus.tsx:15 | definition | label/UI text or type only | `status: { signed: "Advocate consent form: signed", waiting: "Advocate consent form: waiting for your signature` |
| src/components/consent/AdvocateConsentStatus.tsx:17 | definition | label/UI text or type only | `staffOpen: "Open chart consents",` |
| src/components/consent/AdvocateConsentStatus.tsx:21 | definition | label/UI text or type only | `status: { signed: "Formulario de consentimiento del defensor: firmado", waiting: "Formulario de consentimiento` |
| src/components/consent/AdvocateConsentStatus.tsx:23 | definition | label/UI text or type only | `staffOpen: "Abrir consentimientos del expediente",` |
| src/components/consent/AdvocateConsentStatus.tsx:27 | definition | label/UI text or type only | `export function AdvocateConsentStatus({ patientId, audience = "patient" }: { patientId: string; audience?: "pa` |
| src/components/consent/AdvocateConsentStatus.tsx:30 | reader | label/UI text or type only | `const status = useEhr(() => advocateConsentFormStatus(patientId));` |
| src/components/consent/AdvocateConsentStatus.tsx:34 | reader | label/UI text or type only | `<Card className="space-y-3 p-4" data-testid="advocate-consent-status">` |
| src/components/consent/AdvocateConsentStatus.tsx:46 | reader | label/UI text or type only | `<Link to="/record/$patientId" params={{ patientId }} search={{ section: "consents" } as never} className="inli` |
| src/components/consent/ConsentFormsPanel.tsx:3 | comment | label/UI text or type only | `// §Consent W2/W4/W5/W6 — staff side in the chart's Consents section: send,` |
| src/components/consent/ConsentFormsPanel.tsx:12 | gate/reader | separate store | `listPublishedForms, listRequests, listSignedCopies, renewalsDue, intakePacketFor, CARE_IMPACT, STATUS_LABEL, C` |
| src/components/consent/ConsentFormsPanel.tsx:13 | reader | consent-form store (writes ledger) | `} from "@/lib/consentForms";` |
| src/components/consent/ConsentFormsPanel.tsx:20 | import | consent-form store (writes ledger) | `import { FormsToSign } from "./FormsToSign";` |
| src/components/consent/ConsentFormsPanel.tsx:22 | definition | consent-form store (writes ledger) | `export function ConsentFormsPanel({ patient }: { patient: Patient }) {` |
| src/components/consent/ConsentFormsPanel.tsx:26 | gate/reader | separate store | `const snap = JSON.parse(useEhr(() => JSON.stringify({ reqs: listRequests(patient.id), copies: listSignedCopies` |
| src/components/consent/ConsentFormsPanel.tsx:27 | definition | consent-form store (writes ledger) | `reqs: ReturnType<typeof listRequests>; copies: ReturnType<typeof listSignedCopies>; forms: ReturnType<typeof l` |
| src/components/consent/ConsentFormsPanel.tsx:47 | reader | label/UI text or type only | `<section className="rounded-md border border-border p-3 space-y-3" data-testid="consent-forms-panel">` |
| src/components/consent/ConsentFormsPanel.tsx:54 | reader | consent-form store (writes ledger) | `<Button size="sm" variant="outline" data-testid="send-intake-packet" onClick={() => run("consent_form_send", "` |
| src/components/consent/ConsentFormsPanel.tsx:60 | gate/reader | label/UI text or type only | `{snap.gate && <p className="rounded bg-amber-500/10 p-2 text-xs font-medium" data-testid="group-consent-needed` |
| src/components/consent/ConsentFormsPanel.tsx:69 | gate/reader | consent-form store (writes ledger) | `{snap.renew.includes(r.formKey) && <Button size="sm" variant="ghost" onClick={() => run("consent_form_send", "` |
| src/components/consent/ConsentFormsPanel.tsx:100 | gate/reader | consent-form store (writes ledger) | `<Button className="mt-3 w-full" disabled={!pick.length} onClick={() => { if (run("consent_form_send", "sendFor` |
| src/components/consent/ConsentFormsPanel.tsx:130 | gate/reader | consent-form store (writes ledger) | `<Button className="mt-3 w-full" variant="outline" disabled={reason.trim().length < 3} onClick={() => { if (run` |
| src/components/consent/ConsentFormsPanel.tsx:138 | reader | consent-form store (writes ledger) | `<FormsToSign patientId={patient.id} lang={lang} channel="in_person" patientName={'${patient.firstName} ${patie` |
| src/components/consent/ConsentRecordsPanel.tsx:59 | reader | ledger | `const records = useEhr(() => AdelanteEHR.listConsentRecords(patient.id));` |
| src/components/consent/ConsentRecordsPanel.tsx:86 | writer | ledger | `AdelanteEHR.createConsentRecord({` |
| src/components/consent/ConsentRecordsPanel.tsx:114 | writer | ledger | `onConfirm: reason => { confirmedAction("consent_capture", "revokeConsentRecord", patient.id, reason, id, { rea` |
| src/components/consent/FormsToSign.tsx:9 | import | ledger | `import { formsToSign, setChecked, declineForm, signChecked, markViewed, CONSENT_DRAFT_LABEL, type FormKey } fr` |
| src/components/consent/FormsToSign.tsx:37 | writer | ledger | `signChecked({ patientId, signerName: name, relationship: rel, channel, language: lang, ...(needTyped ? { typed` |
| src/components/consent/PatientConsentStatusCard.tsx:45 | reader | ledger | `const records = useEhr(() => AdelanteEHR.listConsentRecords(patientId));` |
| src/components/consent/PatientSignedForms.tsx:1 | comment | label/UI text or type only | `// §Consent W6 — patient "Stop sharing" for signed forms: confirm step with a` |
| src/components/consent/PatientSignedForms.tsx:6 | import | separate store | `import { listSignedCopies, revokeForm, CARE_IMPACT, groupConsentGate, reopenForPatient, type FormKey } from "@` |
| src/components/consent/PatientSignedForms.tsx:9 | import | consent-form store (writes ledger) | `import { FormsToSign } from "./FormsToSign";` |
| src/components/consent/PatientSignedForms.tsx:11 | definition | consent-form store (writes ledger) | `export function PatientSignedForms({ patientId, lang = "en" }: { patientId: string; lang?: "en" \| "es" }) {` |
| src/components/consent/PatientSignedForms.tsx:12 | gate/reader | consent-form store (writes ledger) | `const rows = JSON.parse(useEhr(() => JSON.stringify(listSignedCopies(patientId).filter((r) => !r.ended)))) as ` |
| src/components/consent/PatientSignedForms.tsx:32 | gate/reader | consent-form store (writes ledger) | `<Button variant="outline" className="min-h-11" onClick={() => { try { revokeForm({ patientId, formKey: c.formK` |
| src/components/consent/PatientSignedForms.tsx:44 | comment | label/UI text or type only | `/** W7 one-card group prompt — shown only when group booking is blocked by consent. */` |
| src/components/consent/PatientSignedForms.tsx:45 | definition | label/UI text or type only | `export function GroupConsentPrompt({ patientId, lang = "en" }: { patientId: string; lang?: "en" \| "es" }) {` |
| src/components/consent/PatientSignedForms.tsx:46 | gate/reader | separate store | `const blocked = useEhr(() => groupConsentGate(patientId));` |
| src/components/consent/PatientSignedForms.tsx:51 | reader | label/UI text or type only | `<div className="patient-theme rounded-3xl border p-4" data-testid="group-consent-prompt">` |
| src/components/consent/PatientSignedForms.tsx:54 | gate/reader | consent-form store (writes ledger) | `{opened ? <FormsToSign patientId={patientId} lang={lang} only={["group"]} /> : <Button className="mt-2 min-h-1` |
| src/components/consent/PoDisclosureCard.tsx:21 | reader | ledger | `AdelanteEHR.isConsentCategoryAuthorized(patientId, PO_VOLUNTARY_CONSENT_CATEGORY),` |
| src/components/identity/PatientMatchingQueue.tsx:27 | reader | ledger | `const COUNT_LABEL: Record<string, string> = { appointments: "visits", referrals: "referrals", caseTasks: "task` |
| src/components/patient/ConsentWithdrawSheet.tsx:1 | comment | label/UI text or type only | `// §E10 — confirm step before a patient turns OFF a sharing consent.` |
| src/components/patient/ConsentWithdrawSheet.tsx:9 | definition | derived key (getConsentState / intake payload / withdraw purpose) | `export type WithdrawPurpose = "part2Sud" \| "ecmShare" \| "sms";` |
| src/components/patient/ConsentWithdrawSheet.tsx:20 | reader | derived key (getConsentState / intake payload / withdraw purpose) | `part2Sud:` |
| src/components/patient/ConsentWithdrawSheet.tsx:35 | reader | derived key (getConsentState / intake payload / withdraw purpose) | `part2Sud:` |
| src/components/patient/ConsentWithdrawSheet.tsx:44 | definition | label/UI text or type only | `export function ConsentWithdrawSheet({` |
| src/components/patient/ConsentWithdrawSheet.tsx:58 | reader | derived key (getConsentState / intake payload / withdraw purpose) | `const needsSecond = purpose === "part2Sud";` |
| src/components/patient/ConsentWithdrawSheet.tsx:67 | reader | label/UI text or type only | `<SheetContent side="bottom" data-testid="consent-withdraw-sheet" className="max-h-[90vh] overflow-y-auto">` |
| src/components/patient/ConsentWithdrawSheet.tsx:85 | reader | label/UI text or type only | `<Button autoFocus onClick={close} data-testid="consent-keep">` |
| src/components/patient/ConsentWithdrawSheet.tsx:91 | reader | label/UI text or type only | `data-testid="consent-turn-off"` |
| src/components/patient/ProfilePanels.tsx:1 | import | consent-form store (writes ledger) | `import { PatientSignedForms } from "@/components/consent/PatientSignedForms";` |
| src/components/patient/ProfilePanels.tsx:2 | import | consent-form store (writes ledger) | `import { FormsToSign } from "@/components/consent/FormsToSign";` |
| src/components/patient/ProfilePanels.tsx:3 | import | label/UI text or type only | `import { AdvocateConsentStatus } from "@/components/consent/AdvocateConsentStatus";` |
| src/components/patient/ProfilePanels.tsx:8 | comment | label/UI text or type only | `// 'PatientProfileDialog', and the consent toggles still write through` |
| src/components/patient/ProfilePanels.tsx:9 | comment | label/UI text or type only | `// 'AdelanteEHR.setConsent' — the same field the care-team message composer` |
| src/components/patient/ProfilePanels.tsx:22 | import | label/UI text or type only | `import { ConsentWithdrawSheet, type WithdrawPurpose } from "@/components/patient/ConsentWithdrawSheet";` |
| src/components/patient/ProfilePanels.tsx:38 | reader | label/UI text or type only | `"en": "Privacy & consent",` |
| src/components/patient/ProfilePanels.tsx:39 | reader | label/UI text or type only | `"es": "Privacidad y consentimiento"` |
| src/components/patient/ProfilePanels.tsx:176 | definition | label/UI text or type only | `export function PrivacyConsentCard({ patientId }: { patientId: string }) {` |
| src/components/patient/ProfilePanels.tsx:179 | reader | mixed (flag + ledger mirror) | `const consent = useEhr(() => AdelanteEHR.getConsentState(patientId));` |
| src/components/patient/ProfilePanels.tsx:182 | reader | derived key (getConsentState / intake payload / withdraw purpose) | `const rows: { key: "part2Sud" \| "ecmShare" \| "sms"; label: string; help: string }[] = [` |
| src/components/patient/ProfilePanels.tsx:184 | definition | derived key (getConsentState / intake payload / withdraw purpose) | `key: "part2Sud",` |
| src/components/patient/ProfilePanels.tsx:200 | reader | label/UI text or type only | `<Card className="p-5" id="privacy-consent" data-testid="privacy-consent-card">` |
| src/components/patient/ProfilePanels.tsx:209 | reader | label/UI text or type only | `checked={consent[r.key]}` |
| src/components/patient/ProfilePanels.tsx:216 | writer | mixed (flag + ledger mirror) | `AdelanteEHR.setConsent(patientId, r.key, v);` |
| src/components/patient/ProfilePanels.tsx:217 | gate/reader | label/UI text or type only | `toast.success(lang === "es" ? "Consentimiento otorgado" : "Consent granted");` |
| src/components/patient/ProfilePanels.tsx:227 | reader | label/UI text or type only | `{/* §Group 2 S4 — the patient signs advocate sharing consent here. */}` |
| src/components/patient/ProfilePanels.tsx:228 | gate/reader | consent-form store (writes ledger) | `<PatientSignedForms patientId={patientId} lang={lang === "es" ? "es" : "en"} />` |
| src/components/patient/ProfilePanels.tsx:229 | gate/reader | consent-form store (writes ledger) | `<div className="mt-4"><FormsToSign patientId={patientId} lang={lang === "es" ? "es" : "en"} /></div>` |
| src/components/patient/ProfilePanels.tsx:230 | reader | label/UI text or type only | `<div className="mt-4"><AdvocateConsentStatus patientId={patientId} /></div>` |
| src/components/patient/ProfilePanels.tsx:231 | reader | label/UI text or type only | `<ConsentWithdrawSheet` |
| src/components/patient/ProfilePanels.tsx:237 | writer | mixed (flag + ledger mirror) | `AdelanteEHR.patientWithdrawConsent({ patientId, purpose: pending!, secondConfirm: second });` |
| src/components/patient/ProfilePanels.tsx:256 | comment | label/UI text or type only | `* reminders already live in Privacy & consent above, and one switch for one` |
| src/components/reassessment/RescreenForm.tsx:32 | reader | ledger | `AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment"))),` |
| src/components/referral/ReferrerAuthorizationCard.tsx:5 | import | separate store | `import { recordReferrerAuthorization, referrerAuthorizationFor, revokeReferrerAuthorization } from "@/lib/refe` |
| src/components/referral/ReferrerAuthorizationCard.tsx:13 | reader | separate store | `REFERRER_POLICY_DRAFT, REFERRER_TYPE_LABELS, authorizationActive, authorizationQuestion,` |
| src/components/referral/ReferrerAuthorizationCard.tsx:23 | reader | separate store | `const a = useEhr(() => referrerAuthorizationFor(referral.id));` |
| src/components/referral/ReferrerAuthorizationCard.tsx:24 | reader | separate store | `const active = authorizationActive(a, named);` |
| src/components/referral/ReferrerAuthorizationCard.tsx:28 | writer | separate store | `recordReferrerAuthorization(referral.id, answer, named);` |
| src/components/referral/ReferrerAuthorizationCard.tsx:58 | writer | separate store | `try { revokeReferrerAuthorization(referral.id); return true; } catch { return false; }` |
| src/lib/ab133.ts:7 | comment | ledger | `//    call to 'isConsentCategoryAuthorized', no ConsentRecord lookup, and no` |
| src/lib/ab133.ts:119 | reader | ledger | `const authorized = AdelanteEHR.isConsentCategoryAuthorized(` |
| src/lib/adelBrief.ts:38 | import | separate store | `import { coordinatorEmergencyFor, coordinatorSudCanRead } from "./coordinatorSudAccess";` |
| src/lib/adelBrief.ts:297 | gate/reader | mixed (flag + ledger mirror) | `if (seesSud && !AdelanteEHR.getConsentState(p.id).part2Sud) missing.push("Part 2");` |
| src/lib/adelBrief.ts:361 | gate/reader | ledger, mixed (flag + ledger mirror) | `case "consents": return h('${AdelanteEHR.listConsentRecords(p.id).length}\|${AdelanteEHR.getConsentState(p.id).` |
| src/lib/adelBrief.ts:408 | gate/reader | flag, separate store | `return '${role}\|actor:${viewer.staffId ?? "none"}\|b:${coordinatorSudCanRead(viewer, p, "diagnoses") ? 1 : 0}\|r` |
| src/lib/adelBriefCheck.ts:250 | gate/reader | mixed (flag + ledger mirror) | `if (id === "part2" && AdelanteEHR.getConsentState(p.id).part2Sud) return { error: "Part 2 consent is on file" ` |
| src/lib/advocateInviteDelivery.ts:12 | gate/reader | ledger | `AdelanteEHR.isConsentCategoryAuthorized(patientId, "roi_collateral") \|\|` |
| src/lib/advocateInviteDelivery.ts:13 | reader | ledger | `AdelanteEHR.isConsentCategoryAuthorized(patientId, "advocate_sud_disclosure")` |
| src/lib/asamReporting.ts:92 | gate/reader | flag | `return AdelanteEHR.listPatients().filter((p) => !!p.sudCoordinationConsent && p.consents.part2Sud);` |
| src/lib/billingLifecycleScenario.ts:48 | writer | mixed (flag + ledger mirror) | `action("consent_purpose_set", "staffSetConsent", patient, patient.id, "part2Sud", true,` |
| src/lib/bookingFlow.ts:6 | import | separate store | `import { AdelanteEHR, TELEHEALTH_CONSENT_CATEGORY, GROUP_SERVICE_TYPES, groupConsentBlock, type Appointment, t` |
| src/lib/bookingFlow.ts:82 | gate/reader | ledger | `if (input.modality !== "in_person" && !AdelanteEHR.isConsentCategoryAuthorized(input.patient.id, TELEHEALTH_CO` |
| src/lib/bookingFlow.ts:85 | reader | separate store | `const g = groupConsentBlock(input.patient.id);` |
| src/lib/carePartners.ts:15 | import | ledger | `import { disclose, part2ConsentFor, type Part2RecordClass } from "@/lib/part2Disclosure";` |
| src/lib/carePartners.ts:182 | gate/reader | ledger | `const consent = part2ConsentFor(p.id, { name: o.name, type: o.type === "ntp" \|\| o.type === "clinic" ? "provide` |
| src/lib/chartActions.ts:58 | import | ledger | `import { sendForms, resendCurrent, buildIntakePacket, createFormDraft, editForm, submitForLegalReview, approve` |
| src/lib/chartActions.ts:142 | gate/reader | ledger | `{ id: "consent_form_in_person", label: { en: "Sign in person", es: "Firmar en persona" }, group: "admin", menu` |
| src/lib/chartActions.ts:753 | writer | ledger | `store: refs(["consentLedger", () => undefined], ["revokeConsentRecord", AdelanteEHR.revokeConsentRecord]),` |
| src/lib/chartActions.ts:1021 | writer | mixed (flag + ledger mirror) | `store: refs(["staffSetConsent", ((...a: Parameters<typeof AdelanteEHR.staffSetConsent>) => AdelanteEHR.staffSe` |
| src/lib/chartOrders.ts:194 | reader | ledger | `AdelanteEHR.isConsentCategoryAuthorized(patient.id, "sud_treatment");` |
| src/lib/consentAudit.ts:19 | reader | ledger | `const rec = AdelanteEHR.listConsentRecords(event.patientId).find((r) => r.id === recordId);` |
| src/lib/consentForms.ts:6 | comment | ledger | `// 'AdelanteEHR.createConsentRecord' (sections copied from the record in force,` |
| src/lib/consentForms.ts:11 | reader | separate store | `setGroupConsentGate,` |
| src/lib/consentForms.ts:220 | writer | ledger | `migrateLegacyConsents(p.id);` |
| src/lib/consentForms.ts:242 | gate/reader | mixed (flag + ledger mirror) | `if (AdelanteEHR.getConsentState(p.id).sms) smsLog.push({ id: id("sms"), patientId: p.id, ...(p.phone ? { to: p` |
| src/lib/consentForms.ts:285 | definition | ledger | `export function signChecked(input: SignInput): SignedCopy[] {` |
| src/lib/consentForms.ts:296 | writer | ledger | `migrateLegacyConsents(p.id);` |
| src/lib/consentForms.ts:305 | reader | ledger | `const prior = AdelanteEHR.activeConsentRecord(p.id);` |
| src/lib/consentForms.ts:308 | writer | ledger | `const rec = AdelanteEHR.createConsentRecord({` |
| src/lib/consentForms.ts:320 | writer | mixed (flag + ledger mirror) | `if (v.key === "sms") AdelanteEHR.setConsent(p.id, "sms", true, "form signed");` |
| src/lib/consentForms.ts:321 | writer | mixed (flag + ledger mirror) | `if (v.key === "part2") AdelanteEHR.setConsent(p.id, "part2Sud", true, "form signed");` |
| src/lib/consentForms.ts:377 | definition | ledger | `export function migrateLegacyConsents(patientId: string): boolean {` |
| src/lib/consentForms.ts:381 | gate/reader | ledger | `if (!p \|\| AdelanteEHR.listConsentRecords(p.id).length) return false;` |
| src/lib/consentForms.ts:382 | reader | mixed (flag + ledger mirror) | `const st = AdelanteEHR.getConsentState(p.id);` |
| src/lib/consentForms.ts:388 | gate/reader | flag | `if (!sections.some((s) => s.authorized) && !p.consents?.hipaa) return false;` |
| src/lib/consentForms.ts:389 | gate/reader | flag | `if (p.consents?.hipaa) sections.push({ category: "hipaa_authorization", authorized: true });` |
| src/lib/consentForms.ts:390 | writer | flag, ledger | `AdelanteEHR.createConsentRecord({ patientId: p.id, formType: "NonAB133", source: "intake (legacy)", signedByNa` |
| src/lib/consentForms.ts:419 | reader | ledger | `const prior = AdelanteEHR.activeConsentRecord(p.id);` |
| src/lib/consentForms.ts:421 | writer | ledger | `AdelanteEHR.createConsentRecord({ patientId: p.id, formType: prior?.formType ?? "NonAB133", source: 'form:${v.` |
| src/lib/consentForms.ts:425 | writer | mixed (flag + ledger mirror) | `if (input.by === "staff") AdelanteEHR.staffSetConsent(p.id, purpose, false, { role: input.actor!.role as Staff` |
| src/lib/consentForms.ts:426 | writer | mixed (flag + ledger mirror) | `else AdelanteEHR.setConsent(p.id, purpose, false, "patient stopped sharing");` |
| src/lib/consentForms.ts:525 | definition | separate store | `export function groupConsentGate(patientId: string): string \| undefined {` |
| src/lib/consentForms.ts:556 | writer | separate store | `setGroupConsentGate(groupConsentGate);` |
| src/lib/coordinatorSudAccess.ts:22 | definition | separate store | `export function coordinatorEmergencyFor(viewer: SudViewer, patientId: string, now = Date.now()) {` |
| src/lib/coordinatorSudAccess.ts:30 | gate/reader | flag | `if (item === "counseling_notes") return patient.sudCounselingNotesRelease === true;` |
| src/lib/coordinatorSudAccess.ts:32 | gate/reader | flag, separate store | `return patient.sudCoordinationConsent === "tpo" \|\| patient.sudCoordinationConsent === "specific_written" \|\| !!` |
| src/lib/coordinatorSudEmergency.ts:5 | import | separate store | `import { EMERGENCY_ACCESS_MS, coordinatorEmergencyFor, endCoordinatorEmergencyGrant, saveCoordinatorEmergencyG` |
| src/lib/coordinatorSudEmergency.ts:37 | gate/reader | separate store | `return viewer.role === "clinical_coordinator" && !!viewer.staffId && !!patientId && !!coordinatorEmergencyFor(` |
| src/lib/coordinatorSudView.ts:61 | definition | derived key (getConsentState / intake payload / withdraw purpose) | `smsFallback: false, consents: { hipaa: false, part2Sud: false }, programId: p.programId,` |
| src/lib/dataExchange.ts:45 | definition | label/UI text or type only | `consentUsed: string;` |
| src/lib/dataExchange.ts:103 | comment | label/UI text or type only | `// Held Part 2 record for a patient WITHOUT sud_treatment consent.` |
| src/lib/dataExchange.ts:111 | reader | label/UI text or type only | `shareToHie({ patientId: rosa.id, at: new Date(now.getTime() - 7 * DAY).toISOString(), recipient: "Dr. A. Lin, ` |
| src/lib/dataExchange.ts:114 | reader | label/UI text or type only | `shareToHie({ patientId: luis.id, at: new Date(now.getTime() - 10 * DAY).toISOString(), recipient: "Tulare Coun` |
| src/lib/dataExchange.ts:181 | comment | label/UI text or type only | `* disclosure function (consent check + notice + log); non-SUD passes through.` |
| src/lib/dataExchange.ts:188 | definition | label/UI text or type only | `consentUsed?: string;` |
| src/lib/dataExchange.ts:213 | definition | label/UI text or type only | `consentUsed: input.includesSud ? (res.entry?.consentRef ?? "") : (input.consentUsed ?? "Treatment / care coord` |
| src/lib/dataExchange.ts:228 | reader | label/UI text or type only | `const lines = [["Sent", "Recipient", "What", "Purpose", "Consent used"].join(",")];` |
| src/lib/dataExchange.ts:229 | reader | label/UI text or type only | `for (const r of rows) lines.push([r.sentAt, r.recipient, r.what, r.purpose, r.consentUsed].map(esc).join(","))` |
| src/lib/devInspect.ts:46 | comment | label/UI text or type only | `/** §Group 1 / consent walkthroughs — same module instances the app uses. */` |
| src/lib/devInspect.ts:48 | reader | consent-form store (writes ledger) | `const [ext, av, sp, bf, cf] = await Promise.all([import("@/lib/ehr-ext"), import("@/lib/clinicianAvailability"` |
| src/lib/dmcOdsReadiness.ts:321 | gate/reader | label/UI text or type only | `if (withheld) header.push('# ${withheld} row(s) withheld — no Part 2 consent on file.');` |
| src/lib/ehr.ts:1668 | definition | flag | `sudCoordinationConsent?: "tpo" \| "specific_written";` |
| src/lib/ehr.ts:1670 | definition | flag | `sudCounselingNotesRelease?: boolean;` |
| src/lib/ehr.ts:1789 | definition | flag | `consentState?: {` |
| src/lib/ehr.ts:3627 | reader | separate store | `let groupConsentGate: ((patientId: string) => string \| undefined) \| undefined;` |
| src/lib/ehr.ts:3628 | definition | separate store | `export function setGroupConsentGate(fn: typeof groupConsentGate): void {` |
| src/lib/ehr.ts:3629 | reader | separate store | `groupConsentGate = fn;` |
| src/lib/ehr.ts:3632 | definition | separate store | `export function groupConsentBlock(patientId: string): string \| undefined {` |
| src/lib/ehr.ts:3633 | gate/reader | separate store | `return groupConsentGate?.(patientId);` |
| src/lib/ehr.ts:6288 | reader | ledger | `const sudDisclosureConsentActive = AdelanteEHR.isConsentCategoryAuthorized(` |
| src/lib/ehr.ts:6466 | reader | ledger | `const consentRecords: ConsentRecord[] = [` |
| src/lib/ehr.ts:6489 | definition | ledger | `export function effectiveConsentStatus(rec: ConsentRecord, now = new Date()): ConsentRecordStatus {` |
| src/lib/ehr.ts:8747 | comment | ledger, mixed (flag + ledger mirror) | `// consent ledger ('revokeConsentRecord' / 'setConsent(..., false)'), which` |
| src/lib/ehr.ts:8750 | definition | flag | `hipaa: payload.hipaa \|\| p.consents.hipaa,` |
| src/lib/ehr.ts:8751 | definition | flag | `part2Sud: payload.part2Sud \|\| p.consents.part2Sud,` |
| src/lib/ehr.ts:8752 | definition | flag | `signedAt: p.consents.signedAt ?? now,` |
| src/lib/ehr.ts:8773 | gate/reader | ledger | `return { appointments, referrals, caseTasks, patientDocuments, refillRequests, consentRecords, providerSwitche` |
| src/lib/ehr.ts:9241 | gate/reader | ledger | `if (input.modality && input.modality !== "in_person" && +new Date(input.start) > Date.now() && !AdelanteEHR.is` |
| src/lib/ehr.ts:9244 | reader | separate store | `const g = groupConsentBlock(input.patientId);` |
| src/lib/ehr.ts:10090 | gate/reader | ledger | `return AdelanteEHR.isConsentCategoryAuthorized(patientId, LEGAL_DISCLOSURE_CONSENT_CATEGORY);` |
| src/lib/ehr.ts:11351 | reader | ledger | `const consentActive = AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment");` |
| src/lib/ehr.ts:11446 | reader | ledger | `AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment");` |
| src/lib/ehr.ts:12657 | definition | mixed (flag + ledger mirror) | `getConsentState(patientId: string) {` |
| src/lib/ehr.ts:12660 | gate/reader | flag | `const base = p.consentState ?? {` |
| src/lib/ehr.ts:12661 | definition | flag | `part2Sud: p.consents.part2Sud,` |
| src/lib/ehr.ts:12675 | reader | ledger | `part2Sud: AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment"),` |
| src/lib/ehr.ts:12680 | definition | ledger | `listConsentRecords(patientId?: string): ConsentRecord[] {` |
| src/lib/ehr.ts:12681 | gate/reader | ledger | `return consentRecords` |
| src/lib/ehr.ts:12683 | reader | ledger | `.map((r) => ({ ...r, status: effectiveConsentStatus(r) }))` |
| src/lib/ehr.ts:12687 | definition | ledger | `activeConsentRecord(patientId: string, at = new Date()): ConsentRecord \| undefined {` |
| src/lib/ehr.ts:12688 | gate/reader | ledger | `return consentRecords.find(` |
| src/lib/ehr.ts:12689 | gate/reader | ledger | `(r) => r.patientId === patientId && !r.needsReviewAfterMerge && effectiveConsentStatus(r, at) === "active",` |
| src/lib/ehr.ts:12697 | reader | ledger | `isConsentCategoryAuthorized(` |
| src/lib/ehr.ts:12702 | gate/reader | ledger | `const has = consentRecords.some((r) => r.patientId === patientId && !r.needsReviewAfterMerge);` |
| src/lib/ehr.ts:12708 | gate/reader | flag | `return p.consentState?.part2Sud ?? p.consents.part2Sud;` |
| src/lib/ehr.ts:12710 | reader | ledger | `const rec = AdelanteEHR.activeConsentRecord(patientId, at);` |
| src/lib/ehr.ts:12714 | writer | ledger | `createConsentRecord(input: {` |
| src/lib/ehr.ts:12734 | reader | ledger | `const prior = AdelanteEHR.activeConsentRecord(input.patientId);` |
| src/lib/ehr.ts:12751 | reader | ledger | `consentRecords.unshift(rec);` |
| src/lib/ehr.ts:12771 | writer | ledger | `revokeConsentRecord(` |
| src/lib/ehr.ts:12775 | reader | ledger | `const rec = consentRecords.find((r) => r.id === recordId);` |
| src/lib/ehr.ts:12807 | reader | ledger | `const rec = AdelanteEHR.activeConsentRecord(input.patientId);` |
| src/lib/ehr.ts:12828 | definition | mixed (flag + ledger mirror) | `patientWithdrawConsent(input: { patientId: string; purpose: "part2Sud" \| "ecmShare" \| "sms"; secondConfirm?: b` |
| src/lib/ehr.ts:12833 | writer | mixed (flag + ledger mirror) | `AdelanteEHR.setConsent(p.id, input.purpose, false, "patient withdrew after confirm");` |
| src/lib/ehr.ts:12857 | definition | mixed (flag + ledger mirror) | `staffSetConsent(patientId: string, purpose: "part2Sud" \| "ecmShare" \| "sms", granted: boolean, actor: { role: ` |
| src/lib/ehr.ts:12859 | writer | mixed (flag + ledger mirror) | `AdelanteEHR.setConsent(patientId, purpose, granted, note ?? "consent ledger", { role: actor.role, ...(actor.st` |
| src/lib/ehr.ts:12861 | definition | mixed (flag + ledger mirror) | `setConsent(patientId: string, purpose: ConsentPurpose, granted: boolean, note?: string, actor?: { role: string` |
| src/lib/ehr.ts:12864 | gate/reader | flag | `const prev = p.consentState ?? {` |
| src/lib/ehr.ts:12865 | definition | flag | `part2Sud: p.consents.part2Sud,` |
| src/lib/ehr.ts:12866 | comment | mixed (flag + ledger mirror) | `// §Phase 3a fix #1 — see 'getConsentState': eligibility is not consent.` |
| src/lib/ehr.ts:12872 | reader | flag | `p.consentState = { ...prev, [purpose]: granted } as Patient["consentState"];` |
| src/lib/ehr.ts:12874 | writer | flag | `if (purpose === "part2Sud") p.consents.part2Sud = granted;` |
| src/lib/ehr.ts:12878 | gate/reader | ledger | `if (purpose === "part2Sud" && consentRecords.some((r) => r.patientId === p.id)) {` |
| src/lib/ehr.ts:12879 | reader | ledger | `const active = AdelanteEHR.activeConsentRecord(p.id);` |
| src/lib/ehr.ts:12892 | reader | ledger | `consentRecords.unshift({` |
| src/lib/ehr.ts:12941 | gate/reader | flag | `return p.consentState?.sms ?? p.smsFallback;` |
| src/lib/ehr.ts:12974 | comment | mixed (flag + ledger mirror) | `* default (see 'getConsentState').` |
| src/lib/ehr.ts:12979 | gate/reader | flag | `return Boolean(p.coverage?.ecmEligible) && p.consentState?.ecmShare === undefined;` |
| src/lib/ehr.ts:12992 | gate/reader | flag | `if (eligible && p.consentState?.ecmShare === undefined && p.caseManagerId) {` |
| src/lib/ehr.ts:13710 | reader | ledger | `const sudOk = AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment");` |
| src/lib/ehr.ts:13744 | gate/reader | ledger | `if (def.isSud && !AdelanteEHR.isConsentCategoryAuthorized(patientId, "sud_treatment"))` |
| src/lib/ehr.ts:15244 | reader | ledger | `status = AdelanteEHR.isConsentCategoryAuthorized(ep.patientId, def.consentCategory)` |
| src/lib/ehr.ts:18313 | reader | ledger | `roiCollateralActive: AdelanteEHR.isConsentCategoryAuthorized(` |
| src/lib/ehr.ts:18976 | reader | ledger | `const voluntaryActive = AdelanteEHR.isConsentCategoryAuthorized(` |
| src/lib/ehr.ts:24536 | reader | ledger | `!AdelanteEHR.isConsentCategoryAuthorized(patientId, TELEHEALTH_CONSENT_CATEGORY)` |
| src/lib/ehr.ts:24673 | reader | ledger | `const telehealthOk = AdelanteEHR.isConsentCategoryAuthorized(` |
| src/lib/ehr.ts:24802 | gate/reader | separate store | `{ const g = groupConsentBlock(r.patientId); if (g) throw new Error(g); }` |
| src/lib/ehr.ts:24813 | reader | ledger | `!AdelanteEHR.isConsentCategoryAuthorized(r.patientId, TELEHEALTH_CONSENT_CATEGORY)` |
| src/lib/ehr.ts:25227 | comment | ledger | `* 'isConsentCategoryAuthorized' call every other consent gate uses — no` |
| src/lib/ehr.ts:25255 | reader | ledger | `!AdelanteEHR.isConsentCategoryAuthorized(e.patientId, TELEHEALTH_CONSENT_CATEGORY),` |
| src/lib/ehr.ts:25263 | reader | ledger | `!AdelanteEHR.isConsentCategoryAuthorized(e.patientId, GROUP_CONFIDENTIALITY_CATEGORY),` |
| src/lib/ehr.ts:25413 | reader | ledger | `(a) => !AdelanteEHR.isConsentCategoryAuthorized(a.patientId, TELEHEALTH_CONSENT_CATEGORY),` |
| src/lib/ehr.ts:25430 | reader | ledger | `!AdelanteEHR.isConsentCategoryAuthorized(a.patientId, GROUP_CONFIDENTIALITY_CATEGORY),` |
| src/lib/hie.ts:120 | gate/reader | ledger | `const consent = r.sud ? AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment") : true;` |
| src/lib/hie.ts:154 | gate/reader | ledger | `const consent = r.sud ? AdelanteEHR.isConsentCategoryAuthorized(r.patientId, "sud_treatment") : true;` |
| src/lib/hie.ts:173 | reader | ledger | `consentNowOnFile: AdelanteEHR.isConsentCategoryAuthorized(e.patientId, "sud_treatment"),` |
| src/lib/hie.ts:181 | gate/reader | ledger | `if (!AdelanteEHR.isConsentCategoryAuthorized(e.patientId, "sud_treatment"))` |
| src/lib/identityDemoSeed.ts:51 | writer | ledger | `AdelanteEHR.createConsentRecord({` |
| src/lib/notePdf.ts:70 | comment | label/UI text or type only | `// gate and checked BEFORE it: SUD consent does not unlock this tier.` |
| src/lib/notePdf.ts:77 | definition | label/UI text or type only | `reason: "Psychotherapy notes — not releasable under ASCMI consent.",` |
| src/lib/notePdf.ts:86 | definition | label/UI text or type only | `reason: sud.reason ?? "SUD note — 42 CFR Part 2 consent required",` |
| src/lib/notePdf.ts:92 | comment | label/UI text or type only | `// resolve to the consent-gated 'group_notes' class; skills_education and` |
| src/lib/notePdf.ts:98 | gate/reader | label/UI text or type only | `return { allowed: false, reason: grp.reason ?? "Group note — consent required" };` |
| src/lib/notePdf.ts:323 | comment | label/UI text or type only | `* notes need consent and get the redisclosure notice; others pass through.` |
| src/lib/onboarding.ts:18 | gate/reader | flag | `return Boolean(p?.intakeCompletedAt && p.consents?.hipaa && p.consents?.signedAt);` |
| src/lib/outpatientCare.ts:66 | comment | label/UI text or type only | `/** Destination is an outside SUD provider → Part 2 disclosure consent needed to send. */` |
| src/lib/outpatientCare.ts:223 | comment | label/UI text or type only | `/** Why sending is blocked, or undefined. Outside SUD provider needs a legal Part 2 disclosure consent. */` |
| src/lib/outpatientCare.ts:225 | gate/reader | label/UI text or type only | `if (r.outsideSudProvider && !AdelanteEHR.hasLegalDisclosureConsent(r.patientId))` |
| src/lib/outpatientCare.ts:226 | gate/reader | label/UI text or type only | `return "Sending to an outside SUD provider needs the patient's 42 CFR Part 2 disclosure consent. Record it fir` |
| src/lib/outpatientCare.ts:237 | gate/reader | label/UI text or type only | `audit("hloc_referral_send_blocked", r.patientId, actor, { referralId: r.id, why: "part2_disclosure_consent_mis` |
| src/lib/outpatientCare.ts:287 | comment | label/UI text or type only | `/** Revoke: the ledger stays; a new consent record turns the Part 2 disclosure section off. */` |
| src/lib/outpatientCare.ts:295 | reader | ledger | `const prior = AdelanteEHR.activeConsentRecord(d.patientId);` |
| src/lib/outpatientCare.ts:298 | writer | ledger | `AdelanteEHR.createConsentRecord({` |
| src/lib/outpatientCare.ts:299 | definition | label/UI text or type only | `patientId: d.patientId, formType: prior?.formType ?? "AB133", source: "in person — consent tab", signedByName:` |
| src/lib/outpatientCare.ts:306 | comment | label/UI text or type only | `/** For the demo: capture a legal Part 2 disclosure section on top of the active consent record. */` |
| src/lib/outpatientCare.ts:307 | definition | label/UI text or type only | `export function recordLegalDisclosureConsent(patientId: string, actor: Actor & { staffId?: string }, signedByN` |
| src/lib/outpatientCare.ts:308 | reader | ledger | `const prior = AdelanteEHR.activeConsentRecord(patientId);` |
| src/lib/outpatientCare.ts:310 | writer | ledger | `AdelanteEHR.createConsentRecord({` |
| src/lib/outpatientCare.ts:311 | gate/reader | label/UI text or type only | `patientId, formType: prior?.formType ?? "AB133", source: "in person — consent tab", signedByName, attested: tr` |
| src/lib/outpatientCare.ts:334 | gate/reader | label/UI text or type only | `if (d.revokedAt) throw new Error("This disclosure consent was revoked.");` |
| src/lib/outpatientCare.ts:395 | comment | label/UI text or type only | `// Residential referral for Jordan: blocked for missing consent, then sent.` |
| src/lib/outpatientCare.ts:405 | reader | label/UI text or type only | `recordLegalDisclosureConsent(jordan.id, REYES, '${jordan.firstName} ${jordan.lastName}', { recipient: r.destin` |
| src/lib/part2Disclosure.ts:142 | definition | ledger | `export function part2ConsentFor(` |
| src/lib/part2Disclosure.ts:148 | reader | ledger | `const rec = AdelanteEHR.activeConsentRecord(patientId);` |
| src/lib/part2Disclosure.ts:150 | reader | ledger | `const has = (c: Parameters<typeof AdelanteEHR.isConsentCategoryAuthorized>[1]) =>` |
| src/lib/part2Disclosure.ts:151 | reader | ledger | `AdelanteEHR.isConsentCategoryAuthorized(patientId, c);` |
| src/lib/part2Disclosure.ts:207 | reader | ledger | `const c = part2ConsentFor(req.patientId, req.recipient, req.purpose);` |
| src/lib/part2Disclosure.ts:251 | reader | ledger | `consentRecordId: AdelanteEHR.activeConsentRecord(req.patientId)?.id,` |
| src/lib/patientBooking.ts:39 | gate/reader | ledger | `if (modality !== "in_person" && !AdelanteEHR.isConsentCategoryAuthorized(patient.id, TELEHEALTH_CONSENT_CATEGO` |
| src/lib/patientMerge.ts:97 | definition | ledger | `consentsNeedingReview: (st.consentRecords ?? []).filter((r) => r.patientId === otherId).length,` |
| src/lib/patientMerge.ts:137 | gate/reader | ledger | `if (name === "consentRecords" \|\| name === "disclosures")` |
| src/lib/patientMerge.ts:246 | gate/reader | ledger | `const row = [...(st.consentRecords ?? []), ...(st.disclosures ?? [])].find((r) => r.id === consentId);` |
| src/lib/patientMerge.ts:251 | gate/reader | ledger | `const pending = [...(st.consentRecords ?? []), ...(st.disclosures ?? [])].some((r) => (r.needsReviewAfterMerge` |
| src/lib/poDisclosure.ts:9 | comment | ledger | `//     'isConsentCategoryAuthorized', no ConsentRecord lookup, anywhere beneath` |
| src/lib/poDisclosure.ts:201 | reader | ledger | `const authorized = AdelanteEHR.isConsentCategoryAuthorized(` |
| src/lib/printRecord.ts:9 | comment | label/UI text or type only | `// around consent gating — is the note gate itself: every note goes through` |
| src/lib/printRecord.ts:241 | gate/reader | label/UI text or type only | `? (exportGate.reason ?? "42 CFR Part 2 — consent required")` |
| src/lib/printRecord.ts:254 | comment | label/UI text or type only | `// §ASCMI disclosure trail — a consent-gated note that was actually` |
| src/lib/printRecord.ts:256 | comment | label/UI text or type only | `// category level only, referencing the consent record in force.` |
| src/lib/printRecord.ts:292 | gate/reader | label/UI text or type only | `? { note: e.note, masked: true, authorLabel: e.authorLabel, maskReason: "42 CFR Part 2 — consent required" }` |
| src/lib/referrerAuthorizationStore.ts:21 | definition | separate store | `export function referrerAuthorizationFor(referralId: string): ReferrerAuthorization \| undefined {` |
| src/lib/referrerAuthorizationStore.ts:26 | definition | separate store | `export function recordReferrerAuthorization(referralId: string, answer: "yes" \| "no", referrerNamed: string): ` |
| src/lib/referrerAuthorizationStore.ts:39 | definition | separate store | `export function revokeReferrerAuthorization(referralId: string): void {` |
| src/lib/referrerPolicy.ts:68 | definition | separate store | `export function authorizationActive(a: ReferrerAuthorization \| undefined, namedNow: string): boolean {` |
| src/lib/referrerUpdateGate.ts:8 | import | separate store | `import { heldReferrerUpdates, referrerAuthorizationFor } from "./referrerAuthorizationStore";` |
| src/lib/referrerUpdateGate.ts:10 | reader | separate store | `authorizationActive, decideReferrerUpdate, referrerDisplayName, referrerTypeOf,` |
| src/lib/referrerUpdateGate.ts:30 | definition | separate store | `authorized: authorizationActive(referrerAuthorizationFor(r.id), referrerDisplayName(r)),` |
| src/lib/roles.ts:937 | gate/reader | ledger | `? AdelanteEHR.isConsentCategoryAuthorized(patient.id, category)` |
| src/lib/scribe.ts:186 | reader | ledger | `const rec = AdelanteEHR.activeConsentRecord(patientId, at);` |
| src/lib/scribe.ts:190 | reader | ledger | `const ever = AdelanteEHR.listConsentRecords(patientId).some((r) => r.sections.some((s) => s.category === AI_CO` |
| src/lib/scribe.ts:217 | reader | ledger | `const prior = AdelanteEHR.activeConsentRecord(patientId);` |
| src/lib/scribe.ts:243 | writer | ledger | `const rec = AdelanteEHR.createConsentRecord({` |
| src/lib/scribe.ts:266 | writer | ledger | `const rec = AdelanteEHR.createConsentRecord({` |
| src/routes/admin.tsx:104 | reader | label/UI text or type only | `const consentEvents = useEhr(() => AdelanteEHR.listAllConsentEvents());` |
| src/routes/admin.tsx:353 | reader | label/UI text or type only | `<AuditLogCard events={consentEvents} />` |
| src/routes/admin.tsx:405 | reader | label/UI text or type only | `function AuditLogCard({ events }: { events: ReturnType<typeof AdelanteEHR.listAllConsentEvents> }) {` |
| src/routes/admin.tsx:407 | definition | derived key (getConsentState / intake payload / withdraw purpose) | `part2Sud: "Part 2 SUD",` |
| src/routes/admin.tsx:426 | reader | label/UI text or type only | `<ScrollText className="h-4 w-4 text-teal" /> Consent audit log` |
| src/routes/admin.tsx:433 | gate/reader | label/UI text or type only | `<SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Consent purpose filter">` |
| src/routes/admin.tsx:438 | reader | derived key (getConsentState / intake payload / withdraw purpose) | `<SelectItem value="part2Sud">Part 2 SUD</SelectItem>` |
| src/routes/admin.tsx:447 | reader | label/UI text or type only | `<p className="text-xs text-muted-foreground">No consent changes recorded.</p>` |
| src/routes/advocate.tsx:14 | import | consent-form store (writes ledger) | `import { signAdvocateAttestation } from "@/lib/consentForms";` |
| src/routes/advocate.tsx:244 | comment | label/UI text or type only | `// sent with the invitation (same consent workflow). Seeded links have none.` |
| src/routes/consent.tsx:82 | gate/reader | mixed (flag + ledger mirror) | `const state = useEhr(() => (patient ? AdelanteEHR.getConsentState(patient.id) : null));` |
| src/routes/consent.tsx:140 | gate/reader | flag | `? patient.consents.hipaa` |
| src/routes/intake.tsx:590 | gate/reader | flag | `if (!p?.consents?.signedAt \|\| !p.consents.hipaa) return null;` |
| src/routes/intake.tsx:592 | definition | flag | `signedAt: p.consents.signedAt,` |
| src/routes/intake.tsx:593 | reader | ledger | `part2Sud: AdelanteEHR.isConsentCategoryAuthorized(currentId, "sud_treatment"),` |

Total lines: 342. Unclassified: 0.

## B2-1 additions

| Entry point | File:line | Kind | Notes |
|---|---|---|---|
| consentCovers (typed-record coverage check, live, not wired into any gate until B2-4) | src/lib/ehr.ts:12723 | reader / ledger | Only new entry-point line; pin test regex gains `consentCovers` and `src/lib/ehr.ts` count 41 → 42 |
| createConsentRecord `extension` (typed fields, supersede within type + recipient) | src/lib/ehr.ts:12749-12790 | writer / ledger | Existing line, no new pin |
| Validation + types | src/lib/consentRecordModel.ts | pure | No entry-point names; not pinned |
