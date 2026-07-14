import { useEffect, useState } from "react";

export function ClientDate({ value, dateOnly = false }: { value: string; dateOnly?: boolean }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    const d = new Date(value);
    setText(
      dateOnly
        ? d.toLocaleDateString("en-US", { dateStyle: "medium" })
        : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    );
  }, [value, dateOnly]);
  return <span>{text || "—"}</span>;
}
