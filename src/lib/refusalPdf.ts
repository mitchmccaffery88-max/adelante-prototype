import { jsPDF } from "jspdf";
import type { DoseAdministration, MedOrder, Patient, RefusalForm } from "./ehr";

const MARGIN = 48;
const WIDTH = 595; // A4 portrait points
const HEIGHT = 842;

function fmt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * Renders a finalized refusal form as a one-page (or paginated) legal record,
 * including the nurse, witness and patient signature blocks. Drawn signatures
 * are embedded as images; when a party declined to sign, the block records the
 * decline reason instead so the absence is explicit rather than blank.
 */
export function buildRefusalFormPdf(args: {
  form: RefusalForm;
  patient: Patient;
  order?: MedOrder;
  administration?: DoseAdministration;
  medicationLabel?: string;
}): jsPDF {
  const { form, patient, administration, medicationLabel } = args;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN;

  const ensure = (needed: number) => {
    if (y + needed > HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text: string) => {
    ensure(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(text, MARGIN, y);
    y += 14;
    doc.setDrawColor(190);
    doc.line(MARGIN, y - 6, WIDTH - MARGIN, y - 6);
  };

  const line = (label: string, value: string) => {
    const wrapped = doc.splitTextToSize(value || "—", WIDTH - MARGIN * 2 - 120);
    ensure(wrapped.length * 13 + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(wrapped, MARGIN + 120, y);
    y += wrapped.length * 13 + 2;
  };

  const paragraph = (text: string) => {
    const wrapped = doc.splitTextToSize(text, WIDTH - MARGIN * 2);
    ensure(wrapped.length * 12 + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 12 + 6;
  };

  const signatureBlock = (
    title: string,
    opts: { dataUrl?: string; name?: string; at?: string; note?: string },
  ) => {
    ensure(96);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(title, MARGIN, y);
    y += 8;
    doc.setDrawColor(160);
    doc.rect(MARGIN, y, 240, 56);
    if (opts.dataUrl) {
      try {
        doc.addImage(opts.dataUrl, "PNG", MARGIN + 4, y + 4, 232, 48);
      } catch {
        /* unreadable signature payload — leave the box empty */
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(opts.note ?? "No signature captured", MARGIN + 8, y + 32);
      doc.setTextColor(0);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(opts.name ?? "—", MARGIN + 256, y + 24);
    doc.text(fmt(opts.at), MARGIN + 256, y + 40);
    y += 72;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Medication Refusal — Informed Refusal Record", MARGIN, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `Form ${form.id} · status ${form.status} · attestation ${form.attestationMethod}`,
    MARGIN,
    y,
  );
  doc.setTextColor(0);
  y += 20;

  heading("Patient");
  line("Name", `${patient.firstName} ${patient.lastName}`);
  line("Date of birth", patient.dob);
  line("Patient ID (MRN)", patient.id);
  line("Language", form.languageCode);

  heading("Medication refused");
  line("Medication", medicationLabel ?? "—");
  line("Scheduled", fmt(administration?.scheduledAt));
  line("Charted", fmt(administration?.chartedAt));
  line("Refusal reason", administration?.reason ?? "—");
  line("Medication class", form.medClass === "*" ? "general" : form.medClass);

  heading(`Risk / benefit disclosure (${form.riskTextVersion})`);
  paragraph(form.riskTextSnapshot);
  if (form.riskTextReviewed === false) {
    paragraph(
      "NOTE: the wording above is a draft translation awaiting clinical sign-off. The clinically reviewed English wording is reproduced below.",
    );
    if (form.riskTextSnapshotEn) paragraph(form.riskTextSnapshotEn);
  }

  if (form.capacityFlagsAtSigning.length > 0) {
    heading("Capacity flags");
    paragraph(
      `Active capacity-related alerts at signing: ${form.capacityFlagsAtSigning.join(", ")}. Signature collected for completeness only; it does not override the underlying order. Prescriber notified per protocol.`,
    );
  }
  if (form.guardianRequired) {
    heading("Guardian");
    paragraph(
      "Patient is a minor — guardian notification required per protocol. Guardian signature capture is not yet part of this record.",
    );
  }

  if (form.interpreterUsed) {
    heading("Interpretation");
    line("Method", form.interpreterMethod ?? "—");
    line("Interpreter", form.interpreterName ?? "—");
    if (form.interpreterAbsentJustification)
      line("Justification", form.interpreterAbsentJustification);
  }

  heading("Signatures");
  signatureBlock("Nurse", {
    dataUrl: form.nurseSignatureDataUrl,
    name: form.finalizedBy ?? form.createdBy,
    at: form.finalizedAt ?? form.createdAt,
  });
  signatureBlock("Patient", {
    dataUrl: form.patientSigned ? form.patientSignatureDataUrl : undefined,
    name: `${patient.firstName} ${patient.lastName}`,
    at: form.finalizedAt,
    note: form.patientSigned
      ? "No signature captured"
      : `Declined to sign — ${form.patientDeclineReason ?? "no reason recorded"}`,
  });
  if (form.witnessRequired || form.witnessSignatureDataUrl) {
    signatureBlock("Witness", {
      dataUrl: form.witnessSignatureDataUrl,
      name: form.witnessStaffName,
      at: form.finalizedAt,
    });
  }
  if (form.patientDeclineNotes) line("Decline notes", form.patientDeclineNotes);
  if (form.nurseNote) line("Nurse note", form.nurseNote);

  ensure(24);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Nurse attested: ${form.nurseAttested ? "yes" : "no"} · Exported ${new Date().toLocaleString()}`,
    MARGIN,
    HEIGHT - MARGIN + 16,
  );
  doc.setTextColor(0);

  return doc;
}

export function refusalPdfFilename(form: RefusalForm, patient: Patient): string {
  const date = (form.finalizedAt ?? form.createdAt).slice(0, 10);
  return `refusal-${patient.lastName.toLowerCase()}-${date}-${form.id.slice(0, 6)}.pdf`;
}

/** One-click export: builds and downloads the PDF in the browser. */
export function downloadRefusalFormPdf(
  args: Parameters<typeof buildRefusalFormPdf>[0],
): string {
  const doc = buildRefusalFormPdf(args);
  const filename = refusalPdfFilename(args.form, args.patient);
  doc.save(filename);
  return filename;
}