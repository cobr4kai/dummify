type BriefLike = {
  usedFallbackAbstract: boolean;
};

export function hasPdfBackedBrief<TBrief extends BriefLike>(
  briefs: TBrief[] | null | undefined,
) {
  return (briefs ?? []).some((brief) => !brief.usedFallbackAbstract);
}

export function hasAbstractFallbackBrief<TBrief extends BriefLike>(
  briefs: TBrief[] | null | undefined,
) {
  return (briefs ?? []).some((brief) => brief.usedFallbackAbstract);
}

export function getHomepageBriefState<TBrief extends BriefLike>(
  briefs: TBrief[] | null | undefined,
) {
  if (hasPdfBackedBrief(briefs)) {
    return "pdf-ready" as const;
  }

  if (hasAbstractFallbackBrief(briefs)) {
    return "abstract-fallback" as const;
  }

  return "missing" as const;
}

export function prioritizePapersWithPdfBackedBriefs<
  TPaper extends {
    technicalBriefs: BriefLike[] | null | undefined;
  },
>(papers: TPaper[]) {
  const papersWithPdfBriefs: TPaper[] = [];
  const papersWithoutPdfBriefs: TPaper[] = [];

  for (const paper of papers) {
    if (hasPdfBackedBrief(paper.technicalBriefs)) {
      papersWithPdfBriefs.push(paper);
    } else {
      papersWithoutPdfBriefs.push(paper);
    }
  }

  return [...papersWithPdfBriefs, ...papersWithoutPdfBriefs];
}
