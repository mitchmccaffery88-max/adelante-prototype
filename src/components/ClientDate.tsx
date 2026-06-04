import { useEffect, useState } from "react";

/** Renders a formatted date only after hydration to avoid SSR/client timezone mismatch. */
export function ClientDate({
  value,
  options,
  fallback = "—",
}: {
  value: string | number | Date;
  options?: Intl.DateTimeFormatOptions;
  fallback?: string;
}) {
  const [text, setText] = useState<string>(fallback);
  useEffect(() => {
    setText(new Date(value).toLocaleString(undefined, options));
  }, [value, options]);
  return <span suppressHydrationWarning>{text}</span>;
}