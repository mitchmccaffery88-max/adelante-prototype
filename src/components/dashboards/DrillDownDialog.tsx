// §Population health — generic drill-down dialog.
//
// Faithful port of the reference's DrillDownDialog: a title, a column set, an
// async loader, and an explicit empty state. The loader only runs while the
// dialog is open, so opening the dashboard never pulls PHI rows that nobody
// asked to see.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export interface DrillDownColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface DrillDownDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  columns: DrillDownColumn<T>[];
  /** Runs only when the dialog opens. */
  loader: () => Promise<T[]> | T[];
  emptyMessage?: string;
}

/** Link into the existing full-page patient record route. */
export function PatientLink({ patientId, name }: { patientId: string; name: string }) {
  return (
    <Link
      to="/record/$patientId"
      params={{ patientId }}
      className="font-medium text-teal underline-offset-2 hover:underline"
    >
      {name}
    </Link>
  );
}

export function DrillDownDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  columns,
  loader,
  emptyMessage = "No records behind this number.",
}: DrillDownDialogProps<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    setError(null);
    Promise.resolve()
      .then(() => loader())
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : rows === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading records…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
