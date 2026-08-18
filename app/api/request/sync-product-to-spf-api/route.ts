import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPhilippinesISOString } from "@/lib/datetime";

const ROW_SEP = "|ROW|";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productReferenceID, technicalSpecifications } = body;

    if (!productReferenceID) {
      return NextResponse.json({ message: "Missing productReferenceID" }, { status: 400 });
    }
    if (!technicalSpecifications || !Array.isArray(technicalSpecifications)) {
      return NextResponse.json({ message: "Missing technicalSpecifications" }, { status: 400 });
    }

    const formatSpecs = (specs: any[]) => {
      if (!specs?.length) return "-";
      const grouped = specs
        .map((g: any) => {
          const title = (g.title || "").trim();
          const specLines = (g.specs || [])
            .filter((s: any) => s.value && s.value.trim() !== "")
            .map((s: any) => `${s.specId}: ${s.value.trim()}`)
            .join(";;");
          if (!specLines) return null;
          return title ? `${title}~~${specLines}` : specLines;
        })
        .filter(Boolean)
        .join("@@");
      return grouped || "-";
    };

    const formattedSpecs = formatSpecs(technicalSpecifications);

    const splitByRow = (val: string | null | undefined): string[][] => {
      if (!val) return [];
      return val.split(ROW_SEP).map((r) => r.split(",").map((s) => s.trim()));
    };

    const { data: spfRecords, error: fetchError } = await supabase
      .from("spf_creation")
      .select("id, spf_number, product_reference_id, original_technical_specification")
      .not("product_reference_id", "is", null);

    if (fetchError) {
      console.error("Error fetching SPF records:", fetchError);
      return NextResponse.json({ message: "Failed to fetch SPF records" }, { status: 500 });
    }

    const { data: historyRecords, error: historyFetchError } = await supabase
      .from("spf_creation_history")
      .select("id, spf_number, version_number, product_reference_id, original_technical_specification")
      .not("product_reference_id", "is", null);

    if (historyFetchError) {
      console.error("Error fetching history records:", historyFetchError);
    }

    const updatedSpfs: string[] = [];
    const updatedHistory: Array<{ spf_number: string; version: number }> = [];

    for (const spf of spfRecords || []) {
      const rowProductRefIDs = splitByRow(spf.product_reference_id);
      const rowOriginalSpecs = splitByRow(spf.original_technical_specification);
      let needsUpdate = false;
      const updatedOriginalSpecs: string[] = [];

      for (let rowIdx = 0; rowIdx < rowProductRefIDs.length; rowIdx++) {
        const productRefIDs = rowProductRefIDs[rowIdx] || [];
        const originalSpecs = rowOriginalSpecs[rowIdx] || [];
        const rowUpdatedSpecs: string[] = [];

        for (let optIdx = 0; optIdx < productRefIDs.length; optIdx++) {
          if (productRefIDs[optIdx] === productReferenceID) {
            rowUpdatedSpecs.push(formattedSpecs);
            needsUpdate = true;
          } else {
            rowUpdatedSpecs.push(originalSpecs[optIdx] || "-");
          }
        }
        updatedOriginalSpecs.push(rowUpdatedSpecs.join(","));
      }

      if (needsUpdate) {
        const newOriginalSpecs = updatedOriginalSpecs.join(ROW_SEP);
        const syncISO = getPhilippinesISOString();

        const { error: updateError } = await supabase
          .from("spf_creation")
          .update({ original_technical_specification: newOriginalSpecs, date_updated: syncISO })
          .eq("id", spf.id);

        if (!updateError) {
          await supabase
            .from("spf_request")
            .update({ date_updated: syncISO })
            .eq("spf_number", spf.spf_number);
          updatedSpfs.push(spf.spf_number);
        } else {
          console.error(`Error updating SPF ${spf.spf_number}:`, updateError);
        }
      }
    }

    for (const history of historyRecords || []) {
      const rowProductRefIDs = splitByRow(history.product_reference_id);
      const rowOriginalSpecs = splitByRow(history.original_technical_specification);
      let needsUpdate = false;
      const updatedOriginalSpecs: string[] = [];

      for (let rowIdx = 0; rowIdx < rowProductRefIDs.length; rowIdx++) {
        const productRefIDs = rowProductRefIDs[rowIdx] || [];
        const originalSpecs = rowOriginalSpecs[rowIdx] || [];
        const rowUpdatedSpecs: string[] = [];

        for (let optIdx = 0; optIdx < productRefIDs.length; optIdx++) {
          if (productRefIDs[optIdx] === productReferenceID) {
            rowUpdatedSpecs.push(formattedSpecs);
            needsUpdate = true;
          } else {
            rowUpdatedSpecs.push(originalSpecs[optIdx] || "-");
          }
        }
        updatedOriginalSpecs.push(rowUpdatedSpecs.join(","));
      }

      if (needsUpdate) {
        const newOriginalSpecs = updatedOriginalSpecs.join(ROW_SEP);
        const { error: updateError } = await supabase
          .from("spf_creation_history")
          .update({
            original_technical_specification: newOriginalSpecs,
            date_updated: getPhilippinesISOString(),
          })
          .eq("id", history.id);

        if (!updateError) {
          updatedHistory.push({ spf_number: history.spf_number, version: history.version_number });
        } else {
          console.error(`Error updating history ${history.spf_number} v${history.version_number}:`, updateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Product synced to SPF records",
      updatedSpfs,
      updatedHistory,
      updatedCount: updatedSpfs.length + updatedHistory.length,
    });
  } catch (err: any) {
    console.error("Sync error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
