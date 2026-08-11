// §v3.0 Phase 5 — patient document upload, verification and advocate access.
//
// What these tests hold in place:
//  - unverified by default; never chart content until promoted;
//  - the malware scan gate ACTUALLY blocks a bad file (no record is created);
//  - Part 2 classification is captured AT UPLOAD, by the uploader;
//  - verify-queue ownership follows Phase 2 episode status, both directions;
//  - advocate document access reuses the Phase 4 link gate AND the Phase 4
//    `advocate_sud_disclosure` consent gate — restricted, not hidden.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type ConsentCategory } from "../ehr";
import { ADVOCATE_SUD_DISCLOSURE_CATEGORY, type AdvocateAuthorizationType } from "../advocate";
import { EICAR_SIGNATURE, PART2_RESTRICTED_MESSAGE, scanUpload, verifyQueueOwnerRole } from "../documents";

function patientAt(i: number) {
  const list = AdelanteEHR.listPatients();
  return list[i % list.length]!;
}

const goodFile = (name = "medi-cal-letter.pdf") => ({
  fileName: name,
  mimeType: "application/pdf",
  sizeBytes: 24_000,
});

function selfUpload(patientId: string, isPart2 = false, fileName?: string) {
  const p = AdelanteEHR.getPatient(patientId)!;
  return AdelanteEHR.uploadPatientDocument({
    patientId,
    file: goodFile(fileName),
    isPart2,
    uploader: { kind: "patient", name: `${p.firstName} ${p.lastName}` },
  });
}

