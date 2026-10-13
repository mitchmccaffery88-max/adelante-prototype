# Phase 1 review: fonts, tokens and logo

**Review only. No application files, dependencies, images or tests have been changed. Implementation waits for approval and the SVG sources.**

## 1. Exact proposed files

- `src/styles.css` — self-hosted font imports, font mappings, supplied light/dark tokens, legacy aliases, removal of patient color/font overrides, heading defaults and both shadows. Preserve patient sizing, radius and player rules.
- `src/routes/__root.tsx` — theme-color and favicon/Apple icon links only; preserve titles, descriptions, app name and existing share URLs.
- `src/components/WebsiteBrand.tsx` — light/dark compact SVGs; preserve `data-testid="website-brand"` and the existing parent home link.
- `src/components/AppShell.tsx` — brand-link contents only; preserve patient hiding and all header behavior; 32px staff / 40px advocate logos.
- `src/components/website.css` — delete only line 18's `--destructive` override.
- `public/manifest.webmanifest` — the two colors and four separate regular/maskable icon entries only.
- `package.json`, `bun.lock` — the two Fontsource packages and development-only `sharp`.
- `scripts/render-brand-images.mjs` — reproducible SVG-to-raster conversion.
- SVG sources: `public/brand/adelante-compact.svg`, `public/brand/adelante-compact-dark.svg`, `public/brand/adelante-app-icon.svg`, `public/brand/adelante-app-icon-maskable.svg`, `public/brand/adelante-share.svg`, `public/favicon.svg`.
- Generated images: `public/website-share.jpg`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-192-maskable.png`, `public/icon-512-maskable.png`, `public/apple-touch-icon.png`, `public/favicon-32.png`.

No route, copy, i18n, permission, business-logic or test edits.

### Confirmed conflicts and exceptions

- **Heading weight:** `website.css:26–34` explicitly sets public section headings to **600**, outside the base layer. `styles.css:383` sets player headings to **600**; component utilities such as `ExercisePlayer.tsx:370` also use `font-semibold`. A base 700 rule will not override these. The spec's “700 everywhere” and “one website.css line / preserve player styles” cannot both be guaranteed. Recommended interpretation: **700 becomes the global default; existing explicit weights remain this phase**. Universal 700 needs separately approved scope.
- **Patient sizing:** `styles.css:330–340` actually gives small utility text a **14px** floor; paragraphs/list items have a **16px** floor. Preserve the actual rules, rather than silently changing density to match the spec's “16px text floor” description.
- **Patient dependencies:** `WebsiteLayout`, `AppShell`, `PatientPage`, `FormsToSign`, `PatientSignedForms`, `RealContentPreview`, `ExercisePlayer`, `ModuleTemplate`, and patient drawers/sheets use `.patient-theme`. Keep the class and non-color rules. Their palette changes intentionally through global tokens and aliases. `breath-shape` still uses `--sage`; the alias keeps it resolving.
- **Compatibility mappings:** `styles.css:76,79` confirms the two incorrect soft-token mappings. Correct them exactly as specified. Bare `text-teal` / `bg-navy` are registered semantic aliases, **not** built-in palette bypasses.
- **Remaining bypasses outside scope:** `src/lib/error-page.ts:19–26` has its own system font and hex palette. Numbered Tailwind colors remain in, for example, `billing.tsx:297–301`, `reporting.tsx:198`, `my-calendar.tsx:87`, `admin-note-templates.tsx:527`, `advocate.library.tsx:81–86`, `CssrsStaffControl.tsx:15–16`, and consent/advocate/clinical components. New aliases do not remap `amber-500` or `orange-500`. Leave these for later phases; phase 1 is not complete elimination of fixed colors. `ui/chart.tsx:51` contains `#ccc`/`#fff` **selector matches**, not literal painted colors.
- **Contrast requires measurement:** `website.css:23–24` derives the hero overlay from `--foreground`; `Landing.tsx:60–91` uses `navy-foreground` text. Changing the foreground changes that overlay. Dark-mode text becomes dark through `on-path`; it cannot be assumed readable over the photo. `WebsiteContent.tsx:15–18` uses an inline gradient, but it references tokens and will migrate. Do not adjust either outside the allowed scope if checks fail; report the measured failure.
- **Share metadata:** public leaves use the unchanged `/website-share.jpg` URL through `websiteMetadata.ts`; root fallback still has a different screenshot URL. Preserve both as explicitly requested; root fallback previews will not automatically use the new card.
- **Logo sizing:** verify the supplied compact SVG's aspect ratio against the 390px public header. The existing brand text shrinks on mobile; the requested fixed-height logo may be wider. Do not redesign the header without approval.

## 2. Test risks

**No direct old-color, Inter/Fraunces, A-tile, manifest-color or theme-color assertions were found in the inspected unit/browser tests. No definite assertion break identified.**

- `e2e/websitePolish.spec.ts:22–26` compares heading font, size, color and weight **with each other**, not old fixed values; it should remain valid if consistency is retained. Lines 18–21 pin the unchanged share URL and require the image to load. Lines 28–29 and 80–81 run axe; changed contrast can cause a genuine failure.
- `e2e/publicWebsite.spec.ts:97–109` checks mobile overflow and navigation; new logo width/font metrics could expose a layout failure. Lines 18–27 compare link text across pages, not against the old A tile.
- `landingWebsite.test.ts`, `patientNavShellParity.test.tsx`, `publicReferralShell.test.ts`, and `userNavigationShell.test.ts` inspect shell source, but their confirmed assertions target preserved routing, navigation, crisis support and copy—not brand-link JSX.
- `e2e/staffContent.spec.ts:14` requires `.patient-theme` to remain in preview; retain it.
- `e2e/adelBrief.spec.ts:46` retains the **1,500ms** limit. Screenshot captures there are not visual-baseline assertions.

After implementation: run the full unit suite, then all browser specs separately, including axe. **Stop and report any failure; change no assertions, retries or thresholds.** No tests run during this review.

## 3. Rendering the supplied SVGs

**Yes.** Use `sharp` in the development-only script for SVG rasterization, exact-size PNG output and 1200×630 JPEG output. Neither `sharp` nor `@resvg/resvg-js` is currently installed; ImageMagick is available, but a pinned project dependency gives more reproducible results.

Outline text avoids font-rendering dependencies. Preserve aspect ratios/transparency, use the dedicated maskable source for maskable outputs, and flatten the share JPEG onto its intended canvas color. Derive the 180px Apple icon from the regular app-icon source and the 32px favicon from the micro-symbol. Verify dimensions and light/dark artwork after receiving the actual sources. The renderer is never imported by app or server code.

## 4. Recommended differences / decisions

1. Treat 700 as the new **default**, preserving explicit public/player weights this phase; otherwise expand the permitted heading changes before building.
2. Preserve the current **14px utility / 16px paragraph** floors; density migration is separate.
3. Use `sharp` alone rather than adding two render packages. Store the raster input SVGs too, so the retained script is reproducible.
4. Put every font import in the existing top import block and import only the requested weights/styles. Verify fonts and logo assets finish loading before visual review.
5. If contrast, mobile layout or an old assertion fails, report it rather than silently broadening phase 1.

**Next:** approve the interpretation above; the build message supplies SVG sources. No implementation before then.