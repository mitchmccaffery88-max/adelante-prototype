import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

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
  const { lang } = useI18n();
  const [text, setText] = useState<string>(fallback);
  useEffect(() => {
    const locale = lang === "es" ? "es-US" : "en-US";
    setText(new Date(value).toLocaleString(locale, options));
  }, [value, options, lang]);
  return <span suppressHydrationWarning>{text}</span>;
}
