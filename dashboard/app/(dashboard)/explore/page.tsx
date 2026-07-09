import { getTrendingRepos, getTopics, getMembers } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ExploreView } from "@/components/explore-view";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  const [trending, topics, people] = await Promise.all([
    getTrendingRepos(20),
    getTopics(30),
    getMembers(),
  ]);

  return (
    <div className="rise">
      <PageHeader
        title="Explore"
        subtitle="Trending repositories, topics and people across Wiener Labs."
      />
      <ExploreView
        trending={trending}
        topics={topics}
        people={people}
        initialTopic={topic ?? ""}
      />
    </div>
  );
}
