// §Platform nav — persistent staff shell sidebar (Phase 2).
//
// Renders whatever `navSections.ts` says the acting role may see. There is no
// role logic in this file on purpose: a role with `none` on a gate never gets
// the entry, exactly like the record drawer omits chart sections.
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffNavGroups } from "@/lib/navSections";
import { useActingStaff } from "@/lib/roles";
import { STAFF_ROLES } from "@/lib/roles";

const COLLAPSE_KEY = "adelante.staffNavCollapsed";

export function StaffNavSidebar() {
  const groups = useStaffNavGroups();
  const { role } = useActingStaff();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Quick jump filters only what the RBAC engine already handed us, so a role
  // can never surface a gated route by typing its name.
  const q = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) =>
          `${e.label} ${e.desc} ${g.label}`.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, q]);
  const firstMatch = visibleGroups[0]?.entries[0];

  // A route is active for its own path and any nested child path (e.g.
  // /record/$patientId keeps the Charts group lit).
  const isActive = (to: string) =>
    pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));

  // Explicit user toggles win; otherwise a group opens when it owns the active
  // route or when a quick-jump query is narrowing results.
  const [groupOverrides, setGroupOverrides] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string, defaultOpen: boolean) =>
    setGroupOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen) }));

  const onSearchKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Escape") {
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (ev.key === "Enter" && firstMatch) {
      ev.preventDefault();
      setQuery("");
      navigate({ to: firstMatch.to });
    }
  };

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

      {!collapsed && (
        <div className="border-b px-2 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Quick jump…"
              aria-label="Quick jump to a surface"
              data-testid="staff-nav-quick-jump"
              className="h-8 w-full rounded-md border bg-background pl-7 pr-7 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear quick jump"
                className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {q && visibleGroups.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">No matching surfaces.</p>
        )}
        {visibleGroups.map((g) => {
          const hasActive = g.entries.some((e) => isActive(e.to));
          const defaultOpen = hasActive || Boolean(q);
          const open = collapsed ? true : (groupOverrides[g.group] ?? defaultOpen);
          return (
          <div key={g.group} className="mb-4 last:mb-0" data-group={g.group} data-open={open ? "true" : "false"}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(g.group, defaultOpen)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 rounded px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">{g.label}</span>
                <ChevronDown
                  className={cn("h-3 w-3 shrink-0 transition-transform", !open && "-rotate-90")}
                />
              </button>
            )}
            {open && (
            <ul className="space-y-0.5">
              {g.entries.map((e) => {
                const active = isActive(e.to);
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
            )}
          </div>
          );
        })}
      </nav>
    </aside>
  );
}
