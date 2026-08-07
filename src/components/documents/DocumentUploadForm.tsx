// §v3.0 Phase 5 — the one upload form, reused by all three paths (patient
// self-upload, staff-assisted, advocate).
//
// STORAGE HONESTY FLAG: the picked file is NEVER stored or transmitted. We
// read its name, type and size, plus a short text sample for the scan gate,
// and then drop it. There is no object store, no encryption, no upload. A
// production build needs real encrypted storage inside the compliance
// perimeter — see the header of `src/lib/documents.ts`.
import { useRef, useState } from "react";
import { DOCUMENT_TYPES, type UploadCandidate } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, ShieldAlert } from "lucide-react";

export interface DocumentUploadSubmission {
  file: UploadCandidate;
  isPart2: boolean;
  docType?: string;
  note?: string;
}

export function DocumentUploadForm({
  onSubmit,
  part2Prompt = "This document comes from a substance-use treatment program (42 CFR Part 2).",
  submitLabel = "Send for review",
  disabled,
}: {
  onSubmit: (input: DocumentUploadSubmission) => void;
  part2Prompt?: string;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<UploadCandidate | null>(null);
  const [isPart2, setIsPart2] = useState(false);
  const [docType, setDocType] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return setFile(null);
    // Sample only — used by the scan gate's signature check, then discarded.
    let contentSample: string | undefined;
    if (f.size <= 64 * 1024) {
      try {
        contentSample = (await f.text()).slice(0, 4096);
      } catch {
        contentSample = undefined;
      }
    }
    setFile({
      fileName: f.name,
      mimeType: f.type || "application/octet-stream",
      sizeBytes: f.size,
      ...(contentSample ? { contentSample } : {}),
    });
  }

  function submit() {
    if (!file) return;
    setBusy(true);
    onSubmit({
      file,
      isPart2,
      ...(docType ? { docType } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setBusy(false);
    setFile(null);
    setIsPart2(false);
    setDocType("");
    setNote("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="doc-file">Choose a file</Label>
        <Input
          id="doc-file"
          ref={inputRef}
          type="file"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {file && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            {file.fileName} · {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="doc-type">What is it?</Label>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger id="doc-type">
            <SelectValue placeholder="Choose (optional)" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((d) => (
              <SelectItem key={d.key} value={d.key}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Part 2 classification happens HERE, at upload, by whoever uploads —
          it is never inferred from the file afterwards. */}
      <label className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm">
        <Checkbox
          checked={isPart2}
          onCheckedChange={(v) => setIsPart2(v === true)}
          className="mt-0.5"
          aria-label="Part 2 program document"
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-navy">
            <ShieldAlert className="h-4 w-4 text-teal" /> {part2Prompt}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Marking this protects the document from being redisclosed, and keeps it behind the same
            protection as other substance-use information.
          </span>
        </span>
      </label>

      <div className="space-y-1">
        <Label htmlFor="doc-note">Anything the team should know? (optional)</Label>
        <Textarea id="doc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>

      <Button onClick={submit} disabled={!file || busy || disabled}>
        {submitLabel}
      </Button>
      <p className="text-xs text-muted-foreground">
        Every file is scanned before it is accepted, and nothing is added to the medical record
        until a care team member reviews it.
      </p>
    </div>
  );
}
