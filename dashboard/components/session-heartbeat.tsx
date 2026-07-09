"use client";

import { useEffect } from "react";

export function SessionHeartbeat() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/session-ping", { method: "POST", keepalive: true }).catch(
        () => {},
      );
    };
    const beacon = () => {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/session-ping");
      else ping();
    };

    ping();
    const id = setInterval(ping, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") beacon();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", beacon);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", beacon);
    };
  }, []);

  return null;
}
