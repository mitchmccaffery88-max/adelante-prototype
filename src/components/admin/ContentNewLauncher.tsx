// Quick-actions batch 3 — "+ New" in the content center. Items are the
// registry's content-center create actions, filtered through each action's
// own allowed(): "Create content" (content_create, canAuthorContent) and
// "Edit consent form" (consent_form_author, sys_admin | clinical_coordinator).
// Picking an item only opens the existing workflow (Manage tab title box, or
// Legal & consent); the save there still runs through runAction, so opening
// writes nothing. A role with no permitted item gets no "+ New".
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { StaffNewTrigger } from "@/components/StaffDensity";
import { NewActionMenu, type NewActionItem } from "@/components/staff/NewActionMenu";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CHART_ACTIONS, type ChartActor } from "@/lib/chartActions";
import { useActingStaff } from "@/lib/roles";
import { CONTENT_NEW_ACTION_IDS } from "@/lib/quickActions";

export { CONTENT_NEW_ACTION_IDS } from "@/lib/quickActions";
const TAB_FOR: Record<string, string> = { content_create: "manage", consent_form_author: "legal" };

export function contentNewItems(actor: ChartActor): NewActionItem[] {
  return CONTENT_NEW_ACTION_IDS.map((id) => CHART_ACTIONS.find((a) => a.id === id))
    .filter((a): a is (typeof CHART_ACTIONS)[number] => !!a && !a.pending)
    .map((action) => ({ action, answer: action.allowed(actor, undefined) }))
    .filter((x) => x.answer.state !== "hidden");
}

export function ContentNewLauncher({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const actor = useActingStaff();
  const [open, setOpen] = useState(false);
  const available = useMemo(() => contentNewItems(actor), [actor]);
  if (available.length === 0) return null;
  const pick = (id: string) => {
    setOpen(false);
    onOpenTab(TAB_FOR[id]);
    if (id === "content_create") {
      window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="new-content-id"]')?.focus(), 50);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <StaffNewTrigger>
        <PopoverTrigger asChild>
          <Button data-testid="content-new-button" className="staff-new-button w-full justify-start">
            <Plus className="h-5 w-5" />
            <span>New</span>
          </Button>
        </PopoverTrigger>
      </StaffNewTrigger>
      <PopoverContent aria-label="New action" align="end" side="top" className="w-80 max-h-[70vh] overflow-y-auto p-2" data-testid="content-add-menu">
        <NewActionMenu actor={actor} available={available} onPick={pick} itemTestId={(id) => `content-item-${id}`} />
      </PopoverContent>
    </Popover>
  );
}
