"use client";

import { useEffect } from "react";
import { useUser } from "@/contexts/UserContext";

type LoggingStatus = "SPF_ONLINE" | "SPF_IDLE";

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

export function SpfLoggingStatusTracker() {
  const { userId } = useUser();

  useEffect(() => {
    if (!userId) return;

    let active = true;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let desiredStatus: LoggingStatus | null = null;
    let statusQueue = Promise.resolve();
    let lastPointerActivityAt = 0;

    const updateStatus = (status: LoggingStatus) => {
      if (desiredStatus === status) return;
      desiredStatus = status;

      statusQueue = statusQueue
        .then(async () => {
          if (!active) return;
          const response = await fetch("/api/spf-logging-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
            keepalive: true,
          });
          if (!response.ok) {
            throw new Error(`Logging status update failed (${response.status})`);
          }
        })
        .catch((error) => {
          console.error("SPF logging status update failed:", error);
          if (desiredStatus === status) desiredStatus = null;
        });
    };

    const clearIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };

    const markIdle = () => {
      clearIdleTimer();
      updateStatus("SPF_IDLE");
    };

    const scheduleIdle = () => {
      clearIdleTimer();
      idleTimer = setTimeout(markIdle, IDLE_TIMEOUT_MS);
    };

    const markActive = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      updateStatus("SPF_ONLINE");
      scheduleIdle();
    };

    const handlePointerMove = () => {
      const now = Date.now();
      if (now - lastPointerActivityAt < 1000) return;
      lastPointerActivityAt = now;
      markActive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        markActive();
      } else {
        markIdle();
      }
    };

    const handleWindowBlur = () => markIdle();
    const handlePageHide = () => markIdle();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerdown", markActive);
    document.addEventListener("keydown", markActive);
    document.addEventListener("wheel", markActive);
    document.addEventListener("touchstart", markActive);
    window.addEventListener("focus", markActive);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", markActive);

    if (document.visibilityState === "visible" && document.hasFocus()) {
      markActive();
    } else {
      markIdle();
    }

    return () => {
      active = false;
      clearIdleTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerdown", markActive);
      document.removeEventListener("keydown", markActive);
      document.removeEventListener("wheel", markActive);
      document.removeEventListener("touchstart", markActive);
      window.removeEventListener("focus", markActive);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", markActive);
    };
  }, [userId]);

  return null;
}
