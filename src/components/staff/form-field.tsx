import { useId, useState } from "react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStaffDensity } from "@/components/StaffDensity";

export interface FormFieldProps {
  label?: string;
  reason?: boolean;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  attempted?: boolean;
  validate?: (value: string) => string | undefined;
  multiline?: boolean;
  accessibleName?: string;
}

/** Staff-only field; member forms and the react-hook-form Controller stay independent. */
export function FormField({ label, reason, help, value, onChange, required, attempted, validate, multiline, accessibleName }: FormFieldProps) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const error = required && !value.trim() ? (reason ? "Add a reason for this decision to continue." : "Fill in this field to continue.") : validate?.(value);
  const shown = Boolean((touched || attempted) && error);
  const name = reason ? "Reason (saved to the audit log)" : label;
  const description = help ?? (reason ? "Explain the decision without including patient details." : undefined);
  const props = {
    id, value, required, "aria-label": accessibleName,
    "aria-invalid": shown,
    "aria-describedby": [description ? `${id}-help` : "", shown ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    onBlur: () => setTouched(true),
    className: "min-h-9 rounded-sm border-[1.5px] border-line-strong bg-surface text-sm leading-5 text-ink [@media(pointer:coarse)]:min-h-12",
  };
  return <div className="space-y-1.5 text-sm leading-5" data-density={useStaffDensity()}>
    <Label htmlFor={id} className="text-sm leading-5">{name}</Label>
    {multiline ? <Textarea {...props} rows={2} /> : <Input {...props} />}
    {description && <p id={`${id}-help`} className="text-sm leading-5 text-ink-muted">{description}</p>}
    {shown && <p id={`${id}-error`} role="alert" className="flex items-start gap-2 rounded-sm border border-attention bg-gold p-2 text-sm leading-5 text-on-gold"><CircleAlert aria-hidden="true" className="size-5 shrink-0 text-attention" />{error}</p>}
  </div>;
}