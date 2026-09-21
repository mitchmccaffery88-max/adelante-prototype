// §EHR audit Phase 2a — opens a stored credential document.
//
// Documents are inline data URLs (the signature-capture convention), so they
// are rendered in-page rather than navigated to: Chrome blocks top-level
// navigation to `data:` URLs. PDFs go in an object frame, images in an <img>,
// and both offer a download so the coordinator can keep a copy while verifying.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, FileText } from "lucide-react";
import { formatBytes, isImageCredential } from "@/lib/credentialFile";

export function CredentialDocumentViewer({
  fileName,
  fileType,
  fileSize,
  fileDataUrl,
  triggerLabel = "View",
}: {
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  fileDataUrl?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!fileDataUrl) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="credential-view-trigger">
          <FileText className="h-3.5 w-3.5 mr-1" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl" data-testid="credential-document-viewer">
        <DialogHeader>
          <DialogTitle>{fileName ?? "Credential document"}</DialogTitle>
          <DialogDescription>
            {fileType ?? "document"}
            {typeof fileSize === "number" ? ` · ${formatBytes(fileSize)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 overflow-hidden">
          {isImageCredential(fileType) ? (
            <img src={fileDataUrl} alt={fileName ?? "Credential document"} className="w-full object-contain max-h-[60vh]" />
          ) : (
            <object data={fileDataUrl} type={fileType ?? "application/pdf"} className="w-full h-[60vh]">
              <p className="p-4 text-sm text-muted-foreground">
                This document can't be previewed here. Download it to open in your PDF reader.
              </p>
            </object>
          )}
        </div>
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <a href={fileDataUrl} download={fileName ?? "credential"}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
