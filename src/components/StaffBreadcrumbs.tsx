// §Platform nav — staff page header / breadcrumb trail.
//
// Orientation only: the trail is derived from the SAME registry that renders
// the sidebar (`navSections.ts`), so it can never name a surface the acting
// role isn't allowed to see — an unregistered or gated path simply renders a
// generic header. No PHI is placed in the trail (the full-page chart shows
// "Patient record", not the patient's name).
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home, ListChecks } from "lucide-react";
import { entryForPath } from "@/lib/navGuard";
import { NAV_GROUP_LABELS, STAFF_NAV, canSeeNavEntry } from "@/lib/navSections";
import { useActingStaff } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { myOpenItems } from "@/lib/myWork";
import { StaffPatientSearch } from "@/components/StaffPatientSearch";
import { AskAdelPanel } from "@/components/AskAdelPanel";

/**
 * §Dashboard Standardization Phase 5b — the shared staff top bar.
 *
 * This strip already rendered once for every staff route inside the staff
 * shell, so the standardized bar is built here rather than per page: the
 * breadcrumb trail on the left, patient search and My work on the right. Both
 * controls appear or disappear purely by real role permission — there is no
 * per-dashboard fork.
 */
export function StaffBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, staffId, staffName, clinicianId } = useActingStaff();

  // My work is shown exactly when the shared nav registry already grants the
  // page to this role, so the bar and the sidebar can never disagree.
  const myWorkEntry = STAFF_NAV.find((e) => e.id === "my-work");
  const canSeeMyWork = Boolean(myWorkEntry && canSeeNavEntry(role, myWorkEntry));
  // Same helper `/my-work` and the dashboard queue pill call — one count.
  const myWorkCount = useEhr(() =>
    canSeeMyWork
      ? myOpenItems({ staffId, staffName, ...(clinicianId ? { clinicianId } : {}) }).total
      : 0,
  );


  const entry = entryForPath(pathname);
  const visible = entry && canSeeNavEntry(role, entry) ? entry : undefined;

  const isRecord = pathname.startsWith("/record/");
  const groupLabel = visible ? NAV_GROUP_LABELS[visible.group] : isRecord ? "Care" : undefined;
  const pageLabel = visible?.label ?? (isRecord ? "Patient record" : "Staff");
  const desc =
    visible?.desc ?? (isRecord ? "Full-page clinical chart" : undefined);
  const Icon = visible?.icon;

  return (
    <div
      className="border-b bg-background/60 px-4 py-3 sm:px-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      data-testid="staff-top-bar"
    >
      <div className="min-w-0">
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
      {/* Orientation strip, not a heading: each route owns its own <h1>, so
          this stays a plain label to avoid a second H1 on every page. */}
      <div className="mt-1 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-teal" />}
        <span className="truncate font-display text-base text-navy">{pageLabel}</span>
        {desc && (
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            · {desc}
          </span>
        )}
      </div>
      </div>

      {/* Standardized right-hand controls — role-driven, not page-driven. */}
      <div className="flex w-full items-center gap-2 lg:w-auto lg:justify-end">
        <StaffPatientSearch />
        {/* §Phase 5e — prototype assistant entry point; hides itself for a
            role with no question and no shortcut. */}
        <AskAdelPanel />
        {canSeeMyWork && (
          <Link
            to="/my-work"
            data-testid="top-bar-my-work"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary"
          >
            <ListChecks className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
            My work
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {myWorkCount}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}