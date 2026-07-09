"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui";
import { Mic, MicOff, Video, VideoOff, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

type JitsiApi = {
  addEventListener: (event: string, cb: (...args: unknown[]) => void) => void;
  dispose: () => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>,
    ) => JitsiApi;
  }
}

const DOMAIN = process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si";

function loadScript(domain: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve();
    const existing = document.getElementById("jitsi-external-api");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.id = "jitsi-external-api";
    s.src = `https://${domain}/external_api.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load Jitsi"));
    document.body.appendChild(s);
  });
}

export function JitsiCall({
  room,
  displayName,
  title,
}: {
  room: string;
  displayName: string;
  title: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (!joined) return;
    let api: JitsiApi | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const ping = (leaving = false) => {
      if (leaving && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/meet/ping",
          new Blob([JSON.stringify({ room, leaving: true })], {
            type: "application/json",
          }),
        );
        return;
      }
      fetch("/api/meet/ping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room }),
        keepalive: true,
      }).catch(() => {});
    };
    const onUnload = () => ping(true);

    loadScript(DOMAIN)
      .then(() => {
        if (disposed || !ref.current || !window.JitsiMeetExternalAPI) return;
        api = new window.JitsiMeetExternalAPI(DOMAIN, {
          roomName: room,
          parentNode: ref.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName },
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: !micOn,
            startWithVideoMuted: !camOn,
            disableDeepLinking: true,
            disableThirdPartyRequests: true,
            defaultLanguage: "en",
            hideConferenceSubject: true,
            hideConferenceTimer: false,
            disableProfile: true,
            toolbarButtons: [
              "microphone",
              "camera",
              "desktop",
              "tileview",
              "chat",
              "participants-pane",
              "raisehand",
              "settings",
              "fullscreen",
              "hangup",
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            JITSI_WATERMARK_LINK: "",
            DEFAULT_BACKGROUND: "#0d1117",
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            MOBILE_APP_PROMO: false,
            HIDE_DEEP_LINKING_LOGO: true,
            DISABLE_VIDEO_BACKGROUND: false,
            DEFAULT_REMOTE_DISPLAY_NAME: "Teammate",
            TOOLBAR_ALWAYS_VISIBLE: false,
            DISABLE_PRESENCE_STATUS: true,
            DISABLE_TRANSCRIPTION_SUBTITLES: true,
          },
        });
        api.addEventListener("videoConferenceJoined", () => {
          ping();
          pingTimer = setInterval(() => ping(), 15000);
        });
        api.addEventListener("readyToClose", () => {
          ping(true);
          router.push("/chat");
        });
        window.addEventListener("pagehide", onUnload);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (pingTimer) clearInterval(pingTimer);
      window.removeEventListener("pagehide", onUnload);
      ping(true);
      if (api) api.dispose();
    };
  }, [joined, room, displayName, micOn, camOn, router]);

  if (joined) {
    return <div ref={ref} className="h-full w-full" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0d1117] px-6">
      <div className="w-full max-w-[380px] rounded-[20px] bg-[#161b22] p-7 text-center ring-1 ring-[#30363d]">
        <div className="flex justify-center">
          <Avatar handle={displayName} size={64} />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-[#e6edf3]">
          {title || "Team call"}
        </h1>
        <p className="mt-1 text-[13px] text-[#8b949e]">
          Joining as {displayName}
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setMicOn((v) => !v)}
            title={micOn ? "Mic on" : "Mic off"}
            className={cn(
              "flex size-12 items-center justify-center rounded-full ring-1 transition-colors",
              micOn
                ? "bg-[#21262d] text-[#e6edf3] ring-[#30363d]"
                : "bg-[#3a1c1a] text-[#ff6b61] ring-[#ff6b61]/40",
            )}
          >
            {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>
          <button
            type="button"
            onClick={() => setCamOn((v) => !v)}
            title={camOn ? "Camera on" : "Camera off"}
            className={cn(
              "flex size-12 items-center justify-center rounded-full ring-1 transition-colors",
              camOn
                ? "bg-[#21262d] text-[#e6edf3] ring-[#30363d]"
                : "bg-[#3a1c1a] text-[#ff6b61] ring-[#ff6b61]/40",
            )}
          >
            {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setJoined(true)}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#2f81f7] px-4 py-3 text-[15px] font-semibold text-white transition-all hover:bg-[#1f6feb] active:scale-[0.99]"
        >
          <PhoneCall className="size-[18px]" strokeWidth={2} />
          Join now
        </button>
      </div>
    </div>
  );
}
