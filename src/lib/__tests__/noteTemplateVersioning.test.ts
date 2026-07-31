import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { findMissingRequired, type TemplateSchema } from "@/lib/templateSchema";

const STAFF = "Adelante System Admin";
const v1Schema: TemplateSchema = {
  sections: [
    { id: "s", title: "S", fields: [{ key: "a", type: "text", label: "A", required: true }] },
  ],
};
const v2Schema: TemplateSchema = {
  sections: [
    {
      id: "s",
      title: "S",
      fields: [
        { key: "a", type: "text", label: "A", required: true },
        { key: "b", type: "text", label: "B", required: true },
      ],
    },
  ],
};

function newTemplate(key: string) {
  return AdelanteEHR.createNoteTemplate(
    { key, title: `T ${key}`, encounterType: "intake", schema: v1Schema },
    STAFF,
  );
}

describe("note template versioning", () => {
  it("starts at version 1", () => {
    expect(newTemplate("ver_a").version).toBe(1);
  });

  it("title-only edits patch in place and do not bump the version", () => {
    const t = newTemplate("ver_b");
    const out = AdelanteEHR.updateNoteTemplate(t.id, { title: "Renamed" }, STAFF);
    expect(out.id).toBe(t.id);
    expect(out.version).toBe(1);
    expect(out.title).toBe("Renamed");
    expect(AdelanteEHR.listNoteTemplateVersions("ver_b")).toHaveLength(1);
  });

  it("a schema edit appends a new immutable version and supersedes the old row", () => {
    const t = newTemplate("ver_c");
    const v2 = AdelanteEHR.updateNoteTemplate(t.id, { schema: v2Schema }, STAFF);
    expect(v2.version).toBe(2);
    expect(v2.id).not.toBe(t.id);
    expect(v2.key).toBe(t.key);
    expect(v2.active).toBe(true);

    const old = AdelanteEHR.getNoteTemplate(t.id)!;
    expect(old.supersededBy).toBe(v2.id);
    // v1's schema is untouched by the edit.
    expect(old.schema.sections[0]!.fields).toHaveLength(1);
    expect(AdelanteEHR.listNoteTemplateVersions("ver_c").map((r) => r.version)).toEqual([1, 2]);
  });

  it("listNoteTemplates offers only the latest version; superseded stays queryable", () => {
    const t = newTemplate("ver_d");
    const v2 = AdelanteEHR.updateNoteTemplate(t.id, { schema: v2Schema }, STAFF);
    const listed = AdelanteEHR.listNoteTemplates();
    expect(listed.some((r) => r.id === v2.id)).toBe(true);
    expect(listed.some((r) => r.id === t.id)).toBe(false);
    expect(AdelanteEHR.listNoteTemplates(true, true).some((r) => r.id === t.id)).toBe(true);
    expect(AdelanteEHR.getNoteTemplate(t.id)).toBeDefined();
  });

  it("refuses to edit a superseded version", () => {
    const t = newTemplate("ver_e");
    AdelanteEHR.updateNoteTemplate(t.id, { schema: v2Schema }, STAFF);
    expect(() => AdelanteEHR.updateNoteTemplate(t.id, { title: "x" }, STAFF)).toThrow(
      /superseded/i,
    );
  });

  it("a note answered on v1 still validates against v1 after v2 exists", () => {
    const patientId = AdelanteEHR.listPatients()[0]!.id;
    const t = newTemplate("ver_f");
    const note = AdelanteEHR.addProgressNote(patientId, {
      clinicianId: "c1",
      date: new Date().toISOString(),
      sessionType: "individual",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      authorSource: "human",
      status: "draft",
      templateId: t.id,
      templateKey: t.key,
      templateTitle: t.title,
      templateVersion: t.version,
      templateSchema: t.schema,
      templateAnswers: { a: "answered" },
    })!;
    AdelanteEHR.updateNoteTemplate(t.id, { schema: v2Schema }, STAFF);

    expect(note.templateVersion).toBe(1);
    expect(note.templateSchema!.sections[0]!.fields).toHaveLength(1);
    // v2's new required field must not retroactively invalidate the v1 note.
    expect(findMissingRequired(note.templateSchema, note.templateAnswers!)).toHaveLength(0);
    expect(findMissingRequired(v2Schema, note.templateAnswers!).map((m) => m.key)).toEqual(["b"]);
  });
});
