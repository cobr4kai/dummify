import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils/cn";

export function PageShell({
  children,
  currentPath,
  className,
  headerMeta,
}: {
  children: React.ReactNode;
  currentPath?: string;
  className?: string;
  headerMeta?: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
      <AppHeader currentPath={currentPath} headerMeta={headerMeta} />
      <main className={cn("pb-12", className)}>{children}</main>
    </div>
  );
}
