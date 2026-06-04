"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ForPoolingButtonProps {
  show?: boolean;
  spfNumber?: string;
  onFinished?: () => void;
}

export function ForPoolingButton({ show = true, spfNumber, onFinished }: ForPoolingButtonProps) {
  if (!show) return null;
  const [isLoading, setIsLoading] = useState(false);

  const handleFinishPool = async () => {
    if (!spfNumber) {
      toast.error("Missing SPF number.");
      return;
    }

    const ok = window.confirm(`Mark ${spfNumber} as pool finished?`);
    if (!ok) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/request/spf-request-finish-pool-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spf_number: spfNumber }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Request failed");
      }

      toast.success("Removed from queue and updated all queue numbers.");
      onFinished?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to finish pooling.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size="icon"
      className="h-5 w-5 rounded-full bg-linear-to-br from-[#be2d2d] to-[#5f2828] hover:from-[#a32525] hover:to-[#4d2020] text-white shadow-md"
      onClick={handleFinishPool}
      disabled={isLoading}
    >
      <CheckCircle2 size={12} />
    </Button>
  );
}
