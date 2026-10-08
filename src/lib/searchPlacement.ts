// §Access A2 — patient search shows only on staff WORK pages. Admin, setup,
// content center and reporting pages never carry it.
import { entryForPath } from "./navGuard";

const NON_WORK_GROUPS = new Set(["administration", "population", "revenue", "account"]);
const NON_WORK_PATHS = ["/admin", "/content-library", "/reporting", "/dashboards", "/dmc-ods-readiness", "/quality-compliance", "/billing", "/location-calendars"];

export function isStaffWorkPage(pathname: string): boolean {
  if (NON_WORK_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}-`) || pathname.startsWith(`${p}/`))) return false;
  const entry = entryForPath(pathname);
  return !entry || !NON_WORK_GROUPS.has(entry.group);
}
