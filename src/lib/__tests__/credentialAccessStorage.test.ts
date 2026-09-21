// §EHR audit Phase 2a — credential access scope, document storage limits,
// and licence-expiry reconciliation.
import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_MAX_BYTES,
  formatBytes,
  isImageCredential,
  validateCredentialFile,
} from "@/lib/credentialFile";
import {
  canAssistCredentials,
  credentialAccessFor,
  credentialTargetsFor,
  type CredentialActor,
} from "@/lib/credentialAccess";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";

const therapist: CredentialActor = {
  role: "therapist",
  staffId: "s-th1",
  staffName: "Dr. Marisol Reyes",
  clinicianId: "c1",
};
const peer: CredentialActor = { role: "peer_specialist", staffId: "s-peer1", staffName: "Andre Willis" };
const credCoord: CredentialActor = {
  role: "credentialing_coordinator",
  staffId: "s-cred1",
  staffName: "Marcus Webb",
};

describe("credential access scope", () => {
  it("lets a clinician fully manage only their own file", () => {
    const own = credentialAccessFor(therapist, "c1");
    expect(own).toMatchObject({ mode: "own", canView: true, canUpload: true, canDelete: true });
    const other = credentialAccessFor(therapist, "c2");
    expect(other).toMatchObject({ mode: "none", canView: false, canUpload: false, canDelete: false });
  });

  it("gives staff with no clinician record no file at all", () => {
    expect(credentialAccessFor(peer, undefined)).toMatchObject({ mode: "none", canView: false });
    expect(credentialAccessFor(peer, "c1")).toMatchObject({ mode: "none", canView: false });
  });

  it("gives the credentialing tier assist: view + upload, never delete", () => {
    expect(canAssistCredentials("credentialing_coordinator")).toBe(true);
    expect(canAssistCredentials("clinical_coordinator")).toBe(true);
    expect(canAssistCredentials("sys_admin")).toBe(true);
    expect(canAssistCredentials("therapist")).toBe(false);
    expect(canAssistCredentials("peer_specialist")).toBe(false);
    expect(credentialAccessFor(credCoord, "c1")).toMatchObject({
      mode: "assist",
      canView: true,
      canUpload: true,
      canDelete: false,
    });
  });

  it("scopes the picker: own only, or every file when assisting", () => {
    const all = ["c1", "c2", "c3"];
    expect(credentialTargetsFor(therapist, all)).toEqual(["c1"]);
    expect(credentialTargetsFor(peer, all)).toEqual([]);
    expect(credentialTargetsFor(credCoord, all)).toEqual(all);
  });
});

describe("credential document limits", () => {
  it("accepts a small PDF or image", () => {
    expect(validateCredentialFile({ name: "l.pdf", type: "application/pdf", size: 1000 }).ok).toBe(true);
    expect(validateCredentialFile({ name: "l.png", type: "image/png", size: 1000 }).ok).toBe(true);
  });

  it("rejects the wrong type with an instruction, not silence", () => {
    const r = validateCredentialFile({ name: "l.exe", type: "application/x-msdownload", size: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("PDF");
  });

  it("rejects an oversized file and names the limit", () => {
    const r = validateCredentialFile({
      name: "scan.pdf",
      type: "application/pdf",
      size: CREDENTIAL_MAX_BYTES + 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2.0 MB");
  });

  it("rejects an empty file", () => {
    expect(validateCredentialFile({ name: "a.pdf", type: "application/pdf", size: 0 }).ok).toBe(false);
  });

  it("formats sizes and detects previewable images", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(isImageCredential("image/png")).toBe(true);
    expect(isImageCredential("application/pdf")).toBe(false);
  });
});

describe("licence expiry reconciliation", () => {
  it("makes the licence document the source of the booking hard-stop", () => {
    const before = AdelanteEHR.listClinicians().find((c) => c.id === "c3")!.licenseExpiresOn;
    expect(before).toBeTruthy();

    const past = "2020-01-01";
    AdelanteEHRExt.addCredential({ clinicianId: "c3", kind: "license", number: "X-1", expiresAt: past });
    expect(AdelanteEHR.listClinicians().find((c) => c.id === "c3")!.licenseExpiresOn).toBe(past);
    expect(AdelanteEHR.canBook("c3").ok).toBe(false);

    // A renewal supersedes the lapsing licence: latest expiry wins.
    AdelanteEHRExt.addCredential({ clinicianId: "c3", kind: "license", number: "X-2", expiresAt: "2030-06-30" });
    expect(AdelanteEHR.listClinicians().find((c) => c.id === "c3")!.licenseExpiresOn).toBe("2030-06-30");
    expect(AdelanteEHR.canBook("c3").ok).toBe(true);
  });

  it("does not touch the booking date for non-licence documents", () => {
    const before = AdelanteEHR.listClinicians().find((c) => c.id === "c2")!.licenseExpiresOn;
    AdelanteEHRExt.addCredential({ clinicianId: "c2", kind: "cv", fileName: "cv.pdf" });
    expect(AdelanteEHR.listClinicians().find((c) => c.id === "c2")!.licenseExpiresOn).toBe(before);
  });

  it("stores the document bytes, not just a name", () => {
    AdelanteEHRExt.addCredential({
      clinicianId: "c1",
      kind: "board_cert",
      fileName: "cert.png",
      fileType: "image/png",
      fileSize: 120,
      fileDataUrl: "data:image/png;base64,AAAA",
      uploadedBy: "Dr. Marisol Reyes",
    });
    const row = AdelanteEHRExt.credentialsForClinician("c1").find((c) => c.kind === "board_cert")!;
    expect(row.fileDataUrl).toContain("data:image/png");
    expect(row.uploadedBy).toBe("Dr. Marisol Reyes");
  });
});
