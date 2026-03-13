"use client";

import type { Prisma } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseJsonValue } from "@/lib/utils/json";
import { z } from "zod";

const stringArraySchema = z.array(z.string());
const glossarySchema = z.array(
  z.object({
    term: z.string(),
    definition: z.string(),
  }),
);
const claimsSchema = z.array(
  z.object({
    claim: z.string(),
    supportLevel: z.enum(["explicit", "inferred"]),
  }),
);
const consequenceSchema = z.array(
  z.object({
    consequence: z.string(),
    audience: z.enum(["all", "strategy", "finance", "procurement"]),
    confidence: z.enum(["high", "medium", "low"]),
  }),
);

type SummaryRecord = {
  audience: string;
  oneSentenceSummary: string;
  whyThisMatters: string;
  audienceInterpretation: string | null;
  whatThisIsNot: string;
  confidenceNotes: Prisma.JsonValue;
  glossary: Prisma.JsonValue;
  keyClaims: Prisma.JsonValue;
  businessConsequences: Prisma.JsonValue;
  leadershipQuestions: Prisma.JsonValue;
};

export function AudienceTabs({ summaries }: { summaries: SummaryRecord[] }) {
  const general = summaries.find((summary) => summary.audience === "general");

  return (
    <div className="space-y-6">
      {general ? (
        <section className="space-y-4">
          <div>
            <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
              Plain-English summary
            </p>
            <p className="editorial-title text-4xl text-foreground">
              {general.oneSentenceSummary}
            </p>
          </div>
          <div className="surface-muted rounded-[28px] border border-border/70 p-5 prose-brief">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Why this matters
            </p>
            <p className="mt-3 text-base leading-7 text-foreground/90">
              {general.whyThisMatters}
            </p>
          </div>
        </section>
      ) : null}

      <Tabs defaultValue="strategy">
        <TabsList>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="procurement">Procurement</TabsTrigger>
        </TabsList>
        {(["strategy", "finance", "procurement"] as const).map((audience) => {
          const summary = summaries.find((item) => item.audience === audience);
          if (!summary) {
            return null;
          }

          return (
            <TabsContent key={audience} value={audience}>
              <div className="space-y-6">
                <section className="surface rounded-[28px] border border-border/80 p-5">
                  <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                    Role-based reading
                  </p>
                  <p className="text-base leading-7 text-foreground/90">
                    {summary.audienceInterpretation}
                  </p>
                </section>
                <section className="grid gap-5 xl:grid-cols-2">
                  <div className="surface rounded-[28px] border border-border/80 p-5">
                    <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                      What this is not
                    </p>
                    <p className="text-sm leading-7 text-foreground/90">
                      {summary.whatThisIsNot}
                    </p>
                  </div>
                  <div className="surface rounded-[28px] border border-border/80 p-5">
                    <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                      Confidence notes
                    </p>
                    <ul className="space-y-2 text-sm leading-6 text-foreground/90">
                      {parseJsonValue(summary.confidenceNotes, stringArraySchema, []).map(
                        (item) => (
                          <li key={item}>- {item}</li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="surface rounded-[28px] border border-border/80 p-5">
                    <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                      Jargon buster
                    </p>
                    <ul className="space-y-3 text-sm leading-6 text-foreground/90">
                      {parseJsonValue(summary.glossary, glossarySchema, []).map((item) => (
                        <li key={item.term}>
                          <span className="font-semibold">{item.term}:</span> {item.definition}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="surface rounded-[28px] border border-border/80 p-5">
                    <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                      Key claims
                    </p>
                    <ul className="space-y-3 text-sm leading-6 text-foreground/90">
                      {parseJsonValue(summary.keyClaims, claimsSchema, []).map((item) => (
                        <li key={item.claim}>
                          <span className="font-semibold capitalize">
                            {item.supportLevel}:
                          </span>{" "}
                          {item.claim}
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
                <section className="grid gap-5 xl:grid-cols-2">
                  <div className="surface rounded-[28px] border border-border/80 p-5">
                    <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                      Business consequences
                    </p>
                    <ul className="space-y-3 text-sm leading-6 text-foreground/90">
                      {parseJsonValue(
                        summary.businessConsequences,
                        consequenceSchema,
                        [],
                      ).map((item) => (
                        <li key={item.consequence}>
                          <span className="font-semibold capitalize">{item.audience}:</span>{" "}
                          {item.consequence}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="surface rounded-[28px] border border-border/80 p-5">
                    <p className="eyebrow mb-2 text-[11px] font-semibold text-muted-foreground">
                      Questions leadership should ask
                    </p>
                    <ul className="space-y-2 text-sm leading-6 text-foreground/90">
                      {parseJsonValue(
                        summary.leadershipQuestions,
                        stringArraySchema,
                        [],
                      ).map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
