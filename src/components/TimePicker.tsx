import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // "HH:mm" 24-hour, or ""
  onChange: (v: string) => void;
  error?: string;
  id?: string;
  ariaLabel?: string;
}

function parse(value: string): { h12: string; m: string; ap: "AM" | "PM" } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  if (!m) return { h12: "", m: "", ap: "AM" };
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return { h12: String(h), m: min, ap };
}

function to24(h12: string, m: string, ap: "AM" | "PM"): string {
  if (!h12 || !m) return "";
  let h = parseInt(h12, 10);
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function TimePicker({ value, onChange, error, id, ariaLabel }: TimePickerProps) {
  const { h12, m, ap } = parse(value);
  const invalid = Boolean(error);
  const emit = (next: { h12?: string; m?: string; ap?: "AM" | "PM" }) => {
    onChange(to24(next.h12 ?? h12, next.m ?? m, next.ap ?? ap));
  };
  const triggerCls = cn(invalid && "ring-2 ring-destructive border-destructive");
  const describedBy = id && error ? `${id}-error` : undefined;
  return (
    <div aria-label={ariaLabel} aria-invalid={invalid} aria-describedby={describedBy}>
      <div className="grid grid-cols-3 gap-2">
        <Select value={h12} onValueChange={(v) => emit({ h12: v })}>
          <SelectTrigger className={triggerCls} aria-label="Hour">
            <SelectValue placeholder="Hr" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {HOURS.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={m} onValueChange={(v) => emit({ m: v })}>
          <SelectTrigger className={triggerCls} aria-label="Minute">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {MINUTES.map((mm) => (
              <SelectItem key={mm} value={mm}>
                {mm}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ap} onValueChange={(v) => emit({ ap: v as "AM" | "PM" })}>
          <SelectTrigger className={triggerCls} aria-label="AM or PM">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p id={describedBy} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
