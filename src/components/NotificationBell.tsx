// §Notification feed, Phase 1 — operational alerts only (staff-to-staff,
// system-generated). In-app only: no email/SMS/push transport exists.
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AdelanteEHR, useEhr, type AppNotification } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function NotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { staffName, role } = useActingStaff();
  const rows = useEhr(() => AdelanteEHR.listNotificationsFor(staffName, role));
  const unread = rows.filter((n) => !n.readAt).length;

  const open = (n: AppNotification) => {
    AdelanteEHR.markNotificationRead(n.id, staffName);
    if (!n.linkRoute) return;
    const params = n.linkParams ?? {};
    if (n.linkRoute === "/record/$patientId" && params.patientId) {
      navigate({
        to: "/record/$patientId",
        params: { patientId: params.patientId },
        search: params.section ? { section: params.section } : {},
      });
      return;
    }
    navigate({ to: n.linkRoute });
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
        className={cn(
          "relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-foreground/70 hover:bg-secondary",
          className,
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold text-navy">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={unread === 0}
            onClick={() => AdelanteEHR.markAllNotificationsRead(staffName, role)}
          >
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No notifications for {staffName}.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.slice(0, 30).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-secondary/60",
                      !n.readAt && "bg-teal/5",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
                      <span
                        className={cn(
                          "text-xs text-navy",
                          !n.readAt ? "font-semibold" : "font-medium opacity-80",
                        )}
                      >
                        {n.subject}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{n.body}</span>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      {n.category.replace(/_/g, " ")} · {timeAgo(n.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
