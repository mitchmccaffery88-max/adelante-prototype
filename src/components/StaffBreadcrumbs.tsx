// §Platform nav — staff page header / breadcrumb trail.
//
// Orientation only: the trail is derived from the SAME registry that renders
// the sidebar (`navSections.ts`), so it can never name a surface the acting
// role isn't allowed to see — an unregistered or gated path simply renders a
// generic header. No PHI is placed in the trail (the full-page chart shows
// "Patient record", not the patient's name).
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { entryForPath } from "@/lib/navGuard";
import { NAV_GROUP_LABELS, canSeeNavEntry } from "@/lib/navSections";
import { useActingStaff } from "@/lib/roles";

export function StaffBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useActingStaff();

  const entry = entryForPath(pathname);
  const visible = entry && canSeeNavEntry(role, entry) ? entry : undefined;

  const isRecord = pathname.startsWith("/record/");
  const groupLabel = visible ? NAV_GROUP_LABELS[visible.group] : isRecord ? "Care" : undefined;
  const pageLabel = visible?.label ?? (isRecord ? "Patient record" : "Staff");
  const desc =
    visible?.desc ?? (isRecord ? "Full-page clinical chart" : undefined);
  const Icon = visible?.icon;

  return (
    <div className="border-b bg-background/60 px-4 py-3 sm:px-6">
      <nav aria-label="Breadcrumb" data-testid="staff-breadcrumbs">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
              <Home className="h-3 w-3" />
              <span>Adelante</span>
            </Link>
          </li>
          {groupLabel && (
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 opacity-60" />
              <span>{groupLabel}</span>
            </li>
          )}
          <li className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span aria-current="page" className="font-medium text-foreground">
              {pageLabel}
            </span>
          </li>
        </ol>
      </nav>
      <div className="mt-1 flex items-start gap-2">
        {Icon && <Icon className="mt-1 h-4 w-4 shrink-0 text-teal" />}
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg text-navy">{pageLabel}</h1>
          {desc && <p className="truncate text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
    </div>
  );
}