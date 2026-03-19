"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getCanonicalPaperPathById, getPublicBriefByPaperId, getWeekPath } from "@/lib/briefs";
import {
  ensurePaperTechnicalBrief,
  getCurrentTechnicalBrief,
  revertManualTechnicalBriefEdits,
  saveManualTechnicalBriefEdits,
} from "@/lib/technical/service";
import { getWeekStart } from "@/lib/utils/dates";

export async function savePaperTechnicalBriefAction(formData: FormData) {
  const paperId = readString(formData.get("paperId"));
  if (!paperId) {
    redirect("/admin");
  }

  await requireAdmin(await getCanonicalPaperPathById(paperId));
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

  await revalidatePaperViews(paperId);
  await redirectToPaperDetail(
    paperId,
    result === "saved" ? "brief-saved" : "brief-invalid",
  );
}

export async function revertPaperTechnicalBriefAction(formData: FormData) {
  const paperId = readString(formData.get("paperId"));
  if (!paperId) {
    redirect("/admin");
  }

  await requireAdmin(await getCanonicalPaperPathById(paperId));
  const result = await revertManualTechnicalBriefEdits(paperId);

  await revalidatePaperViews(paperId);
  await redirectToPaperDetail(
    paperId,
    result === "reverted" ? "brief-reverted" : "brief-revert-unavailable",
  );
}

export async function regeneratePaperTechnicalBriefAction(formData: FormData) {
  const paperId = readString(formData.get("paperId"));
  if (!paperId) {
    redirect("/admin");
  }

  await requireAdmin(await getCanonicalPaperPathById(paperId));
  const currentBrief = await getCurrentTechnicalBrief(paperId);
  const result = await ensurePaperTechnicalBrief(paperId, {
    force: true,
    requirePdf: currentBrief ? !currentBrief.usedFallbackAbstract : false,
  });

  await revalidatePaperViews(paperId);
  await redirectToPaperDetail(
    paperId,
    result === "generated"
      ? "brief-regenerated"
      : result === "pdf-required"
        ? "brief-pdf-required"
        : "brief-regenerate-unavailable",
  );
}

async function revalidatePaperViews(paperId: string) {
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/admin");
  revalidatePath(`/papers/${paperId}`);
  const publicBrief = await getPublicBriefByPaperId(paperId);
  if (publicBrief) {
    revalidatePath(await getCanonicalPaperPathById(paperId));
    revalidatePath(getWeekPath(getWeekStart(publicBrief.announcementDay)));
  }
}

async function redirectToPaperDetail(paperId: string, notice: string): Promise<never> {
  const search = new URLSearchParams();
  search.set("notice", notice);
  redirect(`${await getCanonicalPaperPathById(paperId)}?${search.toString()}`);
}

function readString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
