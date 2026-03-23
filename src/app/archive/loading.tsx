import { PageLoadingState } from "@/components/page-loading-state";
import { PageShell } from "@/components/page-shell";

export default function ArchiveLoading() {
  return (
    <PageShell currentPath="/archive">
      <PageLoadingState
        blocks={3}
        description="Refreshing the archive view and rebuilding the paper list."
        title="Loading archive"
      />
    </PageShell>
  );
}
