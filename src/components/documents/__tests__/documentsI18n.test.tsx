// @vitest-environment jsdom
//
// §Group E item 4 — proves the document UI strings really flow through the
// shared I18nProvider (not hard-coded English), by rendering the real
// components at lang=es. Also covers item 2's UI edge: the download control
// is present but refused while a document is unverified.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { PatientDocumentsCard } from "@/components/documents/PatientDocumentsCard";
import { AdvocateDocumentsPanel } from "@/components/advocate/AdvocateWorkspace";
import { AdelanteEHR } from "@/lib/ehr";

function renderIn(lang: "en" | "es", ui: React.ReactNode) {
  localStorage.setItem("adelante.lang", lang);
  return render(<I18nProvider>{ui}</I18nProvider>);
}

let n = 0;
function patientWithDoc(verified: boolean) {
  const p = AdelanteEHR.createPatient({ firstName: "I18n", lastName: `Doc${++n}` });
  const res = AdelanteEHR.uploadPatientDocument({
    patientId: p.id,
    file: { fileName: `carta-${n}.pdf`, mimeType: "application/pdf", sizeBytes: 1024 },
    isPart2: false,
    uploader: { kind: "patient", name: "I18n Patient" },
  });
  if (!res.ok) throw new Error(res.reason);
  if (verified)
    AdelanteEHR.verifyPatientDocument(res.document.id, {
      staffName: "Nurse Vega",
      role: "ecm_provider",
    });
  return p;
}

afterEach(cleanup);

describe("Spanish rendering of the patient document surface", () => {
  it("renders the heading and status in English by default", () => {
    const p = patientWithDoc(true);
    renderIn("en", <PatientDocumentsCard patientId={p.id} />);
    expect(screen.getByText("Your documents")).toBeTruthy();
    expect(screen.getByText("In your record")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download record/i })).toBeTruthy();
  });

  it("renders the heading, status and download control in Spanish", () => {
    const p = patientWithDoc(true);
    renderIn("es", <PatientDocumentsCard patientId={p.id} />);
    expect(screen.getByText("Tus documentos")).toBeTruthy();
    expect(screen.getByText("En tu expediente")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Descargar registro/i })).toBeTruthy();
  });

  it("shows the pending status in Spanish and disables download until review", () => {
    const p = patientWithDoc(false);
    renderIn("es", <PatientDocumentsCard patientId={p.id} />);
    expect(screen.getByText("Pendiente de revisión")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Descargar registro/i }).hasAttribute("disabled"),
    ).toBe(true);
  });
});

describe("Spanish rendering of the advocate document panel", () => {
  function connectedAdvocate(patientId: string) {
    const link = AdelanteEHR.createAdvocateInvitation({
      patientId,
      advocateName: "Advocate I18n",
      relationship: "Sister",
      invitationSentTo: `advi18n${++n}@example.org`,
      invitationChannel: "email",
      designatedBy: { actor: "patient", name: "I18n Patient" },
    });
    AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "hipaa_authorization",
      attestedName: "Advocate",
    });
    return link.id;
  }

  it("renders the restricted badge in Spanish for a Part 2 document", () => {
    const p = AdelanteEHR.createPatient({ firstName: "I18n", lastName: `Adv${++n}` });
    const linkId = connectedAdvocate(p.id);
    const up = AdelanteEHR.uploadPatientDocument({
      patientId: p.id,
      file: { fileName: "sud.pdf", mimeType: "application/pdf", sizeBytes: 1024 },
      isPart2: true,
      uploader: { kind: "patient", name: "I18n Patient" },
    });
    if (!up.ok) throw new Error(up.reason);
    AdelanteEHR.verifyPatientDocument(up.document.id, {
      staffName: "Nurse Vega",
      role: "ecm_provider",
    });

    renderIn("es", <AdvocateDocumentsPanel linkId={linkId} />);
    expect(screen.getByText("Restringido")).toBeTruthy();
  });
});
