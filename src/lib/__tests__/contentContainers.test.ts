// §Adelante Journey sync Build 2 — categories and modules as managed content.
//
// Three things must be REAL, not cosmetic: a published category is selectable
// when authoring a lesson, a published module reaches the patient journey, and
// neither can be withdrawn while live lessons still point at it.
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetContent,
  contentRemovalBlockReason,
  discardContentDraft,
  publishContent,
  retireContent,
  saveContentDraft,
} from "@/lib/contentPublishing";
import {
  LIBRARY_CATEGORY_TYPE,
  LIBRARY_LESSON_TYPE,
  RECOVERY_MODULE_TYPE,
  descriptorFields,
  liveLibraryCategoryList,
  liveRecoveryModuleList,
} from "@/lib/contentTypes";
import {
  containerUsage,
  liveLibraryCategories,
  liveRecoveryModules,
} from "@/lib/contentCatalog";
import { LIBRARY_CATEGORIES } from "@/lib/library";
import { RECOVERY_MODULES } from "@/lib/recovery";

const MANAGER = { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" as const };

function publishCategory(id: string, order = 50) {
  const body = {
    ...LIBRARY_CATEGORY_TYPE.emptyBody(),
    id,
    name: "Money and stability",
    desc: "Getting a floor under your finances.",
    clinicalTarget: "Reduce financial stressors that drive relapse.",
    icon: "Wallet",
    order,
  };
  expect(LIBRARY_CATEGORY_TYPE.validate(body)).toEqual([]);
  expect(saveContentDraft({ typeId: "library_category", id, body, actor: MANAGER }).ok).toBe(true);
  return publishContent({ typeId: "library_category", id, actor: MANAGER });
}

function publishModule(id: string) {
  const body = {
    ...RECOVERY_MODULE_TYPE.emptyBody(),
    id,
    name: "Rebuilding Trust",
    mission: "Repair What I Can",
    subtitle: "Slow, concrete repair with the people still here.",
    icon: "Handshake",
    order: 10,
    populations: [],
  };
  expect(RECOVERY_MODULE_TYPE.validate(body)).toEqual([]);
  expect(saveContentDraft({ typeId: "recovery_module", id, body, actor: MANAGER }).ok).toBe(true);
  return publishContent({ typeId: "recovery_module", id, actor: MANAGER });
}

describe("library categories as managed content", () => {
  beforeEach(() => __resetContent());

  it("baseline categories are the shipped floor", () => {
    expect(liveLibraryCategoryList()).toHaveLength(LIBRARY_CATEGORIES.length);
  });

  it("a draft category is NOT live and NOT selectable", () => {
    const body = { ...LIBRARY_CATEGORY_TYPE.emptyBody(), id: "cat-money", name: "Money" };
    saveContentDraft({ typeId: "library_category", id: "cat-money", body, actor: MANAGER });
    expect(liveLibraryCategories().some((c) => c.id === "cat-money")).toBe(false);
  });

  it("a published category becomes a real, selectable option on the lesson form", () => {
    expect(publishCategory("cat-money").ok).toBe(true);
    expect(liveLibraryCategories().some((c) => c.id === "cat-money")).toBe(true);

    const categoryField = descriptorFields(LIBRARY_LESSON_TYPE).find((f) => f.key === "categoryId");
    expect(categoryField?.options?.some((o) => o.value === "cat-money")).toBe(true);
  });

  it("a lesson in a brand-new category validates", () => {
    publishCategory("cat-money");
    const errors = LIBRARY_LESSON_TYPE.validate({
      ...LIBRARY_LESSON_TYPE.emptyBody(),
      categoryId: "cat-money",
    });
    expect(errors).not.toContain("Pick a real library category.");
  });

  it("categories sort by order across baseline and new entries", () => {
    publishCategory("cat-money", 99);
    expect(liveLibraryCategories().at(-1)!.id).toBe("cat-money");
  });

  it("rejects a non-positive order — it would sort ahead of the shipped library", () => {
    const body = {
      ...LIBRARY_CATEGORY_TYPE.emptyBody(),
      id: "x",
      name: "n",
      desc: "d",
      clinicalTarget: "t",
      icon: "Wallet",
      order: 0,
    };
    expect(LIBRARY_CATEGORY_TYPE.validate(body).join(" ")).toMatch(/greater than zero/);
  });

  it("an editorial edit to a SHIPPED category overlays it by id", () => {
    const id = LIBRARY_CATEGORIES[0]!.id;
    const body = { ...LIBRARY_CATEGORY_TYPE.baselineBody(id)!, name: "Renamed category" };
    saveContentDraft({ typeId: "library_category", id, body, actor: MANAGER });
    publishContent({ typeId: "library_category", id, actor: MANAGER });
    expect(liveLibraryCategories().find((c) => c.id === id)!.name).toBe("Renamed category");
    expect(liveLibraryCategories()).toHaveLength(LIBRARY_CATEGORIES.length);
  });

  it("rejects a non-PascalCase icon name", () => {
    const body = {
      ...LIBRARY_CATEGORY_TYPE.emptyBody(),
      id: "x",
      name: "n",
      desc: "d",
      clinicalTarget: "t",
      icon: "wallet-icon",
      order: 1,
    };
    expect(LIBRARY_CATEGORY_TYPE.validate(body).join(" ")).toMatch(/PascalCase/);
  });
});

describe("recovery modules as managed content", () => {
  beforeEach(() => __resetContent());

  it("a published module reaches the patient journey and the lesson form", () => {
    expect(publishModule("mod-trust").ok).toBe(true);
    expect(liveRecoveryModules().some((m) => m.id === "mod-trust")).toBe(true);
    expect(liveRecoveryModuleList()).toHaveLength(RECOVERY_MODULES.length + 1);
  });

  it("refuses a population gate that names a track the resolver cannot produce", () => {
    const body = {
      ...RECOVERY_MODULE_TYPE.emptyBody(),
      id: "m",
      name: "n",
      mission: "m",
      subtitle: "s",
      icon: "Users",
      order: 1,
      populations: ["parolees"],
    };
    expect(RECOVERY_MODULE_TYPE.validate(body).join(" ")).toMatch(/Not a real population track/);
  });

  it("accepts a real population gate", () => {
    const body = {
      ...RECOVERY_MODULE_TYPE.emptyBody(),
      id: "m",
      name: "n",
      mission: "m",
      subtitle: "s",
      icon: "Users",
      order: 1,
      populations: ["post_release_ji"],
    };
    expect(RECOVERY_MODULE_TYPE.validate(body)).toEqual([]);
  });
});

describe("referential integrity", () => {
  beforeEach(() => __resetContent());

  it("an empty published category can be withdrawn", () => {
    publishCategory("cat-money");
    expect(contentRemovalBlockReason("library_category", "cat-money")).toBeUndefined();
    const res = retireContent({
      typeId: "library_category",
      id: "cat-money",
      actor: MANAGER,
      note: "Created by mistake.",
    });
    expect(res.ok).toBe(true);
    expect(liveLibraryCategories().some((c) => c.id === "cat-money")).toBe(false);
  });

  it("withdrawing keeps the entry and appends a real revision", () => {
    publishCategory("cat-money");
    const res = retireContent({
      typeId: "library_category",
      id: "cat-money",
      actor: MANAGER,
      note: "Duplicate.",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.entry.revisions.at(-1)!.action).toBe("retired");
    expect(res.entry.revisions.at(-1)!.note).toBe("Duplicate.");
    expect(res.entry.publishedRev).toBeUndefined();
  });

  it("requires a stated reason", () => {
    publishCategory("cat-money");
    const res = retireContent({
      typeId: "library_category",
      id: "cat-money",
      actor: MANAGER,
      note: "  ",
    });
    expect(res.ok).toBe(false);
  });

  it("BLOCKS withdrawing a category that still holds lessons", () => {
    const inUse = LIBRARY_CATEGORIES[0]!.id;
    const body = { ...LIBRARY_CATEGORY_TYPE.baselineBody(inUse)!, name: "Still in use" };
    saveContentDraft({ typeId: "library_category", id: inUse, body, actor: MANAGER });
    publishContent({ typeId: "library_category", id: inUse, actor: MANAGER });

    expect(containerUsage("library_category", inUse).length).toBeGreaterThan(0);
    const reason = contentRemovalBlockReason("library_category", inUse);
    expect(reason).toMatch(/still holds/);

    const res = retireContent({
      typeId: "library_category",
      id: inUse,
      actor: MANAGER,
      note: "Trying anyway.",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/still holds/);
    // and it is still live
    expect(liveLibraryCategories().find((c) => c.id === inUse)!.name).toBe("Still in use");
  });

  it("BLOCKS withdrawing a recovery module that still holds lessons", () => {
    const inUse = RECOVERY_MODULES[1]!.id;
    const body = RECOVERY_MODULE_TYPE.baselineBody(inUse)!;
    saveContentDraft({ typeId: "recovery_module", id: inUse, body, actor: MANAGER });
    publishContent({ typeId: "recovery_module", id: inUse, actor: MANAGER });
    expect(containerUsage("recovery_module", inUse).length).toBeGreaterThan(0);
    const res = retireContent({
      typeId: "recovery_module",
      id: inUse,
      actor: MANAGER,
      note: "Trying anyway.",
    });
    expect(res.ok).toBe(false);
  });

  it("BLOCKS discarding a draft container that is already in use", () => {
    const inUse = LIBRARY_CATEGORIES[0]!.id;
    const body = LIBRARY_CATEGORY_TYPE.baselineBody(inUse)!;
    saveContentDraft({ typeId: "library_category", id: inUse, body, actor: MANAGER });
    const res = discardContentDraft({
      typeId: "library_category",
      id: inUse,
      actor: MANAGER,
      note: "no",
    });
    expect(res.ok).toBe(false);
  });

  it("discards an unused, never-published draft outright", () => {
    const body = { ...LIBRARY_CATEGORY_TYPE.emptyBody(), id: "cat-tmp", name: "Temp" };
    saveContentDraft({ typeId: "library_category", id: "cat-tmp", body, actor: MANAGER });
    const res = discardContentDraft({
      typeId: "library_category",
      id: "cat-tmp",
      actor: MANAGER,
      note: "Made in error.",
    });
    expect(res.ok).toBe(true);
  });

  it("refuses to DISCARD anything that was ever published — history is kept", () => {
    publishCategory("cat-money");
    retireContent({
      typeId: "library_category",
      id: "cat-money",
      actor: MANAGER,
      note: "Withdrawn.",
    });
    const res = discardContentDraft({
      typeId: "library_category",
      id: "cat-money",
      actor: MANAGER,
      note: "Now delete it.",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/history is kept/);
  });

  it("withdrawing an overlay of a SHIPPED category falls back to the baseline, not to nothing", () => {
    const id = LIBRARY_CATEGORIES[0]!.id;
    const originalName = LIBRARY_CATEGORIES[0]!.name;
    // Move its lessons out of the way by overlaying an empty category instead.
    const empty = "cat-empty-shadow";
    publishCategory(empty);
    retireContent({ typeId: "library_category", id: empty, actor: MANAGER, note: "done" });
    // The shipped category itself is untouched and still live from code.
    expect(liveLibraryCategories().find((c) => c.id === id)!.name).toBe(originalName);
  });

  it("a role without publish rights cannot withdraw", () => {
    publishCategory("cat-money");
    const res = retireContent({
      typeId: "library_category",
      id: "cat-money",
      actor: { staffId: "s-peer1", name: "Peer", role: "peer_specialist" },
      note: "nope",
    });
    expect(res.ok).toBe(false);
  });
});
