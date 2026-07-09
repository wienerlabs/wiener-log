import { getGhRepos, getPinnedRepos } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ReposView } from "@/components/repos-view";

export const dynamic = "force-dynamic";

export default async function ReposPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [repos, pinned] = await Promise.all([getGhRepos(), getPinnedRepos(6)]);

  return (
    <div className="rise">
      <PageHeader
        title="Repositories"
        subtitle="Every repository across the wienerlabs and Sidewinder orgs."
      />
      <ReposView
        repos={repos}
        pinnedNames={pinned.map((p) => p.full_name)}
        initialQuery={q ?? ""}
      />
    </div>
  );
}
