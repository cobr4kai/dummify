"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAppFeedback } from "@/lib/feedback/service";

export async function submitFeedbackAction(formData: FormData) {
  let result;

  try {
    result = await createAppFeedback({
      sentiment: typeof formData.get("sentiment") === "string" ? formData.get("sentiment") as string : null,
      message: typeof formData.get("message") === "string" ? formData.get("message") as string : null,
      email: typeof formData.get("email") === "string" ? formData.get("email") as string : null,
      sourcePath: typeof formData.get("sourcePath") === "string" ? formData.get("sourcePath") as string : null,
    });
  } catch {
    redirect("/feedback?status=error");
  }

  if (result.status === "invalid") {
    redirect("/feedback?status=invalid");
  }

  revalidatePath("/feedback");
  revalidatePath("/admin/feedback");
  redirect("/feedback?status=success");
}
