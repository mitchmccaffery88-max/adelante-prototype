// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { NoteTemplatePicker } from "@/components/clinical/NoteTemplatePicker";
import { AdelanteEHR } from "@/lib/ehr";
import { findMissingRequired } from "@/lib/templateSchema";

describe("NoteTemplatePicker", () => {
  afterEach(cleanup);

  const templates = AdelanteEHR.listNoteTemplates();

  it("shows title, description and the empty-answers required count", () => {
    render(<NoteTemplatePicker templates={templates} value="none" onChange={() => {}} />);
    for (const t of templates) {
      expect(screen.getByText(t.title)).toBeTruthy();
      if (t.description) expect(screen.getByText(t.description)).toBeTruthy();
      const expected = findMissingRequired(t.schema, {}).length;
      expect(screen.getAllByText(`${expected} required`).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("SOAP (no template)")).toBeTruthy();
  });

  it("selects a template by id", () => {
    const onChange = vi.fn();
    render(<NoteTemplatePicker templates={templates} value="none" onChange={onChange} />);
    fireEvent.click(screen.getByText(templates[0]!.title));
    expect(onChange).toHaveBeenCalledWith(templates[0]!.id);
  });
});
