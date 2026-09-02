// §Advocate Access Redesign Phase 5 — the advocate Library BUCKET, and only
// the bucket.
//
// This seeds ONE managed `library_category` entry through the same publishing
// store every other category uses, so it is editable, retirable and revision-
// tracked in `/admin-content` with no new admin capability. Deliberately ZERO
// lessons: all advocate-facing content is authored separately by the clinical
// content manager, and `/advocate/library` shows an honest "content pending"
// state until then — the same discipline as Module 9 and the empty Library
// check-ins.
//
// The name/description below are identifying labels for the bucket, not
// authored content; the content manager owns their final wording.
import { seedPublishedContent } from "@/lib/contentPublishing";
import { liveLibraryCategoryList } from "@/lib/contentTypes";

export const ADVOCATE_LIBRARY_CATEGORY_ID = "advocate-support";

export function seedAdvocateLibraryCategory(): void {
  seedPublishedContent({
    typeId: "library_category",
    id: ADVOCATE_LIBRARY_CATEGORY_ID,
    body: {
      id: ADVOCATE_LIBRARY_CATEGORY_ID,
      name: "Supporting someone in recovery",
      desc: "Content pending authoring.",
      clinicalTarget: "Pending clinical authoring.",
      icon: "HeartHandshake",
      audience: "advocate",
      order: (liveLibraryCategoryList().at(-1)?.order ?? 0) + 1,
    },
    actor: { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" },
    atISO: "2026-09-02T00:00:00.000Z",
    note: "Advocate library bucket created; content pending authoring.",
  });
}

seedAdvocateLibraryCategory();
