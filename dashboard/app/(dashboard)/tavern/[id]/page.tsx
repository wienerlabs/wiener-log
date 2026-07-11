import { redirect } from "next/navigation";

export default async function TavernGameMoved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`https://tavern-0raclus-projects.vercel.app/game/${id}`);
}
