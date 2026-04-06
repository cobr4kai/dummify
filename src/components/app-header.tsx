import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
import { cn } from "@/lib/utils/cn";

const publicNavItems = [
  { href: "/", label: "Weekly Brief" },
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
  const showReaderMasthead = Boolean(headerContent);
  const showUtilityBrandRow = isUtilityRoute(currentPath);
  const navItems = isUtilityRoute(currentPath)
    ? [...publicNavItems, utilityNavItem]
    : publicNavItems;
  const showFeedbackLink = !isUtilityRoute(currentPath);
  const feedbackHref = getFeedbackHref(currentPath);
  const feedbackIsActive = currentPath === "/feedback";

  return (
    <header className={cn(showReaderMasthead ? "mb-8" : "nav-glass sticky top-0 z-30")} data-tone={tone}>
      {showReaderMasthead ? (
        <div className="mx-auto max-w-[1280px] px-4 pt-3 sm:px-6 sm:pt-6 lg:px-8">
          <div
            className={cn(
              "mb-4 rounded-[24px] px-1",
              showUtilityBrandRow
                ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                : "hidden",
            )}
          >
            {showUtilityBrandRow ? (
              <Link href="/" className="min-w-0">
                <span className="editorial-display block text-[1.9rem] text-foreground sm:text-[2.15rem]">
                  {APP_NAME}
                </span>
                <span className="mt-1 block max-w-[24rem] text-sm leading-6 text-muted-foreground">
                  {APP_TAGLINE}
                </span>
              </Link>
            ) : <div />}

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
              {showFeedbackLink ? (
                <Link
                  className={cn(
                    "nav-link rounded-full px-4 py-2 text-sm font-medium",
                    feedbackIsActive && "nav-link-active",
                  )}
                  href={feedbackHref}
                >
                  Feedback
                </Link>
              ) : null}
              {navMeta ? <div className="flex flex-wrap items-center gap-2 sm:ml-2">{navMeta}</div> : null}
            </div>
          </div>
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
            <span className="mt-2 block max-w-[24rem] text-sm leading-6 text-muted-foreground sm:text-[0.98rem]">
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
            {showFeedbackLink ? (
              <Link
                className={cn(
                  "nav-link rounded-full px-4 py-2 text-sm font-medium",
                  feedbackIsActive && "nav-link-active",
                )}
                href={feedbackHref}
              >
                Feedback
              </Link>
            ) : null}
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

function getFeedbackHref(currentPath?: string) {
  if (!currentPath || currentPath === "/feedback") {
    return "/feedback";
  }

  return `/feedback?from=${encodeURIComponent(currentPath)}`;
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
