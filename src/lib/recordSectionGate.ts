// §Part 2 — chart section visibility. Part 2-protected sections (ASAM) are
// hidden entirely — menu item AND direct ?section= URL — when the role's
// access is none OR locked (consent-gated without consent). Other sections
// keep the older behaviour: listed, rendering a locked note.
import type { RecordClass } from "@/lib/roles";

export const HIDE_WHEN_LOCKED: readonly RecordClass[] = ["screeners_sud"];

export function recordSectionVisible(
  cls: RecordClass,
  access: { level: string; locked?: boolean },
  alwaysVisible = false,
): boolean {
  if (alwaysVisible) return true;
  if (access.level === "none") return false;
  if (access.locked && HIDE_WHEN_LOCKED.includes(cls)) return false;
  return true;
}
