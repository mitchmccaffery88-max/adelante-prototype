// §Adelante Journey Phase 6 — Community Resource Center (patient-facing).
//
// Patients only ever see LIVE entries: `patientVisibleResources` filters on
// `isResourceLive`, which requires a real staff verification of address, phone
// AND hours, unexpired. An unverified seed entry cannot appear here at all —
// there is no "unverified" patient state to accidentally render.
import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Clock } from "lucide-react";
import {
  RESOURCE_CATEGORIES,
  patientVisibleResources,
  subscribeResources,
} from "@/lib/communityResources";

export function CommunityResourceCenter() {
  const [category, setCategory] = useState<string | null>(null);
  const snapshot = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(patientVisibleResources(category ?? undefined)),
    () => "[]",
  );
  const resources = JSON.parse(snapshot) as ReturnType<typeof patientVisibleResources>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-display text-2xl text-navy">Community resources</h1>
        <p className="text-sm text-muted-foreground">
          Housing, food, work, meetings and more. We only list a place here once someone on our team
          has called it and confirmed the address, phone and hours.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={category === null ? "default" : "outline"}
          onClick={() => setCategory(null)}
        >
          All
        </Button>
        {RESOURCE_CATEGORIES.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={category === c.id ? "default" : "outline"}
            onClick={() => setCategory(c.id)}
          >
            {c.name}
          </Button>
        ))}
      </div>

      {resources.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground" data-testid="resources-empty">
          Nothing is confirmed here yet. Our team is verifying local listings before we show them —
          ask your care team and they can connect you directly today.
        </Card>
      ) : (
        <ul className="space-y-3">
          {resources.map((r) => (
            <li key={r.id}>
              <Card className="space-y-1 p-4">
                <div className="text-sm font-medium text-foreground">{r.name}</div>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {r.address}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {r.phone}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {r.hours}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}