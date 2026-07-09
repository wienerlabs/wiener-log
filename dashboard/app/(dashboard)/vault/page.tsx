import { listVaultDocs } from "@/lib/db";
import { Card, PageHeader, EmptyState, Avatar } from "@/components/ui";
import { NewDocButton } from "@/components/doc-buttons";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const docs = await listVaultDocs();

  return (
    <div className="rise">
      <PageHeader
        title="Vault"
        subtitle="Shared team documents. Anyone can add and edit."
      />
      <div className="mb-5">
        <NewDocButton scope="vault" />
      </div>

      {docs.length === 0 ? (
        <EmptyState>No documents yet. Create the first one.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link key={d.id} href={`/docs/${d.id}`}>
              <Card className="flex h-full flex-col p-5 transition-transform duration-300 hover:-translate-y-0.5">
                <div className="flex items-start gap-2.5">
                  <FileText
                    className="mt-0.5 size-[18px] shrink-0 text-[var(--color-faint)]"
                    strokeWidth={2}
                  />
                  <span className="line-clamp-2 text-[14.5px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
                    {d.title}
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-4 text-[11.5px] text-[var(--color-faint)]">
                  <Avatar handle={d.updated_by || d.author} size={18} />
                  <span>
                    {d.updated_by || d.author} · {relativeTime(d.updated_at)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
