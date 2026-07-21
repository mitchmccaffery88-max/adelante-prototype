import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  compact?: boolean;
}

/**
 * Shared empty-state card. Use anywhere a list, table, or card has no data
 * yet — replaces one-off "No X yet" divs.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: Props) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border/70 bg-muted/20 " +
        (compact ? "px-4 py-6 " : "px-6 py-10 ") +
        (className ?? "")
      }
      role="status"
    >
      <div className="h-10 w-10 rounded-full bg-background border grid place-items-center text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="mt-3 font-medium text-navy">{title}</div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <Button size="sm" variant="outline" className="mt-3" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}