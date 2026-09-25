// The two demo controls, side by side, on every page type. It sits in the
// page flow above the header, so it never covers the 988 bar, "I need help
// now", the craving button or intake's "Save & continue".
import { FlaskConical } from "lucide-react";
import { DemoStateSwitcher } from "@/components/DemoStateSwitcher";
import { StaffRoleSwitcher } from "@/components/StaffRoleSwitcher";

export function DemoControlsBar() {
  return (
    <div
      data-testid="demo-controls-bar"
      role="region"
      aria-label="Demo controls"
      className="relative z-40 border-b border-dashed border-gold/60 bg-gold/10 print:hidden"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-1 sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy">
          <FlaskConical className="h-3 w-3" />
          <span className="hidden sm:inline">Demo controls</span>
          <span className="sm:hidden">Demo</span>
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <DemoStateSwitcher />
          <StaffRoleSwitcher />
        </div>
      </div>
    </div>
  );
}
