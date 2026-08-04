// §Platform nav — persistent staff shell sidebar (Phase 2).
//
// Renders whatever `navSections.ts` says the acting role may see. There is no
// role logic in this file on purpose: a role with `none` on a gate never gets
// the entry, exactly like the record drawer omits chart sections.
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffNavGroups } from "@/lib/navSections";
import { useActingStaff } from "@/lib/roles";
import { STAFF_ROLES } from "@/lib/roles";

const COLLAPSE_KEY = "adelante.staffNavCollapsed";

export function StaffNavSidebar() {
  const groups = useStaffNavGroups();
  const { role } = useActingStaff();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* no-op */
      }
      return !c;
    });
  };

  const roleLabel = STAFF_ROLES.find((r) => r.key === role)?.label ?? role;

  return (
    <aside
      aria-label="Staff navigation"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r bg-secondary/30 transition-all",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand staff navigation" : "Collapse staff navigation"}
          aria-expanded={!collapsed}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-foreground/70 hover:bg-secondary"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        {!collapsed && (
          <span className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
            {roleLabel}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((g) => (
          <div key={g.group} className="mb-4 last:mb-0">
            {!collapsed && (
              <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.entries.map((e) => {
                const active = pathname === e.to;
                const Icon = e.icon;
                return (
                  <li key={e.id}>
                    <Link
                      to={e.to}
                      title={collapsed ? `${e.label} — ${e.desc}` : e.desc}
                      data-nav-id={e.id}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-navy text-navy-foreground"
                          : "text-foreground/75 hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", !active && "text-teal")} />
                      {!collapsed && <span className="truncate">{e.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
