// §Advocate Access Redesign Phase 5 — the advocate bucket is real, managed by
// the same tooling, empty, and invisible to patients.
import { describe, expect, it } from "vitest";
import {
  liveAdvocateLibraryCategories,
  liveAdvocateLibraryItems,
  liveLibraryCategories,
  livePatientLibraryItems,
} from "@/lib/contentCatalog";
import { ADVOCATE_LIBRARY_CATEGORY_ID } from "@/lib/library.advocateCategory.seed";
import { getContentEntry } from "@/lib/contentPublishing";

describe("advocate library bucket", () => {
  it("exists as a published, advocate-audience category", () => {
    const cats = liveAdvocateLibraryCategories();
    expect(cats.map((c) => c.id)).toContain(ADVOCATE_LIBRARY_CATEGORY_ID);
    expect(cats.every((c) => c.audience === "advocate")).toBe(true);
  });

  it("is managed through the same content store as every other category", () => {
    const entry = getContentEntry("library_category", ADVOCATE_LIBRARY_CATEGORY_ID);
    expect(entry?.status).toBe("published");
    expect(entry?.revisions.length).toBeGreaterThan(0);
  });

  it("never appears in the patient library", () => {
    expect(liveLibraryCategories().some((c) => c.id === ADVOCATE_LIBRARY_CATEGORY_ID)).toBe(false);
    expect(
      livePatientLibraryItems().some((i) => i.categoryId === ADVOCATE_LIBRARY_CATEGORY_ID),
    ).toBe(false);
  });

  it("carries zero authored lessons", () => {
    expect(liveAdvocateLibraryItems()).toHaveLength(0);
  });
});
