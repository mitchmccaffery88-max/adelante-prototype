// §Scribe Phase 1 — note formats the AI scribe drafts into (SOAP, DAP, BIRP,
// GIRP). Pure: no store import, so ehr.ts can seed the templates from here.
// Every format carries the same DMC-ODS required elements block the chart
// note form uses (service type, date, minutes, modality, location, response,
// next steps). Structure is product-authored: Draft — pending clinical sign-off.
import type { NoteTemplate, TemplateSchema } from "./ehr";

export type ScribeFormat = "soap" | "dap" | "birp" | "girp";
export const SCRIBE_FORMATS: readonly ScribeFormat[] = ["soap", "dap", "birp", "girp"];
export const SCRIBE_FORMAT_LABEL: Record<ScribeFormat, string> = {
  soap: "SOAP",
  dap: "DAP",
  birp: "BIRP",
  girp: "GIRP",
};
export const SCRIBE_FORMAT_DRAFT = "Note formats: Draft — pending clinical sign-off";

/** Narrative sections per format: key + label + which classic SOAP field it maps to for version snapshots. */
export const FORMAT_SECTIONS: Record<ScribeFormat, { key: string; label: string; soap: "subjective" | "objective" | "assessment" | "plan" }[]> = {
  soap: [
    { key: "soap_subjective", label: "Subjective", soap: "subjective" },
    { key: "soap_objective", label: "Objective", soap: "objective" },
    { key: "soap_assessment", label: "Assessment", soap: "assessment" },
    { key: "soap_plan", label: "Plan", soap: "plan" },
  ],
  dap: [
    { key: "dap_data", label: "Data", soap: "subjective" },
    { key: "dap_assessment", label: "Assessment", soap: "assessment" },
    { key: "dap_plan", label: "Plan", soap: "plan" },
  ],
  birp: [
    { key: "birp_behavior", label: "Behavior", soap: "subjective" },
    { key: "birp_intervention", label: "Intervention", soap: "objective" },
    { key: "birp_response", label: "Response", soap: "assessment" },
    { key: "birp_plan", label: "Plan", soap: "plan" },
  ],
  girp: [
    { key: "girp_goal", label: "Goal", soap: "subjective" },
    { key: "girp_intervention", label: "Intervention", soap: "objective" },
    { key: "girp_response", label: "Response", soap: "assessment" },
    { key: "girp_plan", label: "Plan", soap: "plan" },
  ],
};

/** DMC-ODS required elements (same set as the chart note form). */
export const DMC_ODS_ELEMENT_KEYS = ["service_type", "service_date", "service_minutes", "modality", "location", "client_response", "next_steps"] as const;
export type DmcOdsElement = (typeof DMC_ODS_ELEMENT_KEYS)[number];
/** Elements drafted as sentences (with provenance); the rest come from the visit. */
export const DMC_NARRATIVE_KEYS: DmcOdsElement[] = ["client_response", "next_steps"];

export function templateKeyFor(format: ScribeFormat): string {
  return `scribe_${format}`;
}

function schemaFor(format: ScribeFormat): TemplateSchema {
  return {
    sections: [
      {
        id: `${format}_narrative`,
        title: `${SCRIBE_FORMAT_LABEL[format]} note`,
        fields: FORMAT_SECTIONS[format].map((s) => ({ key: s.key, type: "textarea", label: s.label, required: true, rows: 4 })),
      },
      {
        id: "dmc_ods",
        title: "DMC-ODS required elements",
        fields: [
          { key: "service_type", type: "text", label: "Service type", required: true },
          { key: "service_date", type: "date", label: "Date of service", required: true },
          { key: "service_minutes", type: "number", label: "Minutes", required: true },
          { key: "modality", type: "text", label: "Modality (in person / video / phone)", required: true },
          { key: "location", type: "text", label: "Location", required: true },
          { key: "client_response", type: "textarea", label: "Client response", required: true, rows: 3 },
          { key: "next_steps", type: "textarea", label: "Next steps", required: true, rows: 3 },
        ],
      },
    ],
  } as unknown as TemplateSchema;
}

export function scribeTemplates(now = new Date().toISOString()): NoteTemplate[] {
  return SCRIBE_FORMATS.map((f) => ({
    id: `tpl-scribe-${f}`,
    key: templateKeyFor(f),
    version: 1,
    title: `${SCRIBE_FORMAT_LABEL[f]} progress note`,
    description: `${SCRIBE_FORMAT_LABEL[f]} format with the DMC-ODS required elements. ${SCRIBE_FORMAT_DRAFT}.`,
    encounterType: "progress",
    active: true,
    createdBy: "Adelante System Admin",
    createdAt: now,
    schema: schemaFor(f),
  }));
}

/** Default format: from the note template key, else the visit type (Draft mapping). */
export function defaultFormat(input: { templateKey?: string; serviceType?: string }): ScribeFormat {
  const k = input.templateKey?.toLowerCase() ?? "";
  for (const f of SCRIBE_FORMATS) if (k.includes(f)) return f;
  const s = input.serviceType ?? "";
  if (s.startsWith("sud_group")) return "girp";
  if (s === "sud_counseling" || s === "case_management" || s === "care_coordination") return "dap";
  if (s === "peer_support") return "birp";
  return "soap";
}
