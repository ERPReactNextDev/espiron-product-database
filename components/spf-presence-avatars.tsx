"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/utils/supabase";

type PresenceStatus = "SPF_ONLINE" | "SPF_IDLE";

type PresenceUser = {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  status: PresenceStatus;
};

const REFRESH_INTERVAL_MS = 15_000;
const MAX_VISIBLE_USERS = 5;

function PresenceAvatar({
  user,
  tooltipSide = "bottom",
}: {
  user: PresenceUser;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}) {
  const name = `${user.firstName} ${user.lastName}`.trim() || "Espiron user";
  const status = user.status === "SPF_IDLE" ? "idle" : "online";
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` || "U";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar
          aria-label={`${name} is ${status}`}
          className={`size-9 cursor-default border-2 border-white shadow-sm ${
            status === "idle" ? "opacity-50" : "opacity-100"
          }`}
        >
          <AvatarImage src={user.profilePicture || undefined} alt={name} className="object-cover" />
          <AvatarFallback className="bg-gray-200 text-xs font-semibold text-gray-700">
            {initials}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{name} is {status}</TooltipContent>
    </Tooltip>
  );
}

export function SpfPresenceAvatars() {
  const { userId } = useUser();
  const pathname = usePathname();
  const [presence, setPresence] = useState<{ userId: string; users: PresenceUser[] } | null>(null);

  useEffect(() => {
    if (!userId || pathname === "/login") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshId = 0;

    const refreshPresence = async () => {
      const currentRefreshId = ++refreshId;
      try {
        const response = await fetch("/api/spf-presence", { cache: "no-store" });
        if (response.status === 401) {
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to load active users (${response.status})`);
        }

        const data = await response.json();
        if (!cancelled && currentRefreshId === refreshId) {
          setPresence({ userId, users: data.users || [] });
        }
      } catch (error) {
        if (!cancelled) console.error("Failed to refresh SPF presence:", error);
      } finally {
        if (!cancelled) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(refreshPresence, REFRESH_INTERVAL_MS);
        }
      }
    };

    const channel = supabase
      .channel("spf_presence_status")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, (payload) => {
        if (
          payload.eventType === "UPDATE" &&
          payload.old?.spf_logging_status !== undefined &&
          payload.new?.spf_logging_status === payload.old.spf_logging_status
        ) {
          return;
        }

        if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
        realtimeRefreshTimer = setTimeout(() => {
          void refreshPresence();
        }, 200);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`SPF presence realtime subscription ${status.toLowerCase()}.`);
        }
      });

    void refreshPresence();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [pathname, userId]);

  const users = presence?.userId === userId ? presence.users : [];
  if (!userId || pathname === "/login") return null;

  return (
    <div className="inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-2.5 py-1.5 shadow-sm">
      <span className="whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
        Online Status:
      </span>
      {users.length > 0 ? (
        <div role="group" aria-label="Users currently online or idle" className="flex items-center -space-x-2">
          {users.slice(0, MAX_VISIBLE_USERS).map((user) => (
            <PresenceAvatar key={user.id} user={user} />
          ))}
          {users.length > MAX_VISIBLE_USERS && (
            <HoverCard openDelay={150} closeDelay={100}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  aria-label={`${users.length - MAX_VISIBLE_USERS} additional active users`}
                  className="ml-1 whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                >
                  +{users.length - MAX_VISIBLE_USERS}
                </button>
              </HoverCardTrigger>
              <HoverCardContent align="end" side="bottom" className="w-auto max-w-[min(20rem,90vw)] p-3">
                <div
                  role="group"
                  aria-label="Additional online or idle users"
                  className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto"
                >
                  {users.slice(MAX_VISIBLE_USERS).map((user) => {
                    return <PresenceAvatar key={user.id} user={user} tooltipSide="left" />;
                  })}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>
      ) : (
        <span className="whitespace-nowrap text-xs text-gray-500">No active users</span>
      )}
    </div>
  );
}
