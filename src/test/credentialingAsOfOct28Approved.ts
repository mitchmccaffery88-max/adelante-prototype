// 28 Oct fix (Mitch approved): exclusion screening judged as of booking time,
// relative credentialing seed dates, booked-visit source for the coordinator tile.
// Each approved hunk matches exactly once; every other byte remains pinned.
const DELTAS: Record<string, [string, string][]> = {
  "src/lib/ehr.ts": [],
  "src/lib/ehr-ext.ts": []
};
export function withApprovedCredentialingAsOfOct28(path: string, source: string): string {
  for (const [before, after] of DELTAS[path] ?? []) {
    if (source.split(before).length !== 2) throw new Error(`28 Oct as-of fix anchor not found once: ${path}`);
    source = source.replace(before, after);
  }
  return source;
}
