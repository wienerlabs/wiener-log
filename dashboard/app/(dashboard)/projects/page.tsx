import { getGhRepos, getGhPulls, getGhIssues } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ProjectsView, type Project } from "@/components/projects-view";

export const dynamic = "force-dynamic";

function statusOf(pushedAt: string): Project["status"] {
  const days = (Date.now() - new Date(pushedAt).getTime()) / 86400000;
  if (days < 14) return "active";
  if (days < 60) return "idle";
  return "dormant";
}

export default async function ProjectsPage() {
  const [repos, pulls, issues] = await Promise.all([
    getGhRepos(),
    getGhPulls(),
    getGhIssues(1000),
  ]);

  const pullCount = new Map<string, number>();
  const issueCount = new Map<string, number>();
  const contribs = new Map<string, Map<string, string | null>>();
  const addContributor = (
    repo: string,
    handle: string | null,
    avatar: string | null,
  ) => {
    if (!handle) return;
    if (!contribs.has(repo)) contribs.set(repo, new Map());
    const m = contribs.get(repo)!;
    if (!m.has(handle)) m.set(handle, avatar);
  };

  for (const p of pulls) {
    pullCount.set(p.repo, (pullCount.get(p.repo) ?? 0) + 1);
    addContributor(p.repo, p.author, p.author_avatar);
  }
  for (const i of issues) {
    issueCount.set(i.repo, (issueCount.get(i.repo) ?? 0) + 1);
    addContributor(i.repo, i.author, i.author_avatar);
    addContributor(i.repo, i.assignee, i.assignee_avatar);
  }

  const projects: Project[] = repos
    .filter((r) => !r.is_archived && !r.is_fork)
    .map((r) => ({
      full_name: r.full_name,
      name: r.name,
      org: r.org,
      description: r.description,
      language: r.language,
      topics: r.topics,
      html_url: r.html_url,
      pushed_at: r.pushed_at,
      status: statusOf(r.pushed_at),
      open_pulls: pullCount.get(r.full_name) ?? 0,
      open_issues: issueCount.get(r.full_name) ?? 0,
      contributors: [...(contribs.get(r.full_name) ?? new Map()).entries()].map(
        ([handle, avatar]) => ({ handle, avatar }),
      ),
    }));

  return (
    <div className="rise">
      <PageHeader
        title="Projects"
        subtitle="Portfolio health across every active repository."
      />
      <ProjectsView projects={projects} />
    </div>
  );
}
