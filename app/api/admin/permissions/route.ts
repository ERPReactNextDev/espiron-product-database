import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PERMISSION_KEYS = {
  services: [
    "siteVisit",
    "jobRequest",
    "dialux",
    "recommendation",
    "shopDrawing",
    "testing",
    "productRequest",
    "others",
    "meetingRoom",
  ],
  nav: ["team", "admin", "analytics", "systemSettings", "helpCenter"],
  security: [
    "changePassword",
    "managePin",
    "manageBiometrics",
    "manage2FA",
    "viewActivityLog",
  ],
  account: ["viewProfile", "editProfile", "preferences"],
  dashboard: [
    "showStats",
    "showRecentActivity",
    "showOverviewTabs",
    "showSchedule",
    "showAlertBanner",
    "showMyTasks",
  ],
} as const;

type PermissionSection = keyof typeof PERMISSION_KEYS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedEditor(user: { Department?: string; Role?: string }) {
  return (
    user.Department?.toLowerCase() === "it" ||
    (user.Department?.toLowerCase() === "engineering" &&
      user.Role?.toLowerCase() === "manager")
  );
}

async function getEditor(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const userId = Number(session);
  if (!session || !Number.isSafeInteger(userId) || userId <= 0) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = getSupabaseAdmin();
  const { data: user, error } = await supabase
    .from("users")
    .select("Department, Role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to authorize permissions editor:", error);
    return {
      response: NextResponse.json(
        { error: "Unable to verify permissions access" },
        { status: 500 }
      ),
    };
  }

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!isAllowedEditor(user)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await getEditor(request);
    if ("response" in authorization) return authorization.response;

    const { data, error } = await getSupabaseAdmin()
      .from("ole_permissions")
      .select(
        "id, doc_id, department, role, services, nav, security, account, dashboard, is_dashboard_allowed, updated_at, updated_by"
      )
      .order("department", { ascending: true })
      .order("role", { ascending: true });

    if (error) {
      console.error("Failed to load ole_permissions:", error);
      return NextResponse.json(
        { error: "Failed to load role permissions" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Permissions GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load role permissions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await getEditor(request);
    if ("response" in authorization) return authorization.response;

    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const department =
      typeof body.department === "string" ? body.department.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    if (!department || !role || department.length > 120 || role.length > 120) {
      return NextResponse.json(
        { error: "A valid department and role are required" },
        { status: 400 }
      );
    }

    if (typeof body.is_dashboard_allowed !== "boolean" || !isRecord(body.permissions)) {
      return NextResponse.json(
        { error: "Invalid role permission values" },
        { status: 400 }
      );
    }

    const permissions: Record<PermissionSection, Record<string, boolean>> = {
      services: {},
      nav: {},
      security: {},
      account: {},
      dashboard: {},
    };

    for (const section of Object.keys(PERMISSION_KEYS) as PermissionSection[]) {
      const values = body.permissions[section];
      if (!isRecord(values)) {
        return NextResponse.json(
          { error: `Invalid ${section} permissions` },
          { status: 400 }
        );
      }

      for (const key of PERMISSION_KEYS[section]) {
        if (typeof values[key] !== "boolean") {
          return NextResponse.json(
            { error: `Invalid ${section}.${key} permission` },
            { status: 400 }
          );
        }
        permissions[section][key] = values[key];
      }
    }

    const docId = `${department.toUpperCase()}_${role.toUpperCase()}`;
    const { data, error } = await getSupabaseAdmin()
      .from("ole_permissions")
      .upsert(
        {
          doc_id: docId,
          department,
          role,
          ...permissions,
          is_dashboard_allowed: body.is_dashboard_allowed,
          updated_at: new Date().toISOString(),
          updated_by: String(authorization.user.id),
        },
        { onConflict: "doc_id" }
      )
      .select(
        "id, doc_id, department, role, services, nav, security, account, dashboard, is_dashboard_allowed, updated_at, updated_by"
      )
      .single();

    if (error) {
      console.error("Failed to save ole_permissions:", error);
      return NextResponse.json(
        { error: "Failed to save role permissions" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Permissions POST failed:", error);
    return NextResponse.json(
      { error: "Failed to save role permissions" },
      { status: 500 }
    );
  }
}
