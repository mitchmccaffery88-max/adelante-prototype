// §Build D — DISPLAY-layer helpers for content strings.
//
// Same discipline as the Build A placeholder-copy fix: the stored data field
// is untouched (admins author and edit the full `clinicalTarget`, and the
// content admin forms + preview show it in full). Only the small eyebrow on
// the patient Library reads through these helpers.

/** Human labels for every `LibraryActivity["kind"]` in real use. */
export const ACTIVITY_KIND_LABEL: Record<string, string> = {
  reflection: "Reflection",
  timeline: "Interactive timeline",
  breathing: "Guided breathing",
  sort: "Sort activity",
  sliders: "Sliders",
  grounding: "Grounding",
  decision: "Decision",
  checklist: "Checklist",
  rate: "Rating scale",
  write: "Writing",
};

export function activityKindLabel(kind: string): string {
  return ACTIVITY_KIND_LABEL[kind] ?? "Activity";
}

/**
 * Trim a long-form clinical sentence down to the short "X · Y" eyebrow the
 * ported categories already use. Values that are already short (they contain
 * "·", or are two words) pass through unchanged.
 */
export function shortClinicalTarget(value: string): string {
  const raw = value.trim().replace(/\.$/, "");
  if (!raw) return "";
  if (raw.includes("·")) return raw;
  const parts = raw
    .split(/,| and /i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return cap(raw);
  return parts.slice(0, 2).map(cap).join(" · ");
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}