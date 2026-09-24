// §Phase 8c — one label for how much weight a verification record carries.
import {
  COVERAGE_CHECK_CHANNEL_LABEL,
  REPORTED_SOURCE_LABEL,
  type CoverageVerificationRecord,
} from "@/lib/ehr";

export type VerificationKind = "reported" | "staff" | "electronic";

export function verificationKind(v: CoverageVerificationRecord): VerificationKind {
  if (v.reportSource) return "reported";
  if (v.channel === "electronic_270_271") return "electronic";
  return "staff";
}

const STATUS_LABEL = { active: "active", inactive: "inactive", not_found: "not found", error: "error" } as const;

export function verificationSourceLabel(v: CoverageVerificationRecord): string {
  const k = verificationKind(v);
  if (k === "reported") return `${REPORTED_SOURCE_LABEL[v.reportSource!]} — not verified`;
  if (k === "electronic") {
    const st = v.electronic?.responseStatus;
    return `Electronic 270/271${st ? ` · ${STATUS_LABEL[st]}` : ""}`;
  }
  return `Staff check · ${COVERAGE_CHECK_CHANNEL_LABEL[v.channel]}`;
}
