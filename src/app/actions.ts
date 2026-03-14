"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createEmailSignup } from "@/lib/signups/service";

export async function signupAction(formData: FormData) {
  const email = formData.get("email");

  let result;
  try {
    result = await createEmailSignup(typeof email === "string" ? email : null);
  } catch {
    redirect("/?signup=error");
  }

  if (result.status === "invalid") {
    redirect("/?signup=invalid");
  }

  revalidatePath("/");
  revalidatePath("/admin/signups");
  redirect("/?signup=success");
}
