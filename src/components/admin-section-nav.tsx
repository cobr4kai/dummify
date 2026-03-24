import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const adminSections = [
  {
    href: "/admin",
    label: "Overview",
  },
  {
    href: "/admin/edition",
    label: "Edition",
  },
  {
    href: "/admin/ingest",
    label: "Ingest",
  },
  {
    href: "/admin/settings",
    label: "Settings",
  },
  {
    href: "/admin/signups",
    label: "Signups",
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
  },
];

export function AdminSectionNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="mt-5 flex flex-wrap gap-2">
      {adminSections.map((section) => {
        const isActive = section.href === "/admin"
          ? currentPath === section.href
          : currentPath === section.href || currentPath.startsWith(`${section.href}/`);

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
