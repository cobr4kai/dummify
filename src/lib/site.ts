export const SITE_NAME = "Abstracted";
export const SITE_URL = "https://readabstracted.com";
export const SITE_DESCRIPTION =
  "Read the most commercially relevant AI and arXiv papers in plain English for operators, PMs, investors, and non-research engineers.";
export const SITE_INTRO =
  "Abstracted translates the most commercially relevant AI research into plain English. It is built for operators, PMs, investors, and non-research engineers who want the signal from new arXiv papers without reading dense research PDFs.";

export function getSiteUrl(path = "/") {
  const normalizedPath = path === "/" ? "/" : path.replace(/\/+$/, "") || "/";
  return new URL(normalizedPath, SITE_URL).toString();
}
