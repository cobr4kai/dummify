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
  tone = "reader",
}: {
  currentPath?: string;
  navMeta?: React.ReactNode;
  tone?: "reader" | "utility";
}) {
  const navItems = isUtilityRoute(currentPath)
    ? [...publicNavItems, utilityNavItem]
    : publicNavItems;

  return (
    <header className="nav-glass sticky top-0 z-30 border-b border-border/60" data-tone={tone}>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Editorial brief
          </span>
          <span className="mt-1 block text-lg font-medium tracking-[-0.03em] text-foreground">
            {APP_NAME}
          </span>
          <span className="mt-1 hidden text-sm text-muted-foreground sm:block">
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
