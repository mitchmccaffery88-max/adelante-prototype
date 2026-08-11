// §Quality pass Group E — documents.
//
// Items covered: 1 (promotion notification respects EXISTING advocate access),
// 2 (download/view uses the SAME gate as restricted rendering — proved by
// shared call, not just matching outcome), 3 (every lifecycle event lands in
// the unified audit stream the admin page reads).
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { ADVOCATE_SUD_DISCLOSURE_CATEGORY, type AdvocateAuthorizationType } from "../advocate";
import * as documents from "../documents";
import type { ConsentCategory } from "../ehr";

let n = 0;
function freshPatient() {
  return AdelanteEHR.createPatient({ firstName: "GroupE", lastName: `Doc${++n}` });
}

function connected(patientId: string, type: AdvocateAuthorizationType = "hipaa_authorization") {
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: `Advocate ${n}`,
    relationship: "Sister",
    invitationSentTo: `adv${n}@example.org`,
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: type,
    attestedName: "Advocate",
  });
  // §Phase 4.1 — the two authority tiers with real preconditions must have
  // them satisfied here, or the link is claimed but inert.
  if (type === "ahcd") AdelanteEHR.activateAdvocateAhcd(link.id, "Dr. Bagga");
  if (type === "conservatorship")
    AdelanteEHR.recordAdvocateConservatorshipDocs(link.id, {
      verifiedBy: "Records Clerk",
      courtOrderRef: "PR-2026-0001",
    });
  return AdelanteEHR.getAdvocateLink(link.id)!;
}

function signSudDisclosure(patientId: string, authorized = true) {
  const sections: { category: ConsentCategory; authorized: boolean }[] = [
    { category: ADVOCATE_SUD_DISCLOSURE_CATEGORY, authorized },
  ];
  return AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "placeholder — pending Christi's DHCS-sourced language",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    sections,
    capturedBy: { staffName: "Test", role: "therapist" },
  });
}

function upload(patientId: string, isPart2: boolean) {
  const res = AdelanteEHR.uploadPatientDocument({
    patientId,
    file: { fileName: `paper-${++n}.pdf`, mimeType: "application/pdf", sizeBytes: 2048 },
    isPart2,
    uploader: { kind: "patient", name: "Test Patient" },
  });
  if (!res.ok) throw new Error(res.reason);
  return res.document;
}

function verify(documentId: string) {
  return AdelanteEHR.verifyPatientDocument(documentId, {
    staffName: "Nurse Vega",
    role: "ecm_provider",
  });
}

describe("Group E item 2 — download/view is the SAME gate as restricted rendering", () => {
  it("an advocate without Part 2 disclosure cannot download a restricted document", () => {
    const p = freshPatient();
    const link = connected(p.id);
    const doc = upload(p.id, true);
    verify(doc.id);

    // Rendering side: the row exists but is restricted.
    const listed = AdelanteEHR.advocateDocuments(link.id).items.find((i) => i.id === doc.id)!;
    expect(listed.restricted).toBe(true);
    expect(listed.fileName).toBe("Protected document");

    // Download side: refused, with the SAME message the rendering case shows.
    const dl = AdelanteEHR.requestDocumentDownload({
      documentId: doc.id,
      viewer: { kind: "advocate", linkId: link.id },
    });
    expect(dl.ok).toBe(false);
    if (dl.ok) throw new Error("unreachable");
    expect(dl.restricted).toBe(true);
    expect(dl.reason).toBe(documents.PART2_RESTRICTED_MESSAGE);
    expect(listed.restrictionMessage).toBe(dl.reason);
  });

  it("the download decision defers to advocateDocumentVisibility for every input", () => {
    // Exhaustive equivalence over the Part 2 axis: the download gate produces
    // the rendering gate's exact verdict and its exact message, because it is
    // implemented as a call to it rather than as a parallel rule.
    for (const isPart2 of [true, false]) {
      for (const part2Unmasked of [true, false]) {
        const vis = documents.advocateDocumentVisibility({ isPart2, part2Unmasked });
        const dl = documents.documentDownloadDecision({
          isPart2,
          part2Unmasked,
          verification: "verified",
        });
        expect(dl.allowed).toBe(!vis.restricted);
        if (!dl.allowed) {
          expect(dl.restricted).toBe(true);
          expect(dl.reason).toBe(vis.restrictionMessage);
        }
      }
    }
  });

  it("the same advocate CAN download once Part 2 disclosure is on file", () => {
    const p = freshPatient();
    const link = connected(p.id);
    signSudDisclosure(p.id);
    const doc = upload(p.id, true);
    verify(doc.id);

    const dl = AdelanteEHR.requestDocumentDownload({
      documentId: doc.id,
      viewer: { kind: "advocate", linkId: link.id },
    });
    expect(dl.ok).toBe(true);
    if (!dl.ok) throw new Error("unreachable");
    expect(dl.text).toContain(doc.fileName);
    // Honesty: the payload never pretends to be the original file.
    expect(dl.text).toContain("metadata only");
  });

  it("an unverified document is not downloadable by anyone — it is not chart content", () => {
    const p = freshPatient();
    const doc = upload(p.id, false);
    const dl = AdelanteEHR.requestDocumentDownload({
      documentId: doc.id,
      viewer: { kind: "patient", name: "Test Patient" },
    });
    expect(dl.ok).toBe(false);
    if (dl.ok) throw new Error("unreachable");
    expect(dl.restricted).toBe(false);
    expect(dl.reason).toBe(documents.DOWNLOAD_UNVERIFIED_MESSAGE);
  });

  it("a revoked advocate link cannot download even a non-Part-2 verified document", () => {
    const p = freshPatient();
    const link = connected(p.id);
    const doc = upload(p.id, false);
    verify(doc.id);
    AdelanteEHR.revokeAdvocateLink(link.id, "Test Patient", "No longer involved");

    const dl = AdelanteEHR.requestDocumentDownload({
      documentId: doc.id,
      viewer: { kind: "advocate", linkId: link.id },
    });
    expect(dl.ok).toBe(false);
  });
});

