import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";

type QueueRow = {
  spf_number: string | null;
  for_pool_date: string | null;
};

function formatShanghaiTime(dateIso?: string | null) {
  const date = dateIso ? new Date(dateIso) : new Date();
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

async function appendSystemMessage(
  spfNumber: string,
  message: string,
  extra?: Record<string, unknown>
) {
  const docRef = doc(dbCollab, "spf_creations", spfNumber);
  const payload = {
    id: `sys-${Date.now()}`,
    text: message,
    senderId: "system",
    senderName: "System",
    role: "system",
    time: new Date().toISOString(),
    isSystem: true,
    seenBy: [],
    ...(extra || {}),
  };

  try {
    await updateDoc(docRef, { messages: arrayUnion(payload) });
  } catch (docError: any) {
    if (docError?.code === "not-found") {
      await setDoc(docRef, {
        messages: [payload],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    throw docError;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const spf_number: string | undefined =
      typeof body?.spf_number === "string" ? body.spf_number.trim() : undefined;

    if (!spf_number) {
      return NextResponse.json({ error: "spf_number is required" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("spf_request")
      .update({ is_pool_finished: true, date_updated: new Date().toISOString() })
      .eq("spf_number", spf_number);

    if (updateError) throw updateError;

    await appendSystemMessage(spf_number, "PROJECT STATUS: SPF SEND BY PD", {
      systemType: "pd_sent",
    });

    const { data: queueData, error: queueError } = await supabase
      .from("spf_request")
      .select("spf_number, for_pool_date")
      .eq("is_pool_finished", false)
      .not("for_pool_date", "is", null)
      .order("for_pool_date", { ascending: true });

    if (queueError) throw queueError;

    const queue = (queueData || []) as QueueRow[];
    const updates = queue
      .map((row, index) => {
        const spfNum = row.spf_number?.trim();
        if (!spfNum) return null;
        const queueNumber = index + 1;
        const shanghaiTime = formatShanghaiTime(row.for_pool_date);
        const systemMessage = `PROJECT STATUS: YOUR SPF PROJECT HAS BEEN SENT TO Product Development (PD) Department. Pool Date: ${shanghaiTime} (Asia/Shanghai). You are currently on queue number [${queueNumber}].`;
        return appendSystemMessage(spfNum, systemMessage);
      })
      .filter(Boolean) as Promise<void>[];

    await Promise.all(updates);

    return NextResponse.json({
      success: true,
      finishedSpfNumber: spf_number,
      totalInQueue: queue.length,
      updatedChats: updates.length,
    });
  } catch (err: any) {
    console.error("Finish pool error:", err);
    return NextResponse.json({ error: err?.message || "Failed to finish pool" }, { status: 500 });
  }
}
