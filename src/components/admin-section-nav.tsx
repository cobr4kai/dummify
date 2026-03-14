import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const adminSections = [
  {
    href: "/admin",
    label: "Control room",
  },
  {
    href: "/admin/signups",
    label: "Signups",
  },
];

export function AdminSectionNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="mt-5 flex flex-wrap gap-2">
      {adminSections.map((section) => {
        const isActive = currentPath === section.href;

        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "nav-link rounded-full px-4 py-2 text-sm font-medium",
              isActive && "nav-link-active",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
