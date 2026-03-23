export type AdminNoticeVariant = "success" | "highlight" | "danger";

export function getNoticeCardClassName(variant: AdminNoticeVariant) {
  if (variant === "success") {
    return "notice-success";
  }

  if (variant === "danger") {
    return "notice-danger";
  }

  return "notice-highlight";
}

export function getRunBadgeVariant(status: string): AdminNoticeVariant {
  if (status === "FAILED") {
    return "danger";
  }

  if (status === "COMPLETED") {
    return "success";
  }

  return "highlight";
}
