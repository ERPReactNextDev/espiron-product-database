"use client";

// MERGED: sidebar-bottom behavior is now handled here via isMobile detection.
// Delete components/sidebar-bottom.tsx — it is no longer needed.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  LayoutDashboard,
  Package,
  Truck,
  History,
  ClipboardCheck,
  ClipboardList,
  User,
  PanelLeft,
  Key,
  Settings,
  StickyNote,
  BarChart3,
  Mail,
  FileText,
} from "lucide-react";

import { useUser } from "@/contexts/UserContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useRoleAccess, type AccessKey } from "@/contexts/RoleAccessContext";
import { useTheme } from "@/contexts/ThemeContext";
import { NavUser } from "@/components/nav-user";
import { db } from "@/lib/firebase";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type UserDetails = {
  Firstname: string;
  Lastname: string;
  Role: string;
  Email: string;
  profilePicture: string;
  Department: string;
};

type ThemeName = "comic" | "engineer" | "formal";

const NAV_ITEMS: Array<{
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  badgeKey?: "requests" | "forApproval";
  accessKey?: AccessKey;
  onlyForEngineeringManagerOrIT?: boolean;
  onlyForIT?: boolean;
}> = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/analytics", icon: BarChart3, label: "Analytics", accessKey: "page:analytics" },
  { href: "/spf-quotation-tracking", icon: FileText, label: "Tracking", accessKey: "page:requests" },
  { href: "/products", icon: Package, label: "Products", accessKey: "page:products" },
  { href: "/suppliers", icon: Truck, label: "Suppliers", accessKey: "page:suppliers" },
  { href: "/email", icon: Mail, label: "Email" },
  { href: "/requests", icon: ClipboardList, label: "Requests", badgeKey: "requests", accessKey: "page:requests" },
  { href: "/history", icon: History, label: "History", accessKey: "page:history" },
  { href: "/notes", icon: StickyNote, label: "Notes", accessKey: "page:notes" },
  { href: "/for-approval", icon: ClipboardCheck, label: "Approval", badgeKey: "forApproval", onlyForEngineeringManagerOrIT: true },
  { href: "/roles", icon: User, label: "Roles", accessKey: "page:roles", onlyForEngineeringManagerOrIT: true },
  { href: "/api-management", icon: Key, label: "API Keys", onlyForIT: true },
  { href: "/settings", icon: Settings, label: "Settings" },
];

const BOTTOM_NAV_HREFS = new Set(["/for-approval", "/roles", "/api-management", "/settings"]);

/* ─────────────────────────────────────────────
   Reusable badge (desktop, expanded + collapsed)
   - collapsed: tucked INSIDE the icon corner so it can never be clipped
   - expanded : pill on the right side of the row
───────────────────────────────────────────── */
function NavBadge({
  count,
  loading = false,
  collapsed,
  themeName,
}: {
  count: number;
  loading?: boolean;
  collapsed: boolean;
  themeName: ThemeName;
}) {
  if (count <= 0 && !loading) return null;

  const colors =
    themeName === "comic"
      ? "bg-yellow-400 text-gray-900 border-2 border-gray-800 shadow-[2px_2px_0px_#2d3436]"
      : themeName === "engineer"
        ? collapsed
          ? "bg-red-600 text-white shadow-sm"
          : "bg-orange-500 text-white border-2 border-gray-800 shadow-[2px_2px_0px_#2c3e50]"
        : "bg-red-600 text-white shadow-sm";

  const label = count > 9 ? "9+" : count;

  const spinner = (
    <span
      className={`${
        collapsed ? "size-2.5" : "size-3.5"
      } animate-spin rounded-full border-2 border-white/30 border-t-white`}
    />
  );

  if (collapsed) {
    return (
      <span
        className={`pointer-events-none absolute right-0 top-0 z-20 flex h-4 w-max min-w-4 items-center justify-center whitespace-nowrap rounded-full px-1 text-[9px] font-bold leading-none ${colors}`}
      >
        {loading ? spinner : label}
      </span>
    );
  }

  return (
    <span
      className={`ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${colors}`}
    >
      {loading ? spinner : label}
    </span>
  );
}

