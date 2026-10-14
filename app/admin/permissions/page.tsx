"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  CircleUser,
  ClipboardCheck,
  FileText,
  Fingerprint,
  Layers,
  LayoutDashboard,
  ListTodo,
  Lock,
  Monitor,
  MoreHorizontal,
  Package,
  Pencil,
  Save,
  Settings2,
  Shield,
  ShieldCheck,
  ThumbsUp,
  Users,
  Wrench,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type PermissionSection = "services" | "nav" | "security" | "account" | "dashboard";
type PermissionValues = Record<PermissionSection, Record<string, boolean>>;

type OlePermissionRecord = {
  id: number;
  doc_id: string;
  department: string | null;
  role: string | null;
  services: Record<string, boolean> | null;
  nav: Record<string, boolean> | null;
  security: Record<string, boolean> | null;
  account: Record<string, boolean> | null;
  dashboard: Record<string, boolean> | null;
  is_dashboard_allowed: boolean | null;
  updated_at: string | null;
  updated_by: string | null;
};

type DepartmentConfig = {
  name: string;
  roles: string[];
};

type SectionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

type SectionConfig = {
  key: PermissionSection;
  label: string;
  description: string;
  icon: LucideIcon;
  items: SectionItem[];
};

const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
  { name: "IT", roles: ["MEMBER", "LEADER", "MANAGER", "SUPER ADMIN"] },
  { name: "Engineering", roles: ["MEMBER", "LEADER", "MANAGER", "SUPER ADMIN"] },
  { name: "Admin", roles: ["STAFF", "MANAGER"] },
  {
    name: "Sales",
    roles: [
      "TERRITORY SALES ASSOCIATE",
      "TERRITORY SALES MANAGER",
      "SALES HEAD",
      "SUPER ADMIN",
    ],
  },
  { name: "Procurement", roles: ["MEMBER", "LEADER", "MANAGER", "SUPER ADMIN"] },
  {
    name: "Warehouse Operations",
    roles: ["MEMBER", "LEADER", "MANAGER", "SUPER ADMIN"],
  },
];

const DEFAULT_PERMISSIONS: PermissionValues = {
  services: {
    siteVisit: false,
    jobRequest: false,
    dialux: false,
    recommendation: false,
    shopDrawing: false,
    testing: false,
    productRequest: false,
    others: false,
    meetingRoom: false,
  },
  nav: {
    team: false,
    admin: false,
    analytics: false,
    systemSettings: false,
    helpCenter: false,
  },
  security: {
    changePassword: true,
    managePin: true,
    manageBiometrics: true,
    manage2FA: false,
    viewActivityLog: true,
  },
  account: {
    viewProfile: true,
    editProfile: true,
    preferences: true,
  },
  dashboard: {
    showStats: true,
    showRecentActivity: true,
    showOverviewTabs: true,
    showSchedule: true,
    showAlertBanner: true,
    showMyTasks: true,
  },
};

