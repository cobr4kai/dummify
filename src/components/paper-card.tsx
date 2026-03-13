import type { Prisma } from "@prisma/client";
import type { ReactNode } from "react";
import { z } from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { stripTechnicalBriefHeading } from "@/lib/technical/brief-text";
import { parseJsonValue } from "@/lib/utils/json";

const stringArraySchema = z.array(z.string());
const bulletSchema = z.array(
  z.object({
    label: z.string().optional(),
    text: z.string(),
  }),
);

type PaperCardProps = {
  headerMeta?: ReactNode;
  paper: {
    id: string;
    title: string;
    authorsText: string;
    categoriesJson: Prisma.JsonValue;
    abstractUrl: string;
    technicalBriefs: Array<{
      oneLineVerdict: string;
      bulletsJson: Prisma.JsonValue;
      sourceBasis: string;
      usedFallbackAbstract: boolean;
    }>;
  };
};

export function PaperCard({ headerMeta, paper }: PaperCardProps) {
  const brief = paper.technicalBriefs[0];
  const verdict = brief?.oneLineVerdict
    ? stripTechnicalBriefHeading(brief.oneLineVerdict)
    : "";
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []).filter((category) =>
    /^cs\.[A-Z]+$/i.test(category),
  );
  const bullets = parseJsonValue(brief?.bulletsJson ?? [], bulletSchema, []);

  return (
    <Card className="p-6">
      <div className="space-y-5">
        <div className="space-y-3">
          {headerMeta ? <div className="flex flex-wrap items-center gap-2">{headerMeta}</div> : null}
          <h3 className="editorial-title text-[2rem] text-foreground">
            {paper.title}
          </h3>
          {categories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  className="panel-soft text-foreground/75"
                  variant="muted"
                >
                  {category}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] leading-6 text-muted-foreground">
            <span>{paper.authorsText}</span>
            {brief?.sourceBasis ? (
              <>
                <span className="text-border">/</span>
                <span>{brief.sourceBasis}</span>
              </>
            ) : null}
            <span className="text-border">/</span>
            <a
              href={paper.abstractUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
            >
              arXiv abstract
            </a>
          </div>
          {verdict ? (
            <div className="space-y-2">
              <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
                Why this is worth your attention
              </p>
              <p className="max-w-5xl text-base leading-7 text-foreground/95">
                {verdict}
              </p>
            </div>
          ) : null}
        </div>

        {bullets.length > 0 ? (
          <section className="surface rounded-[24px] border border-border/80 px-5">
            <Accordion type="single" collapsible>
              <AccordionItem value={`brief-${paper.id}`} className="border-none">
                <AccordionTrigger className="-mx-3 cursor-pointer rounded-[18px] px-3 py-5 transition-colors hover:bg-[var(--panel-bg)] hover:no-underline data-[state=open]:bg-[var(--field-bg)] [&>svg]:h-5 [&>svg]:w-5 hover:[&>svg]:text-foreground data-[state=open]:[&>svg]:text-foreground">
                  <div className="text-left">
                    <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
                      Executive brief
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <ul className="list-disc space-y-3 pl-5 text-base leading-7 text-foreground/90 marker:text-foreground/70">
                    {bullets.map((bullet, index) => (
                      <li key={`${paper.id}-${index}`}>{bullet.text}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        ) : (
          <section className="notice-highlight rounded-[24px] border px-5 py-4">
            <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
              Executive brief status
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground/90">
              Full-PDF analysis is still pending for this paper, so the homepage is intentionally
              withholding any abstract-only brief.
            </p>
          </section>
        )}
      </div>
    </Card>
  );
}
