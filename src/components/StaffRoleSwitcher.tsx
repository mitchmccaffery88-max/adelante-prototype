// Demo control: pick which staff person/role the wireframe acts as. Uses the
// existing `setActingStaff` — no permissions change. After switching, stay on
// the current staff page if the new role can see it, otherwise go to the
// first page that role's own menu offers.
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, UserCog } from "lucide-react";
import { STAFF_ROLES, STAFF_ROSTER, roleAssignmentsOf, setActingStaff, useActingStaff, type StaffRole } from "@/lib/roles";
import { staffNavForRole } from "@/lib/navSections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const roleLabel = (r: string) => STAFF_ROLES.find((x) => x.key === r)?.label ?? r;

export function StaffRoleSwitcher() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { staffId, role, staffName } = useActingStaff();

  function choose(value: string) {
    // §Batch E — value is "staffId|role": one identity, pick the active role.
    const [id, pickedRole] = value.split("|") as [string, StaffRole | undefined];
    const found = STAFF_ROSTER.find((s) => s.id === id);
    if (!found) return;
    const m = { ...found, role: pickedRole ?? found.role };
    setActingStaff(found.id, m.role);
    const pages = staffNavForRole(m.role);
    const staysHere =
      pages.some((e) => e.to === pathname) ||
      (pathname.startsWith("/record/") && pages.length > 0);
    if (!staysHere) {
      // Sensible home per role, only among pages that role can already see.
      const preferred =
        m.role === "billing" || m.role === "billing_coordinator"
          ? ["/billing"]
          : m.role === "sys_admin"
            ? ["/admin"]
            : ["/my-work", "/clinician", "/case-manager"];
      const dest = preferred.find((to) => pages.some((e) => e.to === to)) ?? pages[0]?.to;
      if (dest) navigate({ to: dest });
    }
    toast.success(`Role: ${roleLabel(m.role)} · ${m.name}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="staff-role-switcher"
        aria-label="Demo control: staff role"
        className="inline-flex w-full min-h-[32px] min-w-0 items-center sm:w-auto gap-1.5 rounded-full border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground/80 shadow-sm hover:bg-secondary"
      >
        <UserCog className="h-3.5 w-3.5 shrink-0 text-teal" />
        <span className="min-w-0 flex-1 truncate text-left sm:max-w-[16rem]">
          <span className="text-muted-foreground">Role: </span>
          {roleLabel(role)} · {STAFF_ROSTER.find((x) => x.id === staffId)?.fullName ?? staffName}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[75vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Demo control · act as staff
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={`${staffId}|${role}`} onValueChange={choose}>
          {STAFF_ROSTER.flatMap((s) =>
            roleAssignmentsOf(s).map((a) => (
              <DropdownMenuRadioItem key={`${s.id}|${a.role}`} value={`${s.id}|${a.role}`} className="text-xs" data-testid={`switch-${s.id}-${a.role}`}>
                {s.name}
                <span className="ml-1 text-muted-foreground">· {roleLabel(a.role)}</span>
              </DropdownMenuRadioItem>
            )),
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
