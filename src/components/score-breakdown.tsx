import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prisma } from "@prisma/client";
import {
  executiveScoreBreakdownRecordSchema,
  EXECUTIVE_SCORE_COMPONENT_METADATA,
  normalizeExecutiveScoreBreakdown,
} from "@/lib/scoring/model";
import { EXECUTIVE_SCORE_COMPONENTS } from "@/lib/types";
import { parseJsonValue } from "@/lib/utils/json";
import { formatPercent } from "@/lib/utils/format";

export function ScoreBreakdownCard({
  breakdown,
  totalScore,
}: {
  breakdown: Prisma.JsonValue;
  totalScore: number;
}) {
  const parsed = normalizeExecutiveScoreBreakdown(
    parseJsonValue(breakdown, executiveScoreBreakdownRecordSchema, {}),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
            Why it ranked
          </p>
          <CardTitle>Ranking criteria</CardTitle>
        </div>
        <Badge variant="highlight">Score {formatPercent(totalScore)}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {EXECUTIVE_SCORE_COMPONENTS.map((key) => {
          const item = parsed[key];
          const metadata = EXECUTIVE_SCORE_COMPONENT_METADATA[key];

          return (
            <div key={item.key} className="space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-muted-foreground">
                  {formatPercent(item.rawScore)}
                </span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {metadata.description}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(8, item.rawScore)}%` }}
                />
              </div>
              <p className="text-sm leading-6 text-foreground/75">{item.reason}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
