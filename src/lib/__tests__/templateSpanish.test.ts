import { describe, expect, it } from "vitest";
import {
  fieldHelp,
  fieldLabel,
  optionLabel,
  schemaContentEquals,
  schemaHasSpanish,
  sectionTitle,
  spanishReviewPending,
  type TemplateSchema,
} from "@/lib/templateSchema";

const schema: TemplateSchema = {
  sections: [
    {
      id: "s1",
      title: "Presenting concern",
      titleEs: "Motivo de consulta",
      fields: [
        { key: "mood", type: "text", label: "Mood", labelEs: "Estado de ánimo", help: "Today" },
        { key: "sleep", type: "text", label: "Sleep" },
        {
          key: "risk",
          type: "radio",
          label: "Risk",
          labelEs: "Riesgo",
          helpEs: "Marque una opción",
          help: "Pick one",
          options: [
            { value: "yes", label: "Yes", labelEs: "Sí" },
            { value: "no", label: "No" },
          ],
        },
      ],
    },
  ],
};

describe("template Spanish localization", () => {
  it("returns Spanish text when present", () => {
    expect(sectionTitle(schema.sections[0]!, "es")).toBe("Motivo de consulta");
    expect(fieldLabel(schema.sections[0]!.fields[0]!, "es")).toBe("Estado de ánimo");
    expect(fieldHelp(schema.sections[0]!.fields[2]!, "es")).toBe("Marque una opción");
    expect(optionLabel(schema.sections[0]!.fields[2]!.options![0]!, "es")).toBe("Sí");
  });

  it("falls back to English rather than blank when a translation is missing", () => {
    expect(fieldLabel(schema.sections[0]!.fields[1]!, "es")).toBe("Sleep");
    expect(fieldHelp(schema.sections[0]!.fields[0]!, "es")).toBe("Today");
    expect(optionLabel(schema.sections[0]!.fields[2]!.options![1]!, "es")).toBe("No");
  });

  it("treats empty-string translations as missing", () => {
    expect(fieldLabel({ key: "k", type: "text", label: "Mood", labelEs: "   " }, "es")).toBe("Mood");
  });

  it("leaves English rendering untouched", () => {
    expect(sectionTitle(schema.sections[0]!, "en")).toBe("Presenting concern");
    expect(fieldLabel(schema.sections[0]!.fields[0]!, "en")).toBe("Mood");
    expect(optionLabel(schema.sections[0]!.fields[2]!.options![0]!, "en")).toBe("Yes");
  });

  it("flags unreviewed Spanish content and clears once reviewed", () => {
    expect(schemaHasSpanish(schema)).toBe(true);
    expect(spanishReviewPending(schema)).toBe(true);
    expect(spanishReviewPending({ ...schema, esReviewed: true })).toBe(false);
  });

  it("does not flag an English-only schema", () => {
    const en: TemplateSchema = { sections: [{ id: "a", title: "A", fields: [] }] };
    expect(schemaHasSpanish(en)).toBe(false);
    expect(spanishReviewPending(en)).toBe(false);
  });

  it("ignores esReviewed for versioning equality but not translated text", () => {
    expect(schemaContentEquals(schema, { ...schema, esReviewed: true })).toBe(true);
    const changed: TemplateSchema = JSON.parse(JSON.stringify(schema));
    changed.sections[0]!.fields[0]!.labelEs = "Ánimo";
    expect(schemaContentEquals(schema, changed)).toBe(false);
  });
});