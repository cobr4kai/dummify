"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  ensurePaperTechnicalBrief,
  getCurrentTechnicalBrief,
  revertManualTechnicalBriefEdits,
  saveManualTechnicalBriefEdits,
} from "@/lib/technical/service";

export async function savePaperTechnicalBriefAction(formData: FormData) {
  const paperId = readString(formData.get("paperId"));
  if (!paperId) {
    redirect("/admin");
  }

  await requireAdmin(`/papers/${paperId}`);
  const oneLineVerdict = readString(formData.get("oneLineVerdict"));
  const bullets = formData
    .getAll("bullet")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  const result = await saveManualTechnicalBriefEdits({
    paperId,
    oneLineVerdict: oneLineVerdict ?? "",
    bullets,
  });

  revalidatePaperViews(paperId);
  redirectToPaperDetail(
    paperId,
    result === "saved" ? "brief-saved" : "brief-invalid",
  );
}

export async function revertPaperTechnicalBriefAction(formData: FormData) {
  const paperId = readString(formData.get("paperId"));
  if (!paperId) {
    redirect("/admin");
  }

  await requireAdmin(`/papers/${paperId}`);
  const result = await revertManualTechnicalBriefEdits(paperId);

  revalidatePaperViews(paperId);
  redirectToPaperDetail(
    paperId,
    result === "reverted" ? "brief-reverted" : "brief-revert-unavailable",
  );
}

export async function regeneratePaperTechnicalBriefAction(formData: FormData) {
  const paperId = readString(formData.get("paperId"));
  if (!paperId) {
    redirect("/admin");
  }

  await requireAdmin(`/papers/${paperId}`);
  const currentBrief = await getCurrentTechnicalBrief(paperId);
  const result = await ensurePaperTechnicalBrief(paperId, {
    force: true,
    requirePdf: currentBrief ? !currentBrief.usedFallbackAbstract : false,
  });

  revalidatePaperViews(paperId);
  redirectToPaperDetail(
    paperId,
    result === "generated"
      ? "brief-regenerated"
      : result === "pdf-required"
        ? "brief-pdf-required"
        : "brief-regenerate-unavailable",
  );
}

function revalidatePaperViews(paperId: string) {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/admin");
  revalidatePath(`/papers/${paperId}`);
}

function redirectToPaperDetail(paperId: string, notice: string): never {
  const search = new URLSearchParams();
  search.set("notice", notice);
  redirect(`/papers/${paperId}?${search.toString()}`);
}

function readString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
