"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { refetchPaperSource } from "@/lib/papers/refetch";
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

export async function refetchPaperSourceAction(formData: FormData) {
  const paperId = readString(formData.get("paperId"));
  if (!paperId) {
    redirect("/admin");
  }

  await requireAdmin(`/papers/${paperId}`);
  const result = await refetchPaperSource(paperId);

  revalidatePaperViews(paperId);
  redirectToPaperDetail(
    paperId,
    result.status === "metadata-refreshed-pdf-extracted"
      ? "paper-source-refetched-pdf-extracted"
      : result.status === "metadata-refreshed-pdf-fallback"
        ? "paper-source-refetched-pdf-fallback"
        : result.status === "metadata-refreshed-no-pdf-retry-needed"
          ? "paper-source-refetched"
          : "paper-source-refetch-failed",
    result.versionChanged,
  );
}

function revalidatePaperViews(paperId: string) {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/admin");
  revalidatePath(`/papers/${paperId}`);
}

function redirectToPaperDetail(
  paperId: string,
  notice: string,
  versionChanged = false,
): never {
  const search = new URLSearchParams();
  search.set("notice", notice);
  if (versionChanged) {
    search.set("versionChanged", "1");
  }
  redirect(`/papers/${paperId}?${search.toString()}`);
}

function readString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
