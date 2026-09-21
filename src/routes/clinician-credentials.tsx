// §EHR audit Phase 2a — "My credentials".
//
// Previously: an open page with an "Acting as" dropdown listing every
// clinician, so any staff member could read, add to, and DELETE anyone's
// licence file. Now the page resolves the acting staff member's own linked
// clinician record and manages that file only. The credentialing tier
// (`staff_supervision` write — the same class that gates the credentialing
// dashboard) keeps a narrower assist capability: view and attach a document
// on someone's behalf, never delete it. See src/lib/credentialAccess.ts.
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt, type CredentialKind } from "@/lib/ehr-ext";
import { useActingStaff } from "@/lib/roles";
import {
  CREDENTIAL_ASSIST_NOTE,
  CREDENTIAL_NO_RECORD_NOTE,
  canAssistCredentials,
  credentialAccessFor,
} from "@/lib/credentialAccess";
import {
  CREDENTIAL_ACCEPT_ATTR,
  CREDENTIAL_STORAGE_NOTE,
  formatBytes,
  readCredentialFile,
  type CredentialFilePayload,
} from "@/lib/credentialFile";
import { CredentialDocumentViewer } from "@/components/credentials/CredentialDocumentViewer";
import { Trash2, Upload, Paperclip } from "lucide-react";

export const Route = createFileRoute("/clinician-credentials")({
  head: () => ({
    meta: [
      { title: "My Credentials — Adelante" },
      { name: "description", content: "Upload and track your license, DEA, malpractice, and CV." },
    ],
  }),
  component: CredentialsPage,
});

const KINDS: { key: CredentialKind; label: string }[] = [
  { key: "license", label: "State license" },
  { key: "dea", label: "DEA" },
  { key: "malpractice", label: "Malpractice COI" },
  { key: "board_cert", label: "Board certification" },
  { key: "cv", label: "CV" },
  { key: "caqh", label: "CAQH attestation" },
  { key: "other", label: "Other" },
];

const statusStyle: Record<string, string> = {
  current: "bg-success/20 text-success",
  expiring: "bg-gold/20 text-navy",
  expired: "bg-destructive/15 text-destructive",
  missing: "bg-destructive/15 text-destructive",
  under_review: "bg-muted text-muted-foreground",
};