const SECTIONS: SectionConfig[] = [
  {
    key: "services",
    label: "App Features",
    description: "Choose which tools and features this role can use in the app.",
    icon: Layers,
    items: [
      { key: "siteVisit", label: "Site Visits", icon: CalendarCheck },
      { key: "jobRequest", label: "Job Requests", icon: FileText },
      { key: "dialux", label: "DIAlux Simulations", icon: Monitor },
      { key: "recommendation", label: "Product Recommendations", icon: ThumbsUp },
      { key: "shopDrawing", label: "Shop Drawings", icon: Wrench },
      { key: "testing", label: "Testing & Monitoring", icon: ClipboardCheck },
      { key: "productRequest", label: "Product Requests", icon: Package },
      { key: "others", label: "Other Requests", icon: MoreHorizontal },
      { key: "meetingRoom", label: "Meeting Rooms", icon: Building2 },
    ],
  },
  {
    key: "nav",
    label: "Navigation",
    description: "Choose which pages this role can see in the menu.",
    icon: LayoutDashboard,
    items: [
      { key: "team", label: "Team Directory", icon: Users },
      { key: "admin", label: "Access & Permissions", icon: ShieldCheck },
      { key: "analytics", label: "Analytics", icon: BarChart3 },
      { key: "systemSettings", label: "System Settings", icon: Settings2 },
      { key: "helpCenter", label: "Help Center", icon: BookOpen },
    ],
  },
  {
    key: "security",
    label: "Security",
    description: "Choose which security settings this role can manage.",
    icon: Shield,
    items: [
      { key: "changePassword", label: "Change Password", icon: Lock },
      { key: "managePin", label: "Login PIN", icon: CircleUser },
      { key: "manageBiometrics", label: "Biometrics", icon: Fingerprint },
      { key: "manage2FA", label: "Two-Step Verification", icon: ShieldCheck },
      { key: "viewActivityLog", label: "Login Activity", icon: Activity },
    ],
  },
  {
    key: "account",
    label: "Profile",
    description: "Choose what this role can do with their profile.",
    icon: CircleUser,
    items: [
      { key: "viewProfile", label: "View Profile", icon: Eye },
      { key: "editProfile", label: "Edit Profile", icon: Pencil },
      { key: "preferences", label: "App Preferences", icon: Settings2 },
    ],
  },
  {
    key: "dashboard",
    label: "Home Screen",
    description: "Choose which sections this role can see on the home screen.",
    icon: LayoutDashboard,
    items: [
      { key: "showStats", label: "Stats Cards", icon: BarChart3 },
      { key: "showRecentActivity", label: "Recent Activity", icon: Bell },
      { key: "showOverviewTabs", label: "Overview Tabs", icon: Layers },
      { key: "showSchedule", label: "Schedule", icon: CalendarCheck },
      { key: "showAlertBanner", label: "Alerts", icon: Activity },
      { key: "showMyTasks", label: "My Tasks", icon: ListTodo },
    ],
  },
];

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function getRowDepartmentRole(
  row: OlePermissionRecord,
  departments: DepartmentConfig[]
): { department: string; role: string } | null {
  const department = row.department?.trim();
  const role = row.role?.trim();
  if (department && role) return { department, role };

  const docId = row.doc_id?.toUpperCase() ?? "";
  const departmentMatch = departments
    .map((config) => config.name)
    .sort((a, b) => b.length - a.length)
    .find((name) => docId.startsWith(`${name.toUpperCase()}_`));

  if (!departmentMatch) return null;
  const parsedRole = docId.slice(departmentMatch.length + 1).trim();
  return parsedRole ? { department: departmentMatch, role: parsedRole } : null;
}

function readPermissionValues(record?: OlePermissionRecord): PermissionValues {
  const values = { ...DEFAULT_PERMISSIONS } as PermissionValues;
  for (const section of SECTIONS) {
    const stored = record?.[section.key];
    if (!stored) continue;
    values[section.key] = { ...DEFAULT_PERMISSIONS[section.key] };
    for (const item of section.items) {
      if (typeof stored[item.key] === "boolean") {
        values[section.key][item.key] = stored[item.key];
      }
    }
  }
  return values;
}

function countActive(values: Record<string, boolean>) {
  return Object.values(values).filter(Boolean).length;
}

