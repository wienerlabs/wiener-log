import { getSession } from "@/lib/session";
import { getMeeting, createMeeting } from "@/lib/db";
import { JitsiCall } from "@/components/jitsi-call";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MeetPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  const session = await getSession();
  const me =
    session?.handle && session.handle !== "admin"
      ? session.handle
      : session?.username || "Guest";

  let meeting = await getMeeting(room);
  if (!meeting) {
    await createMeeting(room, "", me);
    meeting = await getMeeting(room);
  }

  return (
    <div className="flex h-screen flex-col bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-2.5">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#c9d1d9] transition-colors hover:text-white"
        >
          <ChevronLeft className="size-4" /> WienerLog
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-white">
            <Image
              src="/wiener-logo.png"
              alt="Wiener Labs"
              width={30}
              height={21}
              className="h-[10px] w-auto"
            />
          </span>
          <span className="text-[13px] text-[#8b949e]">
            {meeting?.title || "Team call"}
          </span>
        </div>
        <span className="w-[90px]" />
      </div>
      <div className="min-h-0 flex-1">
        <JitsiCall room={room} displayName={me} title={meeting?.title || "Team call"} />
      </div>
    </div>
  );
}
