import { getDocument } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/session";
import { Card } from "@/components/ui";
import { DocEditor } from "@/components/doc-editor";
import { DeleteDocButton } from "@/components/doc-buttons";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDocument(Number(id));
  if (!doc) notFound();

  const session = await getSession();
  const me =
    session?.handle && session.handle !== "admin"
      ? session.handle
      : session?.username || "";
  const admin = await isAdmin();
  const canEdit = doc.scope === "vault" || doc.author === me || admin;
  const backTo = doc.scope === "vault" ? "/vault" : `/members/${doc.author}`;

  return (
    <div className="rise mx-auto max-w-[760px]">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={backTo}
          className="inline-flex items-center gap-1 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          <ChevronLeft className="size-4" />{" "}
          {doc.scope === "vault" ? "Vault" : `@${doc.author}`}
        </Link>
        {canEdit ? <DeleteDocButton id={doc.id} backTo={backTo} /> : null}
      </div>

      <Card className="p-6 sm:p-8">
        <DocEditor
          id={doc.id}
          initialTitle={doc.title}
          initialBody={doc.body}
          canEdit={canEdit}
        />
      </Card>

      <p className="mt-3 text-[12px] text-[var(--color-faint)]">
        Created by @{doc.author} · updated{" "}
        {doc.updated_by ? `by @${doc.updated_by} ` : ""}
        {relativeTime(doc.updated_at)}
        {canEdit ? "" : " · read only"}
      </p>
    </div>
  );
}