export default function AdminPermissionsPage() {
  const { userId } = useUser();
  const [records, setRecords] = useState<OlePermissionRecord[]>([]);
  const [department, setDepartment] = useState("IT");
  const [role, setRole] = useState("MEMBER");
  const [permissions, setPermissions] = useState<PermissionValues>(DEFAULT_PERMISSIONS);
  const [isDashboardAllowed, setIsDashboardAllowed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const departments = useMemo(() => {
    const result = [...DEFAULT_DEPARTMENTS];
    for (const record of records) {
      const pair = getRowDepartmentRole(record, result);
      if (!pair || result.some((item) => normalize(item.name) === normalize(pair.department))) {
        continue;
      }
      result.push({ name: pair.department, roles: [pair.role] });
    }
    return result;
  }, [records]);

  const availableRoles = useMemo(() => {
    const base =
      departments.find((item) => normalize(item.name) === normalize(department))?.roles ?? [];
    const saved = records.flatMap((record) => {
      const pair = getRowDepartmentRole(record, departments);
      return pair && normalize(pair.department) === normalize(department) ? [pair.role] : [];
    });
    return Array.from(new Set([...base, ...saved]));
  }, [department, departments, records]);

  const selectedRecord = useMemo(
    () =>
      records.find((record) => {
        const pair = getRowDepartmentRole(record, departments);
        return (
          pair &&
          normalize(pair.department) === normalize(department) &&
          normalize(pair.role) === normalize(role)
        );
      }),
    [department, departments, records, role]
  );

  useEffect(() => {
    setPermissions(readPermissionValues(selectedRecord));
    setIsDashboardAllowed(selectedRecord?.is_dashboard_allowed ?? true);
    setDirty(false);
  }, [selectedRecord]);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const response = await fetch("/api/admin/permissions");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load permissions");
      }

      const loadedRecords = result as OlePermissionRecord[];
      setRecords(loadedRecords);
      setDirty(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load permissions";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadPermissions();
  }, [loadPermissions, userId]);

  const selectRole = (nextDepartment: string, nextRole: string) => {
    if (dirty && !window.confirm("Discard unsaved permission changes?")) return;
    setDepartment(nextDepartment);
    setRole(nextRole);
  };

  const updatePermission = (
    section: PermissionSection,
    key: string,
    checked: boolean
  ) => {
    setPermissions((current) => ({
      ...current,
      [section]: { ...current[section], [key]: checked },
    }));
    setDirty(true);
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department,
          role,
          permissions,
          is_dashboard_allowed: isDashboardAllowed,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save permissions");
      }

      setRecords((current) => [
        ...current.filter((record) => record.doc_id !== result.doc_id),
        result as OlePermissionRecord,
      ]);
      setDirty(false);
      toast.success(`Permissions saved for ${department} / ${role}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save permissions";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading your session…
      </div>
    );
  }

  return (
    <main className="h-dvh overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-5 p-4 pb-12 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
                Admin Permissions
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Configure app access by department and role.
              </p>
            </div>
          </div>
          <Button onClick={savePermissions} disabled={loading || saving || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </header>

        {loadError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>{loadError}</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => void loadPermissions()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        <Card className="gap-0 rounded-2xl border-slate-200 py-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Choose Role to Edit</h2>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
              {selectedRecord ? "Saved" : "Default"}
            </span>
          </CardHeader>
          <CardContent className="space-y-5 px-5 py-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Department
              </p>
              <div className="flex flex-wrap gap-2">
                {departments.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => selectRole(item.name, item.roles[0] ?? "MEMBER")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      normalize(department) === normalize(item.name)
                        ? "border-slate-300 bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Role
              </p>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => selectRole(department, item)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      normalize(role) === normalize(item)
                        ? "border-slate-300 bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {SECTIONS.map((section) => (
                  <span key={section.key}>
                    {section.label}:{" "}
                    <span className="text-slate-900">
                      {countActive(permissions[section.key])}/{section.items.length}
                    </span>
                  </span>
                ))}
              </div>
              {dirty ? (
                <span className="normal-case tracking-normal text-amber-700">
                  Unsaved changes
                </span>
              ) : selectedRecord?.updated_at ? (
                <span className="normal-case font-normal tracking-normal">
                  Updated {new Date(selectedRecord.updated_at).toLocaleString()}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-2xl border-slate-200 py-0 shadow-sm">
          <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-semibold text-slate-900">Home screen access</p>
              <p className="mt-1 text-sm text-slate-500">
                Allow this role to open the dashboard.
              </p>
            </div>
            <Switch
              aria-label="Allow dashboard access"
              checked={isDashboardAllowed}
              onCheckedChange={(checked) => {
                setIsDashboardAllowed(checked);
                setDirty(true);
              }}
            />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
          </div>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const SectionIcon = section.icon;
              const activeCount = countActive(permissions[section.key]);
              return (
                <Card
                  key={section.key}
                  className="gap-0 overflow-hidden rounded-2xl border-slate-200 py-0 shadow-sm"
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <SectionIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold uppercase text-slate-900">
                          {section.label}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{section.description}</span>
                          <span className="font-semibold text-slate-700">
                            {activeCount}/{section.items.length} active
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        activeCount
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {activeCount ? "Enabled" : "Disabled"}
                    </span>
                  </CardHeader>
                  <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const checked = permissions[section.key][item.key] ?? false;
                      return (
                        <label
                          key={item.key}
                          className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-slate-50"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                checked
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-slate-50 text-slate-400"
                              }`}
                            >
                              <ItemIcon className="h-4 w-4" />
                            </span>
                            <span className="text-xs font-semibold uppercase text-slate-700">
                              {item.label}
                            </span>
                          </span>
                          <Switch
                            aria-label={item.label}
                            checked={checked}
                            onCheckedChange={(value) =>
                              updatePermission(section.key, item.key, value)
                            }
                          />
                        </label>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
