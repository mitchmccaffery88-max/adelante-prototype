// §v3.0 Phase 5 — patient self-upload + the patient's own view of what they
// sent. Unverified uploads are SHOWN with a "pending review" badge rather than
// hidden, so the patient can see their file arrived.
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { FileText, ShieldAlert, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * §Group E item 2 — hands the real payload from
 * `AdelanteEHR.requestDocumentDownload` to the browser. Presentation only: the
 * decision has already been made by the shared gate in the data layer.
 */
export function downloadDocumentPayload(payload: {
  fileName: string;
  mimeType: string;
  text: string;
}) {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(new Blob([payload.text], { type: payload.mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function DocumentStatusBadge({
  status,
}: {
  status: "unverified" | "verified" | "rejected";
}) {
  const { t } = useI18n();
  if (status === "verified") return <Badge variant="default">{t("docStatusVerified")}</Badge>;
  if (status === "rejected") return <Badge variant="destructive">{t("docStatusRejected")}</Badge>;
  return <Badge variant="secondary">{t("docStatusPending")}</Badge>;
}

export function PatientDocumentsCard({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const docs = useEhr(() => AdelanteEHR.listPatientDocuments(patientId));
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!patient) return null;

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg text-navy">
          <FileText className="h-5 w-5 text-teal" /> {t("docTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("docSubtitle")}</p>
      </div>

      <DocumentUploadForm
        part2Prompt="This is from a substance-use treatment program"
        onSubmit={(input) => {
          const res = AdelanteEHR.uploadPatientDocument({
            patientId,
            file: input.file,
            isPart2: input.isPart2,
            ...(input.docType ? { docType: input.docType } : {}),
            ...(input.note ? { note: input.note } : {}),
            uploader: { kind: "patient", name: `${patient.firstName} ${patient.lastName}` },
          });
          if (!res.ok) return toast.error(res.reason);
          toast.success("Sent to your care team for review.");
        }}
      />

      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>
                <span className="font-medium text-navy">{d.fileName}</span>
                <span className="block text-xs text-muted-foreground">
                  <ClientDate value={d.uploadedAt} /> · {AdelanteEHR.documentUploaderLabel(d)}
                  {d.isPart2 ? ` · ${t("docPart2Flag")}` : ""}
                </span>
                {d.rejectedReason && (
                  <span className="mt-1 block text-xs text-destructive">{d.rejectedReason}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {d.isPart2 && <ShieldAlert className="h-4 w-4 text-teal" aria-label="Part 2" />}
                <DocumentStatusBadge status={d.verification} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={d.verification !== "verified"}
                  title={
                    d.verification === "verified" ? undefined : t("docDownloadUnavailable")
                  }
                  onClick={() => {
                    const res = AdelanteEHR.requestDocumentDownload({
                      documentId: d.id,
                      viewer: {
                        kind: "patient",
                        name: `${patient.firstName} ${patient.lastName}`,
                      },
                    });
                    if (!res.ok) return toast.error(res.reason);
                    downloadDocumentPayload(res);
                  }}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> {t("docDownload")}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
