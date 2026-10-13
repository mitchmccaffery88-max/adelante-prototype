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
- Staff care-work status chips derive presentation from existing record statuses and acting-person ownership, with English record labels; shared member branches and operations exceptions remain isolated. Why: colors cannot change ownership, permissions or workflows.
- Public website text is isolated in `i18n.website.ts`; public header/footer/crisis support live in `WebsiteLayout`, branding uses `WebsiteBrand` and navigation uses `WebsiteNavigation`; `WebsiteContent` shares the closing CTA and owns About/Team content, while application branding stays unchanged. Why: the public brand and future logo must never rename patient or staff experiences.
- Public scroll state and measured crisis clearance belong to WebsiteLayout; WebsiteNavigation uses explicit current-state styling and a Radix popover; public leaf metadata shares one absolute share-image constant and one public image file. Why: navigation, safe viewport clearance and future logo replacement stay consistent without changing app shells.
- Resource verification and existing listing edits share the community-resource view in `/admin-content`; verification uses `runAction("resource_verify")` and the existing verifier/store gates. Why: one listing workflow, unchanged role access and published revision provenance.

<!-- LOVABLE:BEGIN -->
- Clinician tiles and merged action rows derive through `clinicianWorkspace.ts`; dashboard “+ New” uses `CHART_ACTIONS` plus `dashboardActionBus.ts`. Why: one acting-person scope, one permission registry, no duplicate queues.
<!-- LOVABLE:END -->
