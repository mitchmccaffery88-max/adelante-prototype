// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TemplateForm } from "@/components/clinical/TemplateForm";
import type { TemplateSchema } from "@/lib/templateSchema";

const schema: TemplateSchema = {
  sections: [
    {
      id: "s1",
      title: "Presenting concern",
      titleEs: "Motivo de consulta",
      fields: [
        { key: "mood", type: "text", label: "Mood", labelEs: "Estado de ánimo" },
        { key: "sleep", type: "text", label: "Sleep hours" },
        {
          key: "risk",
          type: "radio",
          label: "Risk",
          labelEs: "Riesgo",
          options: [
            { value: "yes", label: "Yes", labelEs: "Sí" },
            { value: "no", label: "No" },
          ],
        },
      ],
    },
  ],
};

describe("TemplateForm Spanish rendering", () => {
  afterEach(cleanup);

  it("renders English only when the language is English", () => {
    render(<TemplateForm schema={schema} answers={{}} onChange={() => {}} />);
    expect(screen.getByText("Presenting concern")).toBeTruthy();
    expect(screen.getByText("Mood")).toBeTruthy();
    expect(screen.queryByText("Estado de ánimo")).toBeNull();
    expect(screen.queryByTestId("template-es-draft-banner")).toBeNull();
  });

  it("renders Spanish where present and English where absent — never blank", () => {
    render(<TemplateForm schema={schema} answers={{}} onChange={() => {}} language="es" />);
    expect(screen.getByText("Motivo de consulta")).toBeTruthy();
    expect(screen.getByText("Estado de ánimo")).toBeTruthy();
    // No Spanish label authored for this one — English must still show.
    expect(screen.getByText("Sleep hours")).toBeTruthy();
    expect(screen.getByText("Sí")).toBeTruthy();
    expect(screen.getByText("No")).toBeTruthy();
  });

  it("shows the draft-translation indicator until esReviewed is true", () => {
    const { unmount } = render(
      <TemplateForm schema={schema} answers={{}} onChange={() => {}} language="es" />,
    );
    expect(screen.getByTestId("template-es-draft-banner").textContent).toContain(
      "pendiente de revisión clínica",
    );
    unmount();
    render(
      <TemplateForm
        schema={{ ...schema, esReviewed: true }}
        answers={{}}
        onChange={() => {}}
        language="es"
      />,
    );
    expect(screen.queryByTestId("template-es-draft-banner")).toBeNull();
  });

  it("shows no draft indicator for an English-only schema viewed in Spanish", () => {
    const en: TemplateSchema = {
      sections: [{ id: "a", title: "A", fields: [{ key: "k", type: "text", label: "K" }] }],
    };
    render(<TemplateForm schema={en} answers={{}} onChange={() => {}} language="es" />);
    expect(screen.queryByTestId("template-es-draft-banner")).toBeNull();
    expect(screen.getByText("K")).toBeTruthy();
  });
});