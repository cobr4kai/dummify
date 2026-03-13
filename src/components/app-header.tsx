import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
import { cn } from "@/lib/utils/cn";

const publicNavItems = [
  { href: "/", label: "Daily Brief" },
  { href: "/archive", label: "Archive" },
];

const utilityNavItem = { href: "/admin", label: "Admin" };

export function AppHeader({
  currentPath,
  navMeta,
  headerContent,
  tone = "reader",
}: {
  currentPath?: string;
  navMeta?: React.ReactNode;
  headerContent?: React.ReactNode;
  tone?: "reader" | "utility";
}) {
  const showReaderMasthead = currentPath === "/" && Boolean(headerContent);
  const navItems = isUtilityRoute(currentPath)
    ? [...publicNavItems, utilityNavItem]
    : showReaderMasthead
      ? []
      : publicNavItems;

  return (
    <header className={cn(showReaderMasthead ? "mb-8" : "nav-glass sticky top-0 z-30")} data-tone={tone}>
      {showReaderMasthead ? (
        <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:px-8">
          <div className="hero-shell rounded-[36px] px-6 py-6 sm:px-8 sm:py-7">
            {headerContent}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="min-w-0">
            <span className="editorial-display block text-[2.2rem] text-foreground sm:text-[2.65rem]">
              {APP_NAME}
            </span>
            <span className="mt-2 block max-w-[24rem] text-sm leading-6 text-foreground/78 sm:text-[0.98rem]">
              {APP_TAGLINE}
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => {
                const isActive = isActivePath(currentPath, item.href);

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "nav-link rounded-full px-4 py-2 text-sm font-medium",
                      isActive && "nav-link-active",
                    )}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {navMeta ? <div className="flex flex-wrap items-center gap-2 lg:ml-2">{navMeta}</div> : null}
          </div>
        </div>
      )}
    </header>
  );
}

function isUtilityRoute(currentPath?: string) {
  return currentPath?.startsWith("/admin") || currentPath?.startsWith("/login");
}

function isActivePath(currentPath: string | undefined, href: string) {
  if (!currentPath) {
    return false;
  }

  if (href === "/admin") {
    return currentPath.startsWith("/admin") || currentPath.startsWith("/login");
  }

  return currentPath === href;
}
