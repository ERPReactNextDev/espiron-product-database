/**
 * GET  /api/email/accounts?user_id=...  → list all accounts for user
 * POST /api/email/accounts              → add new account (after autodiscover)
 * PATCH /api/email/accounts/:id         → update account
 * DELETE /api/email/accounts/:id        → delete account
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const { data, error } = await db
    .from("email_accounts")
    .select("id, display_name, email_address, provider, smtp_host, smtp_port, smtp_encryption, smtp_username, imap_host, imap_port, imap_encryption, imap_username, signature, is_default, created_at, updated_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, display_name, email_address, password, provider, smtp_host, smtp_port, smtp_encryption, smtp_username, imap_host, imap_port, imap_encryption, imap_username } = body;

    if (!user_id || !email_address || !password) {
      return NextResponse.json({ error: "user_id, email_address, password required" }, { status: 400 });
    }

    // If this is the first account, make it default
    const { count } = await db
      .from("email_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id);
    const is_default = (count ?? 0) === 0;

    const { data, error } = await db
      .from("email_accounts")
      .insert({
        user_id, display_name, email_address,
        password, // stored as-is — app can encrypt before sending if needed
        provider: provider || null,
        smtp_host: smtp_host || null, smtp_port: smtp_port || null,
        smtp_encryption: smtp_encryption || null, smtp_username: smtp_username || email_address,
        imap_host: imap_host || null, imap_port: imap_port || null,
        imap_encryption: imap_encryption || null, imap_username: imap_username || email_address,
        is_default,
      })
      .select("id, display_name, email_address, provider, smtp_host, smtp_port, smtp_encryption, smtp_username, imap_host, imap_port, imap_encryption, imap_username, signature, is_default, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, display_name, signature, password, is_default } = body;
    const url = new URL(req.url);
    const accountId = url.pathname.split("/").pop();

    if (!accountId || !user_id) {
      return NextResponse.json({ error: "accountId and user_id required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (signature !== undefined) updateData.signature = signature;
    if (password !== undefined) updateData.password = password;
    if (is_default !== undefined) {
      if (is_default) {
        // Set all others to false first
        await db
          .from("email_accounts")
          .update({ is_default: false })
          .eq("user_id", user_id);
      }
      updateData.is_default = is_default;
    }

    const { data, error } = await db
      .from("email_accounts")
      .update(updateData)
      .eq("id", accountId)
      .eq("user_id", user_id)
      .select("id, display_name, email_address, is_default")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id } = body;
    const url = new URL(req.url);
    const accountId = url.pathname.split("/").pop();

    if (!accountId || !user_id) {
      return NextResponse.json({ error: "accountId and user_id required" }, { status: 400 });
    }

    const { error } = await db
      .from("email_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
