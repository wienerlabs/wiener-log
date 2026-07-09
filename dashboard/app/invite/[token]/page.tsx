import Image from "next/image";
import { getInvite } from "@/lib/db";
import { acceptInvite } from "@/lib/invite-actions";

export const dynamic = "force-dynamic";

const fieldCls =
  "w-full rounded-[11px] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none transition-all placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent-soft)]";
const labelCls = "text-[12.5px] font-medium text-[var(--color-ink-soft)]";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await getInvite(token);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex size-14 items-center justify-center rounded-[16px] bg-white ring-1 ring-black/[0.08] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.25)]">
            <Image src="/wiener-logo.png" alt="Wiener Labs" width={60} height={42} className="h-[24px] w-auto" priority />
          </span>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            WienerLog
          </h1>
        </div>
        {children}
      </div>
    </div>
  );

  if (!invite || invite.accepted) {
    return (
      <Shell>
        <div className="rounded-[18px] bg-[var(--color-surface)] p-6 text-center text-[13.5px] text-[var(--color-muted)] ring-1 ring-[var(--color-ring)]">
          This invite link is not valid or has already been used.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-[18px] bg-[var(--color-surface)] p-6 ring-1 ring-[var(--color-ring)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-24px_rgba(0,0,0,0.2)]">
        <p className="mb-4 text-center text-[13.5px] text-[var(--color-muted)]">
          You are invited to WienerLog as{" "}
          <span className="font-medium text-[var(--color-ink)]">@{invite.handle}</span>. Set a password to finish.
        </p>
        <form action={acceptInvite} className="flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <label className={labelCls}>Username</label>
          <input
            name="username"
            defaultValue={invite.handle ?? ""}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className={fieldCls}
          />
          <label className={labelCls}>Password</label>
          <input type="password" name="password" required autoComplete="new-password" placeholder="At least 8 characters" className={fieldCls} />
          <label className={labelCls}>Confirm password</label>
          <input type="password" name="confirm" required autoComplete="new-password" className={fieldCls} />
          {error ? (
            <p className="text-[12.5px] font-medium text-[var(--color-danger)]">{error}</p>
          ) : null}
          <button
            type="submit"
            className="mt-1 rounded-[11px] bg-[var(--color-btn)] px-4 py-2.5 text-[14px] font-medium text-[var(--color-btn-fg)] transition-all hover:opacity-90 active:scale-[0.99]"
          >
            Create account
          </button>
        </form>
      </div>
    </Shell>
  );
}
