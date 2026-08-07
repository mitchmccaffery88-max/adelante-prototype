// §v3.0 Phase 5 — the staff verify queue + the staff-assisted upload path.
//
// Ownership is DERIVED (`AdelanteEHR.documentOwnerRole`) from the patient's
// Phase 2 pre-release episode: CF Care Manager while the episode is open, ECM
// Provider otherwise. There is no manual assignment control here on purpose.
//
// The queue row names WHO uploaded — patient, named advocate, or staff member
// (and whether staff did it on the patient's behalf) — because "someone
// uploaded this" is not a useful review signal.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { FileCheck2, ShieldAlert, Upload } from "lucide-react";

const ASSISTED_ROLES = ["cf_care_manager", "ecm_provider"] as const;

export function DocumentVerifyQueue() {
  const { role, staffId, staffName } = useActingStaff();
  const [mine, setMine] = useState(true);
  const rows = useEhr(() =>
    AdelanteEHR.documentVerifyQueue(mine && (role === "cf_care_manager" || role === "ecm_provider") ? role : undefined),
  );
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectWhy, setRejectWhy] = useState("");
  const [assistPatient, setAssistPatient] = useState("");
  const canAssist = (ASSISTED_ROLES as readonly string[]).includes(role);

  return (
    <div className="space-y-4">
      {canAssist && (
        <Card className="space-y-3 p-5">
          <div>
            <h3 className="flex items-center gap-2 font-medium text-navy">
              <Upload className="h-4 w-4 text-teal" /> Upload on a patient&apos;s behalf
            </h3>
            <p className="text-xs text-muted-foreground">
              For use during an interaction — a phone call, a visit, a release appointment. The
              upload is attributed to you, on the patient&apos;s behalf, and still goes to review.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="assist-patient">Patient</Label>
            <Select value={assistPatient} onValueChange={setAssistPatient}>
              <SelectTrigger id="assist-patient">
                <SelectValue placeholder="Choose a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DocumentUploadForm
            disabled={!assistPatient}
            submitLabel="Upload for review"
            part2Prompt="This document originates from a 42 CFR Part 2 program"
            onSubmit={(input) => {
              if (!assistPatient) return;
              const res = AdelanteEHR.uploadPatientDocument({
                patientId: assistPatient,
                file: input.file,
                isPart2: input.isPart2,
                ...(input.docType ? { docType: input.docType } : {}),
                ...(input.note ? { note: input.note } : {}),
                uploader: {
                  kind: "staff",
                  name: staffName,
                  role,
                  staffId,
                  onBehalfOfPatient: true,
                },
              });
              if (!res.ok) return toast.error(res.reason);
              toast.success("Uploaded and queued for review.");
            }}
          />
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium text-navy">
          <FileCheck2 className="h-4 w-4 text-teal" /> Pending review ({rows.length})
        </h3>
        <Button size="sm" variant="outline" onClick={() => setMine((m) => !m)}>
          {mine ? "Show all queues" : "Show my queue"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing waiting" description="No documents are pending review." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.document.id} className="rounded-lg border p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <span className="font-medium text-navy">{row.document.fileName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.patientName} · uploaded by {row.uploaderLabel} ·{" "}
                    <ClientDate value={row.document.uploadedAt} />
                  </span>
                  {row.document.note && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      &ldquo;{row.document.note}&rdquo;
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {row.document.isPart2 && (
                    <Badge variant="outline" className="gap-1">
                      <ShieldAlert className="h-3 w-3" /> Part 2
                    </Badge>
                  )}
                  <Badge variant="secondary">Pending review</Badge>
                  <Badge variant="outline">
                    {row.ownerRole === "cf_care_manager" ? "CF Care Manager" : "ECM Provider"}
                  </Badge>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const res = AdelanteEHR.verifyPatientDocument(row.document.id, {
                      staffId,
                      staffName,
                      role,
                    });
                    toast[res.ok ? "success" : "error"](res.reason);
                  }}
                >
                  Verify &amp; add to chart
                </Button>
                {rejectFor === row.document.id ? (
                  <span className="flex flex-1 items-center gap-2">
                    <Input
                      value={rejectWhy}
                      onChange={(e) => setRejectWhy(e.target.value)}
                      placeholder="Reason (required)"
                      className="h-8"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const res = AdelanteEHR.rejectPatientDocument(row.document.id, {
                          staffId,
                          staffName,
                          role,
                          reason: rejectWhy,
                        });
                        toast[res.ok ? "success" : "error"](res.reason);
                        if (res.ok) {
                          setRejectFor(null);
                          setRejectWhy("");
                        }
                      }}
                    >
                      Confirm
                    </Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setRejectFor(row.document.id)}>
                    Not accepted
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
