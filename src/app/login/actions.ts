"use server";

import { redirect } from "next/navigation";
import { isAdminConfigured, setAdminSession, verifyAdminPassword } from "@/lib/auth";
import { sanitizeInternalPath } from "@/lib/utils/redirect";

export async function loginAction(formData: FormData) {
  const password = formData.get("password");
  const next = formData.get("next");
  const safeNext = sanitizeInternalPath(
    typeof next === "string" ? next : null,
    "/admin",
  );

  if (!isAdminConfigured()) {
    redirect(`/login?error=unconfigured&next=${encodeURIComponent(safeNext)}`);
  }

  if (typeof password !== "string" || !verifyAdminPassword(password)) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(safeNext)}`);
  }

  await setAdminSession();
  redirect(safeNext);
}
