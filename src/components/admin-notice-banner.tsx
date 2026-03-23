import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNoticeCardClassName, type AdminNoticeVariant } from "@/lib/admin/ui";

export type AdminNotice = {
  title: string;
  description: string;
  variant: AdminNoticeVariant;
} | null;

export function AdminNoticeBanner({
  notice,
  contextLabel = "Latest admin action",
  trailingBadge,
}: {
  notice: AdminNotice;
  contextLabel?: string;
  trailingBadge?: string | null;
}) {
  if (!notice) {
    return null;
  }

  return (
    <section className="mb-6">
      <Card className={getNoticeCardClassName(notice.variant)}>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant={notice.variant}>{contextLabel}</Badge>
              <CardTitle className="mt-3">{notice.title}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                {notice.description}
              </CardDescription>
            </div>
            {trailingBadge ? <Badge variant="muted">{trailingBadge}</Badge> : null}
          </div>
        </CardHeader>
      </Card>
    </section>
  );
}
