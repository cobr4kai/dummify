import { PageLoadingState } from "@/components/page-loading-state";
import { PageShell } from "@/components/page-shell";

export default function LoginLoading() {
  return (
    <PageShell currentPath="/login" tone="utility">
      <PageLoadingState
        blocks={1}
        description="Preparing the admin sign-in workspace."
        title="Loading admin access"
      />
    </PageShell>
  );
}
