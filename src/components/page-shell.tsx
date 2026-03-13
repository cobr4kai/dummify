import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils/cn";

export function PageShell({
  children,
  currentPath,
  className,
  navMeta,
  hero,
  tone = "reader",
}: {
  children: React.ReactNode;
  currentPath?: string;
  className?: string;
  navMeta?: React.ReactNode;
  hero?: React.ReactNode;
  tone?: "reader" | "utility";
}) {
  return (
    <div className="min-h-screen">
      <AppHeader currentPath={currentPath} navMeta={navMeta} tone={tone} />
      <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        {hero ? <section className={cn("mb-8", tone === "reader" ? "pt-2" : "pt-1")}>{hero}</section> : null}
        <main className={cn("pb-12", className)}>{children}</main>
        <footer className="border-t border-border/60 pt-6 text-xs leading-5 text-muted-foreground">
          Thank you to arXiv for use of its open access interoperability. This product was not
          reviewed or approved by, nor does it necessarily express or reflect the policies or
          opinions of, arXiv.
        </footer>
      </div>
    </div>
  );
}
