// §Calendars L7 — Calendar sync (Google / Microsoft 365). Simulated: nothing leaves Adelante.
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { simulatedSurfaceLabel } from "@/lib/features";
import { act } from "@/lib/actions/act";
import { confirmationFor } from "@/lib/actions/runAction";
import { canManageStaffCalendars, staffExternalCalendarId } from "@/lib/workingCalendar";
import type { StaffRole } from "@/lib/roles";

export function CalendarSyncCard({ ownerId, actor }: { ownerId: string; actor: { role: StaffRole; staffId?: string; clinicianId?: string } }) {
  const [ext, setExt] = useState(staffExternalCalendarId(ownerId) ?? "");
  const manager = canManageStaffCalendars(actor.role);
  const run = (fn: () => void, msg: string) => { try { fn(); toast.success(msg); } catch (e) { toast.error((e as Error).message); } };
  return (
    <Card className="space-y-2 p-4" data-testid="calendar-sync-card">
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Calendar sync</h2><Badge variant="outline">{simulatedSurfaceLabel("calendar_sync_simulated")}</Badge></div>
      <p className="text-xs text-muted-foreground">Google / Microsoft 365. No real sync yet — the external calendar id is stored for later.</p>
      <div className="flex gap-2">
        <Input aria-label="External calendar id" placeholder="External calendar id" value={ext} onChange={(e) => setExt(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => run(() => act("calendar_external_id_set", "setExternalCalendarId", actor, { scope: "staff", id: ownerId, externalCalendarId: ext, reason: "External calendar linked" }), "Saved")}>Save</Button>
        {manager && <Button size="sm" onClick={() => run(() => act("calendar_sync_run", "calendarSync.sync", { provider: "google", externalCalendarId: ext }), confirmationFor("calendar_sync_run", "Sync ran — nothing changed"))}>Sync</Button>}
      </div>
    </Card>
  );
}
