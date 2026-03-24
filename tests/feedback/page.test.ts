import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FeedbackPage from "@/app/feedback/page";

describe("FeedbackPage", () => {
  it("renders the captured source path and success state", async () => {
    const page = await FeedbackPage({
      searchParams: Promise.resolve({
        from: "/archive",
        status: "success",
      }),
    });

    const html = renderToStaticMarkup(page);

    expect(html).toContain('value="/archive"');
    expect(html).toContain("Thanks. Your note is in the inbox now.");
    expect(html).toContain("Has ReadAbstracted been useful so far?");
    expect(html).not.toContain("Page: /archive");
  });
});