function connected(patientId: string, type: AdvocateAuthorizationType = "hipaa_authorization") {
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: "rosa@example.org",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: type,
    attestedName: "Rosa Ibarra",
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

function signSudDisclosure(patientId: string) {
  const sections: { category: ConsentCategory; authorized: boolean }[] = [
    { category: ADVOCATE_SUD_DISCLOSURE_CATEGORY, authorized: true },
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

describe("malware scan gate", () => {
  it("blocks the EICAR test signature and stores NOTHING", () => {
    const p = patientAt(0);
    const before = AdelanteEHR.listPatientDocuments(p.id).length;
    const res = AdelanteEHR.uploadPatientDocument({
      patientId: p.id,
      file: {
        fileName: "totally-fine.pdf",
        mimeType: "application/pdf",
        sizeBytes: 68,
        contentSample: EICAR_SIGNATURE,
      },
      isPart2: false,
      uploader: { kind: "patient", name: "Test Patient" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.threat).toBe("eicar_test_signature");
    expect(AdelanteEHR.listPatientDocuments(p.id)).toHaveLength(before);
  });

  it("blocks executables, disguised executables, empty and oversized files", () => {
    expect(scanUpload({ fileName: "x.exe", mimeType: "x", sizeBytes: 10 }).clean).toBe(false);
    expect(scanUpload({ fileName: "id.pdf.scr.txt", mimeType: "x", sizeBytes: 10 }).clean).toBe(false);
    expect(scanUpload({ fileName: "a.pdf", mimeType: "x", sizeBytes: 0 }).clean).toBe(false);
    expect(scanUpload({ fileName: "a.pdf", mimeType: "x", sizeBytes: 99e6 }).clean).toBe(false);
    expect(scanUpload(goodFile()).clean).toBe(true);
  });
});

describe("upload defaults and promotion", () => {
  it("is unverified by default and excluded from the chart until promoted", () => {
    const p = patientAt(1);
    const res = selfUpload(p.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.document.verification).toBe("unverified");
    expect(AdelanteEHR.chartDocuments(p.id).map((d) => d.id)).not.toContain(res.document.id);

    AdelanteEHR.verifyPatientDocument(res.document.id, {
      staffId: "s-cm1",
      staffName: "Luz Herrera",
      role: "ecm_provider",
    });
    const promoted = AdelanteEHR.getPatientDocument(res.document.id)!;
    expect(promoted.verification).toBe("verified");
    expect(promoted.promotedBy).toBe("Luz Herrera");
    expect(promoted.promotedAt).toBeTruthy();
    expect(AdelanteEHR.chartDocuments(p.id).map((d) => d.id)).toContain(res.document.id);
  });

  it("audits both the upload and the promotion, with who uploaded it", () => {
    const p = patientAt(2);
    const res = selfUpload(p.id, false, "release-paperwork.pdf");
    if (!res.ok) throw new Error("upload failed");
    AdelanteEHR.verifyPatientDocument(res.document.id, {
      staffName: "Dana Ruiz",
      role: "cf_care_manager",
    });
    const events = AdelanteEHR.listAuditEvents().filter(
      (e) => (e.detail as { documentId?: string } | undefined)?.documentId === res.document.id,
    );
    const actions = events.map((e) => e.action);
    expect(actions).toContain("document_uploaded");
    expect(actions).toContain("document_verified");
    const verified = events.find((e) => e.action === "document_verified")!;
    expect(verified.detail?.["promotedBy"]).toBe("Dana Ruiz");
    const uploaded = events.find((e) => e.action === "document_uploaded")!;
    expect(String(uploaded.detail?.["uploader"])).toContain("(patient)");
  });

  it("captures Part 2 classification at upload time, by the uploader", () => {
    const p = patientAt(3);
    const res = AdelanteEHR.uploadPatientDocument({
      patientId: p.id,
      file: goodFile("program-summary.pdf"),
      isPart2: true,
      uploader: { kind: "staff", name: "Dana Ruiz", role: "cf_care_manager", staffId: "s-cf1", onBehalfOfPatient: true },
    });
    if (!res.ok) throw new Error("upload failed");
    expect(res.document.isPart2).toBe(true);
    expect(res.document.part2ClassifiedBy).toBe("Dana Ruiz");
    expect(res.document.part2ClassifiedAt).toBe(res.document.uploadedAt);
    expect(AdelanteEHR.documentUploaderLabel(res.document)).toContain("on the patient's behalf");
  });
});

describe("verify queue ownership follows episode status", () => {
  it("routes to the CF Care Manager while a pre-release episode is open", () => {
    const p = patientAt(4);
    AdelanteEHR.openPreReleaseEpisode({
      patientId: p.id,
      anticipatedReleaseDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      cfCareManagerStaffId: "s-cf1",
      cfCareManagerName: "Dana Ruiz",
      openedBy: "test",
      actorRole: "cf_care_manager",
    });
    const res = selfUpload(p.id);
    if (!res.ok) throw new Error("upload failed");
    expect(AdelanteEHR.documentOwnerRole(p.id)).toBe("cf_care_manager");
    const cfQueue = AdelanteEHR.documentVerifyQueue("cf_care_manager");
    expect(cfQueue.map((r) => r.document.id)).toContain(res.document.id);
    expect(AdelanteEHR.documentVerifyQueue("ecm_provider").map((r) => r.document.id)).not.toContain(
      res.document.id,
    );
    expect(cfQueue.find((r) => r.document.id === res.document.id)!.uploaderLabel).toContain("patient");
  });

  it("routes to the ECM Provider with no open episode (post-release / never in custody)", () => {
    const p = patientAt(5);
    const res = selfUpload(p.id);
    if (!res.ok) throw new Error("upload failed");
    expect(AdelanteEHR.documentOwnerRole(p.id)).toBe("ecm_provider");
    expect(AdelanteEHR.documentVerifyQueue("ecm_provider").map((r) => r.document.id)).toContain(
      res.document.id,
    );
  });

  it("policy fn: only an OPEN episode belongs to the CF Care Manager", () => {
    expect(verifyQueueOwnerRole("open")).toBe("cf_care_manager");
    expect(verifyQueueOwnerRole("released")).toBe("ecm_provider");
    expect(verifyQueueOwnerRole("closed")).toBe("ecm_provider");
    expect(verifyQueueOwnerRole(undefined)).toBe("ecm_provider");
  });
});

describe("advocate document access — extends Phase 4, reuses its consent gate", () => {
  // §Phase 4.1 — upload is a WRITE, so it now belongs to the authority tiers
  // only. HIPAA-only and AR are read-only and are asserted so below.
  it("the authority tiers can upload and review; uploads land unverified in the same queue", () => {
    for (const type of ["ahcd", "conservatorship"] as AdvocateAuthorizationType[]) {
      const p = patientAt(type === "ahcd" ? 6 : 7);
      const link = connected(p.id, type);
      const up = AdelanteEHR.advocateUploadDocument(link.id, {
        file: goodFile("id-card.jpg"),
        isPart2: false,
      });
      expect(up.ok).toBe(true);
      const view = AdelanteEHR.advocateDocuments(link.id);
      expect(view.allowed).toBe(true);
      expect(view.canUpload).toBe(true);
      expect(view.items.map((i) => i.id)).toContain(up.documentId);
      const queued = AdelanteEHR.documentVerifyQueue().find((r) => r.document.id === up.documentId)!;
      expect(queued.document.verification).toBe("unverified");
      expect(queued.uploaderLabel).toContain("Rosa Ibarra");
    }
  });

  it("shows a Part 2 document as RESTRICTED with a specific explanation, not hidden", () => {
    const p = patientAt(8);
    const doc = AdelanteEHR.uploadPatientDocument({
      patientId: p.id,
      file: goodFile("methadone-program-letter.pdf"),
      isPart2: true,
      uploader: { kind: "patient", name: "Test Patient" },
    });
    if (!doc.ok) throw new Error("upload failed");
    const link = connected(p.id);
    const view = AdelanteEHR.advocateDocuments(link.id);
    const row = view.items.find((i) => i.id === doc.document.id)!;
    expect(row).toBeTruthy();
    expect(row.restricted).toBe(true);
    expect(row.restrictionMessage).toBe(PART2_RESTRICTED_MESSAGE);
    // The file name is itself Part 2 content — it must not leak.
    expect(row.fileName).not.toContain("methadone");
  });

  it("opens with the SAME advocate_sud_disclosure consent Phase 4 built", () => {
    const p = patientAt(9);
    const doc = AdelanteEHR.uploadPatientDocument({
      patientId: p.id,
      file: goodFile("suboxone-clinic-summary.pdf"),
      isPart2: true,
      uploader: { kind: "patient", name: "Test Patient" },
    });
    if (!doc.ok) throw new Error("upload failed");
    const link = connected(p.id);
    expect(AdelanteEHR.advocateDocuments(link.id).items[0]!.restricted).toBe(true);
    const rec = signSudDisclosure(p.id);
    const open = AdelanteEHR.advocateDocuments(link.id).items.find((i) => i.id === doc.document.id)!;
    expect(open.restricted).toBe(false);
    expect(open.fileName).toContain("suboxone");
    // Live, not cached: revoking the consent re-restricts on the next read.
    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "patient revoked",
      revokedBy: "Test",
      role: "therapist",
    });
    expect(
      AdelanteEHR.advocateDocuments(link.id).items.find((i) => i.id === doc.document.id)!.restricted,
    ).toBe(true);
  });

  it("a revoked link loses BOTH document review and upload", () => {
    const p = patientAt(10);
    selfUpload(p.id);
    const link = connected(p.id);
    signSudDisclosure(p.id);
    expect(AdelanteEHR.advocateDocuments(link.id).allowed).toBe(true);
    AdelanteEHR.revokeAdvocateLink(link.id, "test", "test revocation");
    const after = AdelanteEHR.advocateDocuments(link.id);
    expect(after.allowed).toBe(false);
    expect(after.items).toHaveLength(0);
    const up = AdelanteEHR.advocateUploadDocument(link.id, {
      file: goodFile("late.pdf"),
      isPart2: false,
    });
    expect(up.ok).toBe(false);
  });

  it("an unclaimed invitation grants no document access even with the consent on file", () => {
    const p = patientAt(11);
    signSudDisclosure(p.id);
    const invited = AdelanteEHR.createAdvocateInvitation({
      patientId: p.id,
      advocateName: "Unclaimed Advocate",
      relationship: "Cousin",
      invitationSentTo: "nobody@example.org",
      invitationChannel: "email",
      designatedBy: { actor: "patient", name: "Test Patient" },
    });
    expect(AdelanteEHR.advocateDocuments(invited.id).allowed).toBe(false);
  });

  it("the malware gate applies to advocate uploads too", () => {
    const p = patientAt(12);
    const link = connected(p.id);
    const up = AdelanteEHR.advocateUploadDocument(link.id, {
      file: { fileName: "helper.exe", mimeType: "application/octet-stream", sizeBytes: 4000 },
      isPart2: false,
    });
    expect(up.ok).toBe(false);
  });
});
