import { PageLoadingState } from "@/components/page-loading-state";
import { PageShell } from "@/components/page-shell";

export default function PaperDetailLoading() {
  return (
    <PageShell tone="reader">
      <PageLoadingState
        blocks={3}
        description="Loading the paper, analysis tier, and related context."
        title="Opening paper"
      />
    </PageShell>
  );
}
