import { getGhIssues, getIssuePriorityCounts } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { IssuesView } from "@/components/issues-view";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const [issues, counts] = await Promise.all([
    getGhIssues(120),
    getIssuePriorityCounts(),
  ]);

  return (
    <div className="rise">
      <PageHeader
        title="Issues"
        subtitle="Open issues across the org, ranked by priority."
      />
      <IssuesView issues={issues} counts={counts} />
    </div>
  );
}
