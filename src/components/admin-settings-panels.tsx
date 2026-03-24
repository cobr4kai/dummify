import { DEFAULT_SCORING_VERSION } from "@/config/defaults";
import { EXECUTIVE_SCORE_COMPONENT_METADATA } from "@/lib/scoring/model";
import { SCORING_PRESET_METADATA } from "@/lib/scoring/model";
import type { ExecutiveScoreComponentKey, ScoringPreset } from "@/lib/types";
import { AdminSortStateInputs } from "@/components/admin-sort-state-inputs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RANKING_WEIGHT_FIELDS: Array<{
  key: ExecutiveScoreComponentKey;
}> = [
  { key: "audienceInterest" },
  { key: "frontierRelevance" },
  { key: "practicalRelevance" },
  { key: "evidenceCredibility" },
  { key: "tldrAccessibility" },
];

type AppSettingsShape = {
  genAiFeaturedCount: number;
  genAiShortlistSize: number;
  highBusinessRelevanceThreshold: number;
  genAiScoringPreset: ScoringPreset;
  pdfCacheDir: string;
  primaryCronSchedule: string;
  reconcileCronSchedule: string;
  genAiUsePremiumSynthesis: boolean;
  reconcileEnabled: boolean;
  rssMinDelayMs: number;
  apiMinDelayMs: number;
  retryBaseDelayMs: number;
  feedCacheTtlMinutes: number;
  apiCacheTtlMinutes: number;
  genAiRankingWeights: Record<ExecutiveScoreComponentKey, number>;
};

type CategoryConfig = {
  key: string;
  label: string;
  enabled: boolean;
};

