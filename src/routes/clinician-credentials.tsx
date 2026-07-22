import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt, type CredentialKind } from "@/lib/ehr-ext";
import { Trash2, Plus, Upload } from "lucide-react";

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
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const [id, setId] = useState(clinicians[0]?.id ?? "");
  const creds = useEhrExt(() => (id ? AdelanteEHRExt.credentialsForClinician(id) : []));
  const [kind, setKind] = useState<CredentialKind>("license");
  const [number, setNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fileName, setFileName] = useState("");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header>
        <h1 className="font-display text-2xl text-navy">My credentials</h1>
        <p className="text-sm text-muted-foreground">
          License and malpractice must stay current — bookings are blocked if either expires.
        </p>
      </header>

      <Card className="p-4">
        <Label className="text-xs text-muted-foreground">Acting as</Label>
        <Select value={id} onValueChange={setId}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{clinicians.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

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
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusStyle[c.status]}>{c.status}</Badge>
                <Button size="icon" variant="ghost" onClick={() => { AdelanteEHRExt.removeCredential(c.id); toast.success("Removed"); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid gap-2 sm:grid-cols-5 items-end border-t pt-3">
          <div>
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CredentialKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Number</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
          <div><Label>Expires</Label><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
          <div><Label>File name</Label><Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="license.pdf" /></div>
          <Button
            size="sm"
            onClick={() => {
              if (!id) return;
              AdelanteEHRExt.addCredential({ clinicianId: id, kind, number, expiresAt: expiresAt || undefined, fileName });
              toast.success("Uploaded — pending verification");
              setNumber(""); setExpiresAt(""); setFileName("");
            }}
          >
            <Upload className="h-3.5 w-3.5 mr-1" /> Upload
          </Button>
        </div>
      </Card>
    </div>
  );
}