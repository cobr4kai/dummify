import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppHeader } from "@/components/app-header";

describe("AppHeader", () => {
  it("shows a feedback utility link on reader routes", () => {
    const html = renderToStaticMarkup(
      createElement(AppHeader, { currentPath: "/archive" }),
    );

    expect(html).toContain('href="/feedback?from=%2Farchive"');
    expect(html).toContain(">Feedback<");
    expect(html).toContain("nav-link");
  });

  it("does not show the feedback utility link on admin routes", () => {
    const html = renderToStaticMarkup(
      createElement(AppHeader, { currentPath: "/admin" }),
    );

    expect(html).not.toContain("/feedback");
  });
});
