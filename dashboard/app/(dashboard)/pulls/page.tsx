import { getGhPulls } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PullsView } from "@/components/pulls-view";

export const dynamic = "force-dynamic";

export default async function PullsPage() {
  const pulls = await getGhPulls();

  return (
    <div className="rise">
      <PageHeader
        title="Pull requests"
        subtitle="Open work in flight across every org repository."
      />
      <PullsView pulls={pulls} />
    </div>
  );
}