export function AdminSettingsPanels({
  settings,
  categories,
  updateSettingsAction,
  resetSettingsAction,
  updateCategoriesAction,
  currentScoringVersion = DEFAULT_SCORING_VERSION,
  currentScoreCount = 0,
  legacyScoreCount = 0,
  sortKey,
  sortDirection,
}: {
  settings: AppSettingsShape;
  categories: CategoryConfig[];
  updateSettingsAction: (formData: FormData) => Promise<void>;
  resetSettingsAction: (formData: FormData) => Promise<void>;
  updateCategoriesAction: (formData: FormData) => Promise<void>;
  currentScoringVersion?: string;
  currentScoreCount?: number;
  legacyScoreCount?: number;
  sortKey?: string | null;
  sortDirection?: string | null;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Editorial model and runtime</CardTitle>
          <CardDescription>
            Control scoring, premium synthesis policy, cache behavior, and cron-related runtime
            settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />

            <div className="sm:col-span-2 mt-2 space-y-2">
              <p className="text-sm font-semibold text-foreground">Scoring mode</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Pick the ranking posture for new papers first. Older papers may still show legacy
                scores until they are re-scored.
              </p>
            </div>
            <div className="sm:col-span-2 grid gap-3 md:grid-cols-2">
              {(Object.keys(SCORING_PRESET_METADATA) as ScoringPreset[]).map((preset) => {
                const metadata = SCORING_PRESET_METADATA[preset];
                const isSelected = settings.genAiScoringPreset === preset;

                return (
                  <label
                    key={preset}
                    className={`cursor-pointer rounded-[24px] border px-4 py-4 transition-colors ${
                      isSelected
                        ? "border-accent bg-accent/10"
                        : "border-border/80 bg-white/60 hover:border-accent/50"
                    }`}
                  >
                    <input
                      className="sr-only"
                      defaultChecked={isSelected}
                      name="genAiScoringPreset"
                      type="radio"
                      value={preset}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{metadata.label}</p>
                      <Badge variant={isSelected ? "highlight" : "muted"}>
                        {isSelected ? "Active" : "Available"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {metadata.description}
                    </p>
                  </label>
                );
              })}
            </div>
            <div className="sm:col-span-2 rounded-[24px] border border-border/80 bg-white/60 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="highlight">Current scoring version {currentScoringVersion}</Badge>
                <Badge variant="success">Current scores {currentScoreCount}</Badge>
                <Badge variant={legacyScoreCount > 0 ? "muted" : "success"}>
                  Legacy score coverage {legacyScoreCount}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Switching presets changes the base weighting for new ingests. Existing scored
                papers stay readable and keep their older version until you re-score them through a
                future ingest or backfill.
              </p>
            </div>

            <details className="sm:col-span-2 rounded-[22px] border border-border/80 bg-white/60 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Advanced scoring details
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-sm font-semibold text-foreground">Editorial scoring</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Use these only if you need to fine-tune the active preset. Changing the preset
                    and saving will reset these weights to that preset's defaults.
                  </p>
                </div>
                <label className="space-y-2 text-sm font-medium">
                  High-signal threshold
                  <input
                    className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                    defaultValue={settings.highBusinessRelevanceThreshold}
                    name="highBusinessRelevanceThreshold"
                    step="0.1"
                    type="number"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm text-foreground sm:col-span-2">
                  <input
                    defaultChecked={settings.genAiUsePremiumSynthesis}
                    name="genAiUsePremiumSynthesis"
                    type="checkbox"
                  />
                  Use premium synthesis model when the environment allows it
                </label>

                {RANKING_WEIGHT_FIELDS.map(({ key }) => (
                  <label key={key} className="space-y-2 text-sm font-medium">
                    {EXECUTIVE_SCORE_COMPONENT_METADATA[key].label}
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {EXECUTIVE_SCORE_COMPONENT_METADATA[key].description}
                    </span>
                    <input
                      className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                      defaultValue={settings.genAiRankingWeights[key]}
                      name={key}
                      step="0.01"
                      type="number"
                    />
                  </label>
                ))}
              </div>
            </details>

            <div className="sm:col-span-2 mt-2 space-y-2">
              <p className="text-sm font-semibold text-foreground">Cache and pacing</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Keep requests paced, cached, and aligned with the current Render disk setup.
              </p>
            </div>
            <label className="space-y-2 text-sm font-medium">
              PDF cache directory
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.pdfCacheDir}
                name="pdfCacheDir"
                type="text"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              RSS min delay (ms)
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.rssMinDelayMs}
                name="rssMinDelayMs"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              API min delay (ms)
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.apiMinDelayMs}
                name="apiMinDelayMs"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Retry base delay (ms)
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.retryBaseDelayMs}
                name="retryBaseDelayMs"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Feed cache TTL (minutes)
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.feedCacheTtlMinutes}
                name="feedCacheTtlMinutes"
                type="number"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              API cache TTL (minutes)
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.apiCacheTtlMinutes}
                name="apiCacheTtlMinutes"
                type="number"
              />
            </label>

            <div className="sm:col-span-2 mt-2 space-y-2">
              <p className="text-sm font-semibold text-foreground">Schedules</p>
            </div>
            <label className="space-y-2 text-sm font-medium">
              Primary cron schedule
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.primaryCronSchedule}
                name="primaryCronSchedule"
                type="text"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Reconcile cron schedule
              <input
                className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                defaultValue={settings.reconcileCronSchedule}
                name="reconcileCronSchedule"
                type="text"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-foreground sm:col-span-2">
              <input
                defaultChecked={settings.reconcileEnabled}
                name="reconcileEnabled"
                type="checkbox"
              />
              Run a lighter reconciliation ingest later in the same arXiv cycle
            </label>

            <details className="sm:col-span-2 rounded-[22px] border border-border/80 bg-white/60 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Reserved controls
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Featured count (reserved)
                  <input
                    className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                    defaultValue={settings.genAiFeaturedCount}
                    name="genAiFeaturedCount"
                    type="number"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Shortlist size (reserved)
                  <input
                    className="h-11 w-full rounded-2xl border border-border bg-white/70 px-4 text-sm"
                    defaultValue={settings.genAiShortlistSize}
                    name="genAiShortlistSize"
                    type="number"
                  />
                </label>
              </div>
            </details>

            <div className="sm:col-span-2 flex flex-wrap gap-3">
              <AdminSubmitButton
                idleLabel="Save settings"
                pendingLabel="Saving settings..."
                type="submit"
              />
            </div>
          </form>
          <form action={resetSettingsAction} className="mt-3">
            <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
            <AdminSubmitButton
              idleLabel="Reset defaults"
              pendingLabel="Resetting defaults..."
              type="submit"
              variant="secondary"
            />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Source categories</CardTitle>
          <CardDescription>
            Enable or disable ingestion categories without editing code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCategoriesAction} className="space-y-3">
            <AdminSortStateInputs sortDirection={sortDirection} sortKey={sortKey} />
            {categories.map((category) => (
              <label
                key={category.key}
                className="flex items-center justify-between gap-4 rounded-[22px] border border-border/80 bg-white/60 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-foreground">{category.key}</p>
                  <p className="text-sm text-muted-foreground">{category.label}</p>
                </div>
                <input
                  defaultChecked={category.enabled}
                  name={`enabled__${category.key}`}
                  type="checkbox"
                />
              </label>
            ))}
            <AdminSubmitButton
              idleLabel="Save categories"
              pendingLabel="Saving categories..."
              type="submit"
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
