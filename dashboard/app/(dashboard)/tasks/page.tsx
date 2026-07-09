import { getTasks } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { TasksView } from "@/components/tasks-view";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await getTasks({ limit: 400 });

  return (
    <div className="rise">
      <PageHeader
        title="Tasks"
        subtitle="Drag across the board or check them off. Synthesized from activity and assigned by admins."
      />
      <TasksView tasks={tasks} />
    </div>
  );
}
