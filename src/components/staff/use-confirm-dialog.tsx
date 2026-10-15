import { useEffect, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";

type Request = Omit<ConfirmDialogProps, "open" | "onOpenChange" | "trigger">;

/** Collects intent only. The supplied callback owns its registry/store writes. */
export function useConfirmDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const active = useRef(false);
  useEffect(() => () => { active.current = false; }, []);
  const ask = (next: Request) => {
    if (active.current) return;
    active.current = true;
    setRequest(next);
  };
  const close = () => { active.current = false; setRequest(null); };
  const dialog = request ? <ConfirmDialog {...request} open onOpenChange={open => { if (!open) close(); }} /> : null;
  return { ask, dialog };
}