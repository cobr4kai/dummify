import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <PageShell tone="utility">
      <EmptyState
        title="We couldn&apos;t find that page."
        description="The requested paper or admin route does not exist in this local PaperBrief workspace."
      />
    </PageShell>
  );
}
