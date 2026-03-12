import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prisma } from "@prisma/client";
import type { ScoreBreakdown } from "@/lib/types";
import { parseJsonValue } from "@/lib/utils/json";
import { formatPercent } from "@/lib/utils/format";
import { z } from "zod";

const breakdownSchema = z.record(
  z.string(),
  z.object({
    key: z.string(),
    label: z.string(),
    rawScore: z.number(),
    weight: z.number(),
    weightedScore: z.number(),
    reason: z.string(),
  }),
);

export function ScoreBreakdownCard({
  breakdown,
  totalScore,
}: {
  breakdown: Prisma.JsonValue;
  totalScore: number;
}) {
  const parsed = parseJsonValue(
    breakdown,
    breakdownSchema,
    {},
  ) as ScoreBreakdown;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
            Why it ranked
          </p>
          <CardTitle>Signal breakdown</CardTitle>
        </div>
        <Badge variant="highlight">Score {formatPercent(totalScore)}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.values(parsed).map((item) => (
          <div key={item.key} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-muted-foreground">
                {formatPercent(item.rawScore)} x {item.weight.toFixed(2)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(8, item.rawScore)}%` }}
              />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
