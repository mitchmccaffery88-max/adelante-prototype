import { describe, expect, it } from "vitest";
import { buildRefusalFormPdf, refusalPdfFilename } from "../refusalPdf";
import type { Patient, RefusalForm } from "../ehr";

const patient = {
  id: "p-1",
  firstName: "Alicia",
  lastName: "Rivera",
  dob: "1990-04-02",
} as unknown as Patient;

const form: RefusalForm = {
  id: "rf-123456",
  patientId: "p-1",
  administrationId: "a-1",
  status: "finalized",
  medClass: "psychiatric",
  riskTextVersion: "v1",
  riskTextSnapshot: "Skipping this medication may worsen symptoms.",
  languageCode: "en",
  capacityFlagsAtSigning: [],
  guardianRequired: false,
  nurseAttested: true,
  nurseSignatureDataUrl: undefined,
  patientSigned: false,
  patientDeclineReason: "declined_to_sign",
  witnessRequired: true,
  witnessStaffName: "RN Chen",
  attestationMethod: "checkbox_only",
  finalizedBy: "RN Smith",
  finalizedAt: "2026-07-30T10:00:00.000Z",
  createdAt: "2026-07-30T09:00:00.000Z",
  createdBy: "RN Smith",
};

describe("refusal form PDF export", () => {
  it("renders a document with nurse, patient and witness signature sections", () => {
    const doc = buildRefusalFormPdf({ form, patient, medicationLabel: "Sertraline 50 mg PO daily" });
    const text = doc.output("datauristring");
    expect(text.startsWith("data:application/pdf")).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("names the file by patient and finalize date", () => {
    expect(refusalPdfFilename(form, patient)).toBe("refusal-rivera-2026-07-30-rf-123.pdf");
  });
});
