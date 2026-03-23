import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminSectionNav } from "@/components/admin-section-nav";

describe("AdminSectionNav", () => {
  it("shows the full admin workspace navigation", () => {
    const html = renderToStaticMarkup(
      createElement(AdminSectionNav, { currentPath: "/admin/ingest" }),
    );

    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/edition"');
    expect(html).toContain('href="/admin/ingest"');
    expect(html).toContain('href="/admin/settings"');
    expect(html).toContain('href="/admin/signups"');
    expect(html).toContain("Overview");
    expect(html).toContain("Edition");
    expect(html).toContain("Ingest");
    expect(html).toContain("Settings");
    expect(html).toContain("Signups");
  });
});
