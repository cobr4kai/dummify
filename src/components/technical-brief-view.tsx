import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { stripTechnicalBriefHeading } from "@/lib/technical/brief-text";
import { parseJsonValue } from "@/lib/utils/json";

const citationSchema = z.object({
  page: z.number(),
  section: z.string().nullable().optional(),
  quote: z.string().nullable().optional(),
});

const bulletSchema = z.array(
  z.object({
    label: z.string(),
    text: z.string(),
    impactArea: z.string(),
    citations: z.array(citationSchema),
  }),
);

const stringArraySchema = z.array(z.string());
const evidenceSchema = z.array(
  z.object({
    claim: z.string(),
    impactArea: z.string(),
    confidence: z.string(),
    citations: z.array(citationSchema),
  }),
);

export function TechnicalBriefView({
  technicalBrief,
  score,
}: {
  technicalBrief: {
    oneLineVerdict: string;
    keyStatsJson: Prisma.JsonValue;
    focusTagsJson: Prisma.JsonValue;
    whyItMatters: string;
    whatToIgnore: string;
    bulletsJson: Prisma.JsonValue;
    confidenceNotesJson: Prisma.JsonValue;
    evidenceJson: Prisma.JsonValue;
    usedFallbackAbstract: boolean;
  };
  score?: {
    totalScore: number;
  } | null;
}) {
  const bullets = parseJsonValue(technicalBrief.bulletsJson, bulletSchema, []);
  const focusTags = parseJsonValue(
    technicalBrief.focusTagsJson,
    stringArraySchema,
    [],
  );
  const evidence = parseJsonValue(technicalBrief.evidenceJson, evidenceSchema, []);
  const verdict = stripTechnicalBriefHeading(technicalBrief.oneLineVerdict);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="highlight">Score {Math.round(score?.totalScore ?? 0)}</Badge>
            <Badge variant={technicalBrief.usedFallbackAbstract ? "danger" : "success"}>
              {technicalBrief.usedFallbackAbstract ? "Abstract-based" : "PDF-backed"}
            </Badge>
            {focusTags.map((tag) => (
              <Badge key={tag} variant="default">
              {tag}
              </Badge>
            ))}
          </div>
          <CardTitle>Executive brief</CardTitle>
          <CardDescription className="text-base leading-7">
            A short business-reader brief that explains why the paper matters now and what to watch or do next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="eyebrow text-[11px] font-semibold text-muted-foreground">
              Why this is worth your attention
            </p>
            <p className="text-base leading-7 text-foreground/95">{verdict}</p>
          </div>
          <ul className="list-disc space-y-4 pl-5 text-base leading-7 text-foreground/90 marker:text-foreground/70">
            {bullets.map((bullet, index) => (
              <li key={`${bullet.impactArea}-${index}`}>{bullet.text}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence ledger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {evidence.map((item, index) => (
            <div
              key={`${item.claim}-${index}`}
              className="stat-panel rounded-[22px] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">{item.impactArea}</Badge>
                <Badge variant="default">{item.confidence}</Badge>
                {item.citations.map((citation, citationIndex) => (
                  <Badge
                    key={`${item.claim}-${citation.page}-${citationIndex}`}
                    variant="muted"
                  >
                    p.{citation.page}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-base leading-7 text-foreground/90">{item.claim}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
