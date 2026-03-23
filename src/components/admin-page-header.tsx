import type { ReactNode } from "react";
import { AdminSectionNav } from "@/components/admin-section-nav";

export function AdminPageHeader({
  currentPath,
  title,
  description,
  badges,
}: {
  currentPath: string;
  title: string;
  description: string;
  badges?: ReactNode;
}) {
  return (
    <div className="lg:flex lg:items-end lg:justify-between lg:gap-6">
      <div className="max-w-3xl">
        <p className="eyebrow text-[11px] font-medium text-muted-foreground">
          Admin
        </p>
        <h1 className="utility-title mt-3 text-3xl text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/78 sm:text-base">
          {description}
        </p>
        <AdminSectionNav currentPath={currentPath} />
      </div>
      {badges ? (
        <div className="mt-5 flex flex-wrap gap-2 lg:mt-0">
          {badges}
        </div>
      ) : null}
    </div>
  );
}
