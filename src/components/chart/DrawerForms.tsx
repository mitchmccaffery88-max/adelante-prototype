// §Chart redesign turn 3 — document upload and contact log inside the
// "+ New" drawer. Both call the existing store functions
// (AdelanteEHR.uploadPatientDocument, logContact); nothing new is enforced here.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { logContact, CONTACT_TYPE_LABEL, NOTE_HINT, NOTE_MAX, type ContactType } from "@/lib/caseloadReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormDone } from "@/components/chart/LabsAndMeasures";

const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);

export function DocumentUploadForm({ patientId, onDone }: { patientId: string; onDone: FormDone }) {
  const { role, staffId, staffName } = useActingStaff();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");
  const [part2, setPart2] = useState<"" | "yes" | "no">("");
  const [note, setNote] = useState("");
  const submit = async () => {
    if (!file) return toast.error("Choose a file.");
    if (!part2) return toast.error("Say whether this document has substance use (Part 2) information.");
    const sample = file.size < 200_000 ? (await file.text().catch(() => "")).slice(0, 256) : undefined;
    const r = AdelanteEHR.uploadPatientDocument({
      patientId,
      file: { fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, contentSample: sample },
      uploader: { kind: "staff", name: staffName, role, staffId },
      isPart2: part2 === "yes",
      docType: docType.trim() || undefined,
      note: note.trim() || undefined,
    });
    if (!r.ok) return toast.error(r.reason);
    onDone(`Document "${file.name}" uploaded`, "overview");
  };
  return (
    <div className="space-y-3" data-testid="document-upload-form">
      <div className="space-y-1">
        <Label htmlFor="doc-file">File</Label>
        <Input id="doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="doc-type">Document type</Label>
        <Input id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="e.g. Discharge summary" />
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Substance use (Part 2) information?</legend>
        <div className="flex gap-4 text-sm">
          {(["no", "yes"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name="doc-part2" checked={part2 === v} onChange={() => setPart2(v)} /> {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="doc-note">Note (optional)</Label>
        <Input id="doc-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button onClick={submit}>Upload</Button>
    </div>
  );
}

export function ContactLogForm({ patientId, onDone }: { patientId: string; onDone: FormDone }) {
  const { role, staffId, staffName } = useActingStaff();
  const [type, setType] = useState<ContactType>("call");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const submit = () => {
    try {
      logContact({ id: staffId, name: staffName, role }, { patientId, type, date, note });
      onDone(`${CONTACT_TYPE_LABEL[type]} contact logged`, "checkins");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-3" data-testid="contact-log-form">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="ct-type">Type</Label>
          <select id="ct-type" className={selectCls} value={type} onChange={(e) => setType(e.target.value as ContactType)}>
            {(Object.keys(CONTACT_TYPE_LABEL) as ContactType[]).map((k) => (
              <option key={k} value={k}>{CONTACT_TYPE_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ct-date">Date</Label>
          <Input id="ct-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ct-note">Note (optional)</Label>
        <Textarea id="ct-note" maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-xs text-muted-foreground">{NOTE_HINT}</p>
      </div>
      <Button onClick={submit}>Log contact</Button>
    </div>
  );
}
