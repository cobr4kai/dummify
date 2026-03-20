import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils/cn";

export function PageShell({
  children,
  currentPath,
  className,
  navMeta,
  headerContent,
  hero,
  tone = "reader",
}: {
  children: React.ReactNode;
  currentPath?: string;
  className?: string;
  navMeta?: React.ReactNode;
  headerContent?: React.ReactNode;
  hero?: React.ReactNode;
  tone?: "reader" | "utility";
}) {
  return (
    <div className="min-h-screen">
      <AppHeader currentPath={currentPath} navMeta={navMeta} headerContent={headerContent} tone={tone} />
      <div className={cn("mx-auto max-w-[1280px] px-4 pb-8 sm:px-6 lg:px-8", headerContent ? "pt-0" : "pt-6")}>
        {hero ? <section className={cn("mb-8", tone === "reader" ? "pt-2" : "pt-1")}>{hero}</section> : null}
        <main className={cn("pb-12", className)}>{children}</main>
        <footer className="text-xs leading-5 text-dim-foreground">
          Thank you to arXiv for use of its open access interoperability. This product was not
          reviewed or approved by, nor does it necessarily express or reflect the policies or
          opinions of, arXiv.
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <Link className="underline-offset-4 hover:underline" href="/archive">
              Archive
            </Link>
            <Link className="underline-offset-4 hover:underline" href="/sitemap">
              HTML sitemap
            </Link>
          </div>
          <div className="mt-5 flex justify-center sm:hidden">
            <ThemeToggle className="gap-1.5" />
          </div>
        </footer>
      </div>
    </div>
  );
}
