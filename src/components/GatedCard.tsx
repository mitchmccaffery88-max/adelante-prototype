import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { canAccess, useActingRole, type RecordClass } from "@/lib/roles";
import type { Patient } from "@/lib/ehr";
import { cn } from "@/lib/utils";

/**
 * Wraps a chart section with role/consent gating (§4b). When the acting
 * staff role can't see this record class — or when a Part-2 consent is
 * required and not granted — renders a locked-state card instead of the
 * children. Additive: pages that never wrap in GatedCard behave as before.
 */
export function GatedCard({
  cls,
  patient,
  title,
  children,
  className,
}: {
  cls: RecordClass;
  patient?: Patient;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [role] = useActingRole();
  const { locked, reason } = canAccess(role, cls, patient);
  if (!locked) return <>{children}</>;
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-muted-foreground/30 bg-muted/40 p-4 text-sm text-muted-foreground",
        className,
      )}
      role="note"
      aria-label={`${title} locked`}
    >
      <div className="flex items-center gap-2 font-medium text-foreground/80">
        <Lock className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <p className="mt-1 text-xs">
        {reason ?? "Your role doesn't have access to this section."}
      </p>
    </div>
  );
}
