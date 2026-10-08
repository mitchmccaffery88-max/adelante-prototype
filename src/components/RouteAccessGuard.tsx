import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useActingStaff } from "@/lib/roles";
import { resolveNavAccess, resolveChartRouteAccess } from "@/lib/navGuard";
import { AdelanteEHR } from "@/lib/ehr";

/**
 * §Platform nav — route-level guard. Mounted once in the app shell so it
 * covers every deep link. Redirects (history REPLACE, so Back doesn't bounce
 * the user into the gated URL again) and explains why via a toast.
 */
export function RouteAccessGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, staffId } = useActingStaff();
  const navigate = useNavigate();
  const lastWarned = useRef<string | null>(null);

  useEffect(() => {
    const access = resolveChartRouteAccess(role, staffId, pathname) ?? resolveNavAccess(role, pathname);
    if (access.status !== "denied") {
      lastWarned.current = null;
      return;
    }
    if (access.redirectTo === pathname) return;
    const key = `${role}:${pathname}`;
    if (lastWarned.current !== key) {
      lastWarned.current = key;
      // Audit the blocked attempt once per role+path (same de-dupe as the
      // toast, so a re-render storm can't spam the log). No patient context
      // and no free text is recorded — only the route and the acting role.
      AdelanteEHR.recordNavAccessDenied({
        role,
        actorId: staffId,
        path: pathname,
        redirectTo: access.redirectTo,
        entryId: access.entry.id,
        label: access.entry.label,
      });
      // Deferred a tick: on a cold deep link this effect runs before the
      // Toaster's own mount effect subscribes, and an immediately-emitted
      // toast would be dropped.
      // Under a slow cold load the Toaster can take longer than one tick, so
      // wait (up to 5s) until it is in the page before emitting.
      const started = Date.now();
      const emit = () => {
        const ready = typeof document !== "undefined" && !!document.querySelector('section[aria-label^="Notifications"]');
        if (ready || Date.now() - started > 5000) {
          toast.error("Access restricted", { description: access.message });
        } else {
          setTimeout(emit, 50);
        }
      };
      setTimeout(emit, 0);
    }
    navigate({ to: access.redirectTo, replace: true });
  }, [role, staffId, pathname, navigate]);

  return null;
}