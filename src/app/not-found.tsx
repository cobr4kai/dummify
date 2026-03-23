import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <PageShell tone="utility">
      <EmptyState
        title="We couldn&apos;t find that page."
        description="The page you asked for doesn&apos;t exist here anymore, or the link was incomplete."
        guidance="Try heading back to the weekly edition or archive to keep exploring."
      />
    </PageShell>
  );
}
