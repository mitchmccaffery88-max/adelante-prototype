import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AdelanteEHR } from "@/lib/ehr";
import { toast } from "sonner";
import { UploadCloud, FileDown } from "lucide-react";

interface Props {
  caseManagerId: string;
  caseManagerName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Outcome = "matched_cin" | "matched_program" | "matched_name_dob" | "created" | "skipped";

interface Row {
  cin?: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  phone?: string;
  program_id?: string;
  outcome: Outcome;
  matchedPatientId?: string;
  message?: string;
  raw: Record<string, string>;
}

const REQUIRED_HINT = "cin,first_name,last_name,dob,phone,program_id";

// Minimal CSV parser: handles quoted fields with commas and escaped quotes.
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (field.length > 0 || cur.length > 0) {
        cur.push(field);
        lines.push(cur);
        cur = [];
        field = "";
      }
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    lines.push(cur);
  }
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (line[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

function classifyRow(raw: Record<string, string>): Row {
  const cin = raw.cin || undefined;
  const first = raw.first_name || undefined;
  const last = raw.last_name || undefined;
  const dob = raw.dob || undefined;
  const phone = raw.phone || undefined;
  const program = raw.program_id || undefined;
  const patients = AdelanteEHR.listPatients();

  if (cin) {
    const m = patients.find((p) => p.cin && p.cin.toLowerCase() === cin.toLowerCase());
    if (m)
      return {
        cin,
        first_name: first,
        last_name: last,
        dob,
        phone,
        program_id: program,
        outcome: "matched_cin",
        matchedPatientId: m.id,
        raw,
      };
  }
  if (program) {
    const m = patients.find((p) => p.programId.toLowerCase() === program.toLowerCase());
    if (m)
      return {
        cin,
        first_name: first,
        last_name: last,
        dob,
        phone,
        program_id: program,
        outcome: "matched_program",
        matchedPatientId: m.id,
        raw,
      };
  }
  if (first && last && dob) {
    const m = patients.find(
      (p) =>
        p.firstName.toLowerCase() === first.toLowerCase() &&
        p.lastName.toLowerCase() === last.toLowerCase() &&
        p.dob === dob,
    );
    if (m)
      return {
        cin,
        first_name: first,
        last_name: last,
        dob,
        phone,
        program_id: program,
        outcome: "matched_name_dob",
        matchedPatientId: m.id,
        message: "Matched by name + DOB — confirm before applying.",
        raw,
      };
  }
  if (first && last) {
    return {
      cin,
      first_name: first,
      last_name: last,
      dob,
      phone,
      program_id: program,
      outcome: "created",
      raw,
    };
  }
  return {
    cin,
    first_name: first,
    last_name: last,
    dob,
    phone,
    program_id: program,
    outcome: "skipped",
    message: "Missing first_name or last_name",
    raw,
  };
}

export function CaseloadUploadDialog({
  caseManagerId,
  caseManagerName,
  open,
  onOpenChange,
}: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const counts = useMemo(() => {
    const c = { matched: 0, needsReview: 0, created: 0, skipped: 0 };
    for (const r of rows ?? []) {
      if (r.outcome === "matched_cin" || r.outcome === "matched_program") c.matched++;
      else if (r.outcome === "matched_name_dob") c.needsReview++;
      else if (r.outcome === "created") c.created++;
      else c.skipped++;
    }
    return c;
  }, [rows]);

  const reset = () => {
    setRows(null);
    setFileName("");
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("CSV appears empty.");
      return;
    }
    setRows(parsed.rows.map(classifyRow));
  };

  const downloadTemplate = () => {
    const template = `${REQUIRED_HINT}\n"","Jane","Doe","1990-01-15","+15595550001",""\n`;
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adelante-caseload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const apply = () => {
    if (!rows) return;
    let matched = 0;
    let created = 0;
    let skipped = 0;
    for (const r of rows) {
      if (r.outcome === "skipped") {
        skipped++;
        continue;
      }
      if (r.matchedPatientId) {
        AdelanteEHR.assignCaseManager({
          patientId: r.matchedPatientId,
          caseManagerId,
          actorId: caseManagerId,
        });
        matched++;
      } else if (r.outcome === "created" && r.first_name && r.last_name) {
        const p = AdelanteEHR.createPatient({
          firstName: r.first_name,
          lastName: r.last_name,
          dob: r.dob,
          phone: r.phone,
          cin: r.cin,
        });
        AdelanteEHR.assignCaseManager({
          patientId: p.id,
          caseManagerId,
          actorId: caseManagerId,
        });
        created++;
      }
    }
    toast.success(
      `Applied: ${matched} matched, ${created} created${skipped ? `, ${skipped} skipped` : ""}${
        caseManagerName ? ` — assigned to ${caseManagerName}` : ""
      }.`,
    );
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">Upload caseload</DialogTitle>
          <DialogDescription>
            CSV columns (case-insensitive): <span className="font-mono">{REQUIRED_HINT}</span>.
            Existing patients are matched by CIN, then Program ID, then name + DOB. New rows create
            a patient and assign them to {caseManagerName ?? "you"}.
          </DialogDescription>
        </DialogHeader>
        {!rows ? (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-6 text-center">
              <UploadCloud className="mx-auto h-8 w-8 text-teal" />
              <Label className="mt-2 block text-sm">Choose a CSV file</Label>
              <Input
                type="file"
                accept=".csv,text/csv"
                className="mt-2 mx-auto max-w-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <FileDown className="h-3.5 w-3.5 mr-1.5" /> Download template
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {fileName} · {rows.length} row{rows.length === 1 ? "" : "s"}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="bg-success/20 text-success border-0">
                Matched: {counts.matched}
              </Badge>
              <Badge className="bg-gold/30 text-navy border-0">
                Needs review: {counts.needsReview}
              </Badge>
              <Badge className="bg-teal/15 text-teal border-0">Will create: {counts.created}</Badge>
              <Badge className="bg-destructive/15 text-destructive border-0">
                Skipped: {counts.skipped}
              </Badge>
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/40">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">DOB</th>
                    <th className="text-left p-2">CIN</th>
                    <th className="text-left p-2">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        {r.first_name || "—"} {r.last_name || ""}
                      </td>
                      <td className="p-2 text-muted-foreground">{r.dob || "—"}</td>
                      <td className="p-2 font-mono text-muted-foreground">
                        {r.cin ? `••••${r.cin.slice(-4)}` : "—"}
                      </td>
                      <td className="p-2">
                        <OutcomeBadge outcome={r.outcome} />
                        {r.message && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {r.message}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          {rows && (
            <>
              <Button variant="ghost" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={apply}>Apply</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, { cls: string; label: string }> = {
    matched_cin: { cls: "bg-success/20 text-success", label: "Matched (CIN)" },
    matched_program: { cls: "bg-success/20 text-success", label: "Matched (Program ID)" },
    matched_name_dob: { cls: "bg-gold/30 text-navy", label: "Needs review (name+DOB)" },
    created: { cls: "bg-teal/15 text-teal", label: "Will create" },
    skipped: { cls: "bg-destructive/15 text-destructive", label: "Skipped" },
  };
  const v = map[outcome];
  return <Badge className={`${v.cls} border-0 text-[10px]`}>{v.label}</Badge>;
}