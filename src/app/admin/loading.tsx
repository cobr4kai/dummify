import { PageLoadingState } from "@/components/page-loading-state";
import { PageShell } from "@/components/page-shell";

export default function AdminLoading() {
  return (
    <PageShell currentPath="/admin" tone="utility">
      <PageLoadingState
        blocks={2}
        description="Loading the current admin workspace and its latest operational state."
        title="Loading admin workspace"
      />
    </PageShell>
  );
}
