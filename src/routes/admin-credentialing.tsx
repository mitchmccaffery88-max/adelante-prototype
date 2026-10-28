import { credentialCommand } from "@/components/credentials/credentialCommand";
import { StaffTable } from "@/components/staff/StaffTable";
import {Check,  CircleAlert } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
import { formatClinicianName } from "@/lib/coordination";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt, type CredentialDoc } from "@/lib/ehr-ext";
import { CredentialDocumentViewer } from "@/components/credentials/CredentialDocumentViewer";
import { CredentialingToday } from "@/components/credentials/CredentialingToday";
import {
  CREDENTIAL_ACCEPT_ATTR,
  CREDENTIAL_STORAGE_NOTE,
  formatBytes,
  readCredentialFile,
  type CredentialFilePayload,
} from "@/lib/credentialFile";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  CREDENTIAL_IMPORT_COLUMNS,
  CREDENTIAL_IMPORT_NOTE,
  CREDENTIAL_KINDS,
  previewCredentialImport,
  toCredentialCsv,
  type ImportPreview,
} from "@/lib/credentialRoster";

export const Route = createFileRoute("/admin-credentialing")({
  head: () => ({
    meta: [
      { title: "Credentialing Dashboard — Adelante" },
      { property: "og:title", content: "Credentialing Dashboard — Adelante" },
      { property: "og:description", content: "Verify licenses, DEA, malpractice, and payer enrollments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "description", content: "Verify licenses, DEA, malpractice, and payer enrollments." },
    ],
  }),
  component: CredentialingAdminPage,
});

const statusStyle: Record<string, string> = {
  current: "bg-success/20 text-success",
  expiring: "bg-gold/20 text-navy",
  expired: "bg-surface-sunk text-attention",
  missing: "bg-surface-sunk text-attention",
  under_review: "bg-muted text-muted-foreground",
};

/** §Phase 2b — add a credential record directly from the dashboard. */
function AddCredentialDialog({
  clinicians,
  onClose,
}: {
  clinicians: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [clinicianId, setClinicianId] = useState(clinicians[0]?.id ?? "");
  const [kind, setKind] = useState<string>("license");
  const [number, setNumber] = useState("");
  const [issuingState, setIssuingState] = useState("CA");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<CredentialFilePayload | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const res = await readCredentialFile(f);
    if (!res.ok) {
      setFile(null);
      setFileError(res.error);
      return;
    }
    setFileError(null);
    setFile(res.file);
  };

  const save = () => {
    if (!clinicianId) return toast.error("Choose a clinician.");
    credentialCommand("add", {
      clinicianId,
      kind: kind as CredentialDoc["kind"],
      ...(number.trim() ? { number: number.trim() } : {}),
      ...(issuingState.trim() ? { issuingState: issuingState.trim() } : {}),
      ...(issuedAt ? { issuedAt } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      ...(file ?? {}),
    } as Omit<CredentialDoc, "id" | "uploadedAt">);
    toast.success("Credential added");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a credential</DialogTitle>
          <DialogDescription>{CREDENTIAL_STORAGE_NOTE}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Clinician</Label>
            <Select value={clinicianId} onValueChange={setClinicianId}>
              <SelectTrigger data-testid="add-credential-clinician">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clinicians.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger data-testid="add-credential-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDENTIAL_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Number</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Issuing state</Label>
            <Input value={issuingState} onChange={(e) => setIssuingState(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Issued</Label>
            <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expires</Label>
            <Input
              type="date"
              value={expiresAt}
              data-testid="add-credential-expires"
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Document (optional)</Label>
            <Input
              type="file"
              accept={CREDENTIAL_ACCEPT_ATTR}
              onChange={(e) => void pick(e.target.files?.[0])}
            />
            {fileError && <p className="text-attention text-xs"><CircleAlert className="mr-1 inline size-4 shrink-0 align-text-bottom" aria-hidden="true" />{fileError}</p>}
            {file && (
              <p className="text-muted-foreground text-xs">
                {file.fileName} · {formatBytes(file.fileSize)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="add-credential-save" onClick={save}>
            Add credential
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** §Phase 2b — edit a record; an expiry change needs a reason. */
function EditCredentialDialog({ cred, by, onClose }: { cred: CredentialDoc; by: string; onClose: () => void }) {
  const [number, setNumber] = useState(cred.number ?? "");
  const [issuingState, setIssuingState] = useState(cred.issuingState ?? "");
  const [issuedAt, setIssuedAt] = useState(cred.issuedAt ?? "");
  const [expiresAt, setExpiresAt] = useState(cred.expiresAt ?? "");
  const [reason, setReason] = useState("");
  const expiryChanged = expiresAt !== (cred.expiresAt ?? "");

  const save = () => {
    try {
      credentialCommand("edit", { id: cred.id, patch: {
          number: number.trim() || undefined,
          issuingState: issuingState.trim() || undefined,
          issuedAt: issuedAt || undefined,
          expiresAt: expiresAt || undefined,
        },
        reason,
      });
      toast.success(
        expiryChanged
          ? "Expiry updated — booking availability follows the licence on file."
          : "Credential updated",
      );
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit credential</DialogTitle>
          <DialogDescription>
            Changing an expiry date can block or restore this clinician&apos;s bookings, so it needs
            a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Number</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Issuing state</Label>
            <Input value={issuingState} onChange={(e) => setIssuingState(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Issued</Label>
            <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expires</Label>
            <Input
              type="date"
              value={expiresAt}
              data-testid="edit-credential-expires"
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          {expiryChanged && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Reason for the expiry change</Label>
              <Textarea
                value={reason}
                data-testid="edit-credential-reason"
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. renewal certificate received from the board"
              />
            </div>
          )}
          {(cred.expiryChanges?.length ?? 0) > 0 && (
            <div className="text-muted-foreground sm:col-span-2 space-y-1 text-[11px]">
              {cred.expiryChanges!.map((h, i) => (
                <p key={i}>
                  {h.at.slice(0, 10)} · {h.from ?? "—"} to {h.to ?? "—"} · {h.by}: {h.reason}
                </p>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="edit-credential-save" onClick={save}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FollowUpDialog({ cred, by, onClose }: { cred: CredentialDoc; by: string; onClose: () => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ask the clinician to act</DialogTitle>
          <DialogDescription>
            This shows on their own credentials page and clears when they upload this document.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          data-testid="followup-note"
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Upload your renewed DEA certificate before 1 March."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-testid="followup-send"
            onClick={() => {
              try {
                credentialCommand("followup", { id: cred.id, note });
                toast.success("Follow-up requested");
                onClose();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Request follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** §Phase 2b — CSV import, preview first: nothing is written until confirmed. */
function ImportDialog({
  clinicianIds,
  existing,
  onClose,
}: {
  clinicianIds: string[];
  existing: CredentialDoc[];
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const by = useActingStaff().staffName;

  const load = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    setPreview(
      previewCredentialImport(text, {
        clinicianIds,
        existing: existing.map((c) => ({
          id: c.id,
          clinicianId: c.clinicianId,
          kind: c.kind,
          number: c.number,
        })),
      }),
    );
  };

  const apply = () => {
    if (!preview) return;
    for (const c of preview.candidates) {
      if (c.existingId) {
        credentialCommand("edit", { id: c.existingId, patch: {
            issuingState: c.issuingState,
            issuedAt: c.issuedAt,
            expiresAt: c.expiresAt,
          },
          reason: `CSV roster import (row ${c.line})`,
        });
      } else {
        credentialCommand("add", {
          clinicianId: c.clinicianId,
          kind: c.kind as CredentialDoc["kind"],
          ...(c.number ? { number: c.number } : {}),
          ...(c.issuingState ? { issuingState: c.issuingState } : {}),
          ...(c.issuedAt ? { issuedAt: c.issuedAt } : {}),
          ...(c.expiresAt ? { expiresAt: c.expiresAt } : {}),
        } as Omit<CredentialDoc, "id" | "uploadedAt">);
      }
    }
    toast.success(`Imported ${preview.candidates.length} row(s)`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import credential roster</DialogTitle>
          <DialogDescription>
            Columns: {CREDENTIAL_IMPORT_COLUMNS.join(", ")}. {CREDENTIAL_IMPORT_NOTE}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="file"
          accept=".csv,text/csv"
          data-testid="import-csv-input"
          onChange={(e) => void load(e.target.files?.[0])}
        />
        {preview && (
          <div className="space-y-3 text-sm" data-testid="import-preview">
            <p className="font-medium">
              {preview.candidates.filter((c) => c.action === "add").length} to add ·{" "}
              {preview.candidates.filter((c) => c.action === "update").length} to update ·{" "}
              {preview.problems.length} rejected
            </p>
            <ul className="space-y-1 text-xs">
              {preview.candidates.map((c) => (
                <li key={c.line}>
                  Row {c.line}: {c.action} {c.kind} for {c.clinicianId}
                  {c.expiresAt ? ` · expires ${c.expiresAt}` : ""}
                </li>
              ))}
            </ul>
            {preview.problems.length > 0 && (
              <ul className="text-attention space-y-1 text-xs" data-testid="import-problems">
                {preview.problems.map((p, i) => (
                  <li key={i}>
                    Row {p.line}: {p.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            data-testid="import-apply"
            disabled={!preview || preview.candidates.length === 0}
            onClick={apply}
          >
            Import {preview?.candidates.length ?? 0} row(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialingAdminPage() {
  const { staffName, role, staffId } = useActingStaff();
  const canManageCredentials = canAccess(role, "staff_supervision").level === "write";
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const creds = useEhrExt(() => AdelanteEHRExt.listAllCredentials());
  const enrollments = useEhrExt(() => AdelanteEHRExt.listAllEnrollments());
  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CredentialDoc | null>(null);
  const [followingUp, setFollowingUp] = useState<CredentialDoc | null>(null);
  const [importing, setImporting] = useState(false);

  const expiringSoon = creds.filter(
    (c) => c.status === "expiring" || c.status === "expired" || c.status === "missing",
  );

  const exportCsv = () => {
    const csv = toCredentialCsv(
      creds.map((c) => ({
        id: c.id,
        clinicianId: c.clinicianId,
        clinicianName: (() => {
          const cl = clinicians.find((x) => x.id === c.clinicianId);
          return cl ? formatClinicianName(cl.name, cl.credential) : "";
        })(),
        kind: c.kind,
        number: c.number,
        issuingState: c.issuingState,
        issuedAt: c.issuedAt,
        expiresAt: c.expiresAt,
        status: c.status,
        verifiedAt: c.verifiedAt,
        hasDocument: Boolean(c.fileDataUrl),
      })),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = downloadRef.current;
    if (a) {
      a.href = url;
      a.download = `credential-roster-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Roster exported");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Credentialing dashboard</h1>
        <Link to="/disclosure-log" className="text-xs text-teal underline" data-testid="cred-disclosure-log-link">Disclosure &amp; access log</Link>{" "}
          <Link to="/provider-reference" className="text-xs text-teal underline" data-testid="cred-provider-ref-link">Provider &amp; site reference</Link>
          <p className="text-sm text-muted-foreground">
            Primary-source verification, expiry tracking, and payer enrollments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" data-testid="add-credential-open" onClick={() => setAdding(true)}>
            Add credential
          </Button>
          <Button size="sm" variant="outline" data-testid="export-roster" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button size="sm" variant="outline" data-testid="import-open" onClick={() => setImporting(true)}>
            Import CSV
          </Button>
          <Link to="/admin" className="text-sm underline">
            ← Admin
          </Link>
        </div>
      </header>
      {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
      <a ref={downloadRef} className="hidden" aria-hidden="true" />

      {canManageCredentials && <CredentialingToday role={role} staffId={staffId} />}

      {expiringSoon.length > 0 && (
        <Card className="border-input bg-surface-sunk p-4">
          <h2 className="text-attention mb-2 font-semibold">
            Action needed ({expiringSoon.length})
          </h2>
          <ul className="space-y-1 text-sm">
            {expiringSoon.map((c) => {
              const cl = clinicians.find((x) => x.id === c.clinicianId);
              return (
                <li key={c.id} className="flex items-center justify-between">
                  <span>
                    <b>{cl?.name}</b> — {c.kind}{" "}
                    {c.expiresAt ? `· expires ${c.expiresAt}` : "· missing expiry"}
                  </span>
                  <StatusChip lang="en" state={c.status === "current" ? "done" : c.status === "under_review" ? "team" : canManageCredentials ? "yourturn" : "team"} label={c.status === "expiring" ? (c.expiresAt ? `Expires ${c.expiresAt}` : "expiring") : c.status === "expired" ? "Expired" : c.status === "missing" ? "Missing — upload" : c.status === "under_review" ? "In review" : c.status} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">All credentials</h2>
        <StaffTable rows={creds} rowKey={(c) => c.id} label="All credentials" testId="credentials-table"
          views={[{id:"all",label:"Current view",matches:()=>true},{id:"needs",label:"Needs you",matches:(c)=>canManageCredentials && (c.status === "expiring" || c.status === "expired" || c.status === "missing")}]}
          defaultView="all" emptyState="No credentials in this view."
          columns={[
            {id:"clinician",label:"Clinician",sortValue:(c)=>clinicians.find((x)=>x.id===c.clinicianId)?.name ?? "",cell:(c)=>clinicians.find((x)=>x.id===c.clinicianId)?.name},
            {id:"kind",label:"Kind",sortValue:(c)=>c.kind,cell:(c)=>c.kind},
            {id:"number",label:"#",mono:true,sortValue:(c)=>c.number ?? "",cell:(c)=>c.number ?? "—"},
            {id:"state",label:"State",sortValue:(c)=>c.issuingState ?? "",cell:(c)=>c.issuingState ?? "—"},
            {id:"expires",label:"Expires",sortValue:(c)=>c.expiresAt ?? "",cell:(c)=>c.expiresAt ?? "—"},
            {id:"status",label:"Status",sortValue:(c)=>c.status,cell:(c)=><div className="flex flex-wrap gap-1"><StatusChip lang="en" state={c.status === "current" ? "done" : c.status === "under_review" ? "team" : canManageCredentials ? "yourturn" : "team"} label={c.status === "expiring" ? (c.expiresAt ? `Expires ${c.expiresAt}` : "expiring") : c.status === "expired" ? "Expired" : c.status === "missing" ? "Missing — upload" : c.status === "under_review" ? "In review" : c.status} />{c.followUp && !c.followUp.resolvedAt && <StatusChip lang="en" state="team" label="follow-up sent" data-testid={`followup-badge-${c.id}`} />}</div>},
            {id:"document",label:"Document",cell:(c)=>c.fileDataUrl ? <CredentialDocumentViewer fileName={c.fileName} fileType={c.fileType} fileSize={c.fileSize} fileDataUrl={c.fileDataUrl} /> : <span className="text-ink-muted">{c.fileName ? "name only" : "none"}</span>},
            {id:"verified",label:"Verified",sortValue:(c)=>c.verifiedAt ?? "",cell:(c)=>c.verifiedAt ? <Check className="size-4" aria-label="Verified" /> : "—"},
          ]}
          primaryAction={(c)=><Button size="sm" variant="outline" data-testid={`edit-credential-${c.id}`} onClick={()=>setEditing(c)}>Edit</Button>}
          moreContent={(c)=><div className="flex flex-col gap-1 p-1">{c.followUp && !c.followUp.resolvedAt ? <Button size="sm" variant="ghost" onClick={()=>{credentialCommand("clear", { id: c.id });toast.success("Follow-up cleared");}}>Clear</Button> : <Button size="sm" variant="ghost" data-testid={`followup-open-${c.id}`} onClick={()=>setFollowingUp(c)}>Follow up</Button>}{!c.verifiedAt && <Button size="sm" variant="outline" onClick={()=>{credentialCommand("verify", { id: c.id });toast.success("Verified via primary source");}}>Verify</Button>}</div>}
        />
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Payer enrollments</h2>
        <StaffTable rows={enrollments} rowKey={(e)=>e.id} label="Payer enrollments" testId="payer-enrollments-table" defaultView="all"
          views={[{id:"all",label:"Current view",matches:()=>true},{id:"pending",label:"Pending",matches:(e)=>e.status === "pending"}]}
          emptyState="No payer enrollments in this view."
          columns={[
            {id:"clinician",label:"Clinician",sortValue:(e)=>clinicians.find((c)=>c.id===e.clinicianId)?.name ?? "",cell:(e)=>clinicians.find((c)=>c.id===e.clinicianId)?.name},
            {id:"payer",label:"Payer",sortValue:(e)=>e.payer,cell:(e)=>e.payer},
            {id:"tin",label:"TIN",mono:true,sortValue:(e)=>e.billingTin,cell:(e)=>e.billingTin},
            {id:"status",label:"Status",sortValue:(e)=>e.status,cell:(e)=><StatusChip lang="en" state={e.status === "enrolled" ? "done" : e.status === "pending" ? "team" : e.status === "terminated" ? "closed" : canManageCredentials ? "yourturn" : "team"} label={e.status === "terminated" ? "Ended" : e.status} />},
            {id:"effective",label:"Effective",sortValue:(e)=>e.effectiveFrom ?? "",cell:(e)=>e.effectiveFrom ?? "—"},
          ]}
        />
      </section>

      {adding && (
        <AddCredentialDialog clinicians={clinicians} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <EditCredentialDialog cred={editing} by={staffName} onClose={() => setEditing(null)} />
      )}
      {followingUp && (
        <FollowUpDialog cred={followingUp} by={staffName} onClose={() => setFollowingUp(null)} />
      )}
      {importing && (
        <ImportDialog
          clinicianIds={clinicians.map((c) => c.id)}
          existing={creds}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}
