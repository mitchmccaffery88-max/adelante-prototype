import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "./form-field";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  keepLabel: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonHelp?: string;
  children?: ReactNode;
  onConfirm: (reason: string) => boolean | Promise<boolean>;
  trigger?: ReactNode;
}

/** Presentation only: callers retain their registry, permission and audit ownership. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, keepLabel, requireReason, reasonLabel, reasonHelp, children, onConfirm, trigger }: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = useRef(false);
  const safe = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) { setReason(""); setAttempted(false); setFailure(null); }
  }, [open]);
  const changeOpen = (next: boolean) => { if (!busy.current) onOpenChange(next); };
  const confirm = async () => {
    setAttempted(true);
    if (busy.current || (requireReason && !reason.trim())) return;
    busy.current = true;
    setFailure(null);
    setPending(true);
    try {
      if (await onConfirm(reason.trim())) onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : "";
      setFailure(message || "The change was not completed. Check the details and try again.");
    } finally { busy.current = false; setPending(false); }
  };
  const controlClass = "h-auto min-h-9 whitespace-normal text-sm leading-5 [@media(pointer:coarse)]:min-h-12";
  return <AlertDialog open={open} onOpenChange={changeOpen}>
    {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
    <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg bg-surface text-ink"
      onOpenAutoFocus={(event) => { event.preventDefault(); previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; safe.current?.focus(); }}
      onCloseAutoFocus={(event) => { event.preventDefault(); previousFocus.current?.focus(); }}>
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription className="text-sm leading-5 text-ink-muted">{description}</AlertDialogDescription></AlertDialogHeader>
      {children}
      {(requireReason || reasonLabel) && <FormField reason={!reasonLabel} label={reasonLabel} help={reasonHelp} required={requireReason} multiline value={reason} onChange={setReason} attempted={attempted} />}
      {failure && <p role="alert" className="rounded-sm border border-attention bg-gold p-2 text-sm text-on-gold">{failure}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button ref={safe} type="button" variant="outline" className={controlClass} disabled={pending} onClick={() => changeOpen(false)}>{keepLabel}</Button>
        <Button type="button" className={`${controlClass} bg-path-action text-primary-foreground`} disabled={pending} onClick={confirm}>{confirmLabel}</Button>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}