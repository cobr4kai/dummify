import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/config/defaults";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Daily Brief" },
  { href: "/archive", label: "Archive" },
  { href: "/admin", label: "Admin" },
];

export function AppHeader({
  currentPath,
}: {
  currentPath?: string;
}) {
  return (
    <header className="mb-8">
      <div className="surface flex flex-col gap-6 rounded-[32px] border border-border/80 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow mb-3 text-[11px] font-semibold text-muted-foreground">
            Daily frontier AI brief for decision-makers
          </p>
          <Link href="/" className="block">
            <h1 className="font-serif text-4xl leading-none tracking-tight">
              {APP_NAME}
            </h1>
          </Link>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {APP_TAGLINE}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant={currentPath === item.href ? "default" : "secondary"}
                size="sm"
              >
                <Link className={cn("min-w-[110px]")} href={item.href}>
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
