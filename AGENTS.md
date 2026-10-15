# Architecture rules

Standing rules — apply to ALL work, every change, any folder:
- Registry + runAction: every mutation is a `CHART_ACTIONS` entry run through `runAction` (role check + one audit event).
- Simulated: every mock/placeholder integration has `simulated: true` in `features.ts`, audits `simulated: true`, UI says "Simulated".
- Part 2: SUD content is hidden (not stubbed) for roles failing the existing checks; notification/audit/task text stays neutral; outbound SUD goes through `disclose()`.
- Draft: every clinical/policy rule is labelled "Draft — pending clinical sign-off"; Spanish clinical copy marked draft.
- Cohort guard 11 on all aggregates.
- Outpatient only: in-facility behind `inFacilityEnabled()`, off by default.
- Demo seeds only through real store functions.

- Member status chips are presentation-only and display existing record labels; shared clinical components opt in through existing audience/actor boundaries. Patient help opens the existing sheet in CrisisHeader; advocate header help is a direct 988 phone link. Spanish translation-review notice is owned once by the member shell. Member text-button wrapping is scoped to member shells/overlays, preserves square icon controls, and Home tiles must shrink to available width. Why: member presentation cannot change staff rendering, permissions, lifecycle rules or expose patient help to advocates.

Full per-module rules: `src/lib/AGENTS.md` — read before changing app logic.
- Staff interface English is a non-persistent context override in AppShell; content previews retain their own local language context. Why: staff navigation must not rewrite member preferences or patient-directed output.
- StaffShell owns compact staff chrome and StaffDensity React context marks its portalled overlays; existing route launchers portal their trigger into the shell's New slot without moving their forms, registries or event handlers. Why: staff sizing and a single create entry cannot change member rendering or chart/action permissions.
- Monthly member participation is a read-only facility-date projection in checkInStreak.ts; the Spanish review exporter reads source ASTs only. Why: neither presentation nor review tooling may change clinical windows or access patient data.
- Ordinary screen Spanish lives in each screen's existing dictionary or local bilingual copy object; the source-only review exporter retains stable UI keys and a reviewed audience-exclusion manifest. Why: staff-only branches and controlled text must not be translated by member screen-gap drafting.
- Staff care-work and operations status chips derive presentation from existing record statuses and acting-person ownership, with English record labels; shared member branches, denied-claim styling, simulation, policy and KPI exceptions remain isolated; ambiguous operations statuses retain their existing display. Why: colors cannot change ownership, permissions or workflows.
- Public website text is isolated in `i18n.website.ts`; public header/footer/crisis support live in `WebsiteLayout`, branding uses `WebsiteBrand` and navigation uses `WebsiteNavigation`; `WebsiteContent` shares the closing CTA and owns About/Team content, while application branding stays unchanged. Why: the public brand and future logo must never rename patient or staff experiences.
- Public scroll state and measured crisis clearance belong to WebsiteLayout; WebsiteNavigation uses explicit current-state styling and a Radix popover; public leaf metadata shares one absolute share-image constant and one public image file. Why: navigation, safe viewport clearance and future logo replacement stay consistent without changing app shells.
- Resource verification and existing listing edits share the community-resource view in `/admin-content`; verification uses `runAction("resource_verify")` and the existing verifier/store gates. Why: one listing workflow, unchanged role access and published revision provenance.
- Both patient check-in hosts render EmotionCheckIn; checkInCopy owns its bilingual words, patientCheckInContext projects visible real records, and privateSelfTrackingActions runs self-only writes with generic audit metadata. Why: one flow and dismissal source, no private-answer disclosure or automatic navigation.

<!-- LOVABLE:BEGIN -->
- Clinician tiles and merged action rows derive through `clinicianWorkspace.ts`; dashboard “+ New” uses `CHART_ACTIONS` plus `dashboardActionBus.ts`. Why: one acting-person scope, one permission registry, no duplicate queues.
<!-- LOVABLE:END -->
