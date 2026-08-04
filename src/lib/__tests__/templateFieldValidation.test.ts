import { describe, expect, it } from "vitest";
import { findMissingRequired, type TemplateSchema } from "@/lib/templateSchema";

const schema = (fields: NonNullable<TemplateSchema["sections"]>[number]["fields"]): TemplateSchema => ({
  sections: [{ id: "s", title: "Section", fields }],
});

const keys = (s: TemplateSchema, a: Record<string, unknown>) =>
  findMissingRequired(s, a as never).map((m) => `${m.key}:${m.problem}`);

describe("per-field-type validation in findMissingRequired", () => {
  it("number: boundary values pass, one unit outside fails", () => {
    const s = schema([{ key: "bp", type: "number", label: "BP", required: true, min: 40, max: 200 }]);
    expect(keys(s, { bp: 40 })).toEqual([]);
    expect(keys(s, { bp: 200 })).toEqual([]);
    expect(keys(s, { bp: 39 })).toEqual(["bp:invalid"]);
    expect(keys(s, { bp: 201 })).toEqual(["bp:invalid"]);
    expect(findMissingRequired(s, { bp: 201 } as never)[0].reason).toMatch(/at most 200/);
  });

  it("number: a non-numeric string is invalid", () => {
    const s = schema([{ key: "n", type: "number", label: "N", required: true }]);
    expect(keys(s, { n: "abc" })).toEqual(["n:invalid"]);
    expect(keys(s, { n: "12" })).toEqual([]);
  });

  it("text/textarea: whitespace-only does not satisfy required", () => {
    const s = schema([
      { key: "t", type: "text", label: "T", required: true },
      { key: "ta", type: "textarea", label: "TA", required: true },
    ]);
    expect(keys(s, { t: "", ta: "" })).toEqual(["t:missing", "ta:missing"]);
    expect(keys(s, { t: "   ", ta: "\n\t " })).toEqual(["t:missing", "ta:missing"]);
    expect(keys(s, { t: "x", ta: "y" })).toEqual([]);
  });

  it("select/radio: a programmatically written value outside the option list is invalid", () => {
    const s = schema([
      {
        key: "r",
        type: "radio",
        label: "R",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "sel",
        type: "select",
        label: "S",
        options: [{ value: "a", label: "A" }],
      },
    ]);
    expect(keys(s, { r: "yes", sel: "a" })).toEqual([]);
    expect(keys(s, { r: "maybe", sel: "zz" })).toEqual(["r:invalid", "sel:invalid"]);
  });

  it("multiselect: every entry must be a real option", () => {
    const s = schema([
      {
        key: "ms",
        type: "multiselect",
        label: "MS",
        required: true,
        options: [
          { value: "opioid", label: "Opioid" },
          { value: "alcohol", label: "Alcohol" },
        ],
      },
    ]);
    expect(keys(s, { ms: ["opioid", "alcohol"] })).toEqual([]);
    expect(keys(s, { ms: ["opioid", "unicorn"] })).toEqual(["ms:invalid"]);
    expect(findMissingRequired(s, { ms: ["opioid", "unicorn"] } as never)[0].reason).toMatch(
      /unicorn/,
    );
    expect(keys(s, { ms: [] })).toEqual(["ms:missing"]);
  });

  it("date: unparseable is invalid; year bounds enforced when declared", () => {
    const s = schema([
      { key: "dob", type: "date", label: "DOB", required: true, min: 1900, max: 2020 },
    ]);
    expect(keys(s, { dob: "1990-05-04" })).toEqual([]);
    expect(keys(s, { dob: "2020-12-31" })).toEqual([]);
    expect(keys(s, { dob: "2099-01-01" })).toEqual(["dob:invalid"]);
    expect(keys(s, { dob: "not-a-date" })).toEqual(["dob:invalid"]);
  });

  it("date: ISO string bounds are honoured", () => {
    const s = schema([
      { key: "d", type: "datetime", label: "D", min: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(keys(s, { d: "2026-02-01T10:00:00.000Z" })).toEqual([]);
    expect(keys(s, { d: "2025-12-31T10:00:00.000Z" })).toEqual(["d:invalid"]);
  });

  it("fields with no min/max/options are completely unaffected", () => {
    const s = schema([
      { key: "free", type: "text", label: "Free" },
      { key: "num", type: "number", label: "Num" },
      { key: "day", type: "date", label: "Day" },
      { key: "pick", type: "select", label: "Pick" },
      { key: "many", type: "multiselect", label: "Many" },
    ]);
    expect(
      keys(s, {
        free: "anything at all",
        num: -99999,
        day: "1899-01-01",
        pick: "whatever",
        many: ["a", "b"],
      }),
    ).toEqual([]);
  });
});
