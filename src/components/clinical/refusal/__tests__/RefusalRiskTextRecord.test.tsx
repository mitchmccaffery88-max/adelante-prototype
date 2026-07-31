// @vitest-environment jsdom
//
// The finalized refusal record must show BOTH frozen wordings — the language
// the patient signed in and the reviewed English text — with version + review
// state, and only for roles with meds_erx access.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { RefusalRiskTextRecord } = await import(
  "@/components/clinical/refusal/RefusalRiskTextRecord"
);
const { setActingRole } = await import("@/lib/roles");
const { RISK_TEXT_CATALOG, RISK_TEXT_CATALOG_ES } = await import("@/lib/refusal");

afterEach(cleanup);

const esForm = {
  id: "f1",
  patientId: "p1",
  administrationId: "a1",
  status: "finalized",
  medClass: "psychiatric",
  riskTextVersion: "es-v1-draft",
  riskTextSnapshot: RISK_TEXT_CATALOG_ES.psychiatric.text,
  riskTextSnapshotEn: RISK_TEXT_CATALOG.psychiatric.text,
  riskTextReviewed: false,
  riskTextSnapshotEnLocked: false,
  languageCode: "es",
  capacityFlagsAtSigning: [],
  guardianRequired: false,
  nurseAttested: true,
  patientSigned: false,
  createdBy: "Rosa T., LVN",
  createdAt: new Date().toISOString(),
} as never as Parameters<typeof RefusalRiskTextRecord>[0]["form"];

describe("RefusalRiskTextRecord", () => {
  it("shows the signed Spanish wording alongside the reviewed English wording", () => {
    setActingRole("pmhnp");
    render(<RefusalRiskTextRecord form={esForm} />);
    expect(screen.getByText(RISK_TEXT_CATALOG_ES.psychiatric.text)).toBeTruthy();
    expect(screen.getByText(RISK_TEXT_CATALOG.psychiatric.text)).toBeTruthy();
    expect(screen.getByText(/Wording signed \(ES\)/i)).toBeTruthy();
    expect(screen.getByText(/Reviewed English wording \(on record\)/i)).toBeTruthy();
    expect(screen.getByText("Language: ES")).toBeTruthy();
    expect(screen.getByText("Risk text es-v1-draft")).toBeTruthy();
    expect(screen.getByText(/Draft translation — not clinically reviewed/i)).toBeTruthy();
  });

  it("labels an approved translation as reviewed with a locked English reference", () => {
    setActingRole("pmhnp");
    render(
      <RefusalRiskTextRecord
        form={
          {
            ...esForm,
            riskTextVersion: "es-v1",
            riskTextReviewed: true,
            riskTextSnapshotEnLocked: true,
          } as never as Parameters<typeof RefusalRiskTextRecord>[0]["form"]
        }
      />,
    );
    expect(screen.getByText("Reviewed")).toBeTruthy();
    expect(screen.getByText(/English reference locked/i)).toBeTruthy();
    expect(screen.getByText(/English wording \(locked reference copy\)/i)).toBeTruthy();
  });

  it("shows a single wording block for an English-only form", () => {
    setActingRole("pmhnp");
    const en = {
      ...esForm,
      languageCode: "en",
      riskTextVersion: "en-v1",
      riskTextSnapshot: RISK_TEXT_CATALOG.psychiatric.text,
      riskTextSnapshotEn: RISK_TEXT_CATALOG.psychiatric.text,
      riskTextReviewed: true,
      riskTextSnapshotEnLocked: true,
    } as never as Parameters<typeof RefusalRiskTextRecord>[0]["form"];
    render(<RefusalRiskTextRecord form={en} />);
    expect(screen.getByText("Wording signed")).toBeTruthy();
    expect(screen.queryByText(/locked reference copy/i)).toBeNull();
    expect(screen.queryByText(/English reference locked/i)).toBeNull();
  });

  it("hides the wording from roles with no meds access", () => {
    setActingRole("peer_specialist");
    render(<RefusalRiskTextRecord form={esForm} />);
    expect(screen.getByText(/restricted to clinical roles/i)).toBeTruthy();
    expect(screen.queryByText(RISK_TEXT_CATALOG_ES.psychiatric.text)).toBeNull();
    setActingRole("pmhnp");
  });
});
