// §EHR audit Phase 2a — real credential document storage.
//
// Deliberately the SAME storage convention already used for drawn signatures
// (`SignaturePad` -> `signatureDataUrl`): the bytes live in a base64 data URL
// on the record itself. No object store, no upload endpoint, no virus
// scanning — those are production concerns tracked with SculptSoft. What this
// buys today is the one thing the credentialing dashboard genuinely lacked:
// a clinical coordinator clicking "Verify" can actually OPEN the document.
//
// Because the bytes ride inline, the size ceiling is small and enforced with
// an explicit message. A file that is too large or the wrong type is rejected
// loudly at selection time; it never silently drops.

/** Inline data URLs are held in memory — keep the ceiling small and honest. */
export const CREDENTIAL_MAX_BYTES = 2 * 1024 * 1024;

export const CREDENTIAL_ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type CredentialFileType = (typeof CREDENTIAL_ACCEPTED_TYPES)[number];

/** `accept` attribute for the file input — mirrors the allowlist above. */
export const CREDENTIAL_ACCEPT_ATTR = CREDENTIAL_ACCEPTED_TYPES.join(",");

export const CREDENTIAL_STORAGE_NOTE =
  "Documents are stored inside this prototype as inline data, the same way drawn signatures are. Keep files under 2 MB.";

export interface CredentialFilePayload {
  fileName: string;
  fileType: CredentialFileType;
  fileSize: number;
  fileDataUrl: string;
}

export type CredentialFileResult =
  | { ok: true; file: CredentialFilePayload }
  | { ok: false; error: string };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedType(t: string): t is CredentialFileType {
  return (CREDENTIAL_ACCEPTED_TYPES as readonly string[]).includes(t);
}

/**
 * Pure validation, separated from reading so it is testable without a
 * FileReader. Returns the first real problem, phrased as an instruction.
 */
export function validateCredentialFile(meta: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!meta.name) return { ok: false, error: "No file was selected." };
  if (!isAcceptedType(meta.type))
    return {
      ok: false,
      error: `That file type isn't accepted${meta.type ? ` (${meta.type})` : ""}. Upload a PDF, PNG, JPEG, or WebP.`,
    };
  if (meta.size <= 0) return { ok: false, error: "That file is empty — nothing was read from it." };
  if (meta.size > CREDENTIAL_MAX_BYTES)
    return {
      ok: false,
      error: `That file is ${formatBytes(meta.size)}. The limit is ${formatBytes(CREDENTIAL_MAX_BYTES)} — scan at a lower resolution or split the document.`,
    };
  return { ok: true };
}

/** Reads a selected file into a data URL, refusing anything validation rejects. */
export async function readCredentialFile(file: File): Promise<CredentialFileResult> {
  const check = validateCredentialFile({ name: file.name, type: file.type, size: file.size });
  if (!check.ok) return check;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });
    if (!dataUrl.startsWith("data:"))
      return { ok: false, error: "That file could not be read. Try selecting it again." };
    return {
      ok: true,
      file: {
        fileName: file.name,
        fileType: file.type as CredentialFileType,
        fileSize: file.size,
        fileDataUrl: dataUrl,
      },
    };
  } catch {
    return { ok: false, error: "That file could not be read. Try selecting it again." };
  }
}

/** True when the stored document can be shown inline as an image. */
export function isImageCredential(type?: string): boolean {
  return Boolean(type && type.startsWith("image/"));
}