function CredentialsPage() {
  const acting = useActingStaff();
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const mayAssist = canAssistCredentials(acting.role);

  // Own file by default. Assisting roles may switch to another clinician's
  // file explicitly; nobody else ever sees a picker.
  const [assistId, setAssistId] = useState<string>("");
  const targetId = mayAssist ? assistId || acting.clinicianId || "" : acting.clinicianId || "";
  const access = credentialAccessFor(acting, targetId || undefined);
  const target = clinicians.find((c) => c.id === targetId);

  const creds = useEhrExt(() => (targetId ? AdelanteEHRExt.credentialsForClinician(targetId) : []));

  const [kind, setKind] = useState<CredentialKind>("license");
  const [number, setNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<CredentialFilePayload | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  function resetForm() {
    setNumber("");
    setExpiresAt("");
    setFile(null);
    setFileError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function pickFile(f: File | undefined) {
    if (!f) return;
    const res = await readCredentialFile(f);
    if (!res.ok) {
      setFile(null);
      setFileError(res.error);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFileError(null);
    setFile(res.file);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header>
        <h1 className="font-display text-2xl text-navy">My credentials</h1>
        <p className="text-sm text-muted-foreground">
          License and malpractice must stay current — bookings are blocked if your license expires.
        </p>
      </header>

      <Card className="p-4 text-sm" data-testid="credential-scope-card">
        <div>
          Signed in as <b>{acting.staffName}</b>
          {target ? (
            <>
              {" "}· viewing <b>{target.name}</b>&apos;s credential file
            </>
          ) : null}
        </div>
        {mayAssist && (
          <div className="mt-3">
            <Label className="text-xs text-muted-foreground">Credential file</Label>
            <Select value={targetId} onValueChange={setAssistId}>
              <SelectTrigger className="mt-1" data-testid="credential-assist-select">
                <SelectValue placeholder="Choose a clinician" />
              </SelectTrigger>
              <SelectContent>
                {clinicians.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.id === acting.clinicianId ? " (you)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {access.mode === "assist" && (
          <p className="mt-2 text-xs text-gold-foreground bg-gold/15 rounded px-2 py-1" data-testid="credential-assist-note">
            {CREDENTIAL_ASSIST_NOTE}
          </p>
        )}
        {access.mode === "none" && (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="credential-no-record-note">
            {targetId
              ? access.note
              : mayAssist
                ? "Choose whose credential file to open."
                : CREDENTIAL_NO_RECORD_NOTE}
          </p>
        )}
      </Card>

      {access.canView && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">On file</h2>
          <ul className="divide-y">
            {creds.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nothing uploaded yet.</li>}
            {creds.map((c) => (
              <li key={c.id} className="py-2 text-sm flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{KINDS.find((k) => k.key === c.kind)?.label ?? c.kind}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.number ? `#${c.number}` : ""} {c.expiresAt ? `· expires ${c.expiresAt}` : ""}{" "}
                    {c.verifiedAt ? "· verified" : "· not verified"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.fileDataUrl
                      ? `${c.fileName ?? "document"} · ${formatBytes(c.fileSize ?? 0)}`
                      : c.fileName
                        ? `${c.fileName} — name only, no document stored`
                        : "No document attached"}
                  </div>
                  {/* §Phase 2b — what credentialing has asked this person to do. */}
                  {c.followUp && !c.followUp.resolvedAt && (
                    <p
                      className="mt-1 rounded bg-gold/15 px-2 py-1 text-xs text-gold-foreground"
                      data-testid={`credential-followup-${c.id}`}
                    >
                      Credentialing asked: {c.followUp.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusStyle[c.status]}>{c.status}</Badge>
                  <CredentialDocumentViewer
                    fileName={c.fileName}
                    fileType={c.fileType}
                    fileSize={c.fileSize}
                    fileDataUrl={c.fileDataUrl}
                  />
                  {access.canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove credential"
                      onClick={() => {
                        AdelanteEHRExt.removeCredential(c.id);
                        toast.success("Removed");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {access.canUpload && (
            <div className="border-t pt-3 space-y-3" data-testid="credential-upload-form">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label>Kind</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as CredentialKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Number</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
                <div><Label>Expires</Label><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
              </div>
              <div>
                <Label htmlFor="credential-file">Document</Label>
                <Input
                  id="credential-file"
                  data-testid="credential-file-input"
                  ref={fileInput}
                  type="file"
                  accept={CREDENTIAL_ACCEPT_ATTR}
                  onChange={(e) => void pickFile(e.target.files?.[0])}
                />
                <p className="mt-1 text-xs text-muted-foreground">{CREDENTIAL_STORAGE_NOTE}</p>
                {file && (
                  <p className="mt-1 text-xs text-success flex items-center gap-1" data-testid="credential-file-ready">
                    <Paperclip className="h-3 w-3" /> {file.fileName} · {formatBytes(file.fileSize)} ready to upload
                  </p>
                )}
                {fileError && (
                  <p className="mt-1 text-xs text-destructive" data-testid="credential-file-error">
                    {fileError}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                data-testid="credential-upload-submit"
                onClick={() => {
                  if (!targetId) return;
                  if (!file) {
                    setFileError("Choose a PDF or image of the document before uploading.");
                    return;
                  }
                  AdelanteEHRExt.addCredential({
                    clinicianId: targetId,
                    kind,
                    number,
                    expiresAt: expiresAt || undefined,
                    fileName: file.fileName,
                    fileType: file.fileType,
                    fileSize: file.fileSize,
                    fileDataUrl: file.fileDataUrl,
                    uploadedBy: acting.staffName,
                  });
                  toast.success("Uploaded — pending verification");
                  resetForm();
                }}
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
