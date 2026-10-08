import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useActingStaff } from "@/lib/roles";
import { staffContentInventory } from "@/lib/contentStaff";
import { contentType } from "@/lib/contentTypes";
import { RealContentPreview } from "./RealContentPreview";
export function ContentAssignmentPreview({ id }: { id?: string }) {
  const { role } = useActingStaff(); const [open, setOpen] = useState(false); const item = staffContentInventory(role).find((e) => e.id === id);
  if (!item) return null;
  return <><Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Preview</Button><Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-3xl"><SheetHeader><SheetTitle>{contentType(item.typeId).titleOf(item.body)}</SheetTitle></SheetHeader><div className="mt-5"><RealContentPreview typeId={item.typeId} id={item.id} body={item.publishedBody ?? item.body} /></div></SheetContent></Sheet></>;
}
