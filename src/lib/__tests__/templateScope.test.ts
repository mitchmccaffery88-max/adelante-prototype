import { describe, expect, it } from "vitest";
import {
  buildPersonalClone,
  canCloneTemplate,
  canEditTemplate,
  canUseTemplate,
  disciplineForRole,
  lockedFieldKeys,
  lockedFieldViolations,
  scopeOf,
  templatesVisibleTo,
  TEMPLATE_DEPARTMENTS,
} from "@/lib/templateScope";
import type { TemplateSchema } from "@/lib/templateSchema";
import { STAFF_ROLES } from "@/lib/roles";

const schema: TemplateSchema = {
  sections: [
    {
      id: "s1",
      title: "Billing",
      fields: [
        { key: "cpt", type: "text", label: "CPT code", required: true, locked: true },
        { key: "notes", type: "textarea", label: "Notes" },
      ],
    },
  ],
};

describe("template scope tiers", () => {
  it("treats a pre-2b row with no scope as global", () => {
    expect(scopeOf({ id: "t1" })).toBe("global");
    expect(canUseTemplate({ role: "peer_specialist", staffId: "s1" }, { id: "t1" })).toBe(true);
  });

  it("maps every real staff role to exactly one discipline", () => {
    for (const r of STAFF_ROLES) {
      const hits = TEMPLATE_DEPARTMENTS.filter((d) => d.roles.includes(r.key));
      expect(hits, `${r.key} should sit in exactly one discipline`).toHaveLength(1);
      expect(disciplineForRole(r.key)?.id).toBe(hits[0]!.id);
    }
  });

  it("scopes department templates to that discipline's roles", () => {
    const t = { id: "t2", scope: "department" as const, departmentId: "psychiatry" };
    expect(canUseTemplate({ role: "pmhnp", staffId: "a" }, t)).toBe(true);
    expect(canUseTemplate({ role: "therapist", staffId: "b" }, t)).toBe(false);
  });

  it("keeps a personal template private to its owner", () => {
    const t = { id: "t3", scope: "personal" as const, ownerStaffId: "s-th1" };
    expect(canUseTemplate({ role: "therapist", staffId: "s-th1" }, t)).toBe(true);
    expect(canUseTemplate({ role: "therapist", staffId: "s-th3" }, t)).toBe(false);
    expect(canEditTemplate({ role: "sys_admin", staffId: "s-admin" }, t)).toBe(false);
  });

  it("filters a mixed library by use rights", () => {
    const all = [
      { id: "g", scope: "global" as const },
      { id: "d", scope: "department" as const, departmentId: "behavioral_health" },
      { id: "p1", scope: "personal" as const, ownerStaffId: "s-th1" },
      { id: "p2", scope: "personal" as const, ownerStaffId: "s-np1" },
    ];
    const visible = templatesVisibleTo(all, { role: "therapist", staffId: "s-th1" });
    expect(visible.map((t) => t.id)).toEqual(["g", "d", "p1"]);
  });

  it("gives edit on the shared tiers only to the right authors", () => {
    const global = { id: "g", scope: "global" as const };
    expect(canEditTemplate({ role: "clinical_coordinator", staffId: "x" }, global)).toBe(true);
    expect(canEditTemplate({ role: "therapist", staffId: "x" }, global)).toBe(false);
    const dept = { id: "d", scope: "department" as const, departmentId: "behavioral_health" };
    expect(canEditTemplate({ role: "therapist", staffId: "x" }, dept)).toBe(true);
    expect(canEditTemplate({ role: "clinical_trainee", staffId: "x" }, dept)).toBe(false);
  });

  it("lets anyone who can see a shared template take a copy, but not re-copy a personal one", () => {
    expect(canCloneTemplate({ role: "peer_specialist", staffId: "x" }, { id: "g" })).toBe(true);
    expect(
      canCloneTemplate({ role: "therapist", staffId: "x" }, {
        id: "p",
        scope: "personal",
        ownerStaffId: "x",
      }),
    ).toBe(false);
  });
});

describe("cloning", () => {
  it("produces an independent key at version 1 and carries locked fields through", () => {
    const clone = buildPersonalClone(
      { key: "bh_intake", title: "BH Intake", schema },
      { role: "therapist", staffId: "s-th1" },
      [],
    );
    expect(clone.key).not.toBe("bh_intake");
    expect(clone.title).toBe("BH Intake (my copy)");
    expect(lockedFieldKeys(clone.schema)).toEqual(["cpt"]);
  });

  it("deep-copies so edits to the copy never reach the source", () => {
    const clone = buildPersonalClone(
      { key: "bh_intake", title: "BH Intake", schema },
      { role: "therapist", staffId: "s-th1" },
    );
    clone.schema.sections[0]!.fields[1]!.label = "Changed";
    expect(schema.sections[0]!.fields[1]!.label).toBe("Notes");
  });

  it("avoids colliding with a key the owner already used", () => {
    const first = buildPersonalClone(
      { key: "bh_intake", title: "BH Intake", schema },
      { role: "therapist", staffId: "s-th1" },
    );
    const second = buildPersonalClone(
      { key: "bh_intake", title: "BH Intake", schema },
      { role: "therapist", staffId: "s-th1" },
      [first.key],
    );
    expect(second.key).not.toBe(first.key);
  });
});

describe("locked fields", () => {
  const locked = ["cpt"];

  it("passes when the locked field is untouched", () => {
    expect(lockedFieldViolations(locked, schema, schema)).toEqual([]);
  });

  it("blocks removing a locked field", () => {
    const proposed: TemplateSchema = {
      sections: [{ id: "s1", title: "Billing", fields: [schema.sections[0]!.fields[1]!] }],
    };
    const v = lockedFieldViolations(locked, schema, proposed);
    expect(v).toHaveLength(1);
    expect(v[0]!.reason).toBe("removed");
  });

  it("blocks un-requiring and unlocking a locked field", () => {
    const proposed: TemplateSchema = {
      sections: [
        {
          id: "s1",
          title: "Billing",
          fields: [{ key: "cpt", type: "text", label: "CPT code" }],
        },
      ],
    };
    const reasons = lockedFieldViolations(locked, schema, proposed).map((x) => x.reason);
    expect(reasons).toContain("unrequired");
    expect(reasons).toContain("unlocked");
  });

  it("allows adding and editing everything else", () => {
    const proposed: TemplateSchema = {
      sections: [
        {
          id: "s1",
          title: "Billing",
          fields: [
            schema.sections[0]!.fields[0]!,
            { key: "mine", type: "text", label: "My own field" },
          ],
        },
      ],
    };
    expect(lockedFieldViolations(locked, schema, proposed)).toEqual([]);
  });
});
