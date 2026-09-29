import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "@/components/ui/badge";

describe("Badge is inline", () => {
  it("renders a span so it is valid inside <p>", () => {
    const html = renderToStaticMarkup(<p>Status <Badge>Open</Badge></p>);
    expect(html).toMatch(/^<p>Status <span[^>]*>Open<\/span><\/p>$/);
  });
});
