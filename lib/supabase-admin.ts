import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

// ✅ Supabase Admin Client (server-side only) - Lazy initialized
let supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("Supabase URL:", supabaseUrl ? "Set" : "Missing");
  console.log("Supabase Service Role Key:", supabaseServiceRoleKey ? "Set" : "Missing");

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Add it to .env.local"
    );
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

export { getSupabaseAdmin };

/**
 * Get a user by id (stored in Supabase users table)
 */
export async function getUserById(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", parseInt(userId))
    .single();

  if (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }

  return data;
}

/**
 * Get a user by Email
 */
export async function getUserByEmail(email: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("Email", email)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (not an error in our case)
      console.error("Error fetching user by email:", error);
    }

    return data || null;
  } catch (error) {
    console.error("getUserByEmail error:", error);
    return null;
  }
}

/**
 * Get a user by ReferenceID
 */
export async function getUserByReferenceID(referenceID: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("ReferenceID", referenceID)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching user by ReferenceID:", error);
  }

  return data || null;
}

/**
 * Get multiple users by array of IDs
 */
export async function getUsersByIds(userIds: string[]) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, UserId, Firstname, Lastname, userName, profilePicture, Department")
    .in("id", userIds.map(id => parseInt(id)));

  if (error) {
    console.error("Error fetching users by IDs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get Engineering & IT users with optional IT-only filtering
 */
export async function getEngineeringITUsers(viewerDepartment?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("users")
    .select("*")
    .order("Firstname", { ascending: true });

  // Build query filter
  if (viewerDepartment === "IT") {
    // IT viewers see all Engineering and IT users
    query = query.or("Department.eq.Engineering,Department.eq.IT");
  } else {
    // Non-IT viewers see Engineering non-managers + IT users
    query = supabase
      .from("users")
      .select("*")
      .or(
        "(Department.eq.Engineering AND Role.neq.Manager), Department.eq.IT"
      )
      .order("Firstname", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching Engineering/IT users:", error);
    return [];
  }

  return data || [];
}

/**
 * Update user (for login attempts, status changes, profile updates)
 */
export async function updateUser(userId: string, updates: Record<string, any>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", parseInt(userId))
    .select();

  if (error) {
    console.error("Error updating user:", error);
    return null;
  }

  return data?.[0] || null;
}

/**
 * Update user by Email (for login operations)
 */
export async function updateUserByEmail(email: string, updates: Record<string, any>) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .eq("Email", email)
    .select();

  if (error) {
    console.error("Error updating user by email:", error);
    return null;
  }

  return data?.[0] || null;
}

/**
 * Check if email already exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("Email", email)
    .single();

  return data ? true : false;
}

/**
 * Verify IT department access
 */
export async function verifyITAccess(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const user = await getUserById(userId);
  return user?.Department === "IT";
}

/**
 * Get users by department
 */
export async function getUsersByDepartment(department: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("Department", department);

  if (error) {
    console.error("Error fetching users by department:", error);
    return [];
  }

  return data || [];
}

/**
 * Validate user credentials for login
 */
export async function validateUser({
  Email,
  Password,
}: {
  Email: string;
  Password: string;
}) {
  try {
    console.log("Attempting to validate user:", Email);
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("Email", Email)
      .single();

    if (error || !user) {
      console.error("User lookup error:", error);
      return { success: false, message: "Invalid email or password" };
    }

    console.log("User found:", user.Email, "Department:", user.Department, "Status:", user.Status);

    // Check if Password field exists
    if (!user.Password) {
      console.error("Password field missing for user:", Email);
      return { success: false, message: "Invalid email or password" };
    }

    console.log("Password hash exists, comparing passwords...");
    // Validate password using bcrypt
    const isValidPassword = await bcrypt.compare(Password, user.Password);
    console.log("Password comparison result:", isValidPassword);

    if (!isValidPassword) {
      return { success: false, message: "Invalid email or password" };
    }

    return { success: true, user };
  } catch (error) {
    console.error("validateUser error:", error);
    return { success: false, message: "Invalid email or password" };
  }
}