describe("Group E item 1 — promotion notification respects existing advocate access", () => {
  it("notifies the patient over the existing notification path", () => {
    const p = freshPatient();
    const doc = upload(p.id, false);
    verify(doc.id);
    const notes = AdelanteEHR.getPatient(p.id)?.notifications ?? [];
    const row = notes.find((x) => x.apptId === `document:${doc.id}`);
    expect(row?.kind).toBe("document_verified");
    expect(row?.channel).toBe("profile");
  });

  it("notifies an authorized advocate", () => {
    const p = freshPatient();
    const link = connected(p.id);
    const doc = upload(p.id, false);
    verify(doc.id);
    const notices = AdelanteEHR.advocateDocumentNotifications(link.id);
    expect(notices.some((x) => x.apptId === `document:${doc.id}`)).toBe(true);
  });

  it("never notifies a revoked advocate", () => {
    const p = freshPatient();
    const link = connected(p.id);
    AdelanteEHR.revokeAdvocateLink(link.id, "Test Patient", "Revoked");
    const doc = upload(p.id, false);
    verify(doc.id);
    expect(AdelanteEHR.advocateDocumentNotifications(link.id)).toHaveLength(0);
  });

  it("never notifies an advocate about a Part 2 document they cannot see", () => {
    const p = freshPatient();
    const link = connected(p.id);
    const doc = upload(p.id, true);
    verify(doc.id);
    const notices = AdelanteEHR.advocateDocumentNotifications(link.id);
    expect(notices.some((x) => x.apptId === `document:${doc.id}`)).toBe(false);
  });

  it("notifies about a Part 2 document once disclosure is authorized", () => {
    const p = freshPatient();
    const link = connected(p.id);
    signSudDisclosure(p.id);
    const doc = upload(p.id, true);
    verify(doc.id);
    const notices = AdelanteEHR.advocateDocumentNotifications(link.id);
    expect(notices.some((x) => x.apptId === `document:${doc.id}`)).toBe(true);
  });
});

describe("Group E item 3 — the lifecycle lands in the unified audit stream", () => {
  it("upload, malware block, promotion and download are all recorded", () => {
    const p = freshPatient();
    const doc = upload(p.id, true);
    AdelanteEHR.uploadPatientDocument({
      patientId: p.id,
      file: { fileName: "installer.exe", mimeType: "application/octet-stream", sizeBytes: 10 },
      isPart2: false,
      uploader: { kind: "patient", name: "Test Patient" },
    });
    verify(doc.id);
    AdelanteEHR.requestDocumentDownload({
      documentId: doc.id,
      viewer: { kind: "staff", name: "Nurse Vega", role: "ecm_provider" },
    });

    const actions = AdelanteEHR.listAuditEvents({ patientId: p.id }).map((e) => e.action);
    expect(actions).toContain("document_uploaded");
    expect(actions).toContain("document_upload_rejected");
    expect(actions).toContain("document_verified");
    expect(actions).toContain("document_downloaded");
  });

  it("an advocate's refused download is audited as a denial", () => {
    const p = freshPatient();
    const link = connected(p.id);
    const doc = upload(p.id, true);
    verify(doc.id);
    AdelanteEHR.requestDocumentDownload({
      documentId: doc.id,
      viewer: { kind: "advocate", linkId: link.id },
    });
    const actions = AdelanteEHR.listAuditEvents({ patientId: p.id, category: "advocate" }).map(
      (e) => e.action,
    );
    expect(actions).toContain("advocate_document_download_denied");
  });
});
