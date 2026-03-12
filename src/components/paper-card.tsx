import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { parseJsonValue } from "@/lib/utils/json";

const stringArraySchema = z.array(z.string());
const bulletSchema = z.array(
  z.object({
    label: z.string().optional(),
    text: z.string(),
  }),
);

type PaperCardProps = {
  paper: {
    id: string;
    title: string;
    authorsText: string;
    categoriesJson: Prisma.JsonValue;
    abstractUrl: string;
    scores: Array<{
      totalScore: number;
    }>;
    technicalBriefs: Array<{
      oneLineVerdict: string;
      focusTagsJson: Prisma.JsonValue;
      bulletsJson: Prisma.JsonValue;
      sourceBasis: string;
      usedFallbackAbstract: boolean;
    }>;
  };
};

export function PaperCard({ paper }: PaperCardProps) {
  const brief = paper.technicalBriefs[0];
  const categories = parseJsonValue(paper.categoriesJson, stringArraySchema, []);
  const score = paper.scores[0];
  const focusTags = parseJsonValue(brief?.focusTagsJson ?? [], stringArraySchema, []);
  const bullets = parseJsonValue(brief?.bulletsJson ?? [], bulletSchema, []);

  return (
    <Card className="p-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="highlight">Score {Math.round(score?.totalScore ?? 0)}</Badge>
          {brief?.usedFallbackAbstract ? (
            <Badge variant="danger">Abstract fallback</Badge>
          ) : null}
          {focusTags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
          {categories.slice(0, 2).map((category) => (
            <Badge key={category} variant="muted">
              {category}
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="font-serif text-[1.9rem] leading-[1.12] tracking-tight">
            {paper.title}
          </h3>
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
          {brief?.oneLineVerdict ? (
            <div className="space-y-2">
              <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
                Why this is worth your attention
              </p>
              <p className="max-w-5xl text-base leading-7 text-foreground/95">
                {brief.oneLineVerdict}
              </p>
            </div>
          ) : null}
        </div>

        {bullets.length > 0 ? (
          <section className="surface rounded-[24px] border border-border/80 px-5">
            <Accordion type="single" collapsible>
              <AccordionItem value={`brief-${paper.id}`} className="border-none">
                <AccordionTrigger className="-mx-3 cursor-pointer rounded-[18px] px-3 py-5 transition-colors hover:bg-white/65 hover:no-underline data-[state=open]:bg-white/70 [&>svg]:h-5 [&>svg]:w-5 hover:[&>svg]:text-foreground data-[state=open]:[&>svg]:text-foreground">
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
        ) : null}
      </div>
    </Card>
  );
}