export function SidebarLeft() {
  const { state, isMobile } = useSidebar();
  const { userId } = useUser();
  const { activeNotificationCount, unreadChatCount, isLoading: isNotifLoading } = useNotifications();
  const { subscribeToUserAccess } = useRoleAccess();
  const { theme } = useTheme();
  const pathname = usePathname();

  const [user, setUser] = React.useState<UserDetails | null>(null);
  const [userAccess, setUserAccess] = React.useState<Record<string, boolean> | null>(null);
  const [forApprovalCount, setForApprovalCount] = React.useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function fetchUser() {
      try {
        const res = await fetch(`/api/users?id=${encodeURIComponent(userId!)}`);

        if (!res.ok) {
          console.warn(`SidebarLeft: /api/users returned ${res.status}`);
          return;
        }

        const data = await res.json();

        if (cancelled) return;

        setUser({
          Firstname:      data.Firstname      ?? "",
          Lastname:       data.Lastname       ?? "",
          Role:           data.Role           ?? "",
          Email:          data.Email          ?? "",
          profilePicture: data.profilePicture ?? "",
          Department:     data.Department     ?? "",
        });
      } catch (err) {
        if (!cancelled) {
          console.error("SidebarLeft user fetch error:", err);
        }
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  React.useEffect(() => {
    if (!userId) {
      setUserAccess(null);
      return;
    }

    const unsub = subscribeToUserAccess(userId, (access) => {
      setUserAccess(access);
    });

    return () => unsub();
  }, [userId, subscribeToUserAccess]);

  React.useEffect(() => {
    const q = query(collection(db, "forApprovals"), where("status", "==", "Pending"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setForApprovalCount(snapshot.size);
      },
      () => {
        setForApprovalCount(0);
      }
    );
    return () => unsub();
  }, []);

  const hasFullAccess = React.useMemo(() => {
    if (!user) return false;
    return (
      (user.Department === "Engineering" && user.Role === "Manager") ||
      user.Department === "IT"
    );
  }, [user]);

  // Filter NAV_ITEMS based on user permissions
  const filteredNavItems = React.useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.onlyForEngineeringManagerOrIT && !hasFullAccess) {
        return false;
      }

      if (item.onlyForIT && user?.Department !== "IT") {
        return false;
      }

      if (!item.accessKey || hasFullAccess) {
        return true;
      }

      if (!userAccess) {
        return true;
      }

      return userAccess[item.accessKey] ?? true;
    });
  }, [hasFullAccess, userAccess, user]);

  const mainDesktopNavItems = React.useMemo(
    () => filteredNavItems.filter((item) => !BOTTOM_NAV_HREFS.has(item.href)),
    [filteredNavItems]
  );

  const bottomDesktopNavItems = React.useMemo(
    () => filteredNavItems.filter((item) => BOTTOM_NAV_HREFS.has(item.href)),
    [filteredNavItems]
  );

  const getBadgeCount = (badgeKey?: "requests" | "forApproval") =>
    badgeKey === "requests"
      ? activeNotificationCount + unreadChatCount
      : badgeKey === "forApproval"
        ? forApprovalCount
        : 0;

  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";
  const isChristmas = theme === "christmas";
  const themeName: ThemeName = isComic ? "comic" : isEngineer ? "engineer" : "formal";
  const collapsed = state === "collapsed";

  /* ─────────────────────────────────────────────
     MOBILE — left navigation drawer
  ───────────────────────────────────────────── */
  if (isMobile) {
    return (
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(true)}
          className={`fixed left-3 top-3 z-40 size-10 rounded-xl border bg-white shadow-md md:hidden ${
            isComic
              ? "border-2 border-gray-800 text-gray-900"
              : isEngineer
                ? "border-2 border-gray-800 text-gray-900"
                : "border-gray-200 text-gray-800"
          }`}
        >
          <PanelLeft className="size-5" />
        </Button>
        <SheetContent
          side="left"
          className={`flex h-[100dvh] w-[min(18rem,85vw)] flex-col gap-0 border-r p-0 ${
            isComic
              ? "border-gray-800 bg-white text-gray-900"
              : isEngineer
                ? "border-gray-800 bg-white text-gray-900"
                : isChristmas
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-gray-200 bg-white text-gray-900"
          }`}
        >
          <SheetHeader className={`shrink-0 border-b px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))] ${
            isComic
              ? "border-b-4 border-gray-800 bg-linear-to-r from-yellow-300 to-orange-300"
              : isEngineer
                ? "border-b-4 border-gray-800 bg-linear-to-r from-orange-500 to-yellow-400"
                : isChristmas
                  ? "border-emerald-200 bg-linear-to-r from-emerald-50 to-red-50"
                  : "border-gray-100"
          }`}>
            <div className="flex items-center gap-3">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                isComic
                  ? "comic-card-primary"
                  : isEngineer
                    ? "engineer-card-primary"
                    : isChristmas
                      ? "bg-emerald-700 text-white"
                      : "bg-red-700 text-white"
              }`}>
                <Package className="size-5" />
              </span>
              <div className="min-w-0 text-left">
                <SheetTitle className={`truncate text-base ${
                  isComic ? "font-comic-title" : isEngineer ? "font-engineer-title" : "font-semibold"
                }`}>
                  ESPIRON
                </SheetTitle>
                <SheetDescription className="truncate text-xs">
                  Product Database
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
            <p className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${
              isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"
            }`}>
              Menu
            </p>
            <SidebarMenu className="gap-1">
              {filteredNavItems.map(({ href, icon: Icon, label, badgeKey }) => {
                const active = pathname === href;
                const badge = getBadgeCount(badgeKey);

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      data-active={active}
                      className={`h-11 rounded-lg px-3 ${
                        isComic
                          ? "font-comic text-gray-700 data-[active=true]:border-2 data-[active=true]:border-gray-800 data-[active=true]:bg-yellow-100 data-[active=true]:text-red-600"
                          : isEngineer
                            ? "font-engineer text-gray-700 data-[active=true]:border-2 data-[active=true]:border-gray-800 data-[active=true]:bg-orange-100 data-[active=true]:text-orange-700"
                            : isChristmas
                              ? "font-formal text-emerald-950 data-[active=true]:bg-emerald-100 data-[active=true]:text-emerald-900"
                              : "font-formal text-gray-700 data-[active=true]:bg-red-50 data-[active=true]:text-red-700"
                      }`}
                    >
                      <Link href={href} onClick={() => setMobileMenuOpen(false)} className="flex w-full items-center gap-3">
                        <Icon className="size-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {(badge > 0 || (badgeKey === "requests" && isNotifLoading)) && (
                          <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${
                            isComic
                              ? "border-2 border-gray-800 bg-yellow-400 text-gray-900"
                              : isEngineer
                                ? "border-2 border-gray-800 bg-orange-500 text-white"
                                : "bg-red-600 text-white"
                          }`}>
                            {badgeKey === "requests" && isNotifLoading ? "…" : badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </nav>

          {user && userId && (
            <div className="flex shrink-0 items-center gap-3 border-t border-gray-200 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <NavUser
                user={{
                  name: `${user.Firstname} ${user.Lastname}`.trim() || "User",
                  position: user.Role,
                  email: user.Email,
                  avatar: user.profilePicture || "/avatars/shadcn.jpg",
                }}
                userId={userId}
                avatarOnly
                notificationCount={activeNotificationCount + unreadChatCount}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {`${user.Firstname} ${user.Lastname}`.trim() || "User"}
                </p>
                <p className="truncate text-xs text-gray-500">{user.Role || user.Email}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  /* ─────────────────────────────────────────────
     DESKTOP — left sidebar (collapsible icon)
  ───────────────────────────────────────────── */
  return (
    <Sidebar
      collapsible="icon"
      className={`
        shadow-2xl
        border-r
        ${isComic
          ? "bg-white/90 backdrop-blur-md border-border/50"
          : isEngineer
          ? "bg-white/90 backdrop-blur-md border-border/50"
          : isChristmas
          ? "bg-emerald-50 border-emerald-200"
          : "bg-white border-gray-200"
        }
      `}
    >
      {/* HEADER */}
      <SidebarHeader className={`group-data-[collapsible=icon]:m-0.5 group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border-0! group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none! h-18 px-3 flex items-center m-2 rounded-2xl ${
        isComic
          ? "bg-linear-to-r from-yellow-300 to-orange-300 comic-border-thick"
          : isEngineer
          ? "bg-linear-to-r from-orange-500 to-yellow-400 engineer-steel-beam"
          : isChristmas
          ? "bg-linear-to-r from-emerald-800 via-emerald-700 to-red-700 border border-emerald-900"
          : "bg-linear-to-r from-red-600 to-red-800 border border-red-700"
      }`}>
        <Link
          href="/dashboard"
          className="group-data-[collapsible=icon]:justify-center flex items-center gap-2.5 min-w-0 cursor-pointer transition-opacity hover:opacity-90"
        >
          {/* Logo mark — always visible, even when collapsed */}
          <div className="shrink-0">
            <svg
              width={collapsed ? "28" : "32"}
              height={collapsed ? "28" : "32"}
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="block h-8 w-8 max-w-full drop-shadow-md group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7 group-data-[collapsible=icon]:drop-shadow-none"
            >
              {/* Outer hexagon */}
              <path
                d="M16 2L28.1244 9V23L16 30L3.87564 23V9L16 2Z"
                fill="url(#espironGrad)"
                stroke={isComic ? "#2d3436" : isEngineer ? "#2c3e50" : "#ffffff"}
                strokeWidth="1"
              />
              {/* Inner "E" mark built from bars */}
              <rect x="10" y="10" width="10" height="2" rx="1" fill="white" opacity="0.95" />
              <rect x="10" y="15" width="7.5" height="2" rx="1" fill="white" opacity="0.85" />
              <rect x="10" y="20" width="10" height="2" rx="1" fill="white" opacity="0.95" />
              <rect x="10" y="10" width="2" height="12" rx="1" fill="white" opacity="0.95" />
              <defs>
                <linearGradient id="espironGrad" x1="3.87564" y1="2" x2="28.1244" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={isComic ? "#ff4757" : isEngineer ? "#ff6b35" : isChristmas ? "#166534" : "#dc2626"} />
                  <stop offset="100%" stopColor={isComic ? "#ffa502" : isEngineer ? "#ffd93d" : "#b91c1c"} />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Wordmark — only when expanded */}
          {state === "expanded" && (
            <div className="flex flex-col leading-none min-w-0">
              <span
                className={`text-lg truncate ${
                  isComic
                    ? "font-comic-title text-gray-900"
                    : isEngineer
                    ? "font-engineer-title text-white engineer-text-shadow"
                    : isChristmas
                    ? "font-formal-title text-white"
                    : "font-formal-title text-white"
                }`}
              >
                ESPIRON
              </span>
              <span
                className={`text-xs truncate ${
                  isComic
                    ? "font-comic font-bold text-red-500"
                    : isEngineer
                    ? "font-engineer font-bold text-yellow-300"
                    : isChristmas
                    ? "font-formal font-bold text-amber-100"
                    : "font-formal text-red-100"
                }`}
              >
                Product Database {isComic ? "🚀" : isEngineer ? "👷" : isChristmas ? "🎄" : ""}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* CONTENT
          FIX: overflow-visible! so collapsed badges are never clipped */}
      <SidebarContent className="px-2 flex flex-col group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:overflow-visible!">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          {mainDesktopNavItems.map(({ href, icon: Icon, label, badgeKey }) => {
            const badge = getBadgeCount(badgeKey);
            const showLoading = badgeKey === "requests" && isNotifLoading;

            return (
              <SidebarMenuItem key={href} className="group-data-[collapsible=icon]:overflow-visible">
                <SidebarMenuButton
                  asChild
                  data-active={pathname === href}
                  tooltip={label}
                  className={`
                  ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"} font-bold text-sm
                  transition-all duration-200
                  rounded-xl
                  group-data-[collapsible=icon]:overflow-visible!
                  group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:rounded-[12px]! group-data-[collapsible=icon]:shadow-none! group-data-[collapsible=icon]:translate-x-0 group-data-[collapsible=icon]:translate-y-0
                    ${isComic ? "border-2 border-transparent" : isEngineer ? "border-2 border-transparent" : "border border-transparent"}
                    ${isComic
                      ? "hover:border-gray-800 hover:shadow-[4px_4px_0px_#2d3436] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-100"
                      : isEngineer
                      ? collapsed
                        ? "hover:border-gray-400 hover:bg-gray-100"
                        : "hover:border-gray-800 hover:shadow-[4px_4px_0px_#2c3e50] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-orange-100"
                      : isChristmas
                      ? "hover:border-emerald-800 hover:shadow-md hover:bg-emerald-100 hover:text-emerald-950"
                      : "hover:border-red-600 hover:shadow-md hover:bg-red-600 hover:text-white"
                    }
                    ${isComic
                      ? "data-[active=true]:bg-linear-to-r data-[active=true]:from-red-400 data-[active=true]:to-orange-400 data-[active=true]:text-white data-[active=true]:border-2 data-[active=true]:border-gray-800 data-[active=true]:shadow-[4px_4px_0px_#2d3436]"
                      : isEngineer
                      ? collapsed
                        ? "data-[active=true]:bg-gray-200 data-[active=true]:text-gray-900 data-[active=true]:border-2 data-[active=true]:border-gray-400 data-[active=true]:shadow-none"
                        : "data-[active=true]:bg-linear-to-r data-[active=true]:from-orange-500 data-[active=true]:to-yellow-400 data-[active=true]:text-white data-[active=true]:border-2 data-[active=true]:border-gray-800 data-[active=true]:shadow-[4px_4px_0px_#2c3e50]"
                      : isChristmas
                      ? "data-[active=true]:bg-linear-to-r data-[active=true]:from-emerald-700 data-[active=true]:to-red-700 data-[active=true]:text-white data-[active=true]:border data-[active=true]:border-emerald-900 data-[active=true]:shadow-md"
                      : "data-[active=true]:bg-linear-to-r data-[active=true]:from-red-600 data-[active=true]:to-red-700 data-[active=true]:text-white data-[active=true]:border data-[active=true]:border-red-700 data-[active=true]:shadow-md"
                    }
                    ${isComic
                      ? "bg-white text-gray-700 data-[active=false]:hover:text-red-500"
                      : isEngineer
                        ? collapsed
                          ? "bg-white text-gray-700 data-[active=false]:hover:text-gray-700"
                          : "bg-white text-gray-700 data-[active=false]:hover:text-orange-600"
                        : isChristmas
                        ? "bg-white text-emerald-950 data-[active=false]:hover:text-emerald-950"
                        : "bg-white text-gray-700"
                    }
                  `}
                >
                  <Link href={href} className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 relative flex w-full items-center gap-3 py-3">
                    <span className="relative shrink-0">
                      <Icon className="h-5 w-5" />
                    </span>
                    {collapsed && (
                      <NavBadge count={badge} loading={showLoading} collapsed themeName={themeName} />
                    )}

                    {!collapsed && (
                      <>
                        <span className="flex-1">{label}</span>
                        <NavBadge count={badge} loading={showLoading} collapsed={false} themeName={themeName} />
                      </>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {bottomDesktopNavItems.length > 0 && (
          <SidebarMenu className="mt-auto pt-2 group-data-[collapsible=icon]:items-center">
            {bottomDesktopNavItems.map(({ href, icon: Icon, label, badgeKey }) => {
              const badge = getBadgeCount(badgeKey);

              return (
                <SidebarMenuItem key={href} className="group-data-[collapsible=icon]:overflow-visible">
                  <SidebarMenuButton
                    asChild
                    data-active={pathname === href}
                    tooltip={label}
                    className={`
                      ${isComic ? "font-comic text-gray-700" : isEngineer ? "font-engineer text-white" : "font-formal text-gray-700"}
                      transition-all
                      group-data-[collapsible=icon]:overflow-visible!
                      group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:rounded-[12px]! group-data-[collapsible=icon]:shadow-none! group-data-[collapsible=icon]:translate-x-0 group-data-[collapsible=icon]:translate-y-0
                      ${isComic ? "hover:bg-red-50 hover:text-red-700" : isEngineer ? collapsed ? "hover:bg-gray-600 hover:text-white" : "hover:bg-orange-500 hover:text-white" : isChristmas ? "hover:bg-emerald-100 hover:text-emerald-950" : "hover:bg-red-600 hover:text-white"}
                      hover:scale-[1.01]
                      ${isComic
                        ? "data-[active=true]:bg-linear-to-r data-[active=true]:from-red-400 data-[active=true]:to-orange-400"
                        : isEngineer
                        ? collapsed
                          ? "data-[active=true]:bg-gray-600"
                          : "data-[active=true]:bg-linear-to-r data-[active=true]:from-orange-500 data-[active=true]:to-yellow-400"
                        : isChristmas
                        ? "data-[active=true]:bg-linear-to-r data-[active=true]:from-emerald-700 data-[active=true]:to-red-700"
                        : "data-[active=true]:bg-linear-to-r data-[active=true]:from-red-600 data-[active=true]:to-red-700"
                      }
                      data-[active=true]:text-white
                      data-[active=true]:shadow-md
                      ${isComic
                        ? "data-[active=true]:hover:from-red-500 data-[active=true]:hover:to-orange-500"
                        : isEngineer
                        ? collapsed
                          ? "data-[active=true]:hover:bg-gray-700"
                          : "data-[active=true]:hover:from-orange-600 data-[active=true]:hover:to-yellow-500"
                        : isChristmas
                        ? "data-[active=true]:hover:from-emerald-800 data-[active=true]:hover:to-red-800"
                        : "data-[active=true]:hover:from-red-700 data-[active=true]:hover:to-red-800"
                      }
                      data-[active=true]:hover:text-white
                    `}
                  >
                    <Link href={href} className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 relative flex w-full items-center gap-2">
                      <span className="relative shrink-0">
                        <Icon className="h-4 w-4" />
                      </span>
                      {collapsed && (
                        <NavBadge count={badge} collapsed themeName={themeName} />
                      )}

                      {!collapsed && (
                        <>
                          <span className="flex-1">{label}</span>
                          <NavBadge count={badge} collapsed={false} themeName={themeName} />
                        </>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        )}
      </SidebarContent>

      <SidebarSeparator className={`h-1 my-2 ${isComic ? "bg-gray-800" : isEngineer ? "bg-gray-800" : "bg-gray-200"}`} />

      {/* FOOTER
          Collapsed: avatar only — no card background, no badge */}
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-1">
        {user && userId && (
          <div
            className={`
              cursor-pointer
              p-3
              group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:border-0! group-data-[collapsible=icon]:bg-none! group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:shadow-none! group-data-[collapsible=icon]:hover:shadow-none! group-data-[collapsible=icon]:[&_button]:bg-transparent! group-data-[collapsible=icon]:[&_button]:border-0! group-data-[collapsible=icon]:[&_button]:shadow-none!
              ${isComic
                ? "comic-card bg-linear-to-r from-blue-100 to-purple-100 comic-hover-lift"
                : isEngineer && !collapsed
                ? "engineer-card bg-linear-to-r from-orange-100 to-yellow-100"
                : isEngineer
                ? "bg-transparent"
                : "formal-card bg-linear-to-r from-red-50 to-red-100 hover:shadow-md transition-shadow"
              }
            `}
          >
            <NavUser
              user={{
                name:     `${user.Firstname} ${user.Lastname}`.trim() || "Unknown User",
                position: user.Role,
                email:    user.Email,
                avatar:   user.profilePicture || "/avatars/shadcn.jpg",
              }}
              userId={userId}
              notificationCount={collapsed ? 0 : activeNotificationCount + unreadChatCount}
            />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}