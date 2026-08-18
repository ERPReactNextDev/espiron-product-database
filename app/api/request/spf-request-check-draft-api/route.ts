import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const spf_numbers = searchParams.get("spf_numbers");
    const spf_number  = searchParams.get("spf_number");

    if (spf_number) {
      const { data, error } = await supabase
        .from("spf_creation_draft")
        .select("spf_number, date_updated")
        .eq("spf_number", spf_number)
        .maybeSingle();

      if (error) {
        console.error("Draft check error:", error);
        return NextResponse.json({ message: "Failed to check draft", error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        hasDraft: !!data,
        spf_number,
        date_updated: data?.date_updated || null,
      });
    }

    if (spf_numbers) {
      const spfNumberList = spf_numbers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (spfNumberList.length === 0) {
        return NextResponse.json({ success: true, drafts: {} });
      }

      const { data, error } = await supabase
        .from("spf_creation_draft")
        .select("spf_number, date_updated")
        .in("spf_number", spfNumberList);

      if (error) {
        console.error("Draft batch check error:", error);
        return NextResponse.json({ message: "Failed to check drafts", error }, { status: 500 });
      }

      const draftMap: Record<string, { hasDraft: boolean; date_updated: string | null }> = {};
      spfNumberList.forEach((sn) => {
        draftMap[sn] = { hasDraft: false, date_updated: null };
      });
      data?.forEach((draft: any) => {
        if (draft.spf_number) {
          draftMap[draft.spf_number] = { hasDraft: true, date_updated: draft.date_updated || null };
        }
      });

      return NextResponse.json({ success: true, drafts: draftMap });
    }

    return NextResponse.json(
      { message: "Missing spf_number or spf_numbers parameter" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
