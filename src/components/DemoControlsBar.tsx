// The two demo controls, side by side, on every page type. It sits in the
// sticky page flow above the header, so it stays reachable without covering
// the 988 bar, "In crisis now", the craving button or "Save & continue".
import { cn } from "@/lib/utils";
import { StaffDensityProvider } from "@/components/StaffDensity";
import { FlaskConical } from "lucide-react";
import { DemoStateSwitcher } from "@/components/DemoStateSwitcher";
import { StaffRoleSwitcher } from "@/components/StaffRoleSwitcher";

export function DemoControlsBar({ staff = false }: { staff?: boolean }) {
  const bar = (
    <div
      data-testid="demo-controls-bar"
      data-density={staff ? "compact" : undefined}
      role="region"
      aria-label="Demo controls"
      className={cn("sticky top-0 z-[60] border-b border-dashed bg-background/95 backdrop-blur print:hidden", staff ? "staff-demo-controls border-line-strong" : "border-gold/60")}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-2 py-1 sm:gap-2 sm:px-6">
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold", staff ? "text-sm text-ink-muted" : "bg-gold/25 text-[10px] uppercase tracking-wide text-navy")}>
          <FlaskConical className="h-3 w-3" />
          <span className="hidden sm:inline">Demo controls</span>
          <span className="sm:hidden">Demo</span>
        </span>
        <div className="ml-auto grid min-w-0 flex-1 grid-cols-2 items-center gap-1 sm:flex sm:flex-none">
          <DemoStateSwitcher />
          <StaffRoleSwitcher />
        </div>
      </div>
    </div>
  );
  return staff ? <StaffDensityProvider>{bar}</StaffDensityProvider> : bar;
}
