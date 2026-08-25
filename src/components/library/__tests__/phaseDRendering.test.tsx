// @vitest-environment jsdom
// §Lesson-player Phase D — the populated case. These lessons are TEST-ONLY
// fixtures: nothing here is authored into the shipped catalog.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ContentForm } from "@/components/admin/ContentForm";
import { LIBRARY_LESSON_TYPE } from "@/lib/contentTypes";
import { LearnStages, IfThenStep } from "@/components/library/ModuleTemplate";
import { I18nProvider } from "@/lib/i18n";

const wrap = (ui: React.ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

describe("learn stages renderer", () => {
  it("paginates through authored parts", () => {
    wrap(
      <LearnStages
        stages={[
          { title: "Part one", body: "first body" },
          { title: "Part two", body: "second body" },
        ]}
      />,
    );
    expect(screen.getByText("first body")).toBeTruthy();
    expect(screen.queryByText("second body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /next part/i }));
    expect(screen.getByText("second body")).toBeTruthy();
  });
});

describe("if/then picker", () => {
  it("records picks on both sides and shows the assembled plan", () => {
    const onChange = vi.fn();
    wrap(
      <IfThenStep
        practice={{ ifOptions: ["I can't sleep"], thenOptions: ["I text my sponsor"] }}
        ifPicks={[]}
        thenPicks={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "I can't sleep" }));
    expect(onChange).toHaveBeenCalledWith({
      ifPicks: ["I can't sleep"],
      thenPicks: [],
    });

    onChange.mockClear();
    wrap(
      <IfThenStep
        practice={{ ifOptions: ["I can't sleep"], thenOptions: ["I text my sponsor"] }}
        ifPicks={["I can't sleep"]}
        thenPicks={["I text my sponsor"]}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByText(/I text my sponsor/).length).toBeGreaterThan(1);
  });
});

describe("admin authoring inputs", () => {
  it("offers stage, toggle and if/then inputs on the library lesson form", () => {
    let body: Record<string, unknown> = {};
    const rerenderable = wrap(
      <ContentForm
        descriptor={LIBRARY_LESSON_TYPE}
        body={body}
        onChange={(next) => {
          body = next as Record<string, unknown>;
        }}
      />,
    );
    // The repeatable teaching-part editor exists and can add a part.
    fireEvent.click(screen.getByRole("button", { name: /add teaching part/i }));
    expect(body["learnStages"]).toEqual([{ title: "", body: "" }]);

    // The rating-direction toggle writes a real boolean.
    fireEvent.click(screen.getByTestId("field-ratingPrimary.higherIsHarder"));
    expect((body["ratingPrimary"] as Record<string, unknown>)["higherIsHarder"]).toBe(true);

    expect(screen.getByText(/If–then plan: IF options/i)).toBeTruthy();
    expect(screen.getByText(/Part 1 headline/i)).toBeTruthy();
    rerenderable.unmount();
  });

  it("refuses a half-authored if/then plan", () => {
    const errors = LIBRARY_LESSON_TYPE.validate({
      ifThenPractice: { ifOptions: ["a"], thenOptions: [] },
    });
    expect(errors.join(" ")).toMatch(/THEN option/);
  });
});
