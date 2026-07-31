import { describe, expect, it } from "vitest";
import {
  computeScore,
  evalExpr,
  findMissingRequired,
  isFieldVisible,
  requiredFieldSummary,
  type TemplateSchema,
} from "@/lib/templateSchema";

const SCHEMA: TemplateSchema = {
  sections: [
    {
      id: "s1",
      title: "Screening",
      fields: [
        {
          key: "substance_use",
          type: "radio",
          label: "Current substance use?",
          required: true,
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ],
        },
        {
          key: "substances",
          type: "multiselect",
          label: "Which substances",
          required: true,
          show_if: 'substance_use == "yes"',
          options: [
            { value: "opioid", label: "Opioid" },
            { value: "alcohol", label: "Alcohol" },
          ],
        },
      ],
    },
    {
      id: "s2",
      title: "PHQ-2",
      show_if: 'substance_use == "yes" || phq_1 >= 1',
      fields: [
        {
          key: "phq_1",
          type: "radio",
          label: "Little interest",
          options: [
            { value: "0", label: "Not at all", score: 0 },
            { value: "3", label: "Nearly every day", score: 3 },
          ],
        },
        {
          key: "phq_2",
          type: "radio",
          label: "Feeling down",
          options: [
            { value: "0", label: "Not at all", score: 0 },
            { value: "2", label: "More than half the days", score: 2 },
          ],
        },
      ],
    },
  ],
  scoring: [{ id: "phq2", label: "PHQ-2 total", sum_of: ["phq_1", "phq_2"] }],
};

describe("expression evaluator", () => {
  it("compares strings and numbers", () => {
    expect(evalExpr('a == "yes"', { a: "yes" })).toBe(true);
    expect(evalExpr('a != "yes"', { a: "no" })).toBe(true);
    expect(evalExpr("n >= 3", { n: 3 })).toBe(true);
    expect(evalExpr("n > 3", { n: 3 })).toBe(false);
  });

  it("honours && / || and parentheses", () => {
    const answers = { a: "yes", n: 1 };
    expect(evalExpr('a == "yes" && n >= 3', answers)).toBe(false);
    expect(evalExpr('a == "yes" || n >= 3', answers)).toBe(true);
    expect(evalExpr('(a == "no" || n == 1) && a == "yes"', answers)).toBe(true);
  });

  it("is not eval() — arbitrary JS is inert, not executed", () => {
    // The parser never executes JS. Whatever the expression parses to, the
    // injected assignment and call must have no side effect at all.
    evalExpr('globalThis.__pwned = 1; a == "yes"', { a: "yes" });
    evalExpr('fetch("https://evil.example")', {});
    expect((globalThis as Record<string, unknown>)["__pwned"]).toBeUndefined();
    // Unknown identifiers resolve to undefined answers, never to globals.
    expect(evalExpr("globalThis == undefined_key", {})).toBe(true);
  });
});

describe("conditional visibility", () => {
  it("hides a field whose show_if is unmet", () => {
    const field = SCHEMA.sections[0]!.fields[1]!;
    expect(isFieldVisible(field, { substance_use: "no" })).toBe(false);
    expect(isFieldVisible(field, { substance_use: "yes" })).toBe(true);
  });
});

describe("findMissingRequired", () => {
  it("ignores required fields that are hidden", () => {
    const missing = findMissingRequired(SCHEMA, { substance_use: "no" });
    expect(missing).toHaveLength(0);
  });

  it("reports a visible required field left blank", () => {
    const missing = findMissingRequired(SCHEMA, { substance_use: "yes" });
    expect(missing.map((m) => m.key)).toEqual(["substances"]);
  });

  it("accepts a non-empty multiselect", () => {
    const missing = findMissingRequired(SCHEMA, {
      substance_use: "yes",
      substances: ["opioid"],
    });
    expect(missing).toHaveLength(0);
  });
});

describe("computeScore", () => {
  it("sums option scores and flags an incomplete total", () => {
    const partial = computeScore(SCHEMA, { substance_use: "yes", phq_1: "3" });
    expect(partial[0]!.total).toBe(3);
    expect(partial[0]!.incomplete).toBe(true);

    const full = computeScore(SCHEMA, { substance_use: "yes", phq_1: "3", phq_2: "2" });
    expect(full[0]!.total).toBe(5);
    expect(full[0]!.incomplete).toBe(false);
  });
});
describe("requiredFieldSummary", () => {
  it("baseline matches findMissingRequired against an empty answer set", () => {
    const s = requiredFieldSummary(SCHEMA);
    expect(s.baseline).toBe(findMissingRequired(SCHEMA, {}).length);
    expect(s.baseline).toBe(1); // substance_use only; `substances` is hidden
  });

  it("reports conditionally-gated required fields separately", () => {
    expect(requiredFieldSummary(SCHEMA).conditional).toBe(1); // `substances`
  });

  it("counts section-level gating too, and handles an empty schema", () => {
    const schema: TemplateSchema = {
      sections: [
        {
          id: "a",
          title: "A",
          show_if: 'flag == "yes"',
          fields: [{ key: "x", type: "text", label: "X", required: true }],
        },
      ],
    };
    expect(requiredFieldSummary(schema)).toEqual({ baseline: 0, conditional: 1 });
    expect(requiredFieldSummary(undefined)).toEqual({ baseline: 0, conditional: 0 });
  });
});
